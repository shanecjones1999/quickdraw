import type { GameHandler } from "../gameHandler.js";
import type { MemorySequencePlusState } from "../memorysequenceplus.js";
import {
    MEMORY_SEQUENCE_PLUS_GRID_SIZE,
    MEMORY_SEQUENCE_PLUS_MAX_ROUNDS,
    createMemorySequencePlusState,
    submitMemorySequencePlusRound,
} from "../memorysequenceplus.js";

function s(state: unknown): MemorySequencePlusState {
    return state as MemorySequencePlusState;
}

export const memorysequenceplusHandler: GameHandler = {
    type: "memorysequenceplus",

    createSeed() {
        return createMemorySequencePlusState();
    },
    createState(seed) {
        return createMemorySequencePlusState(
            (seed as MemorySequencePlusState).sequence,
        );
    },
    startPayload(seed) {
        return {
            sequence: (seed as MemorySequencePlusState).sequence,
            maxRounds: MEMORY_SEQUENCE_PLUS_MAX_ROUNDS,
            gridSize: MEMORY_SEQUENCE_PLUS_GRID_SIZE,
        };
    },

    actionEvent: "memorysequenceplus:submit",
    applyAction(state, data) {
        const { inputs } = data as { inputs: number[] };
        return submitMemorySequencePlusRound(s(state), inputs);
    },
    isPlayerDone(state) {
        return s(state).done;
    },
    shouldTrackFinish(state) {
        return s(state).solved;
    },

    updateEvent: "memorysequenceplus:update",
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

    solvedEvent: "memorysequenceplus:solved",
    solvedPayload(state, rank) {
        const st = s(state);
        return {
            rank,
            roundReached: st.currentRound,
            finishTime: st.finishTime,
        };
    },

    progressEvent: "memorysequenceplus:progress",
    progressPayload(state, playerId) {
        const st = s(state);
        return {
            playerId,
            currentRound: st.currentRound,
            solved: st.solved,
            done: st.done,
            failed: st.failed,
            finishTime: st.finishTime,
            latestCell: null,
        };
    },

    resumeStartPayload(state) {
        return {
            sequence: s(state).sequence,
            maxRounds: MEMORY_SEQUENCE_PLUS_MAX_ROUNDS,
            gridSize: MEMORY_SEQUENCE_PLUS_GRID_SIZE,
        };
    },
    resumeSyncEvent: "memorysequenceplus:update",
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
