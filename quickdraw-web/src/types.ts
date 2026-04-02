export type GameType =
    | "klotski"
    | "bowman"
    | "rushhour"
    | "lightsout"
    | "codebreaker"
    | "pipeconnect"
    | "simoncopy"
    | "memorysequenceplus";

// ─── Klotski ─────────────────────────────────────────────────────────────────

export interface Piece {
    id: string;
    cells: [number, number][];
}

export interface PlayerInfo {
    id: string;
    name: string;
    rank: number | null;
}

export interface MatchStanding {
    id: string;
    name: string;
    position: number;
    totalPoints: number;
    roundsWon: number;
    lastRoundPoints: number;
}

export interface ProgressSnapshot {
    playerId: string;
    board: (string | null)[][];
    pieces: Record<string, Piece>;
    moves: number;
    solved: boolean;
    rank: number | null;
    solveTime: number | null;
}

export interface Result {
    id: string;
    name: string;
    rank: number | null;
    moves: number | null;
    solveTime: number | null;
}

export type Direction = "up" | "down" | "left" | "right";

// ─── Bowman ──────────────────────────────────────────────────────────────────

export interface ShotResult {
    angle: number;
    power: number;
    landingY: number;
    distanceFromBullseye: number;
    score: number;
    ring: string;
}

export interface BowmanProgressSnapshot {
    playerId: string;
    shots: ShotResult[];
    totalScore: number;
    done: boolean;
    finishTime: number | null;
    wind: number;
}

// ─── Rush Hour ───────────────────────────────────────────────────────────────

export interface RushHourVehicle {
    id: string;
    orientation: "H" | "V";
    row: number;
    col: number;
    length: 2 | 3;
}

export interface RushHourProgressSnapshot {
    playerId: string;
    vehicles: RushHourVehicle[];
    moves: number;
    solved: boolean;
    rank: number | null;
    finishTime: number | null;
}

export interface RushHourResult {
    id: string;
    name: string;
    rank: number | null;
    moves: number | null;
    finishTime: number | null;
}

// ─── Lights Out ──────────────────────────────────────────────────────────────

export interface LightsOutProgressSnapshot {
    playerId: string;
    board: boolean[][];
    moves: number;
    solved: boolean;
    rank: number | null;
    finishTime: number | null;
}

export interface LightsOutResult {
    id: string;
    name: string;
    rank: number | null;
    moves: number | null;
    finishTime: number | null;
}

// ─── Codebreaker ────────────────────────────────────────────────────────────

export interface CodebreakerGuess {
    colors: string[];
    exact: number;
    partial: number;
}

export interface CodebreakerConfig {
    palette: string[];
    codeLength: number;
    maxGuesses: number;
}

export interface CodebreakerProgressSnapshot {
    playerId: string;
    attempts: number;
    solved: boolean;
    done: boolean;
    finishTime: number | null;
    lastGuess: CodebreakerGuess | null;
}

export interface CodebreakerResult {
    id: string;
    name: string;
    rank: number | null;
    attempts: number;
    finishTime: number | null;
    solved: boolean;
}

// ─── Pipe Connect ───────────────────────────────────────────────────────────

export interface PipeConnectTile {
    id: string;
    row: number;
    col: number;
    mask: number;
    locked: boolean;
    start: boolean;
    end: boolean;
}

export interface PipeConnectProgressSnapshot {
    playerId: string;
    tiles: PipeConnectTile[];
    moves: number;
    solved: boolean;
    rank: number | null;
    finishTime: number | null;
}

export interface PipeConnectResult {
    id: string;
    name: string;
    rank: number | null;
    moves: number | null;
    finishTime: number | null;
}

// ─── Simon Copy ─────────────────────────────────────────────────────────────

export type SimonCopyColor = "red" | "blue" | "green" | "yellow";

export interface SimonCopyConfig {
    sequence: SimonCopyColor[];
    maxRounds: number;
    colors: SimonCopyColor[];
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

export interface SimonCopyResult {
    id: string;
    name: string;
    rank: number | null;
    roundReached: number;
    finishTime: number | null;
    solved: boolean;
    failed: boolean;
}

// ─── Memory Sequence Plus ───────────────────────────────────────────────────

export interface MemorySequencePlusConfig {
    sequence: number[];
    gridSize: number;
    maxRounds: number;
}

export interface MemorySequencePlusProgressSnapshot {
    playerId: string;
    currentRound: number;
    solved: boolean;
    done: boolean;
    failed: boolean;
    finishTime: number | null;
    latestCell: number | null;
}

export interface MemorySequencePlusResult {
    id: string;
    name: string;
    rank: number | null;
    roundReached: number;
    finishTime: number | null;
    solved: boolean;
    failed: boolean;
}

export interface BowmanResult {
    id: string;
    name: string;
    rank: number | null;
    totalScore: number;
    finishTime: number | null;
    shots: ShotResult[];
}
