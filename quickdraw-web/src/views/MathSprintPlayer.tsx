import { useCallback, useMemo, useState } from "react";
import { socket } from "../socket";
import { useSocket } from "../hooks/useSocket";
import { formatTime, useTimer } from "../hooks/useTimer";
import type { MathSprintQuestion } from "../types";
import sharedStyles from "../styles/Player.module.css";
import styles from "../styles/MathSprintPlayer.module.css";

interface Props {
    roomCode: string;
    playerName: string;
    durationMs: number;
    endAt: number | null;
    question: MathSprintQuestion;
    score: number;
    answeredCount: number;
    streak: number;
    bestStreak: number;
    lastAnswerCorrect: boolean | null;
}

export function MathSprintPlayer({
    roomCode,
    playerName,
    durationMs,
    endAt,
    question: initialQuestion,
    score: initialScore,
    answeredCount: initialAnsweredCount,
    streak: initialStreak,
    bestStreak: initialBestStreak,
    lastAnswerCorrect: initialLastAnswerCorrect,
}: Props) {
    const [question, setQuestion] = useState(initialQuestion);
    const [score, setScore] = useState(initialScore);
    const [answeredCount, setAnsweredCount] = useState(initialAnsweredCount);
    const [streak, setStreak] = useState(initialStreak);
    const [bestStreak, setBestStreak] = useState(initialBestStreak);
    const [lastAnswerCorrect, setLastAnswerCorrect] = useState(
        initialLastAnswerCorrect,
    );
    const [pendingQuestionId, setPendingQuestionId] = useState<number | null>(null);
    const elapsed = useTimer(endAt !== null ? endAt - durationMs : null);
    const remainingMs = useMemo(
        () => Math.max(durationMs - elapsed, 0),
        [durationMs, elapsed],
    );

    const onUpdate = useCallback(
        (payload: {
            question: MathSprintQuestion;
            score: number;
            answeredCount: number;
            streak: number;
            bestStreak: number;
            lastAnswerCorrect: boolean | null;
        }) => {
            setQuestion(payload.question);
            setScore(payload.score);
            setAnsweredCount(payload.answeredCount);
            setStreak(payload.streak);
            setBestStreak(payload.bestStreak);
            setLastAnswerCorrect(payload.lastAnswerCorrect);
            setPendingQuestionId(null);
        },
        [],
    );

    useSocket("mathsprint:update", onUpdate as never);

    function submitAnswer(answerIndex: number) {
        if (remainingMs <= 0 || pendingQuestionId === question.id) return;

        setPendingQuestionId(question.id);
        socket.emit("mathsprint:answer", {
            questionId: question.id,
            answerIndex,
        });
    }

    return (
        <div className={sharedStyles.page}>
            <header className={sharedStyles.header}>
                <div className={sharedStyles.logo}>⚡ Quick Draw</div>
                <div className={sharedStyles.meta}>
                    {playerName} · {roomCode}
                </div>
            </header>

            <div className={sharedStyles.content}>
                <div className={styles.topBar}>
                    <div className={styles.metric}>
                        <span className={styles.metricLabel}>Score</span>
                        <span className={styles.metricValue}>{score}</span>
                    </div>
                    <div className={styles.timer}>{formatTime(remainingMs)}</div>
                    <div className={styles.metric}>
                        <span className={styles.metricLabel}>Streak</span>
                        <span className={styles.metricValue}>{streak}</span>
                    </div>
                </div>

                <div className={styles.questionCard}>
                    <div className={styles.questionLabel}>Solve fast</div>
                    <div className={styles.questionPrompt}>{question.prompt}</div>
                </div>

                <div className={styles.answers}>
                    {question.answers.map((answer, index) => (
                        <button
                            key={`${question.id}-${answer}-${index}`}
                            type="button"
                            className={styles.answerButton}
                            onClick={() => submitAnswer(index)}
                            disabled={
                                remainingMs <= 0 || pendingQuestionId === question.id
                            }
                        >
                            {answer}
                        </button>
                    ))}
                </div>

                <div className={styles.footerStats}>
                    <span>
                        Answered{" "}
                        <span className={sharedStyles.statVal}>{answeredCount}</span>
                    </span>
                    <span>
                        Best streak{" "}
                        <span className={sharedStyles.statVal}>{bestStreak}</span>
                    </span>
                </div>

                <div
                    className={`${styles.feedback} ${
                        lastAnswerCorrect === true
                            ? styles.feedbackGood
                            : lastAnswerCorrect === false
                              ? styles.feedbackBad
                              : styles.feedbackNeutral
                    }`.trim()}
                >
                    {remainingMs <= 0
                        ? "Time! Waiting for round results…"
                        : lastAnswerCorrect === true
                          ? "Nice — keep the streak going."
                          : lastAnswerCorrect === false
                            ? "Missed it — next one!"
                            : "Tap the right answer from the four choices."}
                </div>
            </div>
        </div>
    );
}
