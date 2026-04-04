import type { GameHandler, SocketType } from "../gameHandler.js";
import type { ReactionTapState, ReactionTapRoomState, ReactionTapSignalKind } from "../reactiontap.js";
import {
    REACTION_TAP_GO_PROMPTS,
    REACTION_TAP_TOTAL_PROMPTS,
    createReactionTapRoomState,
    createReactionTapState,
    recordReactionTapDecoy,
    recordReactionTapMiss,
    recordReactionTapPenalty,
    recordReactionTapSuccess,
} from "../reactiontap.js";
import type { Server } from "socket.io";
import type { Player, Room } from "../types.js";
import { getRoom } from "../rooms.js";

function s(state: unknown): ReactionTapState {
    return state as ReactionTapState;
}

function buildSignalPayload(room: Room) {
    const state = room.reactionTapRoomState;
    const kind: ReactionTapSignalKind = state?.activeSignalKind ?? "idle";

    return {
        promptIndex: state?.activePromptIndex ?? -1,
        totalPrompts: state?.prompts.length ?? REACTION_TAP_TOTAL_PROMPTS,
        kind,
        label: kind === "go" ? "TAP!" : kind === "decoy" ? "WAIT" : "Stand by",
        activeUntil: state?.activeSignalEndsAt ?? null,
        startedAt: state?.activeSignalStartedAt ?? null,
    };
}

function buildProgress(player: Player) {
    const st = s(player.gameState);
    return {
        playerId: player.id,
        promptsCompleted: st.promptsCompleted,
        totalPrompts: st.totalPrompts,
        goPrompts: st.goPrompts,
        successfulPrompts: st.successfulPrompts,
        missedPrompts: st.missedPrompts,
        penalties: st.penalties,
        score: st.score,
        averageReactionTime: st.averageReactionTime,
        bestReactionTime: st.bestReactionTime,
        latestReactionTime: st.latestReactionTime,
        latestOutcome: st.latestOutcome,
        done: st.done,
    };
}

function emitPlayerState(io: Server, room: Room, player: Player) {
    const snapshot = buildProgress(player);
    io.to(room.hostSocketId).emit("reactiontap:progress", snapshot);
    io.to(player.id).emit("reactiontap:update", snapshot);
}

function emitAllPlayerStates(io: Server, room: Room) {
    for (const player of room.players.values()) {
        emitPlayerState(io, room, player);
    }
}

function clearTimers(room: Room) {
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

function completeRoundIfReady(
    room: Room,
    endGame: (roomCode: string) => void,
) {
    const allDone = [...room.players.values()].every(
        (player) => s(player.gameState).done,
    );

    if (allDone) {
        endGame(room.code);
    }
}

function queuePrompt(
    io: Server,
    room: Room,
    promptIndex: number,
    endGame: (roomCode: string) => void,
) {
    const state = room.reactionTapRoomState;
    const prompt = state?.prompts[promptIndex];

    if (!state || !prompt) {
        endGame(room.code);
        return;
    }

    const timeoutId = setTimeout(() => {
        startPrompt(io, room.code, promptIndex, endGame);
    }, prompt.delayMs);
    state.timeoutIds.push(timeoutId);
}

function startPrompt(
    io: Server,
    roomCode: string,
    promptIndex: number,
    endGame: (roomCode: string) => void,
) {
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

    io.to(room.code).emit("reactiontap:signal", buildSignalPayload(room));

    const timeoutId = setTimeout(() => {
        resolvePrompt(io, room.code, promptIndex, endGame);
    }, prompt.durationMs);
    state.timeoutIds.push(timeoutId);
}

function resolvePrompt(
    io: Server,
    roomCode: string,
    promptIndex: number,
    endGame: (roomCode: string) => void,
) {
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

    io.to(room.code).emit("reactiontap:signal", buildSignalPayload(room));

    for (const player of room.players.values()) {
        const st = s(player.gameState);
        if (st.done) continue;
        if (st.promptsCompleted > promptIndex) continue;

        const nextFinishTime =
            st.promptsCompleted + 1 >= st.totalPrompts ? finishTime : null;

        player.gameState =
            prompt.kind === "go"
                ? recordReactionTapMiss(st, nextFinishTime)
                : recordReactionTapDecoy(st, nextFinishTime);
        emitPlayerState(io, room, player);
    }

    if (promptIndex >= state.prompts.length - 1) {
        completeRoundIfReady(room, endGame);
        if (room.phase === "playing") {
            endGame(room.code);
        }
        return;
    }

    queuePrompt(io, room, promptIndex + 1, endGame);
}

export const reactiontapHandler: GameHandler = {
    type: "reactiontap",

    createSeed() {
        return null;
    },
    createState() {
        return createReactionTapState();
    },
    startPayload() {
        return {
            totalPrompts: REACTION_TAP_TOTAL_PROMPTS,
            goPrompts: REACTION_TAP_GO_PROMPTS,
        };
    },

    customStart: true,
    onStart(io: Server, room: Room, _seed: unknown, endGame: (roomCode: string) => void) {
        room.reactionTapRoomState = createReactionTapRoomState();

        io.to(room.code).emit("game:started", {
            gameType: "reactiontap",
            totalPrompts: REACTION_TAP_TOTAL_PROMPTS,
            goPrompts: REACTION_TAP_GO_PROMPTS,
            roundNumber: room.currentRound,
            totalRounds: room.totalRounds,
        });
        io.to(room.code).emit(
            "reactiontap:signal",
            buildSignalPayload(room),
        );
        emitAllPlayerStates(io, room);
        queuePrompt(io, room, 0, endGame);
    },

    onCleanup(room: Room) {
        clearTimers(room);
        room.reactionTapRoomState = null;
    },

    customAction: true,
    onAction(
        io: Server,
        room: Room,
        socket: SocketType,
        _data: unknown,
        endGame: (roomCode: string) => void,
    ) {
        const player = [...room.players.values()].find(
            (p) => p.id === socket.id,
        );
        const roundState = room.reactionTapRoomState;
        if (!player?.gameState || !roundState || s(player.gameState).done) {
            return;
        }

        const st = s(player.gameState);
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
            st.promptsCompleted <= activePromptIndex;

        if (canScoreSuccess) {
            const reactionTime =
                Date.now() - (roundState.activeSignalStartedAt ?? Date.now());
            const finishTime =
                st.promptsCompleted + 1 >= st.totalPrompts
                    ? Date.now() - roundState.roundStartedAt
                    : null;
            player.gameState = recordReactionTapSuccess(st, reactionTime, finishTime);
        } else {
            player.gameState = recordReactionTapPenalty(st);
        }

        emitPlayerState(io, room, player);
        completeRoundIfReady(room, endGame);
    },

    actionEvent: "reactiontap:tap",
    applyAction(state, _data) {
        return { ok: false, state };
    },
    isPlayerDone(state) {
        return s(state).done;
    },
    shouldTrackFinish() {
        return false;
    },

    updateEvent: "reactiontap:update",
    updatePayload(state) {
        const st = s(state);
        return {
            promptsCompleted: st.promptsCompleted,
            totalPrompts: st.totalPrompts,
            goPrompts: st.goPrompts,
            successfulPrompts: st.successfulPrompts,
            missedPrompts: st.missedPrompts,
            penalties: st.penalties,
            score: st.score,
            averageReactionTime: st.averageReactionTime,
            bestReactionTime: st.bestReactionTime,
            latestReactionTime: st.latestReactionTime,
            latestOutcome: st.latestOutcome,
            done: st.done,
        };
    },

    solvedEvent: null,
    solvedPayload() {
        return {};
    },

    progressEvent: "reactiontap:progress",
    progressPayload(state, playerId) {
        const st = s(state);
        return {
            playerId,
            promptsCompleted: st.promptsCompleted,
            totalPrompts: st.totalPrompts,
            goPrompts: st.goPrompts,
            successfulPrompts: st.successfulPrompts,
            missedPrompts: st.missedPrompts,
            penalties: st.penalties,
            score: st.score,
            averageReactionTime: st.averageReactionTime,
            bestReactionTime: st.bestReactionTime,
            latestReactionTime: st.latestReactionTime,
            latestOutcome: st.latestOutcome,
            done: st.done,
        };
    },

    resumeStartPayload(state) {
        const st = s(state);
        return {
            totalPrompts: st.totalPrompts,
            goPrompts: st.goPrompts,
        };
    },
    resumeSyncEvent: "reactiontap:update",
    resumeSyncPayload(state) {
        const st = s(state);
        return {
            promptsCompleted: st.promptsCompleted,
            totalPrompts: st.totalPrompts,
            goPrompts: st.goPrompts,
            successfulPrompts: st.successfulPrompts,
            missedPrompts: st.missedPrompts,
            penalties: st.penalties,
            score: st.score,
            averageReactionTime: st.averageReactionTime,
            bestReactionTime: st.bestReactionTime,
            latestReactionTime: st.latestReactionTime,
            latestOutcome: st.latestOutcome,
            done: st.done,
        };
    },
    shouldResumeSolved() {
        return false;
    },
    resumeSolvedPayload() {
        return {};
    },

    buildResults(players) {
        return players
            .map(({ id, name, state }) => ({
                id,
                name,
                successfulPrompts: s(state).successfulPrompts ?? 0,
                goPrompts: s(state).goPrompts ?? REACTION_TAP_GO_PROMPTS,
                missedPrompts: s(state).missedPrompts ?? 0,
                penalties: s(state).penalties ?? 0,
                score: s(state).score ?? 0,
                averageReactionTime: s(state).averageReactionTime ?? null,
                bestReactionTime: s(state).bestReactionTime ?? null,
                finishTime: s(state).finishTime ?? null,
                rank: null as number | null,
            }))
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (b.successfulPrompts !== a.successfulPrompts)
                    return b.successfulPrompts - a.successfulPrompts;
                if (a.penalties !== b.penalties) return a.penalties - b.penalties;
                if (
                    a.averageReactionTime !== null &&
                    b.averageReactionTime !== null &&
                    a.averageReactionTime !== b.averageReactionTime
                )
                    return a.averageReactionTime - b.averageReactionTime;
                if (a.averageReactionTime !== null) return -1;
                if (b.averageReactionTime !== null) return 1;
                if (
                    a.bestReactionTime !== null &&
                    b.bestReactionTime !== null &&
                    a.bestReactionTime !== b.bestReactionTime
                )
                    return a.bestReactionTime - b.bestReactionTime;
                if (a.bestReactionTime !== null) return -1;
                if (b.bestReactionTime !== null) return 1;
                if (a.finishTime !== null && b.finishTime !== null)
                    return a.finishTime - b.finishTime;
                if (a.finishTime !== null) return -1;
                if (b.finishTime !== null) return 1;
                return 0;
            })
            .map((result, index) => ({ ...result, rank: index + 1 }));
    },
};
