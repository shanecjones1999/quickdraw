import type { MemorySequencePlusProgressSnapshot } from "../types";
import styles from "../styles/MemorySequencePlusPlayerCard.module.css";

interface Props {
    name: string;
    snapshot: MemorySequencePlusProgressSnapshot | null;
}

export function MemorySequencePlusPlayerCard({ name, snapshot }: Props) {
    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <span className={styles.name}>{name}</span>
                {snapshot?.solved ? (
                    <span className={styles.done}>✓ Cleared</span>
                ) : snapshot?.failed ? (
                    <span className={styles.failed}>✕ Out</span>
                ) : null}
            </div>

            {snapshot ? (
                <>
                    <div className={styles.latestWrap}>
                        <span className={styles.latestLabel}>Latest</span>
                        <span className={styles.latestCell}>
                            {snapshot.latestCell !== null
                                ? snapshot.latestCell + 1
                                : "—"}
                        </span>
                    </div>
                    <div className={styles.stats}>
                        <span>Round {snapshot.currentRound}</span>
                        <span>{snapshot.done ? "Done" : "Playing"}</span>
                    </div>
                </>
            ) : (
                <div className={styles.waiting}>Waiting…</div>
            )}
        </div>
    );
}
