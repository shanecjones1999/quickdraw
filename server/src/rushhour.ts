export interface Vehicle {
  id: string;           // 'red' | 'A' | 'B' | ...
  orientation: 'H' | 'V';
  row: number;          // top-left row (0-indexed)
  col: number;          // top-left col (0-indexed)
  length: 2 | 3;
}

export interface RushHourState {
  vehicles: Vehicle[];
  moves: number;
  solved: boolean;
  startTime: number;
  finishTime: number | null;
  puzzleIndex: number;
}

// 6×6 grid, red car exits right on row 2
// Puzzles: array of Vehicle definitions
const PUZZLES: Vehicle[][] = [
  // Puzzle 0 – beginner
  [
    { id: 'red', orientation: 'H', row: 2, col: 0, length: 2 },
    { id: 'A',   orientation: 'V', row: 0, col: 2, length: 2 },
    { id: 'B',   orientation: 'H', row: 0, col: 3, length: 3 },
    { id: 'C',   orientation: 'V', row: 1, col: 5, length: 3 },
    { id: 'D',   orientation: 'H', row: 3, col: 0, length: 2 },
    { id: 'E',   orientation: 'V', row: 3, col: 2, length: 3 },
    { id: 'F',   orientation: 'H', row: 4, col: 3, length: 3 },
    { id: 'G',   orientation: 'V', row: 0, col: 0, length: 2 },
  ],
  // Puzzle 1 – intermediate
  [
    { id: 'red', orientation: 'H', row: 2, col: 1, length: 2 },
    { id: 'A',   orientation: 'V', row: 0, col: 0, length: 3 },
    { id: 'B',   orientation: 'H', row: 0, col: 1, length: 2 },
    { id: 'C',   orientation: 'V', row: 0, col: 3, length: 2 },
    { id: 'D',   orientation: 'H', row: 0, col: 4, length: 2 },
    { id: 'E',   orientation: 'V', row: 1, col: 3, length: 3 },
    { id: 'F',   orientation: 'H', row: 2, col: 4, length: 2 },
    { id: 'G',   orientation: 'V', row: 3, col: 0, length: 2 },
    { id: 'H',   orientation: 'H', row: 3, col: 1, length: 3 },
    { id: 'I',   orientation: 'V', row: 4, col: 4, length: 2 },
    { id: 'J',   orientation: 'H', row: 5, col: 1, length: 3 },
    { id: 'K',   orientation: 'V', row: 4, col: 5, length: 2 },
  ],
  // Puzzle 2 – intermediate
  [
    { id: 'red', orientation: 'H', row: 2, col: 3, length: 2 },
    { id: 'A',   orientation: 'V', row: 0, col: 0, length: 2 },
    { id: 'B',   orientation: 'H', row: 0, col: 1, length: 3 },
    { id: 'C',   orientation: 'V', row: 0, col: 4, length: 3 },
    { id: 'D',   orientation: 'H', row: 1, col: 0, length: 2 },
    { id: 'E',   orientation: 'V', row: 2, col: 0, length: 3 },
    { id: 'F',   orientation: 'H', row: 2, col: 1, length: 2 },
    { id: 'G',   orientation: 'V', row: 3, col: 3, length: 3 },
    { id: 'H',   orientation: 'H', row: 4, col: 0, length: 2 },
    { id: 'I',   orientation: 'H', row: 5, col: 1, length: 2 },
    { id: 'J',   orientation: 'V', row: 4, col: 4, length: 2 },
    { id: 'K',   orientation: 'H', row: 5, col: 3, length: 3 },
  ],
];

function buildGrid(vehicles: Vehicle[]): (string | null)[][] {
  const grid: (string | null)[][] = Array.from({ length: 6 }, () => Array(6).fill(null));
  for (const v of vehicles) {
    for (let i = 0; i < v.length; i++) {
      const r = v.orientation === 'V' ? v.row + i : v.row;
      const c = v.orientation === 'H' ? v.col + i : v.col;
      grid[r][c] = v.id;
    }
  }
  return grid;
}

export function createRushHourState(puzzleIndex: number): RushHourState {
  const idx = puzzleIndex % PUZZLES.length;
  return {
    vehicles: PUZZLES[idx].map(v => ({ ...v })),
    moves: 0,
    solved: false,
    startTime: Date.now(),
    finishTime: null,
    puzzleIndex: idx,
  };
}

export function applyRushHourMove(
  state: RushHourState,
  vehicleId: string,
  delta: number  // +1 or -1 steps
): { ok: boolean; state: RushHourState } {
  if (state.solved) return { ok: false, state };

  const vehicles = state.vehicles.map(v => ({ ...v }));
  const idx = vehicles.findIndex(v => v.id === vehicleId);
  if (idx === -1) return { ok: false, state };

  const vehicle = vehicles[idx];
  const grid = buildGrid(vehicles);

  // Clear the vehicle's own cells before checking
  for (let i = 0; i < vehicle.length; i++) {
    const r = vehicle.orientation === 'V' ? vehicle.row + i : vehicle.row;
    const c = vehicle.orientation === 'H' ? vehicle.col + i : vehicle.col;
    grid[r][c] = null;
  }

  const newRow = vehicle.orientation === 'V' ? vehicle.row + delta : vehicle.row;
  const newCol = vehicle.orientation === 'H' ? vehicle.col + delta : vehicle.col;

  // Bounds check
  if (newRow < 0 || newCol < 0) return { ok: false, state };
  const endRow = vehicle.orientation === 'V' ? newRow + vehicle.length - 1 : newRow;
  const endCol = vehicle.orientation === 'H' ? newCol + vehicle.length - 1 : newCol;
  if (endRow > 5 || endCol > 5) return { ok: false, state };

  // Collision check
  for (let i = 0; i < vehicle.length; i++) {
    const r = vehicle.orientation === 'V' ? newRow + i : newRow;
    const c = vehicle.orientation === 'H' ? newCol + i : newCol;
    if (grid[r][c] !== null) return { ok: false, state };
  }

  vehicles[idx] = { ...vehicle, row: newRow, col: newCol };

  // Win: red car's right edge is at col 5 (exits at col 6)
  // We treat it as solved when the red car reaches col 4 (right edge at col 5)
  const red = vehicles.find(v => v.id === 'red')!;
  const solved = red.orientation === 'H' && red.col + red.length - 1 === 5;

  const newState: RushHourState = {
    ...state,
    vehicles,
    moves: state.moves + 1,
    solved,
    finishTime: solved ? Date.now() - state.startTime : null,
  };

  return { ok: true, state: newState };
}

export function PUZZLE_COUNT() { return PUZZLES.length; }
