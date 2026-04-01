import type { CodebreakerProgressSnapshot } from "../types";
import styles from "../styles/CodebreakerPlayerCard.module.css";

const COLOR_CLASS: Record<string, string> = {
    red: styles.red,
    blue: styles.blue,
    green: styles.green,
    yellow: styles.yellow,
    purple: styles.purple,
    orange: styles.orange,
};

interface Props {
    name: string;
    snapshot: CodebreakerProgressSnapshot | null;
}

export function CodebreakerPlayerCard({ name, snapshot }: Props) {
    const lastGuess = snapshot?.lastGuess ?? null;

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <span className={styles.name}>{name}</span>
                {snapshot?.solved ? (
                    <span className={styles.solved}>✓ Cracked</span>
                ) : snapshot?.done ? (
                    <span className={styles.failed}>Out</span>
                ) : null}
            </div>

            {snapshot ? (
                <>
                    <div className={styles.guessRow}>
                        {lastGuess
                            ? lastGuess.colors.map((color, index) => (
                                  <span
                                      key={`${color}-${index}`}
                                      className={`${styles.colorDot} ${COLOR_CLASS[color] ?? ""}`.trim()}
                                  />
                              ))
                            : Array.from({ length: 4 }, (_, index) => (
                                  <span
                                      key={index}
                                      className={`${styles.colorDot} ${styles.empty}`}
                                  />
                              ))}
                    </div>

                    <div className={styles.feedback}>
                        <span>Exact: {lastGuess?.exact ?? 0}</span>
                        <span>Close: {lastGuess?.partial ?? 0}</span>
                    </div>

                    <div className={styles.stats}>
                        <span>{snapshot.attempts} guesses</span>
                        {snapshot.finishTime !== null ? (
                            <span>
                                {(snapshot.finishTime / 1000).toFixed(1)}s
                            </span>
                        ) : null}
                    </div>
                </>
            ) : (
                <div className={styles.waiting}>Waiting…</div>
            )}
        </div>
    );
}
