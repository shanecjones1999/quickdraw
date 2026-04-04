import type { GameHandler } from "../gameHandler.js";
import type { MathSprintState } from "../mathsprint.js";
import {
    MATH_SPRINT_ROUND_DURATION_MS,
    createMathSprintState,
    finishMathSprintState,
    serializeMathSprintQuestion,
    submitMathSprintAnswer,
} from "../mathsprint.js";
import type { Server } from "socket.io";
import type { Room } from "../types.js";
import { getRoom } from "../rooms.js";

function s(state: unknown): MathSprintState {
    return state as MathSprintState;
}

export const mathsprintHandler: GameHandler = {
    type: "mathsprint",

    createSeed() {
        return Date.now(); // shared start time
    },
    createState(seed) {
        return createMathSprintState(seed as number);
    },
    startPayload() {
        return { durationMs: MATH_SPRINT_ROUND_DURATION_MS };
    },

    customStart: true,
    onStart(io: Server, room: Room, seed: unknown, endGame: (roomCode: string) => void) {
        const endAt = Date.now() + MATH_SPRINT_ROUND_DURATION_MS;
        room.roundEndAt = endAt;

        // Host gets a simpler started message
        io.to(room.hostSocketId).emit("game:started", {
            gameType: "mathsprint",
            durationMs: MATH_SPRINT_ROUND_DURATION_MS,
            endAt,
            roundNumber: room.currentRound,
            totalRounds: room.totalRounds,
        });

        // Each player gets their own question
        for (const player of room.players.values()) {
            const st = s(player.gameState);
            io.to(room.hostSocketId).emit("mathsprint:progress", {
                playerId: player.id,
                score: 0,
                answeredCount: 0,
                streak: 0,
                bestStreak: 0,
                lastAnswerCorrect: null,
                currentQuestion: serializeMathSprintQuestion(st),
                done: false,
                finishTime: null,
            });
            io.to(player.id).emit("game:started", {
                gameType: "mathsprint",
                durationMs: MATH_SPRINT_ROUND_DURATION_MS,
                endAt,
                question: serializeMathSprintQuestion(st),
                score: 0,
                answeredCount: 0,
                streak: 0,
                bestStreak: 0,
                lastAnswerCorrect: null,
                roundNumber: room.currentRound,
                totalRounds: room.totalRounds,
            });
        }

        // Schedule round end
        room.roundEndTimeout = setTimeout(() => {
            room.roundEndTimeout = null;
            if (getRoom(room.code) !== room) return;

            endGame(room.code);
        }, MATH_SPRINT_ROUND_DURATION_MS);
    },

    onCleanup(room: Room) {
        if (room.roundEndTimeout) {
            clearTimeout(room.roundEndTimeout);
            room.roundEndTimeout = null;
        }
        room.roundEndAt = null;
    },

    actionEvent: "mathsprint:answer",
    applyAction(state, data) {
        const { questionId, answerIndex } = data as {
            questionId: number;
            answerIndex: number;
        };
        const { ok, state: newState } = submitMathSprintAnswer(
            s(state),
            questionId,
            answerIndex,
        );
        return { ok, state: newState };
    },
    isPlayerDone(state) {
        return s(state).done;
    },
    shouldTrackFinish() {
        return false; // ranked by score, timer-based
    },

    updateEvent: "mathsprint:update",
    updatePayload(state) {
        const st = s(state);
        return {
            question: serializeMathSprintQuestion(st),
            score: st.score,
            answeredCount: st.answeredCount,
            streak: st.streak,
            bestStreak: st.bestStreak,
            lastAnswerCorrect: st.lastAnswerCorrect,
        };
    },

    solvedEvent: null,
    solvedPayload() {
        return {};
    },

    progressEvent: "mathsprint:progress",
    progressPayload(state, playerId) {
        const st = s(state);
        return {
            playerId,
            score: st.score,
            answeredCount: st.answeredCount,
            streak: st.streak,
            bestStreak: st.bestStreak,
            lastAnswerCorrect: st.lastAnswerCorrect,
            currentQuestion: serializeMathSprintQuestion(st),
            done: false,
            finishTime: null,
        };
    },

    resumeStartPayload(state) {
        const st = s(state);
        return {
            durationMs: MATH_SPRINT_ROUND_DURATION_MS,
            question: serializeMathSprintQuestion(st),
            score: st.score,
            answeredCount: st.answeredCount,
            streak: st.streak,
            bestStreak: st.bestStreak,
            lastAnswerCorrect: st.lastAnswerCorrect,
        };
    },
    resumeSyncEvent: "mathsprint:update",
    resumeSyncPayload(state) {
        const st = s(state);
        return {
            question: serializeMathSprintQuestion(st),
            score: st.score,
            answeredCount: st.answeredCount,
            streak: st.streak,
            bestStreak: st.bestStreak,
            lastAnswerCorrect: st.lastAnswerCorrect,
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
                score: s(state).score ?? 0,
                answeredCount: s(state).answeredCount ?? 0,
                bestStreak: s(state).bestStreak ?? 0,
                lastCorrectAt: s(state).lastCorrectAt ?? null,
                rank: null as number | null,
            }))
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (a.lastCorrectAt !== null && b.lastCorrectAt !== null)
                    return a.lastCorrectAt - b.lastCorrectAt;
                if (a.lastCorrectAt !== null) return -1;
                if (b.lastCorrectAt !== null) return 1;
                if (b.answeredCount !== a.answeredCount)
                    return b.answeredCount - a.answeredCount;
                if (b.bestStreak !== a.bestStreak)
                    return b.bestStreak - a.bestStreak;
                return 0;
            })
            .map((result, index) => ({ ...result, rank: index + 1 }));
    },
};
