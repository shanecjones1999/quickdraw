import type { ReactionTapProgressSnapshot } from "../types";
import styles from "../styles/ReactionTapPlayerCard.module.css";

interface Props {
    name: string;
    snapshot: ReactionTapProgressSnapshot | null;
}

function formatReactionTime(value: number | null): string {
    return value === null ? "—" : `${value} ms`;
}

function describeOutcome(snapshot: ReactionTapProgressSnapshot): string {
    if (snapshot.latestOutcome === "success") {
        return snapshot.latestReactionTime === null
            ? "Hit"
            : `Hit · ${snapshot.latestReactionTime} ms`;
    }
    if (snapshot.latestOutcome === "penalty") return "False tap";
    if (snapshot.latestOutcome === "missed") return "Missed";
    if (snapshot.latestOutcome === "decoy") return "Clean wait";
    return "Stand by";
}

export function ReactionTapPlayerCard({ name, snapshot }: Props) {
    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <span className={styles.name}>{name}</span>
                {snapshot?.done ? (
                    <span className={styles.done}>✓ Done</span>
                ) : null}
            </div>

            {snapshot ? (
                <>
                    <div className={styles.progressRow}>
                        <span>
                            Prompts {snapshot.promptsCompleted}/{snapshot.totalPrompts}
                        </span>
                        <span>Score {snapshot.score}</span>
                    </div>
                    <div className={styles.progressRow}>
                        <span>
                            Hits {snapshot.successfulPrompts}/{snapshot.goPrompts}
                        </span>
                        <span>Pen {snapshot.penalties}</span>
                    </div>
                    <div className={styles.progressRow}>
                        <span>Best {formatReactionTime(snapshot.bestReactionTime)}</span>
                        <span>Avg {formatReactionTime(snapshot.averageReactionTime)}</span>
                    </div>
                    <div className={styles.outcome}>{describeOutcome(snapshot)}</div>
                </>
            ) : (
                <div className={styles.waiting}>Waiting…</div>
            )}
        </div>
    );
}
