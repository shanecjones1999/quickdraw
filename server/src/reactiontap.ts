export const REACTION_TAP_TOTAL_PROMPTS = 6;
export const REACTION_TAP_GO_PROMPTS = 4;
export const REACTION_TAP_SIGNAL_DURATION_MS = 900;
const REACTION_TAP_INITIAL_DELAY_MS = 1200;
const REACTION_TAP_MIN_DELAY_MS = 700;
const REACTION_TAP_MAX_DELAY_MS = 1500;

export type ReactionTapSignalKind = "idle" | "go" | "decoy";
export type ReactionTapLatestOutcome =
    | "success"
    | "penalty"
    | "missed"
    | "decoy"
    | null;

export interface ReactionTapPrompt {
    index: number;
    kind: "go" | "decoy";
    label: string;
    delayMs: number;
    durationMs: number;
}

export interface ReactionTapRoomState {
    prompts: ReactionTapPrompt[];
    activePromptIndex: number | null;
    activeSignalKind: ReactionTapSignalKind;
    activeSignalStartedAt: number | null;
    activeSignalEndsAt: number | null;
    roundStartedAt: number;
    timeoutIds: ReturnType<typeof setTimeout>[];
}

export interface ReactionTapState {
    totalPrompts: number;
    goPrompts: number;
    promptsCompleted: number;
    successfulPrompts: number;
    missedPrompts: number;
    penalties: number;
    totalReactionTime: number;
    averageReactionTime: number | null;
    bestReactionTime: number | null;
    latestReactionTime: number | null;
    latestOutcome: ReactionTapLatestOutcome;
    score: number;
    done: boolean;
    finishTime: number | null;
}

function randomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shufflePrompts<T>(items: T[]): T[] {
    const next = [...items];
    for (let index = next.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return next;
}

function calculateScore(state: Pick<
    ReactionTapState,
    "successfulPrompts" | "penalties" | "averageReactionTime"
>): number {
    const pacePenalty = Math.round(
        state.averageReactionTime ?? REACTION_TAP_SIGNAL_DURATION_MS,
    );
    return state.successfulPrompts * 1000 - state.penalties * 250 - pacePenalty;
}

export function createReactionTapRoomState(): ReactionTapRoomState {
    const promptKinds = shufflePrompts([
        ...Array.from({ length: REACTION_TAP_GO_PROMPTS }, () => "go" as const),
        ...Array.from(
            { length: REACTION_TAP_TOTAL_PROMPTS - REACTION_TAP_GO_PROMPTS },
            () => "decoy" as const,
        ),
    ]);

    return {
        prompts: promptKinds.map((kind, index) => ({
            index,
            kind,
            label: kind === "go" ? "TAP!" : "WAIT",
            delayMs:
                index === 0
                    ? REACTION_TAP_INITIAL_DELAY_MS
                    : randomDelay(
                          REACTION_TAP_MIN_DELAY_MS,
                          REACTION_TAP_MAX_DELAY_MS,
                      ),
            durationMs: REACTION_TAP_SIGNAL_DURATION_MS,
        })),
        activePromptIndex: null,
        activeSignalKind: "idle",
        activeSignalStartedAt: null,
        activeSignalEndsAt: null,
        roundStartedAt: Date.now(),
        timeoutIds: [],
    };
}

export function createReactionTapState(): ReactionTapState {
    return {
        totalPrompts: REACTION_TAP_TOTAL_PROMPTS,
        goPrompts: REACTION_TAP_GO_PROMPTS,
        promptsCompleted: 0,
        successfulPrompts: 0,
        missedPrompts: 0,
        penalties: 0,
        totalReactionTime: 0,
        averageReactionTime: null,
        bestReactionTime: null,
        latestReactionTime: null,
        latestOutcome: null,
        score: calculateScore({
            successfulPrompts: 0,
            penalties: 0,
            averageReactionTime: null,
        }),
        done: false,
        finishTime: null,
    };
}

export function recordReactionTapSuccess(
    state: ReactionTapState,
    reactionTime: number,
    finishTime: number | null,
): ReactionTapState {
    const successfulPrompts = state.successfulPrompts + 1;
    const totalReactionTime = state.totalReactionTime + reactionTime;
    const averageReactionTime = Math.round(totalReactionTime / successfulPrompts);
    const bestReactionTime =
        state.bestReactionTime === null
            ? reactionTime
            : Math.min(state.bestReactionTime, reactionTime);

    const nextState: ReactionTapState = {
        ...state,
        promptsCompleted: state.promptsCompleted + 1,
        successfulPrompts,
        totalReactionTime,
        averageReactionTime,
        bestReactionTime,
        latestReactionTime: reactionTime,
        latestOutcome: "success",
        done: state.promptsCompleted + 1 >= state.totalPrompts,
        finishTime,
    };

    return {
        ...nextState,
        score: calculateScore(nextState),
    };
}

export function recordReactionTapPenalty(
    state: ReactionTapState,
): ReactionTapState {
    const nextState: ReactionTapState = {
        ...state,
        penalties: state.penalties + 1,
        latestReactionTime: null,
        latestOutcome: "penalty",
    };

    return {
        ...nextState,
        score: calculateScore(nextState),
    };
}

export function recordReactionTapMiss(
    state: ReactionTapState,
    finishTime: number | null,
): ReactionTapState {
    const nextState: ReactionTapState = {
        ...state,
        promptsCompleted: state.promptsCompleted + 1,
        missedPrompts: state.missedPrompts + 1,
        latestReactionTime: null,
        latestOutcome: "missed",
        done: state.promptsCompleted + 1 >= state.totalPrompts,
        finishTime,
    };

    return {
        ...nextState,
        score: calculateScore(nextState),
    };
}

export function recordReactionTapDecoy(
    state: ReactionTapState,
    finishTime: number | null,
): ReactionTapState {
    const nextState: ReactionTapState = {
        ...state,
        promptsCompleted: state.promptsCompleted + 1,
        latestReactionTime: null,
        latestOutcome: "decoy",
        done: state.promptsCompleted + 1 >= state.totalPrompts,
        finishTime,
    };

    return {
        ...nextState,
        score: calculateScore(nextState),
    };
}
