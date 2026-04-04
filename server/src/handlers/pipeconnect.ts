import type { GameHandler } from "../gameHandler.js";
import type { PipeConnectState } from "../pipeconnect.js";
import {
    PIPE_CONNECT_PUZZLE_COUNT,
    createPipeConnectState,
    applyPipeConnectRotate,
    toPublicPipeConnectTiles,
} from "../pipeconnect.js";

function s(state: unknown): PipeConnectState {
    return state as PipeConnectState;
}

export const pipeconnectHandler: GameHandler = {
    type: "pipeconnect",

    createSeed() {
        const puzzleIndex = Math.floor(
            Math.random() * PIPE_CONNECT_PUZZLE_COUNT(),
        );
        return createPipeConnectState(puzzleIndex);
    },
    createState(seed) {
        const st = seed as PipeConnectState;
        return createPipeConnectState(st.puzzleIndex, st.tiles);
    },
    startPayload(seed) {
        return {
            tiles: toPublicPipeConnectTiles((seed as PipeConnectState).tiles),
        };
    },

    actionEvent: "pipeconnect:rotate",
    applyAction(state, data) {
        const { tileId } = data as { tileId: string };
        return applyPipeConnectRotate(s(state), tileId);
    },
    isPlayerDone(state) {
        return s(state).solved;
    },
    shouldTrackFinish(state) {
        return s(state).solved;
    },

    updateEvent: "pipeconnect:update",
    updatePayload(state) {
        const st = s(state);
        return {
            tiles: toPublicPipeConnectTiles(st.tiles),
            moves: st.moves,
            solved: st.solved,
        };
    },

    solvedEvent: "pipeconnect:solved",
    solvedPayload(state, rank) {
        const st = s(state);
        return { rank, moves: st.moves, finishTime: st.finishTime };
    },

    progressEvent: "pipeconnect:progress",
    progressPayload(state, playerId, rank) {
        const st = s(state);
        return {
            playerId,
            tiles: toPublicPipeConnectTiles(st.tiles),
            moves: st.moves,
            solved: st.solved,
            rank,
            finishTime: st.finishTime,
        };
    },

    resumeStartPayload(state) {
        return { tiles: toPublicPipeConnectTiles(s(state).tiles) };
    },
    resumeSyncEvent: "pipeconnect:update",
    resumeSyncPayload(state) {
        const st = s(state);
        return {
            tiles: toPublicPipeConnectTiles(st.tiles),
            moves: st.moves,
            solved: st.solved,
        };
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
