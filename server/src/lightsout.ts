export const LIGHTS_OUT_SIZE = 5;

export interface LightsOutState {
    board: boolean[][];
    moves: number;
    solved: boolean;
    startTime: number;
    finishTime: number | null;
}

function cloneBoard(board: boolean[][]): boolean[][] {
    return board.map((row) => [...row]);
}

function createEmptyBoard(size: number): boolean[][] {
    return Array.from({ length: size }, () => Array(size).fill(false));
}

function toggleCell(board: boolean[][], row: number, col: number): void {
    const deltas: Array<[number, number]> = [
        [0, 0],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
    ];

    for (const [dr, dc] of deltas) {
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (
            nextRow < 0 ||
            nextRow >= board.length ||
            nextCol < 0 ||
            nextCol >= board.length
        ) {
            continue;
        }
        board[nextRow][nextCol] = !board[nextRow][nextCol];
    }
}

function isSolved(board: boolean[][]): boolean {
    return board.every((row) => row.every((cell) => !cell));
}

function scrambleBoard(size: number): boolean[][] {
    const board = createEmptyBoard(size);
    const taps = size * 3;

    for (let index = 0; index < taps; index++) {
        const row = Math.floor(Math.random() * size);
        const col = Math.floor(Math.random() * size);
        toggleCell(board, row, col);
    }

    if (isSolved(board)) {
        toggleCell(board, Math.floor(size / 2), Math.floor(size / 2));
    }

    return board;
}

export function createLightsOutState(board?: boolean[][]): LightsOutState {
    const initialBoard = board
        ? cloneBoard(board)
        : scrambleBoard(LIGHTS_OUT_SIZE);

    return {
        board: initialBoard,
        moves: 0,
        solved: isSolved(initialBoard),
        startTime: Date.now(),
        finishTime: null,
    };
}

export function applyLightsOutMove(
    state: LightsOutState,
    row: number,
    col: number,
): { ok: boolean; state: LightsOutState } {
    const size = state.board.length;
    if (state.solved) return { ok: false, state };
    if (row < 0 || row >= size || col < 0 || col >= size)
        return { ok: false, state };

    const board = cloneBoard(state.board);
    toggleCell(board, row, col);
    const solved = isSolved(board);

    return {
        ok: true,
        state: {
            ...state,
            board,
            moves: state.moves + 1,
            solved,
            finishTime: solved ? Date.now() - state.startTime : null,
        },
    };
}
