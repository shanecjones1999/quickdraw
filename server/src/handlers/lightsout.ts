import type { GameHandler } from "../gameHandler.js";
import type { LightsOutState } from "../lightsout.js";
import { createLightsOutState, applyLightsOutMove } from "../lightsout.js";

function s(state: unknown): LightsOutState {
    return state as LightsOutState;
}

export const lightsoutHandler: GameHandler = {
    type: "lightsout",

    createSeed() {
        return createLightsOutState();
    },
    createState(seed) {
        return createLightsOutState((seed as LightsOutState).board);
    },
    startPayload(seed) {
        return { board: (seed as LightsOutState).board };
    },

    actionEvent: "lightsout:move",
    applyAction(state, data) {
        const { row, col } = data as { row: number; col: number };
        return applyLightsOutMove(s(state), row, col);
    },
    isPlayerDone(state) {
        return s(state).solved;
    },
    shouldTrackFinish(state) {
        return s(state).solved;
    },

    updateEvent: "lightsout:update",
    updatePayload(state) {
        const st = s(state);
        return { board: st.board, moves: st.moves, solved: st.solved };
    },

    solvedEvent: "lightsout:solved",
    solvedPayload(state, rank) {
        const st = s(state);
        return { rank, moves: st.moves, finishTime: st.finishTime };
    },

    progressEvent: "lightsout:progress",
    progressPayload(state, playerId, rank) {
        const st = s(state);
        return {
            playerId,
            board: st.board,
            moves: st.moves,
            solved: st.solved,
            rank,
            finishTime: st.finishTime,
        };
    },

    resumeStartPayload(state) {
        return { board: s(state).board };
    },
    resumeSyncEvent: "lightsout:update",
    resumeSyncPayload(state) {
        const st = s(state);
        return { board: st.board, moves: st.moves, solved: st.solved };
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
