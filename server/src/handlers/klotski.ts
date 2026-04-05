import type { GameHandler } from "../gameHandler.js";
import type { PuzzleState } from "../types.js";
import { createInitialState, applyMove } from "../klotski.js";
import type { Direction } from "../klotski.js";

function s(state: unknown): PuzzleState {
    return state as PuzzleState;
}

export const klotskiHandler: GameHandler = {
    type: "klotski",

    // ── Round start ─────────────────────────────────────────────────
    createSeed() {
        return createInitialState();
    },
    createState(seed) {
        return createInitialState(s(seed).pieces);
    },
    startPayload(seed) {
        const st = s(seed);
        return { board: st.board, pieces: st.pieces };
    },

    // ── Player action ───────────────────────────────────────────────
    actionEvent: "player:move",
    applyAction(state, data) {
        const { pieceId, direction } = data as {
            pieceId: string;
            direction: Direction;
        };
        return applyMove(s(state), pieceId, direction);
    },
    isPlayerDone(state) {
        return s(state).solved;
    },
    shouldTrackFinish(state) {
        return s(state).solved;
    },

    // ── Post-action events ──────────────────────────────────────────
    updateEvent: "state:update",
    updatePayload(state) {
        const st = s(state);
        return {
            board: st.board,
            pieces: st.pieces,
            moves: st.moves,
            solved: st.solved,
        };
    },

    solvedEvent: "puzzle:solved",
    solvedPayload(state, rank) {
        const st = s(state);
        return { rank, moves: st.moves, solveTime: st.solveTime };
    },

    progressEvent: "player:progress",
    progressPayload(state, playerId, rank) {
        const st = s(state);
        return {
            playerId,
            board: st.board,
            pieces: st.pieces,
            moves: st.moves,
            solved: st.solved,
            rank,
            solveTime: st.solveTime,
        };
    },

    // ── Resume ──────────────────────────────────────────────────────
    resumeStartPayload(state) {
        const st = s(state);
        return { board: st.board, pieces: st.pieces };
    },
    resumeSyncEvent: "state:update",
    resumeSyncPayload(state) {
        const st = s(state);
        return {
            board: st.board,
            pieces: st.pieces,
            moves: st.moves,
            solved: st.solved,
        };
    },
    shouldResumeSolved(state, rank) {
        return rank !== null && s(state).solved;
    },
    resumeSolvedPayload(state, rank) {
        const st = s(state);
        return { rank, moves: st.moves, solveTime: st.solveTime };
    },

    // ── Results ─────────────────────────────────────────────────────
    buildResults(players) {
        return players
            .map(({ id, name, rank, state }) => ({
                id,
                name,
                rank,
                moves: s(state).moves ?? null,
                solveTime: s(state).solveTime ?? null,
            }))
            .sort((a, b) => {
                if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
                if (a.rank !== null) return -1;
                if (b.rank !== null) return 1;
                return 0;
            });
    },
};
