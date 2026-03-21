import type { PuzzleState, Piece } from './types.js';

// Classic Klotski layout:
// A = 2×2 red (cols 0-1, rows 0-1)
// B = 2×1 vert blue (col 2, rows 0-1)
// C = 2×1 vert purple (col 3, rows 0-1)
// D = 2×1 vert green (col 0, rows 2-3)
// E = 1×2 horiz orange (cols 1-2, row 2)
// F = 2×1 vert teal (col 3, rows 2-3)
// G = 2×1 vert amber (col 1, rows 3-4)
// H = 2×1 vert pink (col 2, rows 3-4)
// Empty: (4,0) and (4,3)

export function createInitialState(): PuzzleState {
  const pieces: Record<string, Piece> = {
    A: { id: 'A', cells: [[0,0],[0,1],[1,0],[1,1]] },
    B: { id: 'B', cells: [[0,2],[1,2]] },
    C: { id: 'C', cells: [[0,3],[1,3]] },
    D: { id: 'D', cells: [[2,0],[3,0]] },
    E: { id: 'E', cells: [[2,1],[2,2]] },
    F: { id: 'F', cells: [[2,3],[3,3]] },
    G: { id: 'G', cells: [[3,1],[4,1]] },
    H: { id: 'H', cells: [[3,2],[4,2]] },
  };

  const board = buildBoard(pieces);

  return {
    board,
    pieces,
    moves: 0,
    solved: false,
    startTime: Date.now(),
    solveTime: null,
  };
}

function buildBoard(pieces: Record<string, Piece>): (string | null)[][] {
  const board: (string | null)[][] = Array.from({ length: 5 }, () => Array(4).fill(null));
  for (const piece of Object.values(pieces)) {
    for (const [r, c] of piece.cells) {
      board[r][c] = piece.id;
    }
  }
  return board;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

const DELTAS: Record<Direction, [number, number]> = {
  up:    [-1,  0],
  down:  [ 1,  0],
  left:  [ 0, -1],
  right: [ 0,  1],
};

export function applyMove(
  state: PuzzleState,
  pieceId: string,
  direction: Direction
): { ok: boolean; state: PuzzleState } {
  const piece = state.pieces[pieceId];
  if (!piece) return { ok: false, state };

  const [dr, dc] = DELTAS[direction];
  const newCells: [number, number][] = piece.cells.map(([r, c]) => [r + dr, c + dc]);

  // Bounds check
  for (const [r, c] of newCells) {
    if (r < 0 || r > 4 || c < 0 || c > 3) return { ok: false, state };
  }

  // Collision check (ignore own cells)
  const ownSet = new Set(piece.cells.map(([r, c]) => `${r},${c}`));
  for (const [r, c] of newCells) {
    const key = `${r},${c}`;
    if (!ownSet.has(key)) {
      const occupant = state.board[r][c];
      if (occupant !== null && occupant !== pieceId) return { ok: false, state };
    }
  }

  // Apply move
  const newPieces = {
    ...state.pieces,
    [pieceId]: { ...piece, cells: newCells },
  };
  const newBoard = buildBoard(newPieces);
  const solved = checkWin(newPieces['A']);

  return {
    ok: true,
    state: {
      ...state,
      board: newBoard,
      pieces: newPieces,
      moves: state.moves + 1,
      solved,
      solveTime: solved ? Date.now() - state.startTime : null,
    },
  };
}

// Win: piece A occupies (3,1),(3,2),(4,1),(4,2)
function checkWin(pieceA: Piece | undefined): boolean {
  if (!pieceA) return false;
  const winCells = new Set(['3,1', '3,2', '4,1', '4,2']);
  const pieceCells = new Set(pieceA.cells.map(([r, c]) => `${r},${c}`));
  for (const cell of winCells) {
    if (!pieceCells.has(cell)) return false;
  }
  return true;
}
