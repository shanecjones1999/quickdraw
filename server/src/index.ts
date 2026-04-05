import express from "express";
import { createServer as createHttpServer } from "http";
import { createServer as createHttpsServer } from "https";
import { randomUUID } from "crypto";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
    createRoom,
    getRoom,
    getRoomBySocket,
    getRoomByHostSessionId,
    deleteRoom,
} from "./rooms.js";
import { getHandler, getAvailableGameTypes } from "./handlers/index.js";
import { finishMathSprintState } from "./mathsprint.js";
import type { MathSprintState } from "./mathsprint.js";
import type { GameType, MatchStanding, Player, Room } from "./types.js";

const DEFAULT_MATCH_ROUNDS = 5;
const MIN_MATCH_ROUNDS = 1;
const MAX_MATCH_ROUNDS = 12;
const ROUND_SHUFFLE_DURATION_MS = 4800;
const ROUND_SHUFFLE_LANDING_BUFFER_MS = 850;
const RESULTS_AUTO_ADVANCE_MS = 6000;
const ROUND_READY_TARGET = 1;
const PLAYER_RECONNECT_GRACE_MS = 30000;
const HOST_RECONNECT_GRACE_MS = 30000;

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

// ── Helpers ─────────────────────────────────────────────────────────

function sanitizeTotalRounds(value: number | undefined): number {
    if (!Number.isFinite(value)) return DEFAULT_MATCH_ROUNDS;
    return Math.min(
        MAX_MATCH_ROUNDS,
        Math.max(MIN_MATCH_ROUNDS, Math.round(value ?? DEFAULT_MATCH_ROUNDS)),
    );
}

function shuffleGameTypes(gameTypes: GameType[]): GameType[] {
    const pool = [...gameTypes];
    for (let index = pool.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
    }
    return pool;
}

function createRoundSequence(
    totalRounds: number,
    playerCount: number,
): GameType[] {
    const availableGameTypes = getAvailableGameTypes(playerCount);
    const sequence: GameType[] = [];

    while (sequence.length < totalRounds) {
        let bag = shuffleGameTypes(availableGameTypes);

        if (sequence.length > 0) {
            let attempts = 0;
            while (bag[0] === sequence.at(-1) && attempts < 5) {
                bag = shuffleGameTypes(availableGameTypes);
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

function emitHostProgressSnapshots(room: Room) {
    if (room.phase !== "playing" || room.gameType === "teamtug") {
        return;
    }

    const handler = getHandler(room.gameType);

    for (const player of room.players.values()) {
        if (!player.gameState) continue;

        io.to(room.hostSocketId).emit(
            handler.progressEvent,
            handler.progressPayload(player.gameState, player.id, player.rank),
        );
    }
}

function serializePlayers(room: Room) {
    return [...room.players.values()].map(({ id, name, rank }) => ({
        id,
        name,
        rank,
    }));
}

function emitRoomUpdated(room: Room) {
    io.to(room.code).emit("room:updated", {
        players: serializePlayers(room),
    });
}

function emitRoundReadyStatus(room: Room) {
    const readyCount = room.roundReadyPlayerSessionIds.size;
    const readyThresholdMet = readyCount >= ROUND_READY_TARGET;

    io.to(room.hostSocketId).emit("round:readyStatus", {
        readyCount,
        readyTarget: ROUND_READY_TARGET,
        readyThresholdMet,
        playerReady: false,
    });

    for (const player of room.players.values()) {
        io.to(player.id).emit("round:readyStatus", {
            readyCount,
            readyTarget: ROUND_READY_TARGET,
            readyThresholdMet,
            playerReady: room.roundReadyPlayerSessionIds.has(player.sessionId),
        });
    }
}

function getPlayerBySocket(room: Room, socketId: string) {
    for (const player of room.players.values()) {
        if (player.id === socketId) return player;
    }
    return undefined;
}

function getPlayerById(room: Room, id: string) {
    for (const player of room.players.values()) {
        if (player.id === id) return player;
    }
    return undefined;
}

function updatePlayerSocket(room: Room, player: Player, socketId: string) {
    const previousSocketId = player.id;
    player.id = socketId;
    player.connected = true;

    if (player.disconnectTimeout) {
        clearTimeout(player.disconnectTimeout);
        player.disconnectTimeout = null;
    }

    if (previousSocketId !== socketId) {
        room.finishOrder = room.finishOrder.map((entryId) =>
            entryId === previousSocketId ? socketId : entryId,
        );
    }
}

function removeDisconnectedPlayers(room: Room) {
    for (const [sessionId, player] of room.players.entries()) {
        if (player.connected) continue;
        if (player.disconnectTimeout) {
            clearTimeout(player.disconnectTimeout);
        }
        room.players.delete(sessionId);
        room.finishOrder = room.finishOrder.filter((id) => id !== player.id);
    }
}

function buildStandings(
    room: Room,
    lastRoundPoints: Map<string, number>,
): MatchStanding[] {
    const sortedPlayers = [...room.players.values()].sort((left, right) => {
        if (right.matchPoints !== left.matchPoints)
            return right.matchPoints - left.matchPoints;
        if (right.roundsWon !== left.roundsWon)
            return right.roundsWon - left.roundsWon;
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

// ── Round lifecycle ─────────────────────────────────────────────────

function clearRoundState(room: Room) {
    const handler = getHandler(room.gameType);
    handler.onCleanup?.(room);

    room.gameStartTime = null;
    room.finishOrder = [];
    room.roundReadyPlayerSessionIds.clear();
    room.roundReadyOpensAt = null;
    room.roundEndAt = null;

    for (const player of room.players.values()) {
        player.gameState = null;
        player.rank = null;
    }
}

function clearPendingRoundStart(room: Room) {
    if (room.roundRevealTimeout) {
        clearTimeout(room.roundRevealTimeout);
        room.roundRevealTimeout = null;
    }
}

function clearPendingResultsAdvance(room: Room) {
    if (room.resultsAutoAdvanceTimeout) {
        clearTimeout(room.resultsAutoAdvanceTimeout);
        room.resultsAutoAdvanceTimeout = null;
    }
    room.resultsAutoAdvanceAt = null;
}

function clearRoundEndTimeout(room: Room) {
    if (room.roundEndTimeout) {
        clearTimeout(room.roundEndTimeout);
        room.roundEndTimeout = null;
    }
    room.roundEndAt = null;
}

function startRound(room: Room, nextGameType?: GameType) {
    if (room.currentRound >= room.totalRounds) return;

    clearPendingResultsAdvance(room);
    clearRoundEndTimeout(room);
    clearRoundState(room);
    room.phase = "playing";
    room.gameStartTime = Date.now();
    room.gameType =
        nextGameType ?? room.roundSequence[room.currentRound] ?? "klotski";
    room.currentRound += 1;

    const handler = getHandler(room.gameType);
    const playersArray = [...room.players.values()];
    const seed = handler.createSeed(playersArray);

    for (const player of room.players.values()) {
        player.gameState = handler.createState(seed);
    }

    if (handler.customStart && handler.onStart) {
        handler.onStart(io, room, seed, endGame);
    } else {
        io.to(room.code).emit("game:started", {
            gameType: room.gameType,
            ...handler.startPayload(seed),
            roundNumber: room.currentRound,
            totalRounds: room.totalRounds,
        });
        emitHostProgressSnapshots(room);
    }

    emitRoomSettings(room);
    console.log(
        `[host:start] room ${room.code} round ${room.currentRound}/${room.totalRounds} (${room.gameType})`,
    );
}

function queueRoundStart(room: Room) {
    if (room.currentRound >= room.totalRounds) return;

    clearPendingRoundStart(room);
    clearPendingResultsAdvance(room);
    clearRoundEndTimeout(room);

    const nextGameType = room.roundSequence[room.currentRound] ?? "klotski";
    const nextRoundNumber = room.currentRound + 1;
    const availableGameTypes = getAvailableGameTypes(room.players.size);

    room.phase = "shuffling";
    room.roundReadyPlayerSessionIds.clear();
    room.roundReadyOpensAt = Date.now() + ROUND_SHUFFLE_DURATION_MS;
    io.to(room.code).emit("round:shuffle", {
        gameType: nextGameType,
        availableGameTypes,
        roundNumber: nextRoundNumber,
        totalRounds: room.totalRounds,
        durationMs: ROUND_SHUFFLE_DURATION_MS,
        landingBufferMs: ROUND_SHUFFLE_LANDING_BUFFER_MS,
    });
    emitRoundReadyStatus(room);
}

// ── Player resume (reconnection) ────────────────────────────────────

function emitPlayerResumeState(
    socket: Parameters<typeof io.on>[1] extends (socket: infer T) => void
        ? T
        : never,
    room: Room,
    player: Player,
) {
    socket.emit("room:settings", {
        totalRounds: room.totalRounds,
        currentRound: room.currentRound,
    });
    socket.emit("room:gameType", { gameType: room.gameType });

    if (room.phase === "lobby") return;

    if (room.phase === "shuffling") {
        socket.emit("round:shuffle", {
            gameType: room.roundSequence[room.currentRound] ?? room.gameType,
            availableGameTypes: getAvailableGameTypes(room.players.size),
            roundNumber: room.currentRound + 1,
            totalRounds: room.totalRounds,
            durationMs: Math.max(
                0,
                (room.roundReadyOpensAt ?? Date.now()) - Date.now(),
            ),
            landingBufferMs: ROUND_SHUFFLE_LANDING_BUFFER_MS,
        });
        emitRoundReadyStatus(room);
        return;
    }

    if (room.phase === "results") {
        const handler = getHandler(room.gameType);
        const results = handler.buildResults(
            [...room.players.values()].map((p) => ({
                id: p.id,
                name: p.name,
                rank: p.rank,
                state: p.gameState,
            })),
            room,
        );
        const lastRoundPoints = new Map<string, number>();
        const playerCount = room.players.size;
        const isTeamGame = room.gameType === "teamtug";

        if (isTeamGame) {
            for (const entry of results as Array<{
                rank: number;
                members: Array<{ id: string }>;
            }>) {
                const points = Math.max(2 - entry.rank + 1, 1);
                for (const member of entry.members) {
                    lastRoundPoints.set(member.id, points);
                }
            }
        } else {
            for (const entry of results as Array<{
                id: string;
                rank?: number | null;
            }>) {
                const points =
                    entry.rank !== null && entry.rank !== undefined
                        ? Math.max(playerCount - entry.rank + 1, 1)
                        : 0;
                lastRoundPoints.set(entry.id, points);
            }
        }

        socket.emit("game:over", {
            results,
            gameType: room.gameType,
            roundNumber: room.currentRound,
            totalRounds: room.totalRounds,
            matchOver: room.currentRound >= room.totalRounds,
            standings: buildStandings(room, lastRoundPoints),
            autoAdvanceAt: room.resultsAutoAdvanceAt,
        });
        return;
    }

    // phase === "playing"
    if (!player.gameState) return;

    const handler = getHandler(room.gameType);
    const basePayload = {
        gameType: room.gameType,
        roundNumber: room.currentRound,
        totalRounds: room.totalRounds,
    };

    // TeamTug resume uses room state, not player state
    if (room.gameType === "teamtug" && room.teamTugState) {
        const st = room.teamTugState;
        socket.emit("game:started", {
            ...basePayload,
            teamTugState: {
                finishLine: st.finishLine,
                markerPosition: st.markerPosition,
                timeLimitMs: st.timeLimitMs,
                startedAt: st.startedAt,
                winnerTeamId: st.winnerTeamId,
                teams: (["red", "blue"] as const).map((teamId) => {
                    const team = st.teams[teamId];
                    return {
                        id: team.id,
                        name: team.name,
                        totalPulls: team.totalPulls,
                        members: team.members.map((member) => {
                            const p = room.players.get(member.sessionId);
                            return {
                                id: p?.id ?? member.sessionId,
                                sessionId: member.sessionId,
                                name: p?.name ?? "Disconnected Player",
                                connected: p?.connected ?? false,
                                contribution:
                                    team.contributions[member.sessionId] ?? 0,
                            };
                        }),
                    };
                }),
            },
        });
        return;
    }

    // ReactionTap resume needs signal payload too
    if (room.gameType === "reactiontap") {
        socket.emit("game:started", {
            ...basePayload,
            ...handler.resumeStartPayload(player.gameState),
        });
        setTimeout(() => {
            socket.emit(
                handler.resumeSyncEvent,
                handler.resumeSyncPayload(player.gameState!),
            );
            // Also send current signal state
            const rs = room.reactionTapRoomState;
            const kind = rs?.activeSignalKind ?? "idle";
            socket.emit("reactiontap:signal", {
                promptIndex: rs?.activePromptIndex ?? -1,
                totalPrompts: rs?.prompts.length ?? 6,
                kind,
                label:
                    kind === "go"
                        ? "TAP!"
                        : kind === "decoy"
                          ? "WAIT"
                          : "Stand by",
                activeUntil: rs?.activeSignalEndsAt ?? null,
                startedAt: rs?.activeSignalStartedAt ?? null,
            });
        }, 0);
        return;
    }

    // MathSprint resume includes endAt
    if (room.gameType === "mathsprint") {
        socket.emit("game:started", {
            ...basePayload,
            ...handler.resumeStartPayload(player.gameState),
            endAt: room.roundEndAt,
        });
        return;
    }

    // Generic resume
    socket.emit("game:started", {
        ...basePayload,
        ...handler.resumeStartPayload(player.gameState),
    });
    setTimeout(() => {
        if (!player.gameState) return;
        socket.emit(
            handler.resumeSyncEvent,
            handler.resumeSyncPayload(player.gameState),
        );
        if (
            handler.shouldResumeSolved(player.gameState, player.rank) &&
            player.rank !== null &&
            handler.solvedEvent
        ) {
            socket.emit(
                handler.solvedEvent,
                handler.resumeSolvedPayload(player.gameState, player.rank),
            );
        }
    }, 0);
}

// ── Host resume (reconnection) ──────────────────────────────────────

function emitHostResumeState(
    socket: Parameters<typeof io.on>[1] extends (socket: infer T) => void
        ? T
        : never,
    room: Room,
) {
    socket.emit("room:settings", {
        totalRounds: room.totalRounds,
        currentRound: room.currentRound,
    });
    socket.emit("room:updated", { players: serializePlayers(room) });
    socket.emit("room:gameType", { gameType: room.gameType });

    if (room.phase === "lobby") return;

    if (room.phase === "shuffling") {
        socket.emit("round:shuffle", {
            gameType: room.roundSequence[room.currentRound] ?? room.gameType,
            availableGameTypes: getAvailableGameTypes(room.players.size),
            roundNumber: room.currentRound + 1,
            totalRounds: room.totalRounds,
            durationMs: Math.max(
                0,
                (room.roundReadyOpensAt ?? Date.now()) - Date.now(),
            ),
            landingBufferMs: ROUND_SHUFFLE_LANDING_BUFFER_MS,
        });
        emitRoundReadyStatus(room);
        return;
    }

    if (room.phase === "results") {
        const handler = getHandler(room.gameType);
        const results = handler.buildResults(
            [...room.players.values()].map((p) => ({
                id: p.id,
                name: p.name,
                rank: p.rank,
                state: p.gameState,
            })),
            room,
        );
        const lastRoundPoints = new Map<string, number>();
        const playerCount = room.players.size;
        const isTeamGame = room.gameType === "teamtug";

        if (isTeamGame) {
            for (const entry of results as Array<{
                rank: number;
                members: Array<{ id: string }>;
            }>) {
                const points = Math.max(2 - entry.rank + 1, 1);
                for (const member of entry.members) {
                    lastRoundPoints.set(member.id, points);
                }
            }
        } else {
            for (const entry of results as Array<{
                id: string;
                rank?: number | null;
            }>) {
                const points =
                    entry.rank !== null && entry.rank !== undefined
                        ? Math.max(playerCount - entry.rank + 1, 1)
                        : 0;
                lastRoundPoints.set(entry.id, points);
            }
        }

        socket.emit("game:over", {
            results,
            gameType: room.gameType,
            roundNumber: room.currentRound,
            totalRounds: room.totalRounds,
            matchOver: room.currentRound >= room.totalRounds,
            standings: buildStandings(room, lastRoundPoints),
            autoAdvanceAt: room.resultsAutoAdvanceAt,
        });
        return;
    }

    // phase === "playing" — send game:started then progress for all players
    const handler = getHandler(room.gameType);
    const basePayload = {
        gameType: room.gameType,
        roundNumber: room.currentRound,
        totalRounds: room.totalRounds,
    };

    if (room.gameType === "teamtug" && room.teamTugState) {
        const st = room.teamTugState;
        socket.emit("game:started", {
            ...basePayload,
            teamTugState: {
                finishLine: st.finishLine,
                markerPosition: st.markerPosition,
                timeLimitMs: st.timeLimitMs,
                startedAt: st.startedAt,
                winnerTeamId: st.winnerTeamId,
                teams: (["red", "blue"] as const).map((teamId) => {
                    const team = st.teams[teamId];
                    return {
                        id: team.id,
                        name: team.name,
                        totalPulls: team.totalPulls,
                        members: team.members.map((member) => {
                            const p = room.players.get(member.sessionId);
                            return {
                                id: p?.id ?? member.sessionId,
                                sessionId: member.sessionId,
                                name: p?.name ?? "Disconnected Player",
                                connected: p?.connected ?? false,
                                contribution:
                                    team.contributions[member.sessionId] ?? 0,
                            };
                        }),
                    };
                }),
            },
        });
        return;
    }

    if (room.gameType === "mathsprint") {
        socket.emit("game:started", {
            ...basePayload,
            endAt: room.roundEndAt,
        });
    } else {
        socket.emit("game:started", basePayload);
    }

    emitHostProgressSnapshots(room);
}

// ── End game ────────────────────────────────────────────────────────

function endGame(roomCode: string) {
    const room = getRoom(roomCode);
    if (!room) return;
    if (room.phase !== "playing") return;

    clearPendingResultsAdvance(room);
    clearRoundEndTimeout(room);

    const handler = getHandler(room.gameType);
    handler.onCleanup?.(room);

    room.phase = "results";

    // MathSprint finalization
    if (room.gameType === "mathsprint") {
        for (const player of room.players.values()) {
            if (player.gameState) {
                player.gameState = finishMathSprintState(
                    player.gameState as MathSprintState,
                );
            }
        }
    }

    const results = handler.buildResults(
        [...room.players.values()].map((p) => ({
            id: p.id,
            name: p.name,
            rank: p.rank,
            state: p.gameState,
        })),
        room,
    );

    const lastRoundPoints = new Map<string, number>();
    const playerCount = room.players.size;
    const isTeamGame = room.gameType === "teamtug";

    if (isTeamGame) {
        const winningTeamCount = (results as Array<{ winner: boolean }>).filter(
            (entry) => entry.winner,
        ).length;

        for (const entry of results as Array<{
            rank: number;
            winner: boolean;
            members: Array<{ sessionId: string }>;
        }>) {
            const points = Math.max(2 - entry.rank + 1, 1);

            for (const member of entry.members) {
                const player = room.players.get(member.sessionId);
                if (!player) continue;

                player.matchPoints += points;
                if (entry.winner && winningTeamCount === 1) {
                    player.roundsWon += 1;
                }
                lastRoundPoints.set(player.id, points);
            }
        }
    } else {
        for (const entry of results as Array<{
            id: string;
            rank?: number | null;
        }>) {
            const player = getPlayerById(room, entry.id);
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
    }

    const standings = buildStandings(room, lastRoundPoints);
    const matchOver = room.currentRound >= room.totalRounds;

    if (!matchOver) {
        room.resultsAutoAdvanceAt = Date.now() + RESULTS_AUTO_ADVANCE_MS;
        room.resultsAutoAdvanceTimeout = setTimeout(() => {
            room.resultsAutoAdvanceTimeout = null;

            if (getRoom(roomCode) !== room) return;
            if (room.phase !== "results") return;
            if (room.currentRound >= room.totalRounds) return;

            queueRoundStart(room);
        }, RESULTS_AUTO_ADVANCE_MS);
    }

    io.to(roomCode).emit("game:over", {
        results,
        gameType: room.gameType,
        roundNumber: room.currentRound,
        totalRounds: room.totalRounds,
        matchOver,
        standings,
        autoAdvanceAt: room.resultsAutoAdvanceAt,
    });
    console.log(
        `[game:over] room ${roomCode} round ${room.currentRound}/${room.totalRounds} (${room.gameType})`,
    );
}

// ── Static file serving ─────────────────────────────────────────────

const buildPath = join(__dirname, "../../quickdraw-web/dist");
app.use(express.static(buildPath));
app.get("*", (_req, res) => {
    res.sendFile(join(buildPath, "index.html"));
});

// ── Socket.io connection ────────────────────────────────────────────

io.on("connection", (socket) => {
    console.log(`[connect] ${socket.id}`);

    // ── Host creates a room ─────────────────────────────────────────
    socket.on("host:create", () => {
        const hostSessionId = randomUUID();
        const room = createRoom(socket.id, hostSessionId);
        socket.join(room.code);
        socket.emit("room:created", {
            roomCode: room.code,
            hostSessionId,
        });
        socket.emit("room:settings", {
            totalRounds: room.totalRounds,
            currentRound: room.currentRound,
        });
        console.log(`[host:create] room ${room.code}`);
    });

    // ── Host rejoins after disconnect ───────────────────────────────
    socket.on(
        "host:rejoin",
        ({
            roomCode,
            hostSessionId,
        }: {
            roomCode: string;
            hostSessionId: string;
        }) => {
            const code = roomCode?.toUpperCase().trim();
            const sessionId = hostSessionId?.trim();
            if (!code || !sessionId) {
                socket.emit("error", { message: "Invalid rejoin request." });
                return;
            }

            const room = getRoomByHostSessionId(sessionId);
            if (!room || room.code !== code) {
                socket.emit("error", { message: "Room not found." });
                return;
            }

            if (room.hostDisconnectTimeout) {
                clearTimeout(room.hostDisconnectTimeout);
                room.hostDisconnectTimeout = null;
            }

            room.hostSocketId = socket.id;
            socket.join(room.code);

            emitHostResumeState(socket, room);
            console.log(`[host:rejoin] room ${room.code} (reconnected)`);
        },
    );

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

    // ── Host selects game type ──────────────────────────────────────
    socket.on("host:setGameType", ({ gameType }: { gameType: GameType }) => {
        const room = getRoomBySocket(socket.id);
        if (!room || room.hostSocketId !== socket.id) return;
        if (room.phase !== "lobby") return;

        try {
            getHandler(gameType);
        } catch {
            return;
        }

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
            playerSessionId,
        }: {
            roomCode: string;
            playerName: string;
            playerSessionId: string;
        }) => {
            const code = roomCode.toUpperCase().trim();
            const room = getRoom(code);
            const normalizedName = playerName?.trim().slice(0, 16);
            const normalizedSessionId = playerSessionId?.trim();

            if (!room) {
                socket.emit("error", { message: "Room not found." });
                return;
            }
            if (!normalizedName) {
                socket.emit("error", { message: "Name required." });
                return;
            }
            if (!normalizedSessionId) {
                socket.emit("error", { message: "Name required." });
                return;
            }

            const existingPlayer = room.players.get(normalizedSessionId);
            if (room.phase !== "lobby" && !existingPlayer) {
                socket.emit("error", { message: "Game already in progress." });
                return;
            }

            const player = existingPlayer ?? {
                id: socket.id,
                sessionId: normalizedSessionId,
                name: normalizedName,
                connected: true,
                disconnectTimeout: null,
                gameState: null,
                rank: null,
                matchPoints: 0,
                roundsWon: 0,
            };

            player.name = normalizedName;
            updatePlayerSocket(room, player, socket.id);
            room.players.set(normalizedSessionId, player);
            socket.join(code);

            emitRoomUpdated(room);
            emitPlayerResumeState(socket, room, player);
            console.log(
                `[player:join] ${player.name} → ${code}${existingPlayer ? " (rejoin)" : ""}`,
            );
        },
    );

    socket.on("player:ready", () => {
        const room = getRoomBySocket(socket.id);
        if (!room || room.phase !== "shuffling") return;

        const player = getPlayerBySocket(room, socket.id);
        if (!player) return;
        if (room.roundReadyOpensAt && Date.now() < room.roundReadyOpensAt) {
            return;
        }

        room.roundReadyPlayerSessionIds.add(player.sessionId);
        emitRoundReadyStatus(room);

        if (
            room.roundReadyPlayerSessionIds.size >= ROUND_READY_TARGET &&
            !room.roundRevealTimeout
        ) {
            room.roundRevealTimeout = setTimeout(() => {
                room.roundRevealTimeout = null;

                if (getRoom(room.code) !== room) return;
                if (room.phase !== "shuffling") return;

                startRound(room);
            }, ROUND_SHUFFLE_LANDING_BUFFER_MS);
        }
    });

    // ── Host starts the game ────────────────────────────────────────
    socket.on("host:start", () => {
        const room = getRoomBySocket(socket.id);
        if (!room || room.hostSocketId !== socket.id) return;
        if (room.phase !== "lobby") return;

        removeDisconnectedPlayers(room);
        emitRoomUpdated(room);

        room.totalRounds = sanitizeTotalRounds(room.totalRounds);
        room.currentRound = 0;
        room.roundSequence = createRoundSequence(
            room.totalRounds,
            room.players.size,
        );
        // room.roundSequence = Array(room.totalRounds).fill("klotski");
        // room.totalRounds = 1;
        for (const player of room.players.values()) {
            player.matchPoints = 0;
            player.roundsWon = 0;
        }

        queueRoundStart(room);
    });

    // ── Generic action handler ──────────────────────────────────────
    // Register listeners for all game action events
    for (const gameType of [
        "klotski",
        "bowman",
        "rushhour",
        "lightsout",
        "codebreaker",
        "mathsprint",
        "pipeconnect",
        "simoncopy",
        "memorysequenceplus",
        "pairmatch",
        "oddoneout",
        "reactiontap",
        "teamtug",
    ] as GameType[]) {
        const handler = getHandler(gameType);

        socket.on(handler.actionEvent, (data: unknown) => {
            const room = getRoomBySocket(socket.id);
            if (!room || room.phase !== "playing" || room.gameType !== gameType)
                return;

            // Custom action handlers manage everything themselves
            if (handler.customAction && handler.onAction) {
                handler.onAction(io, room, socket, data, endGame);
                return;
            }

            const player = getPlayerBySocket(room, socket.id);
            if (!player?.gameState) return;
            if (handler.isPlayerDone(player.gameState)) return;

            // Time-gated games
            if (room.roundEndAt !== null && Date.now() > room.roundEndAt)
                return;

            const { ok, state } = handler.applyAction(player.gameState, data);
            if (!ok) return;

            player.gameState = state;

            // Send update to player
            socket.emit(handler.updateEvent, handler.updatePayload(state));

            // Track finish order
            let rank: number | null = null;
            if (handler.shouldTrackFinish(state)) {
                if (!room.finishOrder.includes(player.id)) {
                    room.finishOrder.push(player.id);
                }
                rank = room.finishOrder.indexOf(player.id) + 1;
                player.rank = rank;

                if (handler.solvedEvent) {
                    socket.emit(
                        handler.solvedEvent,
                        handler.solvedPayload(state, rank),
                    );
                }
            }

            // Send progress to host
            io.to(room.hostSocketId).emit(
                handler.progressEvent,
                handler.progressPayload(state, socket.id, rank),
            );

            // Post-action hook (e.g. PairMatch mismatch timeout)
            handler.onPostAction?.(io, room, player);

            // Check if all players done
            const allDone = [...room.players.values()].every(
                (p) => p.gameState && handler.isPlayerDone(p.gameState),
            );
            if (allDone) endGame(room.code);
        });
    }

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

        clearPendingResultsAdvance(room);
        queueRoundStart(room);
    });

    // ── Host resets the room ────────────────────────────────────────
    socket.on("host:reset", () => {
        const room = getRoomBySocket(socket.id);
        if (!room || room.hostSocketId !== socket.id) return;

        clearPendingRoundStart(room);
        clearPendingResultsAdvance(room);
        clearRoundEndTimeout(room);
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
        emitRoomUpdated(room);
        console.log(`[host:reset] room ${room.code}`);
    });

    // ── Disconnect ──────────────────────────────────────────────────
    socket.on("disconnect", () => {
        console.log(`[disconnect] ${socket.id}`);
        const room = getRoomBySocket(socket.id);
        if (!room) return;

        if (room.hostSocketId === socket.id) {
            // Give the host a grace period to reconnect (e.g. page refresh)
            if (room.hostDisconnectTimeout) {
                clearTimeout(room.hostDisconnectTimeout);
            }

            room.hostDisconnectTimeout = setTimeout(() => {
                const currentRoom = getRoom(room.code);
                if (!currentRoom) return;
                // If the host reconnected with a new socket, don't destroy
                if (currentRoom.hostSocketId !== socket.id) return;

                clearPendingRoundStart(currentRoom);
                clearPendingResultsAdvance(currentRoom);
                clearRoundEndTimeout(currentRoom);
                const handler = getHandler(currentRoom.gameType);
                handler.onCleanup?.(currentRoom);
                io.to(currentRoom.code).emit("error", {
                    message: "Host disconnected.",
                });
                deleteRoom(currentRoom.code);
            }, HOST_RECONNECT_GRACE_MS);
        } else {
            const player = getPlayerBySocket(room, socket.id);
            if (!player) return;

            player.connected = false;
            if (player.disconnectTimeout) {
                clearTimeout(player.disconnectTimeout);
            }

            player.disconnectTimeout = setTimeout(() => {
                const currentRoom = getRoom(room.code);
                const currentPlayer = currentRoom?.players.get(
                    player.sessionId,
                );
                if (!currentRoom || !currentPlayer || currentPlayer.connected) {
                    return;
                }

                currentRoom.players.delete(player.sessionId);
                currentRoom.finishOrder = currentRoom.finishOrder.filter(
                    (id) => id !== currentPlayer.id,
                );
                emitRoomUpdated(currentRoom);
            }, PLAYER_RECONNECT_GRACE_MS);
        }
    });
});

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
    const protocol = useLocalHttps ? "https" : "http";
    console.log(`Server running on ${protocol}://localhost:${PORT}`);
});
