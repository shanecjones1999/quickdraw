export interface Piece {
  id: string;
  cells: [number, number][]; // [row, col]
}

export interface PuzzleState {
  board: (string | null)[][];  // 5 rows × 4 cols, cell = pieceId or null
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
  rank: number | null;
}

export interface Room {
  code: string;
  hostSocketId: string;
  players: Map<string, Player>;
  phase: 'lobby' | 'playing' | 'results';
  gameStartTime: number | null;
  finishOrder: string[];
}
