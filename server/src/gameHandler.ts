import type { Server } from "socket.io";
import type { GameType, Player, Room } from "./types.js";

/** Socket type extracted from socket.io Server */
export type SocketType = Parameters<
    Parameters<Server["on"]>[1]
>[0];

/**
 * Each mini-game implements this interface so the server can orchestrate
 * rounds, actions, results, and reconnection generically.
 *
 * TState is opaque to the orchestrator — handlers cast internally.
 */
export interface GameHandler {
    readonly type: GameType;

    /**
     * Minimum number of players required. Games below this threshold
     * are excluded from the round sequence (e.g. teamtug needs 2+).
     */
    readonly minPlayers?: number;

    // ── Round start ─────────────────────────────────────────────────
    /** Create a shared seed so all players get the same puzzle / config. */
    createSeed(players?: ReadonlyArray<Player>): unknown;
    /** Create one player's initial state from the seed. */
    createState(seed: unknown): unknown;
    /** Extra fields merged into the `game:started` broadcast. */
    startPayload(seed: unknown): Record<string, unknown>;

    /**
     * Optional: If true, the game manages round start via onStart().
     * The orchestrator still calls createSeed/createState, but the
     * handler handles emitting game:started and setting up timers.
     */
    readonly customStart?: boolean;
    onStart?(io: Server, room: Room, seed: unknown, endGame: (roomCode: string) => void): void;

    /**
     * Optional: If true, the generic action loop is skipped.
     * The handler registers its own socket events via onAction().
     */
    readonly customAction?: boolean;
    onAction?(
        io: Server,
        room: Room,
        socket: SocketType,
        data: unknown,
        endGame: (roomCode: string) => void,
    ): void;

    /**
     * Optional: Called after the generic action handler runs.
     * For delayed effects (e.g. PairMatch mismatch timeout).
     */
    onPostAction?(
        io: Server,
        room: Room,
        player: Player,
    ): void;

    /** Optional: Clean up room-level state / timeouts when round ends. */
    onCleanup?(room: Room): void;

    // ── Player action ───────────────────────────────────────────────
    /** Socket event the player sends (e.g. "bowman:shot"). */
    readonly actionEvent: string;
    /** Process the player's action. Return ok:false to reject. */
    applyAction(
        state: unknown,
        data: unknown,
    ): { ok: boolean; state: unknown };
    /** Is this player completely finished (solved, failed, out of shots…)? */
    isPlayerDone(state: unknown): boolean;
    /**
     * Should we add this player to the finish order right now?
     * (Most games: when solved.  Bowman: when done.)
     */
    shouldTrackFinish(state: unknown): boolean;

    // ── Post-action events ──────────────────────────────────────────
    /** Event + payload sent to the acting player after their action. */
    readonly updateEvent: string;
    updatePayload(state: unknown): Record<string, unknown>;

    /**
     * Event emitted when a player "solves" the game.
     * Set to null for games with no distinct solved event (e.g. bowman).
     */
    readonly solvedEvent: string | null;
    solvedPayload(state: unknown, rank: number): Record<string, unknown>;

    /** Event + payload sent to the host for the progress board. */
    readonly progressEvent: string;
    progressPayload(
        state: unknown,
        playerId: string,
        rank: number | null,
    ): Record<string, unknown>;

    // ── Resume (reconnection) ───────────────────────────────────────
    /** Extra fields merged into `game:started` when a player reconnects. */
    resumeStartPayload(state: unknown): Record<string, unknown>;
    /** Event name for the full-state sync on reconnect. */
    readonly resumeSyncEvent: string;
    resumeSyncPayload(state: unknown): Record<string, unknown>;
    /** Should we re-send the solved notification on reconnect? */
    shouldResumeSolved(state: unknown, rank: number | null): boolean;
    /** Payload for the solved event on reconnect (uses solvedEvent). */
    resumeSolvedPayload(state: unknown, rank: number): Record<string, unknown>;

    // ── Results ─────────────────────────────────────────────────────
    /**
     * Build the ranked result list for all players in this round.
     * The orchestrator passes every player's id, name, rank (from finish
     * order), and game state.  The handler sorts and assigns final ranks.
     */
    buildResults(
        players: ReadonlyArray<{
            id: string;
            name: string;
            rank: number | null;
            state: unknown;
        }>,
        room?: Room,
    ): Array<Record<string, unknown>>;
}
