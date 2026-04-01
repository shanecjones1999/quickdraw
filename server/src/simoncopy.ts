export const SIMON_COPY_COLORS = ["red", "blue", "green", "yellow"] as const;

export const SIMON_COPY_MAX_ROUNDS = 6;

export type SimonCopyColor = (typeof SIMON_COPY_COLORS)[number];

export interface SimonCopyState {
    sequence: SimonCopyColor[];
    currentRound: number;
    solved: boolean;
    done: boolean;
    failed: boolean;
    startTime: number;
    finishTime: number | null;
}

function randomColor(): SimonCopyColor {
    return SIMON_COPY_COLORS[
        Math.floor(Math.random() * SIMON_COPY_COLORS.length)
    ];
}

function isValidColor(color: string): color is SimonCopyColor {
    return SIMON_COPY_COLORS.includes(color as SimonCopyColor);
}

function createSequence(length: number): SimonCopyColor[] {
    return Array.from({ length }, () => randomColor());
}

export function createSimonCopyState(
    sequence?: SimonCopyColor[],
): SimonCopyState {
    return {
        sequence: sequence
            ? [...sequence]
            : createSequence(SIMON_COPY_MAX_ROUNDS),
        currentRound: 1,
        solved: false,
        done: false,
        failed: false,
        startTime: Date.now(),
        finishTime: null,
    };
}

export function submitSimonCopyRound(
    state: SimonCopyState,
    inputs: string[],
): { ok: boolean; state: SimonCopyState } {
    if (state.done) return { ok: false, state };
    if (inputs.length !== state.currentRound) return { ok: false, state };
    if (!inputs.every(isValidColor)) return { ok: false, state };

    const correct = state.sequence
        .slice(0, state.currentRound)
        .every((color, index) => color === inputs[index]);

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
