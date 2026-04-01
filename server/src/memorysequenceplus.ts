export const MEMORY_SEQUENCE_PLUS_GRID_SIZE = 3;

export const MEMORY_SEQUENCE_PLUS_MAX_ROUNDS = 8;

export type MemorySequencePlusCell = number;

export interface MemorySequencePlusState {
    sequence: MemorySequencePlusCell[];
    currentRound: number;
    solved: boolean;
    done: boolean;
    failed: boolean;
    startTime: number;
    finishTime: number | null;
}

function randomCell(): MemorySequencePlusCell {
    return Math.floor(
        Math.random() *
            MEMORY_SEQUENCE_PLUS_GRID_SIZE *
            MEMORY_SEQUENCE_PLUS_GRID_SIZE,
    );
}

function isValidCell(cell: number): boolean {
    return (
        Number.isInteger(cell) &&
        cell >= 0 &&
        cell < MEMORY_SEQUENCE_PLUS_GRID_SIZE * MEMORY_SEQUENCE_PLUS_GRID_SIZE
    );
}

function createSequence(length: number): MemorySequencePlusCell[] {
    return Array.from({ length }, () => randomCell());
}

export function createMemorySequencePlusState(
    sequence?: MemorySequencePlusCell[],
): MemorySequencePlusState {
    return {
        sequence: sequence
            ? [...sequence]
            : createSequence(MEMORY_SEQUENCE_PLUS_MAX_ROUNDS),
        currentRound: 1,
        solved: false,
        done: false,
        failed: false,
        startTime: Date.now(),
        finishTime: null,
    };
}

export function submitMemorySequencePlusRound(
    state: MemorySequencePlusState,
    inputs: number[],
): { ok: boolean; state: MemorySequencePlusState } {
    if (state.done) return { ok: false, state };
    if (inputs.length !== state.currentRound) return { ok: false, state };
    if (!inputs.every(isValidCell)) return { ok: false, state };

    const correct = state.sequence
        .slice(0, state.currentRound)
        .every((cell, index) => cell === inputs[index]);

    if (!correct) {
        return {
            ok: true,
            state: {
                ...state,
                done: true,
                failed: true,
            },
        };
    }

    const solved = state.currentRound >= state.sequence.length;

    return {
        ok: true,
        state: {
            ...state,
            currentRound: solved ? state.currentRound : state.currentRound + 1,
            solved,
            done: solved,
            failed: false,
            finishTime: solved ? Date.now() - state.startTime : null,
        },
    };
}
