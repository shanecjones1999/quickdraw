export interface Vehicle {
  id: string;
  orientation: "H" | "V";
  row: number;
  col: number;
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

const BOARD_SIZE = 6;
const EXIT_ROW = 2;
const EASY_MEDIUM_MIN_STEPS = 7;
const EASY_MEDIUM_MAX_STEPS = 12;

const RAW_PUZZLES: Vehicle[][] = [
  [
    { id: "red", orientation: "H", row: 2, col: 2, length: 2 },
    { id: "A", orientation: "H", row: 4, col: 4, length: 2 },
    { id: "B", orientation: "V", row: 0, col: 5, length: 3 },
    { id: "C", orientation: "H", row: 3, col: 1, length: 2 },
    { id: "D", orientation: "V", row: 4, col: 0, length: 2 },
    { id: "E", orientation: "V", row: 4, col: 2, length: 2 },
    { id: "F", orientation: "H", row: 1, col: 1, length: 2 },
    { id: "G", orientation: "H", row: 0, col: 3, length: 2 },
    { id: "H", orientation: "H", row: 5, col: 3, length: 3 },
    { id: "I", orientation: "V", row: 1, col: 4, length: 2 },
  ],
  [
    { id: "red", orientation: "H", row: 2, col: 0, length: 2 },
    { id: "A", orientation: "V", row: 1, col: 4, length: 3 },
    { id: "B", orientation: "V", row: 3, col: 3, length: 2 },
    { id: "C", orientation: "H", row: 0, col: 2, length: 2 },
    { id: "D", orientation: "H", row: 3, col: 0, length: 3 },
    { id: "E", orientation: "H", row: 5, col: 3, length: 2 },
    { id: "F", orientation: "V", row: 1, col: 2, length: 2 },
  ],
  [
    { id: "red", orientation: "H", row: 2, col: 0, length: 2 },
    { id: "A", orientation: "H", row: 5, col: 0, length: 2 },
    { id: "B", orientation: "H", row: 1, col: 3, length: 3 },
    { id: "C", orientation: "V", row: 3, col: 2, length: 2 },
    { id: "D", orientation: "V", row: 1, col: 2, length: 2 },
    { id: "E", orientation: "V", row: 4, col: 5, length: 2 },
    { id: "F", orientation: "V", row: 2, col: 5, length: 2 },
  ],
  [
    { id: "red", orientation: "H", row: 2, col: 0, length: 2 },
    { id: "A", orientation: "H", row: 5, col: 1, length: 2 },
    { id: "B", orientation: "V", row: 4, col: 4, length: 2 },
    { id: "C", orientation: "V", row: 3, col: 0, length: 3 },
    { id: "D", orientation: "V", row: 0, col: 1, length: 2 },
    { id: "E", orientation: "H", row: 3, col: 3, length: 3 },
    { id: "F", orientation: "H", row: 0, col: 2, length: 3 },
    { id: "G", orientation: "V", row: 4, col: 5, length: 2 },
    { id: "H", orientation: "V", row: 1, col: 3, length: 2 },
  ],
  [
    { id: "red", orientation: "H", row: 2, col: 2, length: 2 },
    { id: "A", orientation: "V", row: 1, col: 5, length: 3 },
    { id: "B", orientation: "V", row: 0, col: 0, length: 2 },
    { id: "C", orientation: "V", row: 3, col: 1, length: 2 },
    { id: "D", orientation: "H", row: 4, col: 4, length: 2 },
    { id: "E", orientation: "V", row: 3, col: 0, length: 2 },
    { id: "F", orientation: "H", row: 4, col: 2, length: 2 },
  ],
  [
    { id: "red", orientation: "H", row: 2, col: 0, length: 2 },
    { id: "A", orientation: "H", row: 3, col: 0, length: 2 },
    { id: "B", orientation: "V", row: 4, col: 4, length: 2 },
    { id: "C", orientation: "V", row: 1, col: 3, length: 3 },
    { id: "D", orientation: "H", row: 4, col: 2, length: 2 },
    { id: "E", orientation: "V", row: 2, col: 5, length: 2 },
    { id: "F", orientation: "V", row: 1, col: 4, length: 2 },
    { id: "G", orientation: "V", row: 4, col: 5, length: 2 },
  ],
  [
    { id: "red", orientation: "H", row: 2, col: 0, length: 2 },
    { id: "A", orientation: "H", row: 3, col: 0, length: 2 },
    { id: "B", orientation: "H", row: 5, col: 1, length: 2 },
    { id: "C", orientation: "H", row: 0, col: 3, length: 2 },
    { id: "D", orientation: "V", row: 2, col: 2, length: 3 },
    { id: "E", orientation: "H", row: 4, col: 4, length: 2 },
    { id: "F", orientation: "V", row: 1, col: 5, length: 2 },
    { id: "G", orientation: "V", row: 4, col: 3, length: 2 },
    { id: "H", orientation: "V", row: 1, col: 3, length: 2 },
  ],
  [
    { id: "red", orientation: "H", row: 2, col: 1, length: 2 },
    { id: "A", orientation: "H", row: 4, col: 2, length: 2 },
    { id: "B", orientation: "V", row: 3, col: 4, length: 3 },
    { id: "C", orientation: "H", row: 0, col: 1, length: 2 },
    { id: "D", orientation: "V", row: 1, col: 3, length: 3 },
    { id: "E", orientation: "H", row: 1, col: 0, length: 3 },
    { id: "F", orientation: "V", row: 1, col: 5, length: 2 },
    { id: "G", orientation: "H", row: 5, col: 1, length: 3 },
    { id: "H", orientation: "V", row: 2, col: 0, length: 3 },
    { id: "I", orientation: "H", row: 0, col: 3, length: 2 },
  ],
  [
    { id: "red", orientation: "H", row: 2, col: 1, length: 2 },
    { id: "A", orientation: "V", row: 2, col: 4, length: 2 },
    { id: "B", orientation: "H", row: 4, col: 3, length: 2 },
    { id: "C", orientation: "V", row: 2, col: 5, length: 3 },
    { id: "D", orientation: "H", row: 0, col: 0, length: 2 },
    { id: "E", orientation: "H", row: 0, col: 4, length: 2 },
    { id: "F", orientation: "H", row: 1, col: 1, length: 2 },
    { id: "G", orientation: "H", row: 4, col: 0, length: 2 },
    { id: "H", orientation: "V", row: 1, col: 3, length: 2 },
    { id: "I", orientation: "H", row: 3, col: 0, length: 2 },
  ],
  [
    { id: "red", orientation: "H", row: 2, col: 0, length: 2 },
    { id: "A", orientation: "V", row: 2, col: 2, length: 2 },
    { id: "B", orientation: "H", row: 0, col: 1, length: 2 },
    { id: "C", orientation: "V", row: 1, col: 4, length: 2 },
    { id: "D", orientation: "V", row: 2, col: 3, length: 2 },
    { id: "E", orientation: "H", row: 1, col: 0, length: 2 },
    { id: "F", orientation: "V", row: 4, col: 2, length: 2 },
  ],
  [
    { id: "red", orientation: "H", row: 2, col: 0, length: 2 },
    { id: "A", orientation: "V", row: 1, col: 3, length: 2 },
    { id: "B", orientation: "V", row: 1, col: 2, length: 2 },
    { id: "C", orientation: "H", row: 3, col: 3, length: 2 },
    { id: "D", orientation: "V", row: 4, col: 1, length: 2 },
    { id: "E", orientation: "V", row: 1, col: 4, length: 2 },
    { id: "F", orientation: "V", row: 4, col: 5, length: 2 },
    { id: "G", orientation: "V", row: 3, col: 0, length: 3 },
    { id: "H", orientation: "H", row: 0, col: 2, length: 2 },
  ],
  [
    { id: "red", orientation: "H", row: 2, col: 0, length: 2 },
    { id: "A", orientation: "H", row: 0, col: 0, length: 2 },
    { id: "B", orientation: "H", row: 5, col: 0, length: 2 },
    { id: "C", orientation: "H", row: 4, col: 2, length: 2 },
    { id: "D", orientation: "V", row: 2, col: 3, length: 2 },
    { id: "E", orientation: "V", row: 1, col: 5, length: 2 },
    { id: "F", orientation: "H", row: 5, col: 3, length: 2 },
    { id: "G", orientation: "H", row: 0, col: 3, length: 3 },
    { id: "H", orientation: "H", row: 4, col: 0, length: 2 },
    { id: "I", orientation: "H", row: 1, col: 1, length: 2 },
  ],
];

type Grid = (string | null)[][];

function cloneVehicles(vehicles: Vehicle[]): Vehicle[] {
  return vehicles.map((vehicle) => ({ ...vehicle }));
}

function normalizePuzzleIndex(puzzleIndex: number): number {
  if (!Number.isFinite(puzzleIndex)) return 0;
  const normalized = Math.abs(Math.trunc(puzzleIndex));
  return normalized % RAW_PUZZLES.length;
}

function buildGrid(vehicles: Vehicle[]): Grid {
  const grid: Grid = Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(null)
  );

  for (const vehicle of vehicles) {
    for (let offset = 0; offset < vehicle.length; offset++) {
      const row = vehicle.orientation === "V" ? vehicle.row + offset : vehicle.row;
      const col = vehicle.orientation === "H" ? vehicle.col + offset : vehicle.col;

      if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
        throw new Error(`Rush Hour vehicle ${vehicle.id} is out of bounds.`);
      }
      if (grid[row][col] !== null) {
        throw new Error(
          `Rush Hour vehicles ${grid[row][col]} and ${vehicle.id} overlap.`
        );
      }

      grid[row][col] = vehicle.id;
    }
  }

  return grid;
}

function isSolved(vehicles: Vehicle[]): boolean {
  const red = vehicles.find((vehicle) => vehicle.id === "red");
  return (
    red !== undefined &&
    red.orientation === "H" &&
    red.row === EXIT_ROW &&
    red.col + red.length - 1 === BOARD_SIZE - 1
  );
}

function serializeVehicles(vehicles: Vehicle[]): string {
  return vehicles.map((vehicle) => `${vehicle.id}:${vehicle.row},${vehicle.col}`).join("|");
}

function getAdjacentMoves(vehicles: Vehicle[]): Vehicle[][] {
  const nextStates: Vehicle[][] = [];

  vehicles.forEach((vehicle, index) => {
    const grid = buildGrid(vehicles);

    for (let offset = 0; offset < vehicle.length; offset++) {
      const row = vehicle.orientation === "V" ? vehicle.row + offset : vehicle.row;
      const col = vehicle.orientation === "H" ? vehicle.col + offset : vehicle.col;
      grid[row][col] = null;
    }

    for (const delta of [-1, 1] as const) {
      const row = vehicle.orientation === "V" ? vehicle.row + delta : vehicle.row;
      const col = vehicle.orientation === "H" ? vehicle.col + delta : vehicle.col;
      const endRow = vehicle.orientation === "V" ? row + vehicle.length - 1 : row;
      const endCol = vehicle.orientation === "H" ? col + vehicle.length - 1 : col;

      if (row < 0 || col < 0 || endRow >= BOARD_SIZE || endCol >= BOARD_SIZE) {
        continue;
      }

      let blocked = false;
      for (let offset = 0; offset < vehicle.length; offset++) {
        const nextRow = vehicle.orientation === "V" ? row + offset : row;
        const nextCol = vehicle.orientation === "H" ? col + offset : col;
        if (grid[nextRow][nextCol] !== null) {
          blocked = true;
          break;
        }
      }

      if (blocked) continue;

      const nextVehicles = cloneVehicles(vehicles);
      nextVehicles[index] = { ...vehicle, row, col };
      nextStates.push(nextVehicles);
    }
  });

  return nextStates;
}

function getMinimumSolutionSteps(
  vehicles: Vehicle[],
  maxSteps: number
): number | null {
  const queue: Array<{ vehicles: Vehicle[]; steps: number }> = [
    { vehicles: cloneVehicles(vehicles), steps: 0 },
  ];
  const seen = new Set<string>([serializeVehicles(vehicles)]);

  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (isSolved(current.vehicles)) return current.steps;
    if (current.steps >= maxSteps) continue;

    for (const nextVehicles of getAdjacentMoves(current.vehicles)) {
      const signature = serializeVehicles(nextVehicles);
      if (seen.has(signature)) continue;
      seen.add(signature);
      queue.push({ vehicles: nextVehicles, steps: current.steps + 1 });
    }
  }

  return null;
}

function validatePuzzlePool(puzzles: Vehicle[][]): Vehicle[][] {
  return puzzles.map((puzzle, index) => {
    const ids = new Set<string>();
    let redCount = 0;

    for (const vehicle of puzzle) {
      if (ids.has(vehicle.id)) {
        throw new Error(`Rush Hour puzzle ${index} reuses vehicle id ${vehicle.id}.`);
      }
      ids.add(vehicle.id);

      if (vehicle.id === "red") {
        redCount += 1;
        if (
          vehicle.orientation !== "H" ||
          vehicle.row !== EXIT_ROW ||
          vehicle.length !== 2
        ) {
          throw new Error(`Rush Hour puzzle ${index} has an invalid red car.`);
        }
      }
    }

    if (redCount !== 1) {
      throw new Error(`Rush Hour puzzle ${index} must contain exactly one red car.`);
    }

    buildGrid(puzzle);

    const minimumSteps = getMinimumSolutionSteps(puzzle, EASY_MEDIUM_MAX_STEPS);
    if (
      minimumSteps === null ||
      minimumSteps < EASY_MEDIUM_MIN_STEPS ||
      minimumSteps > EASY_MEDIUM_MAX_STEPS
    ) {
      throw new Error(
        `Rush Hour puzzle ${index} is outside the easy-medium range.`
      );
    }

    return cloneVehicles(puzzle);
  });
}

const PUZZLES = validatePuzzlePool(RAW_PUZZLES);

export function createRushHourState(puzzleIndex: number): RushHourState {
  const idx = normalizePuzzleIndex(puzzleIndex);
  return {
    vehicles: cloneVehicles(PUZZLES[idx]),
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
  delta: number
): { ok: boolean; state: RushHourState } {
  if (state.solved) return { ok: false, state };

  const vehicles = cloneVehicles(state.vehicles);
  const index = vehicles.findIndex((vehicle) => vehicle.id === vehicleId);
  if (index === -1) return { ok: false, state };

  const vehicle = vehicles[index];
  const grid = buildGrid(vehicles);

  for (let offset = 0; offset < vehicle.length; offset++) {
    const row = vehicle.orientation === "V" ? vehicle.row + offset : vehicle.row;
    const col = vehicle.orientation === "H" ? vehicle.col + offset : vehicle.col;
    grid[row][col] = null;
  }

  const newRow = vehicle.orientation === "V" ? vehicle.row + delta : vehicle.row;
  const newCol = vehicle.orientation === "H" ? vehicle.col + delta : vehicle.col;
  const endRow = vehicle.orientation === "V" ? newRow + vehicle.length - 1 : newRow;
  const endCol = vehicle.orientation === "H" ? newCol + vehicle.length - 1 : newCol;

  if (newRow < 0 || newCol < 0 || endRow >= BOARD_SIZE || endCol >= BOARD_SIZE) {
    return { ok: false, state };
  }

  for (let offset = 0; offset < vehicle.length; offset++) {
    const row = vehicle.orientation === "V" ? newRow + offset : newRow;
    const col = vehicle.orientation === "H" ? newCol + offset : newCol;
    if (grid[row][col] !== null) return { ok: false, state };
  }

  vehicles[index] = { ...vehicle, row: newRow, col: newCol };

  const solved = isSolved(vehicles);
  return {
    ok: true,
    state: {
      ...state,
      vehicles,
      moves: state.moves + 1,
      solved,
      finishTime: solved ? Date.now() - state.startTime : null,
    },
  };
}

export function PUZZLE_COUNT() {
  return PUZZLES.length;
}
