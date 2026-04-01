import express from "express";
import { createServer } from "http";
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
import { createRushHourState, applyRushHourMove } from "./rushhour.js";
import type { GameType } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*" },
});

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
        console.log(`[host:create] room ${room.code}`);
    });

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
            gameType !== "codebreaker"
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
                rank: null,
            };
            room.players.set(socket.id, player);
            socket.join(code);

            const players = [...room.players.values()].map(
                ({ id, name, rank }) => ({ id, name, rank }),
            );
            io.to(code).emit("room:updated", { players });
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

        room.phase = "playing";
        room.gameStartTime = Date.now();
        room.finishOrder = [];

        if (room.gameType === "klotski") {
            for (const player of room.players.values()) {
                player.puzzleState = createInitialState();
                player.rank = null;
            }
            const initialState = createInitialState();
            io.to(room.code).emit("game:started", {
                gameType: "klotski",
                board: initialState.board,
                pieces: initialState.pieces,
            });
        } else if (room.gameType === "bowman") {
            const sharedWind = 0;
            for (const player of room.players.values()) {
                player.bowmanState = createBowmanState(sharedWind);
                player.rank = null;
            }
            io.to(room.code).emit("game:started", {
                gameType: "bowman",
                wind: sharedWind,
            });
        } else if (room.gameType === "rushhour") {
            const puzzleIndex = Math.floor(Math.random() * 3);
            for (const player of room.players.values()) {
                player.rushHourState = createRushHourState(puzzleIndex);
                player.rank = null;
            }
            const sample = createRushHourState(puzzleIndex);
            io.to(room.code).emit("game:started", {
                gameType: "rushhour",
                vehicles: sample.vehicles,
                puzzleIndex,
            });
        } else if (room.gameType === "lightsout") {
            const initialState = createLightsOutState();
            for (const player of room.players.values()) {
                player.lightsOutState = createLightsOutState(
                    initialState.board,
                );
                player.rank = null;
            }
            io.to(room.code).emit("game:started", {
                gameType: "lightsout",
                board: initialState.board,
            });
        } else {
            const initialState = createCodebreakerState();
            for (const player of room.players.values()) {
                player.codebreakerState = createCodebreakerState(
                    initialState.secret,
                );
                player.rank = null;
            }
            io.to(room.code).emit("game:started", {
                gameType: "codebreaker",
                palette: [...CODEBREAKER_PALETTE],
                codeLength: CODEBREAKER_CODE_LENGTH,
                maxGuesses: CODEBREAKER_MAX_GUESSES,
            });
        }

        console.log(`[host:start] room ${room.code} (${room.gameType})`);
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

    // ── Host ends the round early ───────────────────────────────────
    socket.on("host:end", () => {
        const room = getRoomBySocket(socket.id);
        if (!room || room.hostSocketId !== socket.id) return;
        if (room.phase !== "playing") return;
        endGame(room.code);
    });

    // ── Host resets the room ────────────────────────────────────────
    socket.on("host:reset", () => {
        const room = getRoomBySocket(socket.id);
        if (!room || room.hostSocketId !== socket.id) return;

        room.phase = "lobby";
        room.gameStartTime = null;
        room.finishOrder = [];
        for (const player of room.players.values()) {
            player.puzzleState = null;
            player.bowmanState = null;
            player.rushHourState = null;
            player.lightsOutState = null;
            player.codebreakerState = null;
            player.rank = null;
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

    io.to(roomCode).emit("game:over", { results, gameType: room.gameType });
    console.log(`[game:over] room ${roomCode} (${room.gameType})`);
}

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
