export type GameType = 'klotski' | 'bowman';

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

export type Direction = 'up' | 'down' | 'left' | 'right';

// ─── Bowman ──────────────────────────────────────────────────────────────────

export interface ShotResult {
  angle:                number;
  power:                number;
  landingY:             number;
  distanceFromBullseye: number;
  score:                number;
  ring:                 string;
}

export interface BowmanProgressSnapshot {
  playerId:   string;
  shots:      ShotResult[];
  totalScore: number;
  done:       boolean;
  finishTime: number | null;
  wind:       number;
}

export interface BowmanResult {
  id:         string;
  name:       string;
  rank:       number | null;
  totalScore: number;
  finishTime: number | null;
  shots:      ShotResult[];
}
