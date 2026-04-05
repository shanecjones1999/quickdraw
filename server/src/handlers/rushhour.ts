import type { GameHandler } from "../gameHandler.js";
import type { RushHourState } from "../rushhour.js";
import {
    createRushHourState,
    applyRushHourMove,
    PUZZLE_COUNT,
} from "../rushhour.js";

function s(state: unknown): RushHourState {
    return state as RushHourState;
}

export const rushhourHandler: GameHandler = {
    type: "rushhour",

    createSeed() {
        return Math.floor(Math.random() * PUZZLE_COUNT());
    },
    createState(seed) {
        return createRushHourState(seed as number);
    },
    startPayload(seed) {
        const sample = createRushHourState(seed as number);
        return { vehicles: sample.vehicles, puzzleIndex: seed as number };
    },

    actionEvent: "rushhour:move",
    applyAction(state, data) {
        const { vehicleId, delta } = data as {
            vehicleId: string;
            delta: number;
        };
        return applyRushHourMove(s(state), vehicleId, delta);
    },
    isPlayerDone(state) {
        return s(state).solved;
    },
    shouldTrackFinish(state) {
        return s(state).solved;
    },

    updateEvent: "rushhour:update",
    updatePayload(state) {
        const st = s(state);
        return { vehicles: st.vehicles, moves: st.moves, solved: st.solved };
    },

    solvedEvent: "rushhour:solved",
    solvedPayload(state, rank) {
        const st = s(state);
        return { rank, moves: st.moves, finishTime: st.finishTime };
    },

    progressEvent: "rushhour:progress",
    progressPayload(state, playerId, rank) {
        const st = s(state);
        return {
            playerId,
            vehicles: st.vehicles,
            moves: st.moves,
            solved: st.solved,
            rank,
            finishTime: st.finishTime,
        };
    },

    resumeStartPayload(state) {
        return { vehicles: s(state).vehicles };
    },
    resumeSyncEvent: "rushhour:update",
    resumeSyncPayload(state) {
        const st = s(state);
        return { vehicles: st.vehicles, moves: st.moves, solved: st.solved };
    },
    shouldResumeSolved(state, rank) {
        return rank !== null && s(state).solved;
    },
    resumeSolvedPayload(state, rank) {
        const st = s(state);
        return { rank, moves: st.moves, finishTime: st.finishTime };
    },

    buildResults(players) {
        return players
            .map(({ id, name, rank, state }) => ({
                id,
                name,
                rank,
                moves: s(state).moves ?? null,
                finishTime: s(state).finishTime ?? null,
            }))
            .sort((a, b) => {
                if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
                if (a.rank !== null) return -1;
                if (b.rank !== null) return 1;
                return 0;
            });
    },
};
