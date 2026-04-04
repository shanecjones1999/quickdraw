import type { GameHandler } from "../gameHandler.js";
import type { OddOneOutState } from "../oddoneout.js";
import {
    createOddOneOutPromptSet,
    createOddOneOutState,
    getCurrentOddOneOutPrompt,
    processOddOneOutSelection,
} from "../oddoneout.js";
import type { Server } from "socket.io";
import type { Room } from "../types.js";

function s(state: unknown): OddOneOutState {
    return state as OddOneOutState;
}

export const oddoneoutHandler: GameHandler = {
    type: "oddoneout",

    createSeed() {
        return createOddOneOutPromptSet();
    },
    createState(seed) {
        return createOddOneOutState(
            seed as ReturnType<typeof createOddOneOutPromptSet>,
        );
    },
    startPayload(seed) {
        const prompts =
            seed as ReturnType<typeof createOddOneOutPromptSet>;
        return {
            prompt: prompts[0] ?? null,
            promptCount: prompts.length,
        };
    },

    customStart: true,
    onStart(io: Server, room: Room, seed: unknown) {
        const prompts =
            seed as ReturnType<typeof createOddOneOutPromptSet>;
        io.to(room.code).emit("game:started", {
            gameType: "oddoneout",
            prompt: prompts[0] ?? null,
            promptCount: prompts.length,
            roundNumber: room.currentRound,
            totalRounds: room.totalRounds,
        });
        // Emit initial progress for each player to host
        for (const player of room.players.values()) {
            io.to(room.hostSocketId).emit("oddoneout:progress", {
                playerId: player.id,
                promptsCleared: 0,
                totalPrompts: prompts.length,
                score: 0,
                totalResponseTime: 0,
                penaltyCount: 0,
                lockedOutUntil: null,
                done: false,
                finishTime: null,
                currentPrompt: prompts[0] ?? null,
            });
        }
    },

    actionEvent: "oddoneout:select",
    applyAction(state, data) {
        const { index } = data as { index: number };
        return processOddOneOutSelection(s(state), index);
    },
    isPlayerDone(state) {
        return s(state).done;
    },
    shouldTrackFinish() {
        return false; // ranked by score, not finish order
    },

    updateEvent: "oddoneout:update",
    updatePayload(state) {
        const st = s(state);
        return {
            prompt: getCurrentOddOneOutPrompt(st),
            promptsCleared: st.promptsCleared,
            totalPrompts: st.prompts.length,
            score: st.score,
            totalResponseTime: st.totalResponseTime,
            penaltyCount: st.penaltyCount,
            lockedOutUntil: st.lockedOutUntil,
            done: st.done,
            finishTime: st.finishTime,
        };
    },

    solvedEvent: null,
    solvedPayload() {
        return {};
    },

    progressEvent: "oddoneout:progress",
    progressPayload(state, playerId) {
        const st = s(state);
        return {
            playerId,
            promptsCleared: st.promptsCleared,
            totalPrompts: st.prompts.length,
            score: st.score,
            totalResponseTime: st.totalResponseTime,
            penaltyCount: st.penaltyCount,
            lockedOutUntil: st.lockedOutUntil,
            done: st.done,
            finishTime: st.finishTime,
            currentPrompt: getCurrentOddOneOutPrompt(st),
        };
    },

    resumeStartPayload(state) {
        const st = s(state);
        const prompt = getCurrentOddOneOutPrompt(st);
        return {
            prompt,
            promptCount: st.prompts.length,
        };
    },
    resumeSyncEvent: "oddoneout:update",
    resumeSyncPayload(state) {
        const st = s(state);
        return {
            prompt: getCurrentOddOneOutPrompt(st),
            promptsCleared: st.promptsCleared,
            totalPrompts: st.prompts.length,
            score: st.score,
            totalResponseTime: st.totalResponseTime,
            penaltyCount: st.penaltyCount,
            lockedOutUntil: st.lockedOutUntil,
            done: st.done,
            finishTime: st.finishTime,
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
                promptsCleared: s(state).promptsCleared ?? 0,
                totalPrompts: s(state).prompts.length ?? 0,
                score: s(state).score ?? 0,
                totalResponseTime: s(state).totalResponseTime ?? 0,
                penaltyCount: s(state).penaltyCount ?? 0,
                finishTime: s(state).finishTime ?? null,
                rank: null as number | null,
            }))
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (b.promptsCleared !== a.promptsCleared)
                    return b.promptsCleared - a.promptsCleared;
                if (a.totalResponseTime !== b.totalResponseTime)
                    return a.totalResponseTime - b.totalResponseTime;
                if (a.finishTime !== null && b.finishTime !== null)
                    return a.finishTime - b.finishTime;
                if (a.finishTime !== null) return -1;
                if (b.finishTime !== null) return 1;
                return 0;
            })
            .map((result, index) => ({ ...result, rank: index + 1 }));
    },
};
