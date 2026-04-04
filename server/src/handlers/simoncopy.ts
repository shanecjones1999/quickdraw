import type { GameHandler } from "../gameHandler.js";
import type { SimonCopyState } from "../simoncopy.js";
import {
    SIMON_COPY_COLORS,
    SIMON_COPY_MAX_ROUNDS,
    createSimonCopyState,
    submitSimonCopyRound,
} from "../simoncopy.js";

function s(state: unknown): SimonCopyState {
    return state as SimonCopyState;
}

export const simoncopyHandler: GameHandler = {
    type: "simoncopy",

    createSeed() {
        return createSimonCopyState();
    },
    createState(seed) {
        return createSimonCopyState((seed as SimonCopyState).sequence);
    },
    startPayload(seed) {
        return {
            sequence: (seed as SimonCopyState).sequence,
            maxRounds: SIMON_COPY_MAX_ROUNDS,
            colors: [...SIMON_COPY_COLORS],
        };
    },

    actionEvent: "simoncopy:submit",
    applyAction(state, data) {
        const { inputs } = data as { inputs: string[] };
        return submitSimonCopyRound(s(state), inputs);
    },
    isPlayerDone(state) {
        return s(state).done;
    },
    shouldTrackFinish(state) {
        return s(state).solved;
    },

    updateEvent: "simoncopy:update",
    updatePayload(state) {
        const st = s(state);
        return {
            currentRound: st.currentRound,
            solved: st.solved,
            done: st.done,
            failed: st.failed,
            finishTime: st.finishTime,
        };
    },

    solvedEvent: "simoncopy:solved",
    solvedPayload(state, rank) {
        const st = s(state);
        return {
            rank,
            roundReached: st.currentRound,
            finishTime: st.finishTime,
        };
    },

    progressEvent: "simoncopy:progress",
    progressPayload(state, playerId) {
        const st = s(state);
        return {
            playerId,
            currentRound: st.currentRound,
            solved: st.solved,
            done: st.done,
            failed: st.failed,
            finishTime: st.finishTime,
            latestColor: null, // filled by orchestrator if needed
        };
    },

    resumeStartPayload(state) {
        return {
            sequence: s(state).sequence,
            maxRounds: SIMON_COPY_MAX_ROUNDS,
            colors: [...SIMON_COPY_COLORS],
        };
    },
    resumeSyncEvent: "simoncopy:update",
    resumeSyncPayload(state) {
        const st = s(state);
        return {
            currentRound: st.currentRound,
            solved: st.solved,
            done: st.done,
            failed: st.failed,
            finishTime: st.finishTime,
        };
    },
    shouldResumeSolved(state, rank) {
        return rank !== null && s(state).solved;
    },
    resumeSolvedPayload(state, rank) {
        const st = s(state);
        return {
            rank,
            roundReached: st.currentRound,
            finishTime: st.finishTime,
        };
    },

    buildResults(players) {
        const ranked = players
            .map(({ id, name, state }) => ({
                id,
                name,
                roundReached: s(state).currentRound ?? 1,
                finishTime: s(state).finishTime ?? null,
                solved: s(state).solved ?? false,
                failed: s(state).failed ?? false,
                rank: null as number | null,
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
    },
};
