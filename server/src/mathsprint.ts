export const MATH_SPRINT_ROUND_DURATION_MS = 30000;

export interface MathSprintQuestion {
    id: number;
    prompt: string;
    answers: number[];
}

interface MathSprintQuestionInternal extends MathSprintQuestion {
    correctIndex: number;
}

export interface MathSprintState {
    score: number;
    answeredCount: number;
    streak: number;
    bestStreak: number;
    lastAnswerCorrect: boolean | null;
    lastCorrectAt: number | null;
    currentQuestion: MathSprintQuestionInternal;
    done: boolean;
    startTime: number;
    finishTime: number | null;
}

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(items: T[]): T[] {
    const next = [...items];

    for (let index = next.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }

    return next;
}

function createQuestionPrompt(
    answeredCount: number,
): { prompt: string; answer: number } {
    if (answeredCount >= 6 && Math.random() < 0.25) {
        const left = randomInt(2, 9);
        const right = randomInt(2, 9);
        return {
            prompt: `${left} × ${right}`,
            answer: left * right,
        };
    }

    if (Math.random() < 0.55) {
        const max = answeredCount >= 8 ? 30 : 20;
        const left = randomInt(4, max);
        const right = randomInt(3, max);
        return {
            prompt: `${left} + ${right}`,
            answer: left + right,
        };
    }

    const max = answeredCount >= 8 ? 35 : 20;
    const left = randomInt(6, max);
    const right = randomInt(1, Math.min(left - 1, 16));
    return {
        prompt: `${left} - ${right}`,
        answer: left - right,
    };
}

function createQuestion(questionId: number, answeredCount: number) {
    const { prompt, answer } = createQuestionPrompt(answeredCount);
    const answers = new Set<number>([answer]);

    const deltas = shuffle([-10, -6, -4, -3, -2, -1, 1, 2, 3, 4, 6, 10]);
    for (const delta of deltas) {
        if (answers.size >= 4) break;
        const candidate = answer + delta;
        if (candidate >= 0) {
            answers.add(candidate);
        }
    }

    while (answers.size < 4) {
        answers.add(Math.max(0, answer + randomInt(-12, 12)));
    }

    const shuffledAnswers = shuffle([...answers].slice(0, 4));

    return {
        id: questionId,
        prompt,
        answers: shuffledAnswers,
        correctIndex: shuffledAnswers.indexOf(answer),
    } satisfies MathSprintQuestionInternal;
}

function toPublicQuestion(question: MathSprintQuestionInternal): MathSprintQuestion {
    return {
        id: question.id,
        prompt: question.prompt,
        answers: [...question.answers],
    };
}

export function createMathSprintState(startTime = Date.now()): MathSprintState {
    return {
        score: 0,
        answeredCount: 0,
        streak: 0,
        bestStreak: 0,
        lastAnswerCorrect: null,
        lastCorrectAt: null,
        currentQuestion: createQuestion(1, 0),
        done: false,
        startTime,
        finishTime: null,
    };
}

export function finishMathSprintState(state: MathSprintState): MathSprintState {
    if (state.done) {
        return state;
    }

    return {
        ...state,
        done: true,
        finishTime: Date.now() - state.startTime,
    };
}

export function serializeMathSprintQuestion(
    state: MathSprintState,
): MathSprintQuestion {
    return toPublicQuestion(state.currentQuestion);
}

export function submitMathSprintAnswer(
    state: MathSprintState,
    questionId: number,
    answerIndex: number,
): { ok: boolean; state: MathSprintState; correct: boolean } {
    if (state.done) {
        return { ok: false, state, correct: false };
    }

    if (
        questionId !== state.currentQuestion.id ||
        answerIndex < 0 ||
        answerIndex >= state.currentQuestion.answers.length
    ) {
        return { ok: false, state, correct: false };
    }

    const correct = answerIndex === state.currentQuestion.correctIndex;
    const answeredCount = state.answeredCount + 1;
    const score = correct ? state.score + 1 : state.score;
    const streak = correct ? state.streak + 1 : 0;
    const bestStreak = Math.max(state.bestStreak, streak);

    return {
        ok: true,
        correct,
        state: {
            ...state,
            score,
            answeredCount,
            streak,
            bestStreak,
            lastAnswerCorrect: correct,
            lastCorrectAt: correct ? Date.now() - state.startTime : state.lastCorrectAt,
            currentQuestion: createQuestion(
                state.currentQuestion.id + 1,
                answeredCount,
            ),
        },
    };
}
