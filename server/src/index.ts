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
    MATH_SPRINT_ROUND_DURATION_MS,
    createMathSprintState,
    finishMathSprintState,
    serializeMathSprintQuestion,
    submitMathSprintAnswer,
} from "./mathsprint.js";
import {
    MEMORY_SEQUENCE_PLUS_GRID_SIZE,
    MEMORY_SEQUENCE_PLUS_MAX_ROUNDS,
    createMemorySequencePlusState,
    submitMemorySequencePlusRound,
} from "./memorysequenceplus.js";
import {
    PAIR_MATCH_MISMATCH_REVEAL_MS,
    PAIR_MATCH_PAIR_COUNT,
    clearPairMatchMismatch,
    createPairMatchState,
    flipPairMatchTile,
    getPairMatchLayout,
    toPublicPairMatchTiles,
} from "./pairmatch.js";
import {
    createOddOneOutPromptSet,
    createOddOneOutState,
    getCurrentOddOneOutPrompt,
    processOddOneOutSelection,
} from "./oddoneout.js";
import {
    PIPE_CONNECT_PUZZLE_COUNT,
    applyPipeConnectRotate,
    createPipeConnectState,
    toPublicPipeConnectTiles,
} from "./pipeconnect.js";
import {
    REACTION_TAP_GO_PROMPTS,
    REACTION_TAP_TOTAL_PROMPTS,
    createReactionTapRoomState,
    createReactionTapState,
    recordReactionTapDecoy,
    recordReactionTapMiss,
    recordReactionTapPenalty,
    recordReactionTapSuccess,
} from "./reactiontap.js";
import { createRushHourState, applyRushHourMove } from "./rushhour.js";
import {
    SIMON_COPY_COLORS,
    SIMON_COPY_MAX_ROUNDS,
    createSimonCopyState,
    submitSimonCopyRound,
} from "./simoncopy.js";
import {
    applyTeamTugPull,
    createTeamTugState,
    getLeadingTeamTugTeamId,
} from "./teamtug.js";
import type { GameType } from "./types.js";
import type { MatchStanding, Player, Room } from "./types.js";

const AVAILABLE_GAME_TYPES: GameType[] = [
    "klotski",
    "bowman",
    "codebreaker",
    "mathsprint",
    "pipeconnect",
    "simoncopy",
    "memorysequenceplus",
    "pairmatch",
    "oddoneout",
    "reactiontap",
    "rushhour",
    "lightsout",
    "teamtug",
];

const DEFAULT_MATCH_ROUNDS = 5;
const MIN_MATCH_ROUNDS = 1;
const MAX_MATCH_ROUNDS = 12;
const ROUND_SHUFFLE_DURATION_MS = 4800;
const ROUND_SHUFFLE_LANDING_BUFFER_MS = 850;
const RESULTS_AUTO_ADVANCE_MS = 6000;
const ROUND_READY_TARGET = 1;
const PLAYER_RECONNECT_GRACE_MS = 30000;

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

function getAvailableGameTypes(playerCount: number): GameType[] {
    if (playerCount >= 2) {
        return AVAILABLE_GAME_TYPES;
    }

    return AVAILABLE_GAME_TYPES.filter((gameType) => gameType !== "teamtug");
}

function shuffleGameTypes(gameTypes: GameType[]): GameType[] {
    const pool = [...gameTypes];
    for (let index = pool.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
    }
    return pool;
}

function createRoundSequence(totalRounds: number, playerCount: number): GameType[] {
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

function serializeTeamTugState(room: Room) {
    if (!room.teamTugState) {
        return null;
    }

    return {
        finishLine: room.teamTugState.finishLine,
        markerPosition: room.teamTugState.markerPosition,
        timeLimitMs: room.teamTugState.timeLimitMs,
        startedAt: room.teamTugState.startedAt,
        winnerTeamId: room.teamTugState.winnerTeamId,
        teams: (["red", "blue"] as const).map((teamId) => {
            const team = room.teamTugState!.teams[teamId];

            return {
                id: team.id,
                name: team.name,
                totalPulls: team.totalPulls,
                members: team.members.map((member) => {
                    const player = room.players.get(member.sessionId);

                    return {
                        id: player?.id ?? member.sessionId,
                        sessionId: member.sessionId,
                        name: player?.name ?? "Disconnected Player",
                        connected: player?.connected ?? false,
                        contribution: team.contributions[member.sessionId] ?? 0,
                    };
                }),
            };
        }),
    };
}

function buildTeamTugResults(room: Room) {
    if (!room.teamTugState) {
        return [];
    }

    const uniqueWinnerTeamId =
        room.teamTugState.winnerTeamId ?? getLeadingTeamTugTeamId(room.teamTugState);

    return (["red", "blue"] as const)
        .map((teamId) => {
            const team = room.teamTugState!.teams[teamId];
            const isTie = uniqueWinnerTeamId === null;

            return {
                id: team.id,
                name: team.name,
                pulls: team.totalPulls,
                winner: !isTie && uniqueWinnerTeamId === team.id,
                rank: isTie ? 1 : uniqueWinnerTeamId === team.id ? 1 : 2,
                members: team.members
                    .map((member) => {
                        const player = room.players.get(member.sessionId);

                        return {
                            id: player?.id ?? member.sessionId,
                            sessionId: member.sessionId,
                            name: player?.name ?? "Disconnected Player",
                            contribution:
                                team.contributions[member.sessionId] ?? 0,
                        };
                    })
                    .sort(
                        (left, right) =>
                            right.contribution - left.contribution ||
                            left.name.localeCompare(right.name),
                    ),
            };
        })
        .sort((left, right) => {
            if (left.rank !== right.rank) {
                return left.rank - right.rank;
            }

            if (right.pulls !== left.pulls) {
                return right.pulls - left.pulls;
            }

            return left.name.localeCompare(right.name);
        });
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

function buildRoundResults(room: Room) {
    if (room.gameType === "bowman") {
        return [...room.players.values()]
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
            .map((result, index) => ({ ...result, rank: index + 1 }));
    }

    if (room.gameType === "rushhour") {
        return [...room.players.values()]
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
    }

    if (room.gameType === "lightsout") {
        return [...room.players.values()]
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
    }

    if (room.gameType === "codebreaker") {
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
                    if (a.finishTime !== null && b.finishTime !== null)
                        return a.finishTime - b.finishTime;
                    if (a.finishTime !== null) return -1;
                    if (b.finishTime !== null) return 1;
                }
                return a.attempts - b.attempts;
            });

        let nextRank = 1;
        return ranked.map((entry) => ({
            ...entry,
            rank: entry.solved ? nextRank++ : null,
        }));
    }

    if (room.gameType === "mathsprint") {
        return [...room.players.values()]
            .map((player) => ({
                id: player.id,
                name: player.name,
                score: player.mathSprintState?.score ?? 0,
                answeredCount: player.mathSprintState?.answeredCount ?? 0,
                bestStreak: player.mathSprintState?.bestStreak ?? 0,
                lastCorrectAt: player.mathSprintState?.lastCorrectAt ?? null,
                rank: null as number | null,
            }))
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (a.lastCorrectAt !== null && b.lastCorrectAt !== null) {
                    return a.lastCorrectAt - b.lastCorrectAt;
                }
                if (a.lastCorrectAt !== null) return -1;
                if (b.lastCorrectAt !== null) return 1;
                if (b.answeredCount !== a.answeredCount) {
                    return b.answeredCount - a.answeredCount;
                }
                if (b.bestStreak !== a.bestStreak) {
                    return b.bestStreak - a.bestStreak;
                }
                return a.name.localeCompare(b.name);
            })
            .map((result, index) => ({ ...result, rank: index + 1 }));
    }

    if (room.gameType === "pairmatch") {
        const ranked = [...room.players.values()]
            .map((player) => ({
                id: player.id,
                name: player.name,
                attempts: player.pairMatchState?.attempts ?? 0,
                pairsFound: player.pairMatchState?.pairsFound ?? 0,
                finishTime: player.pairMatchState?.finishTime ?? null,
                solved: player.pairMatchState?.solved ?? false,
                totalPairs: PAIR_MATCH_PAIR_COUNT,
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
                if (b.pairsFound !== a.pairsFound) {
                    return b.pairsFound - a.pairsFound;
                }
                return a.attempts - b.attempts;
            });

        let nextRank = 1;
        return ranked.map((entry) => ({
            ...entry,
            rank: entry.solved ? nextRank++ : null,
        }));
    }

    if (room.gameType === "pipeconnect") {
        return [...room.players.values()]
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
    }

    if (room.gameType === "simoncopy") {
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
                    if (a.finishTime !== null && b.finishTime !== null)
                        return a.finishTime - b.finishTime;
                    if (a.finishTime !== null) return -1;
                    if (b.finishTime !== null) return 1;
                }
                return b.roundReached - a.roundReached;
            });

        let nextRank = 1;
        return ranked.map((entry) => ({
            ...entry,
            rank: entry.solved ? nextRank++ : null,
        }));
    }

    if (room.gameType === "memorysequenceplus") {
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
                    if (a.finishTime !== null && b.finishTime !== null)
                        return a.finishTime - b.finishTime;
                    if (a.finishTime !== null) return -1;
                    if (b.finishTime !== null) return 1;
                }
                return b.roundReached - a.roundReached;
            });

        let nextRank = 1;
        return ranked.map((entry) => ({
            ...entry,
            rank: entry.solved ? nextRank++ : null,
        }));
    }

    if (room.gameType === "reactiontap") {
        return [...room.players.values()]
            .map((player) => ({
                id: player.id,
                name: player.name,
                successfulPrompts:
                    player.reactionTapState?.successfulPrompts ?? 0,
                goPrompts: player.reactionTapState?.goPrompts ?? REACTION_TAP_GO_PROMPTS,
                missedPrompts: player.reactionTapState?.missedPrompts ?? 0,
                penalties: player.reactionTapState?.penalties ?? 0,
                score: player.reactionTapState?.score ?? 0,
                averageReactionTime:
                    player.reactionTapState?.averageReactionTime ?? null,
                bestReactionTime: player.reactionTapState?.bestReactionTime ?? null,
                finishTime: player.reactionTapState?.finishTime ?? null,
                rank: null as number | null,
            }))
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (b.successfulPrompts !== a.successfulPrompts) {
                    return b.successfulPrompts - a.successfulPrompts;
                }
                if (a.penalties !== b.penalties) {
                    return a.penalties - b.penalties;
                }
                if (
                    a.averageReactionTime !== null &&
                    b.averageReactionTime !== null &&
                    a.averageReactionTime !== b.averageReactionTime
                ) {
                    return a.averageReactionTime - b.averageReactionTime;
                }
                if (a.averageReactionTime !== null) return -1;
                if (b.averageReactionTime !== null) return 1;
                if (
                    a.bestReactionTime !== null &&
                    b.bestReactionTime !== null &&
                    a.bestReactionTime !== b.bestReactionTime
                ) {
                    return a.bestReactionTime - b.bestReactionTime;
                }
                if (a.bestReactionTime !== null) return -1;
                if (b.bestReactionTime !== null) return 1;
                if (a.finishTime !== null && b.finishTime !== null) {
                    return a.finishTime - b.finishTime;
                }
                if (a.finishTime !== null) return -1;
                if (b.finishTime !== null) return 1;
                return a.name.localeCompare(b.name);
            })
            .map((result, index) => ({ ...result, rank: index + 1 }));
    }

    if (room.gameType === "oddoneout") {
        return [...room.players.values()]
            .map((player) => ({
                id: player.id,
                name: player.name,
                promptsCleared: player.oddOneOutState?.promptsCleared ?? 0,
                totalPrompts: player.oddOneOutState?.prompts.length ?? 0,
                score: player.oddOneOutState?.score ?? 0,
                totalResponseTime: player.oddOneOutState?.totalResponseTime ?? 0,
                penaltyCount: player.oddOneOutState?.penaltyCount ?? 0,
                finishTime: player.oddOneOutState?.finishTime ?? null,
                rank: null as number | null,
            }))
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (b.promptsCleared !== a.promptsCleared) {
                    return b.promptsCleared - a.promptsCleared;
                }
                if (a.totalResponseTime !== b.totalResponseTime) {
                    return a.totalResponseTime - b.totalResponseTime;
                }
                if (a.finishTime !== null && b.finishTime !== null) {
                    return a.finishTime - b.finishTime;
                }
                if (a.finishTime !== null) return -1;
                if (b.finishTime !== null) return 1;
                return a.name.localeCompare(b.name);
            })
            .map((result, index) => ({ ...result, rank: index + 1 }));
    }

    if (room.gameType === "teamtug") {
        return buildTeamTugResults(room);
    }

    return [...room.players.values()]
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

function buildReactionTapSignalPayload(room: Room) {
    const state = room.reactionTapRoomState;
    const kind = state?.activeSignalKind ?? "idle";

    return {
        promptIndex: state?.activePromptIndex ?? -1,
        totalPrompts: state?.prompts.length ?? REACTION_TAP_TOTAL_PROMPTS,
        kind,
        label: kind === "go" ? "TAP!" : kind === "decoy" ? "WAIT" : "Stand by",
        activeUntil: state?.activeSignalEndsAt ?? null,
        startedAt: state?.activeSignalStartedAt ?? null,
    };
}

function buildReactionTapProgress(player: Player) {
    if (!player.reactionTapState) return null;

    return {
        playerId: player.id,
        promptsCompleted: player.reactionTapState.promptsCompleted,
        totalPrompts: player.reactionTapState.totalPrompts,
        goPrompts: player.reactionTapState.goPrompts,
        successfulPrompts: player.reactionTapState.successfulPrompts,
        missedPrompts: player.reactionTapState.missedPrompts,
        penalties: player.reactionTapState.penalties,
        score: player.reactionTapState.score,
        averageReactionTime: player.reactionTapState.averageReactionTime,
        bestReactionTime: player.reactionTapState.bestReactionTime,
        latestReactionTime: player.reactionTapState.latestReactionTime,
        latestOutcome: player.reactionTapState.latestOutcome,
        done: player.reactionTapState.done,
    };
}

function emitReactionTapState(room: Room, player: Player) {
    const snapshot = buildReactionTapProgress(player);
    if (!snapshot) return;

    io.to(room.hostSocketId).emit("reactiontap:progress", snapshot);
    io.to(player.id).emit("reactiontap:update", snapshot);
}

function emitAllReactionTapStates(room: Room) {
    for (const player of room.players.values()) {
        emitReactionTapState(room, player);
    }
}

function clearReactionTapTimers(room: Room) {
    if (!room.reactionTapRoomState) return;

    for (const timeoutId of room.reactionTapRoomState.timeoutIds) {
        clearTimeout(timeoutId);
    }

    room.reactionTapRoomState.timeoutIds = [];
    room.reactionTapRoomState.activePromptIndex = null;
    room.reactionTapRoomState.activeSignalKind = "idle";
    room.reactionTapRoomState.activeSignalStartedAt = null;
    room.reactionTapRoomState.activeSignalEndsAt = null;
}

function completeReactionTapRoundIfReady(room: Room) {
    const allDone = [...room.players.values()].every(
        (player) => player.reactionTapState?.done,
    );

    if (allDone) {
        endGame(room.code);
    }
}

function queueReactionTapPrompt(room: Room, promptIndex: number) {
    const state = room.reactionTapRoomState;
    const prompt = state?.prompts[promptIndex];

    if (!state || !prompt) {
        endGame(room.code);
        return;
    }

    const timeoutId = setTimeout(() => {
        startReactionTapPrompt(room.code, promptIndex);
    }, prompt.delayMs);
    state.timeoutIds.push(timeoutId);
}

function startReactionTapPrompt(roomCode: string, promptIndex: number) {
    const room = getRoom(roomCode);
    if (!room || room.phase !== "playing" || room.gameType !== "reactiontap") {
        return;
    }

    const state = room.reactionTapRoomState;
    const prompt = state?.prompts[promptIndex];
    if (!state || !prompt) return;

    state.activePromptIndex = promptIndex;
    state.activeSignalKind = prompt.kind;
    state.activeSignalStartedAt = Date.now();
    state.activeSignalEndsAt = state.activeSignalStartedAt + prompt.durationMs;

    io.to(room.code).emit("reactiontap:signal", buildReactionTapSignalPayload(room));

    const timeoutId = setTimeout(() => {
        resolveReactionTapPrompt(room.code, promptIndex);
    }, prompt.durationMs);
    state.timeoutIds.push(timeoutId);
}

function resolveReactionTapPrompt(roomCode: string, promptIndex: number) {
    const room = getRoom(roomCode);
    if (!room || room.phase !== "playing" || room.gameType !== "reactiontap") {
        return;
    }

    const state = room.reactionTapRoomState;
    const prompt = state?.prompts[promptIndex];
    if (!state || !prompt) return;

    const finishTime = Date.now() - state.roundStartedAt;

    state.activePromptIndex = null;
    state.activeSignalKind = "idle";
    state.activeSignalStartedAt = null;
    state.activeSignalEndsAt = null;

    io.to(room.code).emit("reactiontap:signal", buildReactionTapSignalPayload(room));

    for (const player of room.players.values()) {
        if (!player.reactionTapState || player.reactionTapState.done) continue;
        if (player.reactionTapState.promptsCompleted > promptIndex) continue;

        const nextFinishTime =
            player.reactionTapState.promptsCompleted + 1 >=
            player.reactionTapState.totalPrompts
                ? finishTime
                : null;

        player.reactionTapState =
            prompt.kind === "go"
                ? recordReactionTapMiss(player.reactionTapState, nextFinishTime)
                : recordReactionTapDecoy(player.reactionTapState, nextFinishTime);
        emitReactionTapState(room, player);
    }

    if (promptIndex >= state.prompts.length - 1) {
        completeReactionTapRoundIfReady(room);
        if (room.phase === "playing") {
            endGame(room.code);
        }
        return;
    }

    queueReactionTapPrompt(room, promptIndex + 1);
}

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

    if (room.phase === "lobby") {
        return;
    }

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
        const results = buildRoundResults(room);
        const lastRoundPoints = new Map<string, number>();
        const playerCount = room.players.size;

        if (room.gameType === "teamtug") {
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

    const basePayload = {
        gameType: room.gameType,
        roundNumber: room.currentRound,
        totalRounds: room.totalRounds,
    };

    if (room.gameType === "klotski" && player.puzzleState) {
        socket.emit("game:started", {
            ...basePayload,
            board: player.puzzleState.board,
            pieces: player.puzzleState.pieces,
        });
        setTimeout(() => {
            socket.emit("state:update", {
                board: player.puzzleState?.board,
                pieces: player.puzzleState?.pieces,
                moves: player.puzzleState?.moves ?? 0,
                solved: player.puzzleState?.solved ?? false,
            });
            if (player.rank !== null && player.puzzleState?.solved) {
                socket.emit("puzzle:solved", {
                    rank: player.rank,
                    moves: player.puzzleState.moves,
                    solveTime: player.puzzleState.solveTime,
                });
            }
        }, 0);
        return;
    }

    if (room.gameType === "bowman" && player.bowmanState) {
        socket.emit("game:started", {
            ...basePayload,
            wind: player.bowmanState.wind,
        });
        setTimeout(() => {
            socket.emit("bowman:sync", {
                shots: player.bowmanState?.shots ?? [],
                totalScore: player.bowmanState?.totalScore ?? 0,
                done: player.bowmanState?.done ?? false,
            });
        }, 0);
        return;
    }

    if (room.gameType === "rushhour" && player.rushHourState) {
        socket.emit("game:started", {
            ...basePayload,
            vehicles: player.rushHourState.vehicles,
        });
        setTimeout(() => {
            socket.emit("rushhour:update", {
                vehicles: player.rushHourState?.vehicles ?? [],
                moves: player.rushHourState?.moves ?? 0,
                solved: player.rushHourState?.solved ?? false,
            });
            if (player.rank !== null && player.rushHourState?.solved) {
                socket.emit("rushhour:solved", {
                    rank: player.rank,
                    moves: player.rushHourState.moves,
                    finishTime: player.rushHourState.finishTime,
                });
            }
        }, 0);
        return;
    }

    if (room.gameType === "lightsout" && player.lightsOutState) {
        socket.emit("game:started", {
            ...basePayload,
            board: player.lightsOutState.board,
        });
        setTimeout(() => {
            socket.emit("lightsout:update", {
                board: player.lightsOutState?.board ?? [],
                moves: player.lightsOutState?.moves ?? 0,
                solved: player.lightsOutState?.solved ?? false,
            });
            if (player.rank !== null && player.lightsOutState?.solved) {
                socket.emit("lightsout:solved", {
                    rank: player.rank,
                    moves: player.lightsOutState.moves,
                    finishTime: player.lightsOutState.finishTime,
                });
            }
        }, 0);
        return;
    }

    if (room.gameType === "codebreaker" && player.codebreakerState) {
        socket.emit("game:started", {
            ...basePayload,
            palette: [...CODEBREAKER_PALETTE],
            codeLength: CODEBREAKER_CODE_LENGTH,
            maxGuesses: CODEBREAKER_MAX_GUESSES,
        });
        setTimeout(() => {
            socket.emit("codebreaker:update", {
                guesses: player.codebreakerState?.guesses ?? [],
                solved: player.codebreakerState?.solved ?? false,
                done: player.codebreakerState?.done ?? false,
                finishTime: player.codebreakerState?.finishTime ?? null,
            });
            if (
                player.codebreakerState?.solved &&
                player.codebreakerState.finishTime !== null
            ) {
                socket.emit("codebreaker:solved", {
                    attempts: player.codebreakerState.guesses.length,
                    finishTime: player.codebreakerState.finishTime,
                });
            }
        }, 0);
        return;
    }

    if (room.gameType === "mathsprint" && player.mathSprintState) {
        socket.emit("game:started", {
            ...basePayload,
            durationMs: MATH_SPRINT_ROUND_DURATION_MS,
            endAt: room.roundEndAt,
            question: serializeMathSprintQuestion(player.mathSprintState),
            score: player.mathSprintState.score,
            answeredCount: player.mathSprintState.answeredCount,
            streak: player.mathSprintState.streak,
            bestStreak: player.mathSprintState.bestStreak,
            lastAnswerCorrect: player.mathSprintState.lastAnswerCorrect,
        });
        return;
    }

    if (room.gameType === "oddoneout" && player.oddOneOutState) {
        const oddOneOutState = player.oddOneOutState;
        socket.emit("game:started", {
            ...basePayload,
            prompt: getCurrentOddOneOutPrompt(oddOneOutState),
            promptCount: oddOneOutState.prompts.length,
        });
        setTimeout(() => {
            socket.emit("oddoneout:update", {
                prompt: getCurrentOddOneOutPrompt(oddOneOutState),
                promptsCleared: oddOneOutState.promptsCleared,
                totalPrompts: oddOneOutState.prompts.length,
                score: oddOneOutState.score,
                totalResponseTime: oddOneOutState.totalResponseTime,
                penaltyCount: oddOneOutState.penaltyCount,
                lockedOutUntil: oddOneOutState.lockedOutUntil,
                done: oddOneOutState.done,
                finishTime: oddOneOutState.finishTime,
            });
        }, 0);
        return;
    }

    if (room.gameType === "reactiontap" && player.reactionTapState) {
        socket.emit("game:started", {
            ...basePayload,
            totalPrompts: player.reactionTapState.totalPrompts,
            goPrompts: player.reactionTapState.goPrompts,
        });
        setTimeout(() => {
            const snapshot = buildReactionTapProgress(player);
            if (snapshot) {
                socket.emit("reactiontap:update", snapshot);
            }
            socket.emit("reactiontap:signal", buildReactionTapSignalPayload(room));
        }, 0);
        return;
    }

    if (room.gameType === "teamtug" && room.teamTugState) {
        socket.emit("game:started", {
            ...basePayload,
            teamTugState: serializeTeamTugState(room),
        });
        return;
    }

    if (room.gameType === "pipeconnect" && player.pipeConnectState) {
        socket.emit("game:started", {
            ...basePayload,
            tiles: toPublicPipeConnectTiles(player.pipeConnectState.tiles),
        });
        setTimeout(() => {
            socket.emit("pipeconnect:update", {
                tiles: player.pipeConnectState
                    ? toPublicPipeConnectTiles(player.pipeConnectState.tiles)
                    : [],
                moves: player.pipeConnectState?.moves ?? 0,
                solved: player.pipeConnectState?.solved ?? false,
            });
            if (player.rank !== null && player.pipeConnectState?.solved) {
                socket.emit("pipeconnect:solved", {
                    rank: player.rank,
                    moves: player.pipeConnectState.moves,
                    finishTime: player.pipeConnectState.finishTime,
                });
            }
        }, 0);
        return;
    }

    if (room.gameType === "simoncopy" && player.simonCopyState) {
        socket.emit("game:started", {
            ...basePayload,
            sequence: player.simonCopyState.sequence,
            maxRounds: SIMON_COPY_MAX_ROUNDS,
            colors: [...SIMON_COPY_COLORS],
        });
        setTimeout(() => {
            socket.emit("simoncopy:update", {
                currentRound: player.simonCopyState?.currentRound ?? 1,
                solved: player.simonCopyState?.solved ?? false,
                done: player.simonCopyState?.done ?? false,
                failed: player.simonCopyState?.failed ?? false,
                finishTime: player.simonCopyState?.finishTime ?? null,
            });
            if (player.rank !== null && player.simonCopyState?.solved) {
                socket.emit("simoncopy:solved", {
                    rank: player.rank,
                    roundReached: player.simonCopyState.currentRound,
                    finishTime: player.simonCopyState.finishTime,
                });
            }
        }, 0);
        return;
    }

    if (
        room.gameType === "memorysequenceplus" &&
        player.memorySequencePlusState
    ) {
        socket.emit("game:started", {
            ...basePayload,
            sequence: player.memorySequencePlusState.sequence,
            maxRounds: MEMORY_SEQUENCE_PLUS_MAX_ROUNDS,
            gridSize: MEMORY_SEQUENCE_PLUS_GRID_SIZE,
        });
        setTimeout(() => {
            socket.emit("memorysequenceplus:update", {
                currentRound: player.memorySequencePlusState?.currentRound ?? 1,
                solved: player.memorySequencePlusState?.solved ?? false,
                done: player.memorySequencePlusState?.done ?? false,
                failed: player.memorySequencePlusState?.failed ?? false,
                finishTime: player.memorySequencePlusState?.finishTime ?? null,
            });
            if (
                player.rank !== null &&
                player.memorySequencePlusState?.solved
            ) {
                socket.emit("memorysequenceplus:solved", {
                    rank: player.rank,
                    roundReached: player.memorySequencePlusState.currentRound,
                    finishTime: player.memorySequencePlusState.finishTime,
                });
            }
        }, 0);
        return;
    }

    if (room.gameType === "pairmatch" && player.pairMatchState) {
        socket.emit("game:started", {
            ...basePayload,
            tiles: toPublicPairMatchTiles(player.pairMatchState.tiles),
        });
        setTimeout(() => {
            socket.emit("pairmatch:update", {
                tiles: toPublicPairMatchTiles(player.pairMatchState?.tiles ?? []),
                attempts: player.pairMatchState?.attempts ?? 0,
                pairsFound: player.pairMatchState?.pairsFound ?? 0,
                totalPairs: PAIR_MATCH_PAIR_COUNT,
                solved: player.pairMatchState?.solved ?? false,
                done: player.pairMatchState?.done ?? false,
                busy: player.pairMatchState?.busy ?? false,
                finishTime: player.pairMatchState?.finishTime ?? null,
            });
            if (player.rank !== null && player.pairMatchState?.solved) {
                socket.emit("pairmatch:solved", {
                    rank: player.rank,
                    attempts: player.pairMatchState.attempts,
                    finishTime: player.pairMatchState.finishTime,
                });
            }
        }, 0);
    }
}

function clearRoundState(room: Room) {
    clearReactionTapTimers(room);
    room.gameStartTime = null;
    room.finishOrder = [];
    room.roundReadyPlayerSessionIds.clear();
    room.roundReadyOpensAt = null;
    room.roundEndAt = null;
    room.teamTugState = null;
    room.reactionTapRoomState = null;
    for (const player of room.players.values()) {
        player.puzzleState = null;
        player.bowmanState = null;
        player.rushHourState = null;
        player.lightsOutState = null;
        player.codebreakerState = null;
        player.mathSprintState = null;
        if (player.pairMatchState?.mismatchTimeout) {
            clearTimeout(player.pairMatchState.mismatchTimeout);
        }
        player.pairMatchState = null;
        player.pipeConnectState = null;
        player.simonCopyState = null;
        player.memorySequencePlusState = null;
        player.oddOneOutState = null;
        player.teamTugState = null;
        player.reactionTapState = null;
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
    } else if (room.gameType === "mathsprint") {
        room.roundEndAt = Date.now() + MATH_SPRINT_ROUND_DURATION_MS;
        const sharedStartTime = room.gameStartTime ?? Date.now();
        io.to(room.hostSocketId).emit("game:started", {
            gameType: "mathsprint",
            durationMs: MATH_SPRINT_ROUND_DURATION_MS,
            endAt: room.roundEndAt,
            roundNumber: room.currentRound,
            totalRounds: room.totalRounds,
        });
        for (const player of room.players.values()) {
            player.mathSprintState = createMathSprintState(sharedStartTime);
            io.to(room.hostSocketId).emit("mathsprint:progress", {
                playerId: player.id,
                score: 0,
                answeredCount: 0,
                streak: 0,
                bestStreak: 0,
                lastAnswerCorrect: null,
                currentQuestion: serializeMathSprintQuestion(
                    player.mathSprintState,
                ),
                done: false,
                finishTime: null,
            });
            io.to(player.id).emit("game:started", {
                gameType: "mathsprint",
                durationMs: MATH_SPRINT_ROUND_DURATION_MS,
                endAt: room.roundEndAt,
                question: serializeMathSprintQuestion(player.mathSprintState),
                score: 0,
                answeredCount: 0,
                streak: 0,
                bestStreak: 0,
                lastAnswerCorrect: null,
                roundNumber: room.currentRound,
                totalRounds: room.totalRounds,
            });
        }
        room.roundEndTimeout = setTimeout(() => {
            room.roundEndTimeout = null;

            if (getRoom(room.code) !== room) return;
            endGame(room.code);
        }, MATH_SPRINT_ROUND_DURATION_MS);
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
    } else if (room.gameType === "pairmatch") {
        const initialState = createPairMatchState();
        const layout = getPairMatchLayout(initialState);
        for (const player of room.players.values()) {
            player.pairMatchState = createPairMatchState(layout);
        }
        io.to(room.code).emit("game:started", {
            gameType: "pairmatch",
            tiles: toPublicPairMatchTiles(initialState.tiles),
            roundNumber: room.currentRound,
            totalRounds: room.totalRounds,
        });
    } else if (room.gameType === "oddoneout") {
        const promptSet = createOddOneOutPromptSet();
        for (const player of room.players.values()) {
            player.oddOneOutState = createOddOneOutState(promptSet);
        }
        io.to(room.code).emit("game:started", {
            gameType: "oddoneout",
            prompt: promptSet[0] ?? null,
            promptCount: promptSet.length,
            roundNumber: room.currentRound,
            totalRounds: room.totalRounds,
        });
        for (const player of room.players.values()) {
            io.to(room.hostSocketId).emit("oddoneout:progress", {
                playerId: player.id,
                promptsCleared: 0,
                totalPrompts: promptSet.length,
                score: 0,
                totalResponseTime: 0,
                penaltyCount: 0,
                lockedOutUntil: null,
                done: false,
                finishTime: null,
                currentPrompt: promptSet[0] ?? null,
            });
        }
    } else if (room.gameType === "reactiontap") {
        room.reactionTapRoomState = createReactionTapRoomState();
        for (const player of room.players.values()) {
            player.reactionTapState = createReactionTapState();
        }
        io.to(room.code).emit("game:started", {
            gameType: "reactiontap",
            totalPrompts: REACTION_TAP_TOTAL_PROMPTS,
            goPrompts: REACTION_TAP_GO_PROMPTS,
            roundNumber: room.currentRound,
            totalRounds: room.totalRounds,
        });
        io.to(room.code).emit("reactiontap:signal", buildReactionTapSignalPayload(room));
        emitAllReactionTapStates(room);
        queueReactionTapPrompt(room, 0);
    } else if (room.gameType === "teamtug") {
        room.teamTugState = createTeamTugState(
            [...room.players.values()].map((player) => ({
                sessionId: player.sessionId,
            })),
        );

        for (const player of room.players.values()) {
            player.teamTugState = room.teamTugState;
        }

        room.roundEndAt = Date.now() + room.teamTugState.timeLimitMs;
        room.roundEndTimeout = setTimeout(() => {
            room.roundEndTimeout = null;

            if (getRoom(room.code) !== room) return;
            if (room.phase !== "playing" || room.gameType !== "teamtug") return;
            if (room.teamTugState) {
                room.teamTugState.winnerTeamId = getLeadingTeamTugTeamId(
                    room.teamTugState,
                );
            }
            endGame(room.code);
        }, room.teamTugState.timeLimitMs);

        io.to(room.code).emit("game:started", {
            gameType: "teamtug",
            teamTugState: serializeTeamTugState(room),
            roundNumber: room.currentRound,
            totalRounds: room.totalRounds,
        });
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
            gameType !== "mathsprint" &&
            gameType !== "pipeconnect" &&
            gameType !== "simoncopy" &&
            gameType !== "memorysequenceplus" &&
            gameType !== "pairmatch" &&
            gameType !== "oddoneout" &&
            gameType !== "reactiontap" &&
            gameType !== "teamtug"
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
                puzzleState: null,
                bowmanState: null,
                rushHourState: null,
                lightsOutState: null,
                codebreakerState: null,
                mathSprintState: null,
                pipeConnectState: null,
                simonCopyState: null,
                memorySequencePlusState: null,
                pairMatchState: null,
                oddOneOutState: null,
                teamTugState: null,
                reactionTapState: null,
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
        for (const player of room.players.values()) {
            player.matchPoints = 0;
            player.roundsWon = 0;
        }

        queueRoundStart(room);
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

            const player = getPlayerBySocket(room, socket.id);
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
                if (!room.finishOrder.includes(player.id))
                    room.finishOrder.push(player.id);
                rank = room.finishOrder.indexOf(player.id) + 1;
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

            const player = getPlayerBySocket(room, socket.id);
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

            if (state.done && !room.finishOrder.includes(player.id)) {
                room.finishOrder.push(player.id);
                player.rank = room.finishOrder.indexOf(player.id) + 1;
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

            const player = getPlayerBySocket(room, socket.id);
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
                if (!room.finishOrder.includes(player.id))
                    room.finishOrder.push(player.id);
                rank = room.finishOrder.indexOf(player.id) + 1;
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

            const player = getPlayerBySocket(room, socket.id);
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
                if (!room.finishOrder.includes(player.id))
                    room.finishOrder.push(player.id);
                rank = room.finishOrder.indexOf(player.id) + 1;
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

        const player = getPlayerBySocket(room, socket.id);
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

    socket.on(
        "mathsprint:answer",
        ({
            questionId,
            answerIndex,
        }: {
            questionId: number;
            answerIndex: number;
        }) => {
            const room = getRoomBySocket(socket.id);
            if (
                !room ||
                room.phase !== "playing" ||
                room.gameType !== "mathsprint"
            ) {
                return;
            }

            if (room.roundEndAt !== null && Date.now() > room.roundEndAt) {
                return;
            }

            const player = getPlayerBySocket(room, socket.id);
            if (!player?.mathSprintState || player.mathSprintState.done) return;

            const { ok, state, correct } = submitMathSprintAnswer(
                player.mathSprintState,
                questionId,
                answerIndex,
            );
            if (!ok) return;

            player.mathSprintState = state;

            socket.emit("mathsprint:update", {
                question: serializeMathSprintQuestion(state),
                score: state.score,
                answeredCount: state.answeredCount,
                streak: state.streak,
                bestStreak: state.bestStreak,
                lastAnswerCorrect: correct,
            });

            io.to(room.hostSocketId).emit("mathsprint:progress", {
                playerId: socket.id,
                score: state.score,
                answeredCount: state.answeredCount,
                streak: state.streak,
                bestStreak: state.bestStreak,
                lastAnswerCorrect: state.lastAnswerCorrect,
                currentQuestion: serializeMathSprintQuestion(state),
                done: false,
                finishTime: null,
            });
        },
    );

    socket.on("teamtug:pull", () => {
        const room = getRoomBySocket(socket.id);
        if (!room || room.phase !== "playing" || room.gameType !== "teamtug") {
            return;
        }

        const player = getPlayerBySocket(room, socket.id);
        if (!player || !room.teamTugState) return;
        if (room.roundEndAt !== null && Date.now() > room.roundEndAt) {
            return;
        }

        const { ok, state, winnerTeamId } = applyTeamTugPull(
            room.teamTugState,
            player.sessionId,
        );
        if (!ok) return;

        room.teamTugState = state;
        player.teamTugState = state;

        const snapshot = serializeTeamTugState(room);
        if (!snapshot) return;

        io.to(room.code).emit("teamtug:update", snapshot);

        if (winnerTeamId) {
            clearRoundEndTimeout(room);
            room.teamTugState.winnerTeamId = winnerTeamId;
            endGame(room.code);
        }
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

        const player = getPlayerBySocket(room, socket.id);
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
            if (!room.finishOrder.includes(player.id)) {
                room.finishOrder.push(player.id);
            }
            rank = room.finishOrder.indexOf(player.id) + 1;
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

        const player = getPlayerBySocket(room, socket.id);
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
            if (!room.finishOrder.includes(player.id)) {
                room.finishOrder.push(player.id);
            }
            rank = room.finishOrder.indexOf(player.id) + 1;
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

            const player = getPlayerBySocket(room, socket.id);
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
                if (!room.finishOrder.includes(player.id)) {
                    room.finishOrder.push(player.id);
                }
                rank = room.finishOrder.indexOf(player.id) + 1;
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

    socket.on("reactiontap:tap", () => {
        const room = getRoomBySocket(socket.id);
        if (!room || room.phase !== "playing" || room.gameType !== "reactiontap") {
            return;
        }

        const player = getPlayerBySocket(room, socket.id);
        const roundState = room.reactionTapRoomState;
        if (!player?.reactionTapState || !roundState || player.reactionTapState.done) {
            return;
        }

        const activePromptIndex = roundState.activePromptIndex;
        const prompt =
            activePromptIndex === null
                ? null
                : roundState.prompts[activePromptIndex] ?? null;
        const canScoreSuccess =
            prompt?.kind === "go" &&
            activePromptIndex !== null &&
            roundState.activeSignalStartedAt !== null &&
            roundState.activeSignalEndsAt !== null &&
            Date.now() <= roundState.activeSignalEndsAt &&
            player.reactionTapState.promptsCompleted <= activePromptIndex;

        if (canScoreSuccess) {
            const reactionTime =
                Date.now() - (roundState.activeSignalStartedAt ?? Date.now());
            const finishTime =
                player.reactionTapState.promptsCompleted + 1 >=
                player.reactionTapState.totalPrompts
                    ? Date.now() - roundState.roundStartedAt
                    : null;
            player.reactionTapState = recordReactionTapSuccess(
                player.reactionTapState,
                reactionTime,
                finishTime,
            );
        } else {
            player.reactionTapState = recordReactionTapPenalty(
                player.reactionTapState,
            );
        }

        emitReactionTapState(room, player);
        completeReactionTapRoundIfReady(room);
    });

    // ── Player selects the odd item ────────────────────────────────
    socket.on("oddoneout:select", ({ index }: { index: number }) => {
        const room = getRoomBySocket(socket.id);
        if (
            !room ||
            room.phase !== "playing" ||
            room.gameType !== "oddoneout"
        ) {
            return;
        }

        const player = getPlayerBySocket(room, socket.id);
        if (!player?.oddOneOutState || player.oddOneOutState.done) return;

        const { ok, state } = processOddOneOutSelection(
            player.oddOneOutState,
            index,
        );
        if (!ok) return;

        player.oddOneOutState = state;

        const prompt = getCurrentOddOneOutPrompt(state);

        socket.emit("oddoneout:update", {
            prompt,
            promptsCleared: state.promptsCleared,
            totalPrompts: state.prompts.length,
            score: state.score,
            totalResponseTime: state.totalResponseTime,
            penaltyCount: state.penaltyCount,
            lockedOutUntil: state.lockedOutUntil,
            done: state.done,
            finishTime: state.finishTime,
        });

        io.to(room.hostSocketId).emit("oddoneout:progress", {
            playerId: socket.id,
            promptsCleared: state.promptsCleared,
            totalPrompts: state.prompts.length,
            score: state.score,
            totalResponseTime: state.totalResponseTime,
            penaltyCount: state.penaltyCount,
            lockedOutUntil: state.lockedOutUntil,
            done: state.done,
            finishTime: state.finishTime,
            currentPrompt: prompt,
        });

        const allDone = [...room.players.values()].every(
            (candidate) => candidate.oddOneOutState?.done,
        );
        if (allDone) endGame(room.code);
    });

    socket.on("pairmatch:flip", ({ tileId }: { tileId: string }) => {
        const room = getRoomBySocket(socket.id);
        if (!room || room.phase !== "playing" || room.gameType !== "pairmatch") {
            return;
        }

        const player = getPlayerBySocket(room, socket.id);
        if (!player?.pairMatchState || player.pairMatchState.done) return;

        const { ok, state } = flipPairMatchTile(player.pairMatchState, tileId);
        if (!ok) return;

        player.pairMatchState = state;

        socket.emit("pairmatch:update", {
            tiles: toPublicPairMatchTiles(state.tiles),
            attempts: state.attempts,
            pairsFound: state.pairsFound,
            totalPairs: PAIR_MATCH_PAIR_COUNT,
            solved: state.solved,
            done: state.done,
            busy: state.busy,
            finishTime: state.finishTime,
        });

        let rank: number | null = null;
        if (state.solved) {
            if (!room.finishOrder.includes(player.id)) {
                room.finishOrder.push(player.id);
            }
            rank = room.finishOrder.indexOf(player.id) + 1;
            player.rank = rank;
            socket.emit("pairmatch:solved", {
                rank,
                attempts: state.attempts,
                finishTime: state.finishTime,
            });
        }

        io.to(room.hostSocketId).emit("pairmatch:progress", {
            playerId: player.id,
            attempts: state.attempts,
            pairsFound: state.pairsFound,
            totalPairs: PAIR_MATCH_PAIR_COUNT,
            solved: state.solved,
            done: state.done,
            busy: state.busy,
            rank,
            finishTime: state.finishTime,
            tiles: toPublicPairMatchTiles(state.tiles),
        });

        if (state.busy) {
            if (state.mismatchTimeout) {
                clearTimeout(state.mismatchTimeout);
            }

            state.mismatchTimeout = setTimeout(() => {
                const currentRoom = getRoom(room.code);
                if (!currentRoom || currentRoom.phase !== "playing") return;
                if (currentRoom.gameType !== "pairmatch") return;

                const currentPlayer = currentRoom.players.get(player.sessionId);
                if (!currentPlayer?.pairMatchState?.busy) return;

                currentPlayer.pairMatchState = clearPairMatchMismatch(
                    currentPlayer.pairMatchState,
                );

                io.to(currentPlayer.id).emit("pairmatch:update", {
                    tiles: toPublicPairMatchTiles(currentPlayer.pairMatchState.tiles),
                    attempts: currentPlayer.pairMatchState.attempts,
                    pairsFound: currentPlayer.pairMatchState.pairsFound,
                    totalPairs: PAIR_MATCH_PAIR_COUNT,
                    solved: currentPlayer.pairMatchState.solved,
                    done: currentPlayer.pairMatchState.done,
                    busy: currentPlayer.pairMatchState.busy,
                    finishTime: currentPlayer.pairMatchState.finishTime,
                });

                io.to(currentRoom.hostSocketId).emit("pairmatch:progress", {
                    playerId: currentPlayer.id,
                    attempts: currentPlayer.pairMatchState.attempts,
                    pairsFound: currentPlayer.pairMatchState.pairsFound,
                    totalPairs: PAIR_MATCH_PAIR_COUNT,
                    solved: currentPlayer.pairMatchState.solved,
                    done: currentPlayer.pairMatchState.done,
                    busy: currentPlayer.pairMatchState.busy,
                    rank: currentPlayer.rank,
                    finishTime: currentPlayer.pairMatchState.finishTime,
                    tiles: toPublicPairMatchTiles(currentPlayer.pairMatchState.tiles),
                });
            }, PAIR_MATCH_MISMATCH_REVEAL_MS);
        }

        const allSolved = [...room.players.values()].every(
            (entry) => entry.pairMatchState?.solved,
        );
        if (allSolved) endGame(room.code);
    });

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
            clearPendingRoundStart(room);
            clearPendingResultsAdvance(room);
            clearRoundEndTimeout(room);
            clearReactionTapTimers(room);
            io.to(room.code).emit("error", { message: "Host disconnected." });
            deleteRoom(room.code);
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

function endGame(roomCode: string) {
    const room = getRoom(roomCode);
    if (!room) return;
    if (room.phase !== "playing") return;
    clearPendingResultsAdvance(room);
    clearRoundEndTimeout(room);
    clearReactionTapTimers(room);
    room.phase = "results";

    if (room.gameType === "mathsprint") {
        for (const player of room.players.values()) {
            if (player.mathSprintState) {
                player.mathSprintState = finishMathSprintState(
                    player.mathSprintState,
                );
            }
        }
    }

    const results = buildRoundResults(room);

    const lastRoundPoints = new Map<string, number>();
    const playerCount = room.players.size;
    if (room.gameType === "teamtug") {
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

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
    const protocol = useLocalHttps ? "https" : "http";
    console.log(`Server running on ${protocol}://localhost:${PORT}`);
});
