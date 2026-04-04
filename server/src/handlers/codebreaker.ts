import type { GameHandler } from "../gameHandler.js";
import type { CodebreakerState } from "../codebreaker.js";
import {
    CODEBREAKER_CODE_LENGTH,
    CODEBREAKER_MAX_GUESSES,
    CODEBREAKER_PALETTE,
    createCodebreakerState,
    processCodebreakerGuess,
} from "../codebreaker.js";

function s(state: unknown): CodebreakerState {
    return state as CodebreakerState;
}

export const codebreakerHandler: GameHandler = {
    type: "codebreaker",

    createSeed() {
        return createCodebreakerState();
    },
    createState(seed) {
        return createCodebreakerState((seed as CodebreakerState).secret);
    },
    startPayload() {
        return {
            palette: [...CODEBREAKER_PALETTE],
            codeLength: CODEBREAKER_CODE_LENGTH,
            maxGuesses: CODEBREAKER_MAX_GUESSES,
        };
    },

    actionEvent: "codebreaker:guess",
    applyAction(state, data) {
        const { guess } = data as { guess: string[] };
        const { ok, state: newState } = processCodebreakerGuess(
            s(state),
            guess,
        );
        return { ok, state: newState };
    },
    isPlayerDone(state) {
        return s(state).done;
    },
    shouldTrackFinish() {
        return false; // codebreaker ranks by solved/attempts, not finish order
    },

    updateEvent: "codebreaker:update",
    updatePayload(state) {
        const st = s(state);
        return {
            guesses: st.guesses,
            solved: st.solved,
            done: st.done,
            finishTime: st.finishTime,
        };
    },

    solvedEvent: "codebreaker:solved",
    solvedPayload(state) {
        const st = s(state);
        return {
            attempts: st.guesses.length,
            finishTime: st.finishTime,
        };
    },

    progressEvent: "codebreaker:progress",
    progressPayload(state, playerId) {
        const st = s(state);
        return {
            playerId,
            attempts: st.guesses.length,
            solved: st.solved,
            done: st.done,
            finishTime: st.finishTime,
            lastGuess: st.guesses.at(-1) ?? null,
        };
    },

    resumeStartPayload() {
        return {
            palette: [...CODEBREAKER_PALETTE],
            codeLength: CODEBREAKER_CODE_LENGTH,
            maxGuesses: CODEBREAKER_MAX_GUESSES,
        };
    },
    resumeSyncEvent: "codebreaker:update",
    resumeSyncPayload(state) {
        const st = s(state);
        return {
            guesses: st.guesses,
            solved: st.solved,
            done: st.done,
            finishTime: st.finishTime,
        };
    },
    shouldResumeSolved(state) {
        const st = s(state);
        return st.solved && st.finishTime !== null;
    },
    resumeSolvedPayload(state) {
        const st = s(state);
        return {
            attempts: st.guesses.length,
            finishTime: st.finishTime,
        };
    },

    buildResults(players) {
        const ranked = players
            .map(({ id, name, state }) => ({
                id,
                name,
                attempts: s(state).guesses.length ?? 0,
                finishTime: s(state).finishTime ?? null,
                solved: s(state).solved ?? false,
                rank: null as number | null,
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
    },
};
