import express from "express";
import { createServer as createHttpServer } from "http";
import { createServer as createHttpsServer } from "https";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRoom, getRoom, getRoomBySocket, deleteRoom } from "./rooms.js";
import { createInitialState, applyMove } from "./klotski.js";
import type { Direction } from "./klotski.js";
import { createBowmanState, processShot, MAX_SHOTS } from "./bowman.js";
import {
    CODEBREAKER_CODE_LENGTH,
    CODEBREAKER_MAX_GUESSES,
    CODEBREAKER_PALETTE,
    createCodebreakerState,
    processCodebreakerGuess,
} from "./codebreaker.js";
import { createLightsOutState, applyLightsOutMove } from "./lightsout.js";
import {
    MEMORY_SEQUENCE_PLUS_GRID_SIZE,
    MEMORY_SEQUENCE_PLUS_MAX_ROUNDS,
    createMemorySequencePlusState,
    submitMemorySequencePlusRound,
} from "./memorysequenceplus.js";
import {
    PIPE_CONNECT_PUZZLE_COUNT,
    applyPipeConnectRotate,
    createPipeConnectState,
    toPublicPipeConnectTiles,
} from "./pipeconnect.js";
import { createRushHourState, applyRushHourMove } from "./rushhour.js";
import {
    SIMON_COPY_COLORS,
    SIMON_COPY_MAX_ROUNDS,
    createSimonCopyState,
    submitSimonCopyRound,
} from "./simoncopy.js";
import type { GameType } from "./types.js";
import type { MatchStanding, Room } from "./types.js";

const AVAILABLE_GAME_TYPES: GameType[] = [
    "klotski",
    "bowman",
    "codebreaker",
    "pipeconnect",
    "simoncopy",
    "memorysequenceplus",
    "rushhour",
    "lightsout",
];

const DEFAULT_MATCH_ROUNDS = 5;
const MIN_MATCH_ROUNDS = 1;
const MAX_MATCH_ROUNDS = 12;

const __dirname = dirname(fileURLToPath(import.meta.url));
const useLocalHttps = process.env.LOCAL_HTTPS === "true";

async function createAppServer(app: express.Express) {
    if (!useLocalHttps) {
        return createHttpServer(app);
    }

    const { default: selfsigned } = await import("selfsigned");
    const certificate = selfsigned.generate(
        [{ name: "commonName", value: "localhost" }],
        {
            algorithm: "sha256",
            days: 365,
            keySize: 2048,
            extensions: [
                {
                    name: "subjectAltName",
                    altNames: [
                        { type: 2, value: "localhost" },
                        { type: 7, ip: "127.0.0.1" },
                        { type: 7, ip: "::1" },
                    ],
                },
            ],
        },
    );

    return createHttpsServer(
        {
            key: certificate.private,
            cert: certificate.cert,
        },
        app,
    );
}

const app = express();
const httpServer = await createAppServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*" },
});

function sanitizeTotalRounds(value: number | undefined): number {
    if (!Number.isFinite(value)) return DEFAULT_MATCH_ROUNDS;
    return Math.min(
        MAX_MATCH_ROUNDS,
        Math.max(MIN_MATCH_ROUNDS, Math.round(value ?? DEFAULT_MATCH_ROUNDS)),
    );
}

function shuffleGameTypes(): GameType[] {
    const pool = [...AVAILABLE_GAME_TYPES];
    for (let index = pool.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
    }
    return pool;
}

function createRoundSequence(totalRounds: number): GameType[] {
    const sequence: GameType[] = [];

    while (sequence.length < totalRounds) {
        let bag = shuffleGameTypes();

        if (sequence.length > 0) {
            let attempts = 0;
            while (bag[0] === sequence.at(-1) && attempts < 5) {
                bag = shuffleGameTypes();
                attempts += 1;
            }
        }

        for (const gameType of bag) {
            if (sequence.length >= totalRounds) break;
            if (sequence.at(-1) === gameType) continue;
            sequence.push(gameType);
        }
    }

    return sequence;
}

function emitRoomSettings(room: Room) {
    io.to(room.code).emit("room:settings", {
        totalRounds: room.totalRounds,
        currentRound: room.currentRound,
    });
}

function clearRoundState(room: Room) {
    room.gameStartTime = null;
    room.finishOrder = [];
    for (const player of room.players.values()) {
        player.puzzleState = null;
        player.bowmanState = null;
        player.rushHourState = null;
        player.lightsOutState = null;
        player.codebreakerState = null;
        player.pipeConnectState = null;
        player.simonCopyState = null;
        player.memorySequencePlusState = null;
        player.rank = null;
    }
}

function buildStandings(
    room: Room,
    lastRoundPoints: Map<string, number>,
): MatchStanding[] {
    const sortedPlayers = [...room.players.values()].sort((left, right) => {
        if (right.matchPoints !== left.matchPoints) {
            return right.matchPoints - left.matchPoints;
        }
        if (right.roundsWon !== left.roundsWon) {
            return right.roundsWon - left.roundsWon;
        }
        return left.name.localeCompare(right.name);
    });

    return sortedPlayers.map((player, index) => ({
        id: player.id,
        name: player.name,
        position: index + 1,
        totalPoints: player.matchPoints,
        roundsWon: player.roundsWon,
        lastRoundPoints: lastRoundPoints.get(player.id) ?? 0,
    }));
}

function startRound(room: Room) {
    if (room.currentRound >= room.totalRounds) return;

    clearRoundState(room);
    room.phase = "playing";
    room.gameStartTime = Date.now();
    room.gameType = room.roundSequence[room.currentRound] ?? "klotski";
    room.currentRound += 1;

    if (room.gameType === "klotski") {
        for (const player of room.players.values()) {
            player.puzzleState = createInitialState();
        }
        const initialState = createInitialState();
        io.to(room.code).emit("game:started", {
            gameType: "klotski",
            board: initialState.board,
            pieces: initialState.pieces,
            roundNumber: room.currentRound,
            totalRounds: room.totalRounds,
        });
    } else if (room.gameType === "bowman") {
        const sharedWind = 0;
        for (const player of room.players.values()) {
            player.bowmanState = createBowmanState(sharedWind);
        }
        io.to(room.code).emit("game:started", {
            gameType: "bowman",
            wind: sharedWind,
            roundNumber: room.currentRound,
            totalRounds: room.totalRounds,
        });
    } else if (room.gameType === "rushhour") {
        const puzzleIndex = Math.floor(Math.random() * 3);
        for (const player of room.players.values()) {
            player.rushHourState = createRushHourState(puzzleIndex);
        }
        const sample = createRushHourState(puzzleIndex);
        io.to(room.code).emit("game:started", {
            gameType: "rushhour",
            vehicles: sample.vehicles,
            puzzleIndex,
            roundNumber: room.currentRound,
            totalRounds: room.totalRounds,
        });
    } else if (room.gameType === "lightsout") {
        const initialState = createLightsOutState();
        for (const player of room.players.values()) {
            player.lightsOutState = createLightsOutState(initialState.board);
        }
        io.to(room.code).emit("game:started", {
            gameType: "lightsout",
            board: initialState.board,
            roundNumber: room.currentRound,
            totalRounds: room.totalRounds,
        });
    } else if (room.gameType === "codebreaker") {
        const initialState = createCodebreakerState();
        for (const player of room.players.values()) {
            player.codebreakerState = createCodebreakerState(
                initialState.secret,
            );
        }
        io.to(room.code).emit("game:started", {
            gameType: "codebreaker",
            palette: [...CODEBREAKER_PALETTE],
            codeLength: CODEBREAKER_CODE_LENGTH,
            maxGuesses: CODEBREAKER_MAX_GUESSES,
            roundNumber: room.currentRound,
            totalRounds: room.totalRounds,
        });
    } else if (room.gameType === "pipeconnect") {
        const puzzleIndex = Math.floor(
            Math.random() * PIPE_CONNECT_PUZZLE_COUNT(),
        );
        const initialState = createPipeConnectState(puzzleIndex);
        for (const player of room.players.values()) {
            player.pipeConnectState = createPipeConnectState(
                initialState.puzzleIndex,
                initialState.tiles,
            );
        }
        io.to(room.code).emit("game:started", {
            gameType: "pipeconnect",
            tiles: toPublicPipeConnectTiles(initialState.tiles),
            roundNumber: room.currentRound,
            totalRounds: room.totalRounds,
        });
    } else if (room.gameType === "simoncopy") {
        const initialState = createSimonCopyState();
        for (const player of room.players.values()) {
            player.simonCopyState = createSimonCopyState(initialState.sequence);
        }
        io.to(room.code).emit("game:started", {
            gameType: "simoncopy",
            sequence: initialState.sequence,
            maxRounds: SIMON_COPY_MAX_ROUNDS,
            colors: [...SIMON_COPY_COLORS],
            roundNumber: room.currentRound,
            totalRounds: room.totalRounds,
        });
    } else if (room.gameType === "memorysequenceplus") {
        const initialState = createMemorySequencePlusState();
        for (const player of room.players.values()) {
            player.memorySequencePlusState = createMemorySequencePlusState(
                initialState.sequence,
            );
        }
        io.to(room.code).emit("game:started", {
            gameType: "memorysequenceplus",
            sequence: initialState.sequence,
            maxRounds: MEMORY_SEQUENCE_PLUS_MAX_ROUNDS,
            gridSize: MEMORY_SEQUENCE_PLUS_GRID_SIZE,
            roundNumber: room.currentRound,
            totalRounds: room.totalRounds,
        });
    }

    emitRoomSettings(room);
    console.log(
        `[host:start] room ${room.code} round ${room.currentRound}/${room.totalRounds} (${room.gameType})`,
    );
}

// Serve the React build in production
const buildPath = join(__dirname, "../../quickdraw-web/dist");
app.use(express.static(buildPath));
app.get("*", (_req, res) => {
    res.sendFile(join(buildPath, "index.html"));
});

io.on("connection", (socket) => {
    console.log(`[connect] ${socket.id}`);

    // ── Host creates a room ─────────────────────────────────────────
    socket.on("host:create", () => {
        const room = createRoom(socket.id);
        socket.join(room.code);
        socket.emit("room:created", { roomCode: room.code });
        socket.emit("room:settings", {
            totalRounds: room.totalRounds,
            currentRound: room.currentRound,
        });
        console.log(`[host:create] room ${room.code}`);
    });

    socket.on(
        "host:setTotalRounds",
        ({ totalRounds }: { totalRounds: number }) => {
            const room = getRoomBySocket(socket.id);
            if (!room || room.hostSocketId !== socket.id) return;
            if (room.phase !== "lobby") return;

            room.totalRounds = sanitizeTotalRounds(totalRounds);
            room.roundSequence = [];
            emitRoomSettings(room);
            console.log(
                `[host:setTotalRounds] room ${room.code} → ${room.totalRounds}`,
            );
        },
    );

    // ── Host selects game type ───────────────────────────────────────
    socket.on("host:setGameType", ({ gameType }: { gameType: GameType }) => {
        const room = getRoomBySocket(socket.id);
        if (!room || room.hostSocketId !== socket.id) return;
        if (room.phase !== "lobby") return;
        if (
            gameType !== "klotski" &&
            gameType !== "bowman" &&
            gameType !== "rushhour" &&
            gameType !== "lightsout" &&
            gameType !== "codebreaker" &&
            gameType !== "pipeconnect" &&
            gameType !== "simoncopy" &&
            gameType !== "memorysequenceplus"
        )
            return;
        room.gameType = gameType;
        io.to(room.code).emit("room:gameType", { gameType });
        console.log(`[host:setGameType] room ${room.code} → ${gameType}`);
    });

    // ── Player joins a room ─────────────────────────────────────────
    socket.on(
        "player:join",
        ({
            roomCode,
            playerName,
        }: {
            roomCode: string;
            playerName: string;
        }) => {
            const code = roomCode.toUpperCase().trim();
            const room = getRoom(code);

            if (!room) {
                socket.emit("error", { message: "Room not found." });
                return;
            }
            if (room.phase !== "lobby") {
                socket.emit("error", { message: "Game already in progress." });
                return;
            }
            if (!playerName?.trim()) {
                socket.emit("error", { message: "Name required." });
                return;
            }

            const player = {
                id: socket.id,
                name: playerName.trim().slice(0, 16),
                puzzleState: null,
                bowmanState: null,
                rushHourState: null,
                lightsOutState: null,
                codebreakerState: null,
                pipeConnectState: null,
                simonCopyState: null,
                memorySequencePlusState: null,
                rank: null,
                matchPoints: 0,
                roundsWon: 0,
            };
            room.players.set(socket.id, player);
            socket.join(code);

            const players = [...room.players.values()].map(
                ({ id, name, rank }) => ({ id, name, rank }),
            );
            io.to(code).emit("room:updated", { players });
            socket.emit("room:settings", {
                totalRounds: room.totalRounds,
                currentRound: room.currentRound,
            });
            // Also tell the joining player the current game type
            socket.emit("room:gameType", { gameType: room.gameType });
            console.log(`[player:join] ${player.name} → ${code}`);
        },
    );

    // ── Host starts the game ────────────────────────────────────────
    socket.on("host:start", () => {
        const room = getRoomBySocket(socket.id);
        if (!room || room.hostSocketId !== socket.id) return;
        if (room.phase !== "lobby") return;

        room.totalRounds = sanitizeTotalRounds(room.totalRounds);
        room.currentRound = 0;
        room.roundSequence = createRoundSequence(room.totalRounds);
        for (const player of room.players.values()) {
            player.matchPoints = 0;
            player.roundsWon = 0;
        }

        startRound(room);
    });

    // ── Player submits a Klotski move ───────────────────────────────
    socket.on(
        "player:move",
        ({ pieceId, direction }: { pieceId: string; direction: Direction }) => {
            const room = getRoomBySocket(socket.id);
            if (
                !room ||
                room.phase !== "playing" ||
                room.gameType !== "klotski"
            )
                return;

            const player = room.players.get(socket.id);
            if (!player?.puzzleState || player.puzzleState.solved) return;

            const { ok, state } = applyMove(
                player.puzzleState,
                pieceId,
                direction,
            );
            if (!ok) return;

            player.puzzleState = state;

            socket.emit("state:update", {
                board: state.board,
                pieces: state.pieces,
                moves: state.moves,
                solved: state.solved,
            });

            let rank: number | null = null;
            if (state.solved) {
                if (!room.finishOrder.includes(socket.id))
                    room.finishOrder.push(socket.id);
                rank = room.finishOrder.indexOf(socket.id) + 1;
                player.rank = rank;
                socket.emit("puzzle:solved", {
                    rank,
                    moves: state.moves,
                    solveTime: state.solveTime,
                });
            }

            io.to(room.hostSocketId).emit("player:progress", {
                playerId: socket.id,
                board: state.board,
                pieces: state.pieces,
                moves: state.moves,
                solved: state.solved,
                rank,
                solveTime: state.solveTime,
            });

            const allSolved = [...room.players.values()].every(
                (p) => p.puzzleState?.solved,
            );
            if (allSolved) endGame(room.code);
        },
    );

    // ── Player fires an arrow (Bowman) ──────────────────────────────
    socket.on(
        "bowman:shot",
        ({ angle, power }: { angle: number; power: number }) => {
            const room = getRoomBySocket(socket.id);
            if (!room || room.phase !== "playing" || room.gameType !== "bowman")
                return;

            const player = room.players.get(socket.id);
            if (!player?.bowmanState || player.bowmanState.done) return;

            const { ok, state, result } = processShot(
                player.bowmanState,
                angle,
                power,
            );
            if (!ok || !result) return;

            player.bowmanState = state;

            socket.emit("bowman:result", {
                result,
                totalScore: state.totalScore,
                shotsLeft: MAX_SHOTS - state.shots.length,
                done: state.done,
            });

            io.to(room.hostSocketId).emit("bowman:progress", {
                playerId: socket.id,
                shots: state.shots,
                totalScore: state.totalScore,
                done: state.done,
                finishTime: state.finishTime,
                wind: state.wind,
            });

            if (state.done && !room.finishOrder.includes(socket.id)) {
                room.finishOrder.push(socket.id);
                player.rank = room.finishOrder.indexOf(socket.id) + 1;
            }

            const allDone = [...room.players.values()].every(
                (p) => p.bowmanState?.done,
            );
            if (allDone) endGame(room.code);
        },
    );

    // ── Player moves a Rush Hour vehicle ───────────────────────────
    socket.on(
        "rushhour:move",
        ({ vehicleId, delta }: { vehicleId: string; delta: number }) => {
            const room = getRoomBySocket(socket.id);
            if (
                !room ||
                room.phase !== "playing" ||
                room.gameType !== "rushhour"
            )
                return;

            const player = room.players.get(socket.id);
            if (!player?.rushHourState || player.rushHourState.solved) return;

            const { ok, state } = applyRushHourMove(
                player.rushHourState,
                vehicleId,
                delta,
            );
            if (!ok) return;

            player.rushHourState = state;

            socket.emit("rushhour:update", {
                vehicles: state.vehicles,
                moves: state.moves,
                solved: state.solved,
            });

            let rank: number | null = null;
            if (state.solved) {
                if (!room.finishOrder.includes(socket.id))
                    room.finishOrder.push(socket.id);
                rank = room.finishOrder.indexOf(socket.id) + 1;
                player.rank = rank;
                socket.emit("rushhour:solved", {
                    rank,
                    moves: state.moves,
                    finishTime: state.finishTime,
                });
            }

            io.to(room.hostSocketId).emit("rushhour:progress", {
                playerId: socket.id,
                vehicles: state.vehicles,
                moves: state.moves,
                solved: state.solved,
                rank,
                finishTime: state.finishTime,
            });

            const allSolved = [...room.players.values()].every(
                (p) => p.rushHourState?.solved,
            );
            if (allSolved) endGame(room.code);
        },
    );

    // ── Player toggles a Lights Out cell ──────────────────────────
    socket.on(
        "lightsout:move",
        ({ row, col }: { row: number; col: number }) => {
            const room = getRoomBySocket(socket.id);
            if (
                !room ||
                room.phase !== "playing" ||
                room.gameType !== "lightsout"
            )
                return;

            const player = room.players.get(socket.id);
            if (!player?.lightsOutState || player.lightsOutState.solved) return;

            const { ok, state } = applyLightsOutMove(
                player.lightsOutState,
                row,
                col,
            );
            if (!ok) return;

            player.lightsOutState = state;

            socket.emit("lightsout:update", {
                board: state.board,
                moves: state.moves,
                solved: state.solved,
            });

            let rank: number | null = null;
            if (state.solved) {
                if (!room.finishOrder.includes(socket.id))
                    room.finishOrder.push(socket.id);
                rank = room.finishOrder.indexOf(socket.id) + 1;
                player.rank = rank;
                socket.emit("lightsout:solved", {
                    rank,
                    moves: state.moves,
                    finishTime: state.finishTime,
                });
            }

            io.to(room.hostSocketId).emit("lightsout:progress", {
                playerId: socket.id,
                board: state.board,
                moves: state.moves,
                solved: state.solved,
                rank,
                finishTime: state.finishTime,
            });

            const allSolved = [...room.players.values()].every(
                (p) => p.lightsOutState?.solved,
            );
            if (allSolved) endGame(room.code);
        },
    );

    // ── Player submits a Codebreaker guess ───────────────────────
    socket.on("codebreaker:guess", ({ guess }: { guess: string[] }) => {
        const room = getRoomBySocket(socket.id);
        if (
            !room ||
            room.phase !== "playing" ||
            room.gameType !== "codebreaker"
        )
            return;

        const player = room.players.get(socket.id);
        if (!player?.codebreakerState || player.codebreakerState.done) return;

        const { ok, state } = processCodebreakerGuess(
            player.codebreakerState,
            guess,
        );
        if (!ok) return;

        player.codebreakerState = state;

        socket.emit("codebreaker:update", {
            guesses: state.guesses,
            solved: state.solved,
            done: state.done,
            finishTime: state.finishTime,
        });

        if (state.solved) {
            socket.emit("codebreaker:solved", {
                attempts: state.guesses.length,
                finishTime: state.finishTime,
            });
        }

        io.to(room.hostSocketId).emit("codebreaker:progress", {
            playerId: socket.id,
            attempts: state.guesses.length,
            solved: state.solved,
            done: state.done,
            finishTime: state.finishTime,
            lastGuess: state.guesses.at(-1) ?? null,
        });

        const allDone = [...room.players.values()].every(
            (p) => p.codebreakerState?.done,
        );
        if (allDone) endGame(room.code);
    });

    // ── Player rotates a Pipe Connect tile ───────────────────────
    socket.on("pipeconnect:rotate", ({ tileId }: { tileId: string }) => {
        const room = getRoomBySocket(socket.id);
        if (
            !room ||
            room.phase !== "playing" ||
            room.gameType !== "pipeconnect"
        )
            return;

        const player = room.players.get(socket.id);
        if (!player?.pipeConnectState || player.pipeConnectState.solved) return;

        const { ok, state } = applyPipeConnectRotate(
            player.pipeConnectState,
            tileId,
        );
        if (!ok) return;

        player.pipeConnectState = state;

        socket.emit("pipeconnect:update", {
            tiles: toPublicPipeConnectTiles(state.tiles),
            moves: state.moves,
            solved: state.solved,
        });

        let rank: number | null = null;
        if (state.solved) {
            if (!room.finishOrder.includes(socket.id)) {
                room.finishOrder.push(socket.id);
            }
            rank = room.finishOrder.indexOf(socket.id) + 1;
            player.rank = rank;
            socket.emit("pipeconnect:solved", {
                rank,
                moves: state.moves,
                finishTime: state.finishTime,
            });
        }

        io.to(room.hostSocketId).emit("pipeconnect:progress", {
            playerId: socket.id,
            tiles: toPublicPipeConnectTiles(state.tiles),
            moves: state.moves,
            solved: state.solved,
            rank,
            finishTime: state.finishTime,
        });

        const allSolved = [...room.players.values()].every(
            (p) => p.pipeConnectState?.solved,
        );
        if (allSolved) endGame(room.code);
    });

    // ── Player submits a Simon Copy round ───────────────────────
    socket.on("simoncopy:submit", ({ inputs }: { inputs: string[] }) => {
        const room = getRoomBySocket(socket.id);
        if (!room || room.phase !== "playing" || room.gameType !== "simoncopy")
            return;

        const player = room.players.get(socket.id);
        if (!player?.simonCopyState || player.simonCopyState.done) return;

        const latestColor = inputs.at(-1) ?? null;
        const { ok, state } = submitSimonCopyRound(
            player.simonCopyState,
            inputs,
        );
        if (!ok) return;

        player.simonCopyState = state;

        socket.emit("simoncopy:update", {
            currentRound: state.currentRound,
            solved: state.solved,
            done: state.done,
            failed: state.failed,
            finishTime: state.finishTime,
        });

        let rank: number | null = null;
        if (state.solved) {
            if (!room.finishOrder.includes(socket.id)) {
                room.finishOrder.push(socket.id);
            }
            rank = room.finishOrder.indexOf(socket.id) + 1;
            player.rank = rank;
            socket.emit("simoncopy:solved", {
                rank,
                roundReached: state.currentRound,
                finishTime: state.finishTime,
            });
        }

        io.to(room.hostSocketId).emit("simoncopy:progress", {
            playerId: socket.id,
            currentRound: state.currentRound,
            solved: state.solved,
            done: state.done,
            failed: state.failed,
            finishTime: state.finishTime,
            latestColor,
        });

        const allDone = [...room.players.values()].every(
            (p) => p.simonCopyState?.done,
        );
        if (allDone) endGame(room.code);
    });

    // ── Player submits a Memory Sequence Plus round ──────────────
    socket.on(
        "memorysequenceplus:submit",
        ({ inputs }: { inputs: number[] }) => {
            const room = getRoomBySocket(socket.id);
            if (
                !room ||
                room.phase !== "playing" ||
                room.gameType !== "memorysequenceplus"
            )
                return;

            const player = room.players.get(socket.id);
            if (
                !player?.memorySequencePlusState ||
                player.memorySequencePlusState.done
            )
                return;

            const latestCell = inputs.at(-1) ?? null;
            const { ok, state } = submitMemorySequencePlusRound(
                player.memorySequencePlusState,
                inputs,
            );
            if (!ok) return;

            player.memorySequencePlusState = state;

            socket.emit("memorysequenceplus:update", {
                currentRound: state.currentRound,
                solved: state.solved,
                done: state.done,
                failed: state.failed,
                finishTime: state.finishTime,
            });

            let rank: number | null = null;
            if (state.solved) {
                if (!room.finishOrder.includes(socket.id)) {
                    room.finishOrder.push(socket.id);
                }
                rank = room.finishOrder.indexOf(socket.id) + 1;
                player.rank = rank;
                socket.emit("memorysequenceplus:solved", {
                    rank,
                    roundReached: state.currentRound,
                    finishTime: state.finishTime,
                });
            }

            io.to(room.hostSocketId).emit("memorysequenceplus:progress", {
                playerId: socket.id,
                currentRound: state.currentRound,
                solved: state.solved,
                done: state.done,
                failed: state.failed,
                finishTime: state.finishTime,
                latestCell,
            });

            const allDone = [...room.players.values()].every(
                (p) => p.memorySequencePlusState?.done,
            );
            if (allDone) endGame(room.code);
        },
    );

    // ── Host ends the round early ───────────────────────────────────
    socket.on("host:end", () => {
        const room = getRoomBySocket(socket.id);
        if (!room || room.hostSocketId !== socket.id) return;
        if (room.phase !== "playing") return;
        endGame(room.code);
    });

    socket.on("host:nextRound", () => {
        const room = getRoomBySocket(socket.id);
        if (!room || room.hostSocketId !== socket.id) return;
        if (room.phase !== "results") return;
        if (room.currentRound >= room.totalRounds) return;

        startRound(room);
    });

    // ── Host resets the room ────────────────────────────────────────
    socket.on("host:reset", () => {
        const room = getRoomBySocket(socket.id);
        if (!room || room.hostSocketId !== socket.id) return;

        room.phase = "lobby";
        room.currentRound = 0;
        room.roundSequence = [];
        clearRoundState(room);
        emitRoomSettings(room);
        for (const player of room.players.values()) {
            player.matchPoints = 0;
            player.roundsWon = 0;
        }

        io.to(room.code).emit("game:reset");
        const players = [...room.players.values()].map(
            ({ id, name, rank }) => ({ id, name, rank }),
        );
        io.to(room.code).emit("room:updated", { players });
        console.log(`[host:reset] room ${room.code}`);
    });

    // ── Disconnect ──────────────────────────────────────────────────
    socket.on("disconnect", () => {
        console.log(`[disconnect] ${socket.id}`);
        const room = getRoomBySocket(socket.id);
        if (!room) return;

        if (room.hostSocketId === socket.id) {
            io.to(room.code).emit("error", { message: "Host disconnected." });
            deleteRoom(room.code);
        } else {
            room.players.delete(socket.id);
            const players = [...room.players.values()].map(
                ({ id, name, rank }) => ({ id, name, rank }),
            );
            io.to(room.code).emit("room:updated", { players });
        }
    });
});

function endGame(roomCode: string) {
    const room = getRoom(roomCode);
    if (!room) return;
    if (room.phase !== "playing") return;
    room.phase = "results";

    let results: object[];

    if (room.gameType === "bowman") {
        results = [...room.players.values()]
            .map((player) => ({
                id: player.id,
                name: player.name,
                totalScore: player.bowmanState?.totalScore ?? 0,
                finishTime: player.bowmanState?.finishTime ?? null,
                shots: player.bowmanState?.shots ?? [],
                rank: null as number | null,
            }))
            .sort((a, b) => {
                if (b.totalScore !== a.totalScore)
                    return b.totalScore - a.totalScore;
                if (a.finishTime !== null && b.finishTime !== null)
                    return a.finishTime - b.finishTime;
                if (a.finishTime !== null) return -1;
                if (b.finishTime !== null) return 1;
                return 0;
            })
            .map((r, i) => ({ ...r, rank: i + 1 }));
    } else if (room.gameType === "rushhour") {
        results = [...room.players.values()]
            .map((player) => ({
                id: player.id,
                name: player.name,
                rank: player.rank,
                moves: player.rushHourState?.moves ?? null,
                finishTime: player.rushHourState?.finishTime ?? null,
            }))
            .sort((a, b) => {
                if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
                if (a.rank !== null) return -1;
                if (b.rank !== null) return 1;
                return 0;
            });
    } else if (room.gameType === "lightsout") {
        results = [...room.players.values()]
            .map((player) => ({
                id: player.id,
                name: player.name,
                rank: player.rank,
                moves: player.lightsOutState?.moves ?? null,
                finishTime: player.lightsOutState?.finishTime ?? null,
            }))
            .sort((a, b) => {
                if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
                if (a.rank !== null) return -1;
                if (b.rank !== null) return 1;
                return 0;
            });
    } else if (room.gameType === "codebreaker") {
        const ranked = [...room.players.values()]
            .map((player) => ({
                id: player.id,
                name: player.name,
                attempts: player.codebreakerState?.guesses.length ?? 0,
                finishTime: player.codebreakerState?.finishTime ?? null,
                solved: player.codebreakerState?.solved ?? false,
            }))
            .sort((a, b) => {
                if (a.solved !== b.solved) return a.solved ? -1 : 1;
                if (a.solved && b.solved) {
                    if (a.attempts !== b.attempts)
                        return a.attempts - b.attempts;
                    if (a.finishTime !== null && b.finishTime !== null) {
                        return a.finishTime - b.finishTime;
                    }
                    if (a.finishTime !== null) return -1;
                    if (b.finishTime !== null) return 1;
                }
                return a.attempts - b.attempts;
            });

        let nextRank = 1;
        results = ranked.map((entry) => ({
            ...entry,
            rank: entry.solved ? nextRank++ : null,
        }));
    } else if (room.gameType === "pipeconnect") {
        results = [...room.players.values()]
            .map((player) => ({
                id: player.id,
                name: player.name,
                rank: player.rank,
                moves: player.pipeConnectState?.moves ?? null,
                finishTime: player.pipeConnectState?.finishTime ?? null,
            }))
            .sort((a, b) => {
                if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
                if (a.rank !== null) return -1;
                if (b.rank !== null) return 1;
                return 0;
            });
    } else if (room.gameType === "simoncopy") {
        const ranked = [...room.players.values()]
            .map((player) => ({
                id: player.id,
                name: player.name,
                roundReached: player.simonCopyState?.currentRound ?? 1,
                finishTime: player.simonCopyState?.finishTime ?? null,
                solved: player.simonCopyState?.solved ?? false,
                failed: player.simonCopyState?.failed ?? false,
            }))
            .sort((a, b) => {
                if (a.solved !== b.solved) return a.solved ? -1 : 1;
                if (a.solved && b.solved) {
                    if (a.finishTime !== null && b.finishTime !== null) {
                        return a.finishTime - b.finishTime;
                    }
                    if (a.finishTime !== null) return -1;
                    if (b.finishTime !== null) return 1;
                }
                return b.roundReached - a.roundReached;
            });

        let nextRank = 1;
        results = ranked.map((entry) => ({
            ...entry,
            rank: entry.solved ? nextRank++ : null,
        }));
    } else if (room.gameType === "memorysequenceplus") {
        const ranked = [...room.players.values()]
            .map((player) => ({
                id: player.id,
                name: player.name,
                roundReached: player.memorySequencePlusState?.currentRound ?? 1,
                finishTime: player.memorySequencePlusState?.finishTime ?? null,
                solved: player.memorySequencePlusState?.solved ?? false,
                failed: player.memorySequencePlusState?.failed ?? false,
            }))
            .sort((a, b) => {
                if (a.solved !== b.solved) return a.solved ? -1 : 1;
                if (a.solved && b.solved) {
                    if (a.finishTime !== null && b.finishTime !== null) {
                        return a.finishTime - b.finishTime;
                    }
                    if (a.finishTime !== null) return -1;
                    if (b.finishTime !== null) return 1;
                }
                return b.roundReached - a.roundReached;
            });

        let nextRank = 1;
        results = ranked.map((entry) => ({
            ...entry,
            rank: entry.solved ? nextRank++ : null,
        }));
    } else {
        results = [...room.players.values()]
            .map((player) => ({
                id: player.id,
                name: player.name,
                rank: player.rank,
                moves: player.puzzleState?.moves ?? null,
                solveTime: player.puzzleState?.solveTime ?? null,
            }))
            .sort((a, b) => {
                if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
                if (a.rank !== null) return -1;
                if (b.rank !== null) return 1;
                return 0;
            });
    }

    const lastRoundPoints = new Map<string, number>();
    const playerCount = room.players.size;

    for (const entry of results as Array<{
        id: string;
        rank?: number | null;
    }>) {
        const player = room.players.get(entry.id);
        if (!player) continue;

        const points =
            entry.rank !== null && entry.rank !== undefined
                ? Math.max(playerCount - entry.rank + 1, 1)
                : 0;

        player.matchPoints += points;
        if (entry.rank === 1) {
            player.roundsWon += 1;
        }
        lastRoundPoints.set(entry.id, points);
    }

    const standings = buildStandings(room, lastRoundPoints);
    const matchOver = room.currentRound >= room.totalRounds;

    io.to(roomCode).emit("game:over", {
        results,
        gameType: room.gameType,
        roundNumber: room.currentRound,
        totalRounds: room.totalRounds,
        matchOver,
        standings,
    });
    console.log(
        `[game:over] room ${roomCode} round ${room.currentRound}/${room.totalRounds} (${room.gameType})`,
    );
}

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
    const protocol = useLocalHttps ? "https" : "http";
    console.log(`Server running on ${protocol}://localhost:${PORT}`);
});
