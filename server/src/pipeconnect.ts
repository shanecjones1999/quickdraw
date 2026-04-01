const NORTH = 1;
const EAST = 2;
const SOUTH = 4;
const WEST = 8;

export interface PipeConnectTile {
    id: string;
    row: number;
    col: number;
    solvedMask: number;
    currentMask: number;
    rotation: number;
    locked: boolean;
    start: boolean;
    end: boolean;
}

export interface PipeConnectPublicTile {
    id: string;
    row: number;
    col: number;
    mask: number;
    locked: boolean;
    start: boolean;
    end: boolean;
}

export interface PipeConnectState {
    tiles: PipeConnectTile[];
    moves: number;
    solved: boolean;
    startTime: number;
    finishTime: number | null;
    puzzleIndex: number;
}

interface PuzzleDefinition {
    solvedMasks: number[][];
    lockedCells: Array<[number, number]>;
    start: [number, number];
    end: [number, number];
}

const PUZZLES: PuzzleDefinition[] = [
    {
        solvedMasks: [
            [EAST | SOUTH, EAST | WEST, SOUTH | WEST, 0],
            [NORTH | SOUTH, EAST | SOUTH, NORTH | EAST | WEST, SOUTH | WEST],
            [NORTH | EAST, NORTH | SOUTH | WEST, 0, NORTH | SOUTH],
            [0, NORTH | EAST, EAST | WEST, NORTH | WEST],
        ],
        lockedCells: [
            [0, 0],
            [0, 3],
            [2, 2],
            [3, 0],
            [3, 3],
        ],
        start: [0, 0],
        end: [3, 3],
    },
    {
        solvedMasks: [
            [0, EAST | SOUTH, EAST | WEST, SOUTH | WEST],
            [EAST | SOUTH, NORTH | WEST, EAST | SOUTH, NORTH | SOUTH | WEST],
            [NORTH | EAST | SOUTH, EAST | WEST, NORTH | WEST, NORTH | SOUTH],
            [NORTH | EAST, EAST | WEST, EAST | WEST, NORTH | WEST],
        ],
        lockedCells: [
            [0, 0],
            [0, 1],
            [3, 3],
        ],
        start: [0, 1],
        end: [3, 3],
    },
    {
        solvedMasks: [
            [EAST | SOUTH, EAST | WEST, EAST | WEST, SOUTH | WEST],
            [NORTH | SOUTH, 0, EAST | SOUTH, NORTH | SOUTH | WEST],
            [NORTH | EAST | SOUTH, EAST | WEST, NORTH | WEST, NORTH | SOUTH],
            [NORTH | EAST, EAST | WEST, EAST | WEST, NORTH | WEST],
        ],
        lockedCells: [
            [0, 0],
            [1, 1],
            [3, 3],
        ],
        start: [0, 0],
        end: [3, 3],
    },
];

function rotateMaskClockwise(mask: number): number {
    return (
        (mask & NORTH ? EAST : 0) |
        (mask & EAST ? SOUTH : 0) |
        (mask & SOUTH ? WEST : 0) |
        (mask & WEST ? NORTH : 0)
    );
}

function rotateMask(mask: number, rotation: number): number {
    let current = mask;
    for (let index = 0; index < rotation; index++) {
        current = rotateMaskClockwise(current);
    }
    return current;
}

function cloneTiles(tiles: PipeConnectTile[]): PipeConnectTile[] {
    return tiles.map((tile) => ({ ...tile }));
}

function isSolved(tiles: PipeConnectTile[]): boolean {
    return tiles.every((tile) => tile.currentMask === tile.solvedMask);
}

function createScrambledTiles(puzzle: PuzzleDefinition): PipeConnectTile[] {
    const lockedSet = new Set(
        puzzle.lockedCells.map(([row, col]) => `${row},${col}`),
    );

    const tiles = puzzle.solvedMasks.flatMap((rowMasks, row) =>
        rowMasks.map((solvedMask, col) => {
            const locked = lockedSet.has(`${row},${col}`) || solvedMask === 0;
            const rotation = locked ? 0 : Math.floor(Math.random() * 4);
            return {
                id: `tile-${row}-${col}`,
                row,
                col,
                solvedMask,
                currentMask: rotateMask(solvedMask, rotation),
                rotation,
                locked,
                start: row === puzzle.start[0] && col === puzzle.start[1],
                end: row === puzzle.end[0] && col === puzzle.end[1],
            };
        }),
    );

    if (isSolved(tiles)) {
        const firstRotatable = tiles.find(
            (tile) => !tile.locked && tile.solvedMask !== 0,
        );
        if (firstRotatable) {
            firstRotatable.rotation = (firstRotatable.rotation + 1) % 4;
            firstRotatable.currentMask = rotateMask(
                firstRotatable.solvedMask,
                firstRotatable.rotation,
            );
        }
    }

    return tiles;
}

export function toPublicPipeConnectTiles(
    tiles: PipeConnectTile[],
): PipeConnectPublicTile[] {
    return tiles.map((tile) => ({
        id: tile.id,
        row: tile.row,
        col: tile.col,
        mask: tile.currentMask,
        locked: tile.locked,
        start: tile.start,
        end: tile.end,
    }));
}

export function createPipeConnectState(
    puzzleIndex: number,
    tiles?: PipeConnectTile[],
): PipeConnectState {
    const normalizedIndex =
        ((puzzleIndex % PUZZLES.length) + PUZZLES.length) % PUZZLES.length;
    const nextTiles = tiles
        ? cloneTiles(tiles)
        : createScrambledTiles(PUZZLES[normalizedIndex]);

    return {
        tiles: nextTiles,
        moves: 0,
        solved: isSolved(nextTiles),
        startTime: Date.now(),
        finishTime: null,
        puzzleIndex: normalizedIndex,
    };
}

export function applyPipeConnectRotate(
    state: PipeConnectState,
    tileId: string,
): { ok: boolean; state: PipeConnectState } {
    if (state.solved) return { ok: false, state };

    const tiles = cloneTiles(state.tiles);
    const tile = tiles.find((entry) => entry.id === tileId);
    if (!tile || tile.locked) return { ok: false, state };

    tile.rotation = (tile.rotation + 1) % 4;
    tile.currentMask = rotateMask(tile.solvedMask, tile.rotation);

    const solved = isSolved(tiles);

    return {
        ok: true,
        state: {
            ...state,
            tiles,
            moves: state.moves + 1,
            solved,
            finishTime: solved ? Date.now() - state.startTime : null,
        },
    };
}

export function PIPE_CONNECT_PUZZLE_COUNT(): number {
    return PUZZLES.length;
}
