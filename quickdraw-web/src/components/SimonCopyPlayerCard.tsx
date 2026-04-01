import type { SimonCopyProgressSnapshot } from "../types";
import styles from "../styles/SimonCopyPlayerCard.module.css";

const COLOR_CLASS: Record<string, string> = {
    red: styles.red,
    blue: styles.blue,
    green: styles.green,
    yellow: styles.yellow,
};

interface Props {
    name: string;
    snapshot: SimonCopyProgressSnapshot | null;
}

export function SimonCopyPlayerCard({ name, snapshot }: Props) {
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
                        <span
                            className={`${styles.colorDot} ${snapshot.latestColor ? (COLOR_CLASS[snapshot.latestColor] ?? "") : styles.empty}`.trim()}
                        />
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
