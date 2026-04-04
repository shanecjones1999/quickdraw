import type { MathSprintProgressSnapshot } from "../types";
import styles from "../styles/MathSprintPlayerCard.module.css";

interface Props {
    name: string;
    snapshot: MathSprintProgressSnapshot | null;
}

export function MathSprintPlayerCard({ name, snapshot }: Props) {
    const questionPrompt =
        snapshot?.currentQuestion?.prompt ?? "Waiting for next question…";

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <span className={styles.name}>{name}</span>
                {snapshot?.lastAnswerCorrect === true ? (
                    <span className={styles.good}>✓</span>
                ) : snapshot?.lastAnswerCorrect === false ? (
                    <span className={styles.bad}>✕</span>
                ) : null}
            </div>

            {snapshot ? (
                <>
                    <div className={styles.scoreRow}>
                        <span className={styles.score}>{snapshot.score}</span>
                        <span className={styles.scoreLabel}>pts</span>
                    </div>
                    <div className={styles.question}>{questionPrompt}</div>
                    <div className={styles.stats}>
                        <span>{snapshot.answeredCount} answered</span>
                        <span>Streak {snapshot.streak}</span>
                        <span>Best {snapshot.bestStreak}</span>
                    </div>
                </>
            ) : (
                <div className={styles.waiting}>Waiting…</div>
            )}
        </div>
    );
}
