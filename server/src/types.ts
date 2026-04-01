import type { BowmanState, ShotResult } from "./bowman.js";
import type { CodebreakerState, CodebreakerGuess } from "./codebreaker.js";
import type { LightsOutState } from "./lightsout.js";
import type { PipeConnectState, PipeConnectPublicTile } from "./pipeconnect.js";
import type { RushHourState } from "./rushhour.js";
import type { SimonCopyState, SimonCopyColor } from "./simoncopy.js";

export type { RushHourState };
export type GameType =
    | "klotski"
    | "bowman"
    | "rushhour"
    | "lightsout"
    | "codebreaker"
    | "pipeconnect"
    | "simoncopy";

export interface Piece {
    id: string;
    cells: [number, number][]; // [row, col]
}

export interface PuzzleState {
    board: (string | null)[][]; // 5 rows × 4 cols, cell = pieceId or null
    pieces: Record<string, Piece>;
    moves: number;
    solved: boolean;
    startTime: number;
    solveTime: number | null;
}

export interface Player {
    id: string; // socketId
    name: string;
    puzzleState: PuzzleState | null;
    bowmanState: BowmanState | null;
    rushHourState: RushHourState | null;
    lightsOutState: LightsOutState | null;
    codebreakerState: CodebreakerState | null;
    pipeConnectState: PipeConnectState | null;
    simonCopyState: SimonCopyState | null;
    rank: number | null;
}

export interface Room {
    code: string;
    hostSocketId: string;
    players: Map<string, Player>;
    phase: "lobby" | "playing" | "results";
    gameType: GameType;
    gameStartTime: number | null;
    finishOrder: string[];
}

export interface BowmanProgressSnapshot {
    playerId: string;
    shots: ShotResult[];
    totalScore: number;
    done: boolean;
    finishTime: number | null;
    wind: number;
}

export interface LightsOutProgressSnapshot {
    playerId: string;
    board: boolean[][];
    moves: number;
    solved: boolean;
    rank: number | null;
    finishTime: number | null;
}

export interface CodebreakerProgressSnapshot {
    playerId: string;
    attempts: number;
    solved: boolean;
    done: boolean;
    finishTime: number | null;
    lastGuess: CodebreakerGuess | null;
}

export interface PipeConnectProgressSnapshot {
    playerId: string;
    tiles: PipeConnectPublicTile[];
    moves: number;
    solved: boolean;
    rank: number | null;
    finishTime: number | null;
}

export interface SimonCopyProgressSnapshot {
    playerId: string;
    currentRound: number;
    solved: boolean;
    done: boolean;
    failed: boolean;
    finishTime: number | null;
    latestColor: SimonCopyColor | null;
}
