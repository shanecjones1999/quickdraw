import type { GameHandler, SocketType } from "../gameHandler.js";
import type { PairMatchState, PairMatchSymbol } from "../pairmatch.js";
import {
    PAIR_MATCH_PAIR_COUNT,
    PAIR_MATCH_MISMATCH_REVEAL_MS,
    createPairMatchState,
    getPairMatchLayout,
    toPublicPairMatchTiles,
    flipPairMatchTile,
    clearPairMatchMismatch,
} from "../pairmatch.js";
import type { Server } from "socket.io";
import type { Player, Room } from "../types.js";
import { getRoom } from "../rooms.js";

function s(state: unknown): PairMatchState {
    return state as PairMatchState;
}

export const pairmatchHandler: GameHandler = {
    type: "pairmatch",

    createSeed() {
        const initial = createPairMatchState();
        return getPairMatchLayout(initial);
    },
    createState(seed) {
        return createPairMatchState(seed as PairMatchSymbol[]);
    },
    startPayload(seed) {
        const initial = createPairMatchState(seed as PairMatchSymbol[]);
        return { tiles: toPublicPairMatchTiles(initial.tiles) };
    },

    actionEvent: "pairmatch:flip",
    applyAction(state, data) {
        const { tileId } = data as { tileId: string };
        return flipPairMatchTile(s(state), tileId);
    },
    isPlayerDone(state) {
        return s(state).done;
    },
    shouldTrackFinish(state) {
        return s(state).solved;
    },

    onPostAction(io: Server, room: Room, player: Player) {
        const st = s(player.gameState);
        if (!st.busy) return;

        // Clear any existing mismatch timeout
        if (st.mismatchTimeout) {
            clearTimeout(st.mismatchTimeout);
        }

        st.mismatchTimeout = setTimeout(() => {
            const currentRoom = getRoom(room.code);
            if (!currentRoom || currentRoom.phase !== "playing") return;
            if (currentRoom.gameType !== "pairmatch") return;

            const currentPlayer = currentRoom.players.get(player.sessionId);
            if (!currentPlayer?.gameState) return;
            const currentSt = s(currentPlayer.gameState);
            if (!currentSt.busy) return;

            currentPlayer.gameState = clearPairMatchMismatch(currentSt);
            const cleared = s(currentPlayer.gameState);

            io.to(currentPlayer.id).emit("pairmatch:update", {
                tiles: toPublicPairMatchTiles(cleared.tiles),
                attempts: cleared.attempts,
                pairsFound: cleared.pairsFound,
                totalPairs: PAIR_MATCH_PAIR_COUNT,
                solved: cleared.solved,
                done: cleared.done,
                busy: cleared.busy,
                finishTime: cleared.finishTime,
            });

            io.to(currentRoom.hostSocketId).emit("pairmatch:progress", {
                playerId: currentPlayer.id,
                attempts: cleared.attempts,
                pairsFound: cleared.pairsFound,
                totalPairs: PAIR_MATCH_PAIR_COUNT,
                solved: cleared.solved,
                done: cleared.done,
                busy: cleared.busy,
                rank: currentPlayer.rank,
                finishTime: cleared.finishTime,
                tiles: toPublicPairMatchTiles(cleared.tiles),
            });
        }, PAIR_MATCH_MISMATCH_REVEAL_MS);
    },

    updateEvent: "pairmatch:update",
    updatePayload(state) {
        const st = s(state);
        return {
            tiles: toPublicPairMatchTiles(st.tiles),
            attempts: st.attempts,
            pairsFound: st.pairsFound,
            totalPairs: PAIR_MATCH_PAIR_COUNT,
            solved: st.solved,
            done: st.done,
            busy: st.busy,
            finishTime: st.finishTime,
        };
    },

    solvedEvent: "pairmatch:solved",
    solvedPayload(state, rank) {
        const st = s(state);
        return { rank, attempts: st.attempts, finishTime: st.finishTime };
    },

    progressEvent: "pairmatch:progress",
    progressPayload(state, playerId, rank) {
        const st = s(state);
        return {
            playerId,
            attempts: st.attempts,
            pairsFound: st.pairsFound,
            totalPairs: PAIR_MATCH_PAIR_COUNT,
            solved: st.solved,
            done: st.done,
            busy: st.busy,
            rank,
            finishTime: st.finishTime,
            tiles: toPublicPairMatchTiles(st.tiles),
        };
    },

    resumeStartPayload(state) {
        return { tiles: toPublicPairMatchTiles(s(state).tiles) };
    },
    resumeSyncEvent: "pairmatch:update",
    resumeSyncPayload(state) {
        const st = s(state);
        return {
            tiles: toPublicPairMatchTiles(st.tiles),
            attempts: st.attempts,
            pairsFound: st.pairsFound,
            totalPairs: PAIR_MATCH_PAIR_COUNT,
            solved: st.solved,
            done: st.done,
            busy: st.busy,
            finishTime: st.finishTime,
        };
    },
    shouldResumeSolved(state, rank) {
        return rank !== null && s(state).solved;
    },
    resumeSolvedPayload(state, rank) {
        const st = s(state);
        return { rank, attempts: st.attempts, finishTime: st.finishTime };
    },

    buildResults(players) {
        const ranked = players
            .map(({ id, name, state }) => ({
                id,
                name,
                attempts: s(state).attempts ?? 0,
                pairsFound: s(state).pairsFound ?? 0,
                finishTime: s(state).finishTime ?? null,
                solved: s(state).solved ?? false,
                totalPairs: PAIR_MATCH_PAIR_COUNT,
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
                if (b.pairsFound !== a.pairsFound)
                    return b.pairsFound - a.pairsFound;
                return a.attempts - b.attempts;
            });

        let nextRank = 1;
        return ranked.map((entry) => ({
            ...entry,
            rank: entry.solved ? nextRank++ : null,
        }));
    },
};
