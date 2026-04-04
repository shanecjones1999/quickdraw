import type { GameHandler } from "../gameHandler.js";
import type { BowmanState } from "../bowman.js";
import { createBowmanState, processShot, MAX_SHOTS } from "../bowman.js";

function s(state: unknown): BowmanState {
    return state as BowmanState;
}

export const bowmanHandler: GameHandler = {
    type: "bowman",

    // ── Round start ─────────────────────────────────────────────────
    createSeed() {
        return 0; // shared wind value
    },
    createState(seed) {
        return createBowmanState(seed as number);
    },
    startPayload(seed) {
        return { wind: seed as number };
    },

    // ── Player action ───────────────────────────────────────────────
    actionEvent: "bowman:shot",
    applyAction(state, data) {
        const { angle, power } = data as { angle: number; power: number };
        const { ok, state: newState } = processShot(s(state), angle, power);
        return { ok, state: newState };
    },
    isPlayerDone(state) {
        return s(state).done;
    },
    shouldTrackFinish(state) {
        return s(state).done;
    },

    // ── Post-action events ──────────────────────────────────────────
    updateEvent: "bowman:result",
    updatePayload(state) {
        const st = s(state);
        const lastShot = st.shots.at(-1) ?? null;
        return {
            result: lastShot,
            totalScore: st.totalScore,
            shotsLeft: MAX_SHOTS - st.shots.length,
            done: st.done,
        };
    },

    solvedEvent: null,
    solvedPayload() {
        return {};
    },

    progressEvent: "bowman:progress",
    progressPayload(state, playerId) {
        const st = s(state);
        return {
            playerId,
            shots: st.shots,
            totalScore: st.totalScore,
            done: st.done,
            finishTime: st.finishTime,
            wind: st.wind,
        };
    },

    // ── Resume ──────────────────────────────────────────────────────
    resumeStartPayload(state) {
        return { wind: s(state).wind };
    },
    resumeSyncEvent: "bowman:sync",
    resumeSyncPayload(state) {
        const st = s(state);
        return {
            shots: st.shots,
            totalScore: st.totalScore,
            done: st.done,
        };
    },
    shouldResumeSolved() {
        return false; // bowman has no solved event
    },
    resumeSolvedPayload() {
        return {};
    },

    // ── Results ─────────────────────────────────────────────────────
    buildResults(players) {
        return players
            .map(({ id, name, state }) => ({
                id,
                name,
                totalScore: s(state).totalScore ?? 0,
                finishTime: s(state).finishTime ?? null,
                shots: s(state).shots ?? [],
                rank: null as number | null,
            }))
            .sort((a, b) => {
                if (b.totalScore !== a.totalScore)
                    return b.totalScore - a.totalScore;
                if (a.finishTime !== null && b.finishTime !== null)
                    return a.finishTime - b.finishTime;
                if (a.finishTime !== null) return -1;
                if (b.finishTime !== null) return 1;
                return 0;
            })
            .map((result, index) => ({ ...result, rank: index + 1 }));
    },
};
