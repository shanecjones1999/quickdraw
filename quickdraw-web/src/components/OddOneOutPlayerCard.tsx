import { useEffect, useState } from "react";
import { formatTime } from "../hooks/useTimer";
import type { OddOneOutProgressSnapshot } from "../types";
import styles from "../styles/OddOneOutPlayerCard.module.css";

interface Props {
    name: string;
    snapshot: OddOneOutProgressSnapshot | null;
}

export function OddOneOutPlayerCard({ name, snapshot }: Props) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const deadline = snapshot?.lockedOutUntil ?? null;
        if (deadline === null || deadline <= Date.now()) return;

        const intervalId = setInterval(() => {
            const nextNow = Date.now();
            setNow(nextNow);
            if (nextNow >= deadline) {
                clearInterval(intervalId);
            }
        }, 100);

        return () => {
            clearInterval(intervalId);
        };
    }, [snapshot?.lockedOutUntil]);

    const lockoutRemainingMs =
        snapshot?.lockedOutUntil === null || snapshot?.lockedOutUntil === undefined
            ? 0
            : Math.max(0, snapshot.lockedOutUntil - now);
    const isLocked = lockoutRemainingMs > 0;

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <span
                    className={`${styles.name} ${snapshot?.done ? styles.done : ""}`.trim()}
                >
                    {snapshot?.done ? "✓ " : ""}
                    {name}
                </span>
                {isLocked ? (
                    <span className={styles.locked}>
                        Locked {(lockoutRemainingMs / 1000).toFixed(1)}s
                    </span>
                ) : snapshot ? (
                    <span className={styles.status}>
                        {snapshot.penaltyCount}{" "}
                        {snapshot.penaltyCount === 1
                            ? "penalty"
                            : "penalties"}
                    </span>
                ) : null}
            </div>

            {snapshot ? (
                <>
                    <div className={styles.score}>{snapshot.score} pts</div>
                    <div className={styles.progress}>
                        {snapshot.promptsCleared}/{snapshot.totalPrompts} cleared
                    </div>
                    <div className={styles.meta}>
                        <span>{formatTime(snapshot.totalResponseTime)}</span>
                        <span>{snapshot.penaltyCount} mistakes</span>
                    </div>
                </>
            ) : (
                <div className={styles.waiting}>Waiting…</div>
            )}
        </div>
    );
}
