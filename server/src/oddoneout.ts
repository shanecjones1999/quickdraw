export const ODD_ONE_OUT_GRID_ROWS = 4;
export const ODD_ONE_OUT_GRID_COLS = 4;
export const ODD_ONE_OUT_TOTAL_PROMPTS = 6;
export const ODD_ONE_OUT_LOCKOUT_MS = 900;
export const ODD_ONE_OUT_WRONG_TAP_PENALTY_MS = 800;

const ODD_ONE_OUT_MAX_PROMPT_SCORE = 120;
const ODD_ONE_OUT_MIN_PROMPT_SCORE = 40;
const ODD_ONE_OUT_WRONG_TAP_SCORE_PENALTY = 15;

const SHAPES = ["circle", "square", "triangle", "diamond", "star"] as const;
const COLORS = [
    "#ff5d73",
    "#4dd5ff",
    "#7bff8c",
    "#ffd166",
    "#c58cff",
    "#ff9f43",
] as const;

export type OddOneOutShape = (typeof SHAPES)[number];

export interface OddOneOutCell {
    shape: OddOneOutShape;
    color: string;
}

export interface OddOneOutPrompt {
    rows: number;
    cols: number;
    items: OddOneOutCell[];
}

interface OddOneOutPromptInternal extends OddOneOutPrompt {
    oddIndex: number;
}

export interface OddOneOutState {
    prompts: OddOneOutPromptInternal[];
    currentPromptIndex: number;
    promptsCleared: number;
    score: number;
    totalResponseTime: number;
    penaltyCount: number;
    done: boolean;
    startTime: number;
    promptStartedAt: number;
    finishTime: number | null;
    lockedOutUntil: number | null;
}

function randomFrom<T>(items: readonly T[]): T {
    return items[Math.floor(Math.random() * items.length)] ?? items[0];
}

function pickDifferent<T>(items: readonly T[], current: T): T {
    const options = items.filter((item) => item !== current);
    return randomFrom(options);
}

function calculatePromptScore(responseTime: number): number {
    return Math.max(
        ODD_ONE_OUT_MIN_PROMPT_SCORE,
        ODD_ONE_OUT_MAX_PROMPT_SCORE - Math.floor(responseTime / 250) * 5,
    );
}

function createPrompt(): OddOneOutPromptInternal {
    const cellCount = ODD_ONE_OUT_GRID_ROWS * ODD_ONE_OUT_GRID_COLS;
    const oddIndex = Math.floor(Math.random() * cellCount);
    const baseShape = randomFrom(SHAPES);
    const baseColor = randomFrom(COLORS);
    const changeShape = Math.random() < 0.5;
    const oddShape = changeShape ? pickDifferent(SHAPES, baseShape) : baseShape;
    const oddColor = changeShape ? baseColor : pickDifferent(COLORS, baseColor);

    return {
        rows: ODD_ONE_OUT_GRID_ROWS,
        cols: ODD_ONE_OUT_GRID_COLS,
        oddIndex,
        items: Array.from({ length: cellCount }, (_, index) => ({
            shape: index === oddIndex ? oddShape : baseShape,
            color: index === oddIndex ? oddColor : baseColor,
        })),
    };
}

function clonePrompt(prompt: OddOneOutPromptInternal): OddOneOutPromptInternal {
    return {
        rows: prompt.rows,
        cols: prompt.cols,
        oddIndex: prompt.oddIndex,
        items: prompt.items.map((item) => ({ ...item })),
    };
}

export function createOddOneOutPromptSet(
    count = ODD_ONE_OUT_TOTAL_PROMPTS,
): OddOneOutPrompt[] {
    return Array.from({ length: count }, () => {
        const prompt = createPrompt();
        return toPublicOddOneOutPrompt(prompt);
    });
}

export function toPublicOddOneOutPrompt(
    prompt: OddOneOutPromptInternal | OddOneOutPrompt,
): OddOneOutPrompt {
    return {
        rows: prompt.rows,
        cols: prompt.cols,
        items: prompt.items.map((item) => ({ ...item })),
    };
}

export function createOddOneOutState(prompts?: OddOneOutPrompt[]): OddOneOutState {
    const promptSet =
        prompts && prompts.length > 0
            ? prompts.map((prompt) => {
                  const oddIndex = prompt.items.findIndex(
                      (item, _, items) =>
                          items.filter(
                              (candidate) =>
                                  candidate.shape === item.shape &&
                                  candidate.color === item.color,
                          ).length === 1,
                  );

                  return {
                      rows: prompt.rows,
                      cols: prompt.cols,
                      items: prompt.items.map((item) => ({ ...item })),
                      oddIndex: oddIndex >= 0 ? oddIndex : 0,
                  };
              })
            : Array.from({ length: ODD_ONE_OUT_TOTAL_PROMPTS }, () =>
                  createPrompt(),
              );

    const now = Date.now();

    return {
        prompts: promptSet.map(clonePrompt),
        currentPromptIndex: 0,
        promptsCleared: 0,
        score: 0,
        totalResponseTime: 0,
        penaltyCount: 0,
        done: false,
        startTime: now,
        promptStartedAt: now,
        finishTime: null,
        lockedOutUntil: null,
    };
}

export function getCurrentOddOneOutPrompt(
    state: OddOneOutState,
): OddOneOutPrompt | null {
    const prompt = state.prompts[state.currentPromptIndex];
    return prompt ? toPublicOddOneOutPrompt(prompt) : null;
}

export function processOddOneOutSelection(
    state: OddOneOutState,
    index: number,
): { ok: boolean; state: OddOneOutState; correct: boolean } {
    if (state.done) return { ok: false, state, correct: false };
    if (
        state.lockedOutUntil !== null &&
        Date.now() < state.lockedOutUntil
    ) {
        return { ok: false, state, correct: false };
    }

    const prompt = state.prompts[state.currentPromptIndex];
    if (!prompt || index < 0 || index >= prompt.items.length) {
        return { ok: false, state, correct: false };
    }

    const now = Date.now();

    if (index !== prompt.oddIndex) {
        return {
            ok: true,
            correct: false,
            state: {
                ...state,
                score: Math.max(
                    0,
                    state.score - ODD_ONE_OUT_WRONG_TAP_SCORE_PENALTY,
                ),
                totalResponseTime:
                    state.totalResponseTime + ODD_ONE_OUT_WRONG_TAP_PENALTY_MS,
                penaltyCount: state.penaltyCount + 1,
                lockedOutUntil: now + ODD_ONE_OUT_LOCKOUT_MS,
            },
        };
    }

    const responseTime = now - state.promptStartedAt;
    const promptsCleared = state.promptsCleared + 1;
    const done = promptsCleared >= state.prompts.length;

    return {
        ok: true,
        correct: true,
        state: {
            ...state,
            currentPromptIndex: promptsCleared,
            promptsCleared,
            score: state.score + calculatePromptScore(responseTime),
            totalResponseTime: state.totalResponseTime + responseTime,
            done,
            promptStartedAt: now,
            finishTime: done ? now - state.startTime : null,
            lockedOutUntil: null,
        },
    };
}
