import type { PairMatchProgressSnapshot } from "../types";
import styles from "../styles/PairMatchPlayerCard.module.css";

interface Props {
    name: string;
    snapshot: PairMatchProgressSnapshot | null;
}

export function PairMatchPlayerCard({ name, snapshot }: Props) {
    const completion = snapshot
        ? (snapshot.pairsFound / snapshot.totalPairs) * 100
        : 0;

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <span className={styles.name}>{name}</span>
                {snapshot?.solved ? (
                    <span className={styles.solved}>✓ Cleared</span>
                ) : snapshot?.busy ? (
                    <span className={styles.busy}>Checking…</span>
                ) : null}
            </div>

            {snapshot ? (
                <>
                    <div className={styles.stats}>
                        <span>
                            Pairs {snapshot.pairsFound}/{snapshot.totalPairs}
                        </span>
                        <span>{snapshot.attempts} tries</span>
                    </div>
                    <div className={styles.progressBar}>
                        <div
                            className={styles.progressFill}
                            style={{ width: `${completion}%` }}
                        />
                    </div>
                    <div className={styles.footer}>
                        <span>{snapshot.done ? "Done" : "Playing"}</span>
                        {snapshot.rank !== null ? <span>#{snapshot.rank}</span> : null}
                    </div>
                </>
            ) : (
                <div className={styles.waiting}>Waiting…</div>
            )}
        </div>
    );
}
