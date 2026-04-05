import type { PuzzleState, Piece } from './types.js';

const BOARD_ROWS = 5;
const BOARD_COLS = 4;
const SCRAMBLE_MIN_STEPS = 24;
const SCRAMBLE_STEP_VARIANCE = 12;

// Classic Huarong Pass layout (Klotski):
// A = 2×2 red  (cols 1-2, rows 0-1)  ← the key piece, starts top-center
// B = 2×1 vert blue   (col 0, rows 0-1)
// C = 2×1 vert purple (col 3, rows 0-1)
// D = 2×1 vert green  (col 0, rows 2-3)
// E = 1×2 horiz orange (cols 1-2, row 2)
// F = 2×1 vert teal   (col 3, rows 2-3)
// G = 1×1 amber  (row 3, col 1)
// H = 1×1 pink   (row 3, col 2)
// I = 1×1 yellow (row 4, col 1)
// J = 1×1 gray   (row 4, col 2)
// Empty: (4,0) and (4,3)
//
// Win: A reaches (3,1),(3,2),(4,1),(4,2) — drops straight down to the exit.
const CLASSIC_PIECES: Record<string, Piece> = {
  A: { id: 'A', cells: [[0, 1], [0, 2], [1, 1], [1, 2]] },
  B: { id: 'B', cells: [[0, 0], [1, 0]] },
  C: { id: 'C', cells: [[0, 3], [1, 3]] },
  D: { id: 'D', cells: [[2, 0], [3, 0]] },
  E: { id: 'E', cells: [[2, 1], [2, 2]] },
  F: { id: 'F', cells: [[2, 3], [3, 3]] },
  G: { id: 'G', cells: [[3, 1]] },
  H: { id: 'H', cells: [[3, 2]] },
  I: { id: 'I', cells: [[4, 1]] },
  J: { id: 'J', cells: [[4, 2]] },
};

export type Direction = 'up' | 'down' | 'left' | 'right';

const DELTAS: Record<Direction, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

type MoveOption = {
  pieceId: string;
  direction: Direction;
  nextState: PuzzleState;
  key: string;
};

export function createInitialState(
  initialPieces?: Record<string, Piece>,
): PuzzleState {
  const pieces = initialPieces
    ? clonePieces(initialPieces)
    : generateSolvablePieces();
  const board = buildBoard(pieces);

  return {
    board,
    pieces,
    moves: 0,
    solved: checkWin(pieces.A),
    startTime: Date.now(),
    solveTime: null,
  };
}

function clonePieces(pieces: Record<string, Piece>): Record<string, Piece> {
  return Object.fromEntries(
    Object.entries(pieces).map(([pieceId, piece]) => [
      pieceId,
      {
        ...piece,
        cells: piece.cells.map(
          ([row, col]) => [row, col] as [number, number],
        ),
      },
    ]),
  );
}

function buildBoard(pieces: Record<string, Piece>): (string | null)[][] {
  const board: (string | null)[][] = Array.from({ length: BOARD_ROWS }, () =>
    Array(BOARD_COLS).fill(null),
  );

  for (const piece of Object.values(pieces)) {
    for (const [row, col] of piece.cells) {
      if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) {
        throw new Error(
          `Klotski piece ${piece.id} is out of bounds at ${row},${col}`,
        );
      }

      if (board[row][col] !== null) {
        throw new Error(
          `Klotski pieces ${board[row][col]} and ${piece.id} overlap at ${row},${col}`,
        );
      }

      board[row][col] = piece.id;
    }
  }

  return board;
}

function stateKey(pieces: Record<string, Piece>): string {
  return Object.values(pieces)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (piece) =>
        `${piece.id}:${piece.cells
          .map(([row, col]) => `${row},${col}`)
          .sort()
          .join(';')}`,
    )
    .join('|');
}

function listLegalMoves(
  state: PuzzleState,
  previousMove?: { pieceId: string; direction: Direction } | null,
): MoveOption[] {
  const moves: MoveOption[] = [];

  for (const pieceId of Object.keys(state.pieces)) {
    for (const direction of Object.keys(DELTAS) as Direction[]) {
      if (
        previousMove &&
        previousMove.pieceId === pieceId &&
        previousMove.direction === OPPOSITE_DIRECTION[direction]
      ) {
        continue;
      }

      const result = applyMove(state, pieceId, direction);
      if (!result.ok || result.state.solved) {
        continue;
      }

      moves.push({
        pieceId,
        direction,
        nextState: result.state,
        key: stateKey(result.state.pieces),
      });
    }
  }

  return moves;
}

function generateSolvablePieces(): Record<string, Piece> {
  let state = createInitialState(CLASSIC_PIECES);
  let previousMove: { pieceId: string; direction: Direction } | null = null;

  const targetSteps =
    SCRAMBLE_MIN_STEPS +
    Math.floor(Math.random() * (SCRAMBLE_STEP_VARIANCE + 1));
  const visited = new Set<string>([stateKey(state.pieces)]);

  for (let step = 0; step < targetSteps; step += 1) {
    let legalMoves = listLegalMoves(state, previousMove);
    if (legalMoves.length === 0 && previousMove) {
      legalMoves = listLegalMoves(state, null);
    }

    if (legalMoves.length === 0) {
      break;
    }

    const unseenMoves = legalMoves.filter((move) => !visited.has(move.key));
    const candidates = unseenMoves.length > 0 ? unseenMoves : legalMoves;
    const nextMove =
      candidates[Math.floor(Math.random() * candidates.length)];

    state = nextMove.nextState;
    previousMove = {
      pieceId: nextMove.pieceId,
      direction: nextMove.direction,
    };
    visited.add(nextMove.key);
  }

  return clonePieces(state.pieces);
}

export function applyMove(
  state: PuzzleState,
  pieceId: string,
  direction: Direction,
): { ok: boolean; state: PuzzleState } {
  if (state.solved) return { ok: false, state };

  const piece = state.pieces[pieceId];
  if (!piece) return { ok: false, state };

  const [dr, dc] = DELTAS[direction];
  const newCells: [number, number][] = piece.cells.map(([r, c]) => [
    r + dr,
    c + dc,
  ]);

  for (const [r, c] of newCells) {
    if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) {
      return { ok: false, state };
    }
  }

  const ownSet = new Set(piece.cells.map(([r, c]) => `${r},${c}`));
  for (const [r, c] of newCells) {
    const key = `${r},${c}`;
    if (!ownSet.has(key)) {
      const occupant = state.board[r][c];
      if (occupant !== null && occupant !== pieceId) {
        return { ok: false, state };
      }
    }
  }

  const newPieces = {
    ...state.pieces,
    [pieceId]: { ...piece, cells: newCells },
  };
  const solved = checkWin(newPieces.A);

  return {
    ok: true,
    state: {
      ...state,
      board: buildBoard(newPieces),
      pieces: newPieces,
      moves: state.moves + 1,
      solved,
      solveTime: solved ? Date.now() - state.startTime : null,
    },
  };
}

function checkWin(pieceA: Piece | undefined): boolean {
  if (!pieceA) return false;

  const winCells = new Set(['3,1', '3,2', '4,1', '4,2']);
  const pieceCells = new Set(
    pieceA.cells.map(([row, col]) => `${row},${col}`),
  );

  for (const cell of winCells) {
    if (!pieceCells.has(cell)) return false;
  }

  return true;
}
