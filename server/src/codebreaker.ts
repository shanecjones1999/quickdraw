export const CODEBREAKER_PALETTE = [
    "red",
    "blue",
    "green",
    "yellow",
    "purple",
    "orange",
] as const;

export const CODEBREAKER_CODE_LENGTH = 4;
export const CODEBREAKER_MAX_GUESSES = 8;

export type CodebreakerColor = (typeof CODEBREAKER_PALETTE)[number];

export interface CodebreakerGuess {
    colors: CodebreakerColor[];
    exact: number;
    partial: number;
}

export interface CodebreakerState {
    secret: CodebreakerColor[];
    guesses: CodebreakerGuess[];
    solved: boolean;
    done: boolean;
    startTime: number;
    finishTime: number | null;
}

function isValidColor(color: string): color is CodebreakerColor {
    return CODEBREAKER_PALETTE.includes(color as CodebreakerColor);
}

function randomColor(): CodebreakerColor {
    return CODEBREAKER_PALETTE[
        Math.floor(Math.random() * CODEBREAKER_PALETTE.length)
    ];
}

function createSecret(): CodebreakerColor[] {
    return Array.from({ length: CODEBREAKER_CODE_LENGTH }, () => randomColor());
}

function scoreGuess(
    secret: CodebreakerColor[],
    guess: CodebreakerColor[],
): Pick<CodebreakerGuess, "exact" | "partial"> {
    let exact = 0;
    const secretRemainders = new Map<CodebreakerColor, number>();
    const guessRemainders = new Map<CodebreakerColor, number>();

    for (let index = 0; index < secret.length; index++) {
        if (secret[index] === guess[index]) {
            exact += 1;
            continue;
        }

        secretRemainders.set(
            secret[index],
            (secretRemainders.get(secret[index]) ?? 0) + 1,
        );
        guessRemainders.set(
            guess[index],
            (guessRemainders.get(guess[index]) ?? 0) + 1,
        );
    }

    let partial = 0;
    for (const [color, count] of guessRemainders) {
        partial += Math.min(count, secretRemainders.get(color) ?? 0);
    }

    return { exact, partial };
}

export function createCodebreakerState(
    secret?: CodebreakerColor[],
): CodebreakerState {
    return {
        secret: secret ? [...secret] : createSecret(),
        guesses: [],
        solved: false,
        done: false,
        startTime: Date.now(),
        finishTime: null,
    };
}

export function processCodebreakerGuess(
    state: CodebreakerState,
    guess: string[],
): {
    ok: boolean;
    state: CodebreakerState;
    result: CodebreakerGuess | null;
} {
    if (state.done) return { ok: false, state, result: null };
    if (guess.length !== CODEBREAKER_CODE_LENGTH) {
        return { ok: false, state, result: null };
    }

    if (!guess.every(isValidColor)) {
        return { ok: false, state, result: null };
    }

    const normalizedGuess = guess as CodebreakerColor[];
    const { exact, partial } = scoreGuess(state.secret, normalizedGuess);
    const result: CodebreakerGuess = {
        colors: [...normalizedGuess],
        exact,
        partial,
    };

    const guesses = [...state.guesses, result];
    const solved = exact === CODEBREAKER_CODE_LENGTH;
    const done = solved || guesses.length >= CODEBREAKER_MAX_GUESSES;

    return {
        ok: true,
        result,
        state: {
            ...state,
            guesses,
            solved,
            done,
            finishTime: solved ? Date.now() - state.startTime : null,
        },
    };
}
