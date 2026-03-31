export type GameType = "klotski" | "bowman" | "rushhour" | "lightsout";

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

export interface BowmanResult {
    id: string;
    name: string;
    rank: number | null;
    totalScore: number;
    finishTime: number | null;
    shots: ShotResult[];
}
