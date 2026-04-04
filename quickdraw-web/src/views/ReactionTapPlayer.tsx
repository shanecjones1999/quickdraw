import { useCallback, useState } from "react";
import { socket } from "../socket";
import { useSocket } from "../hooks/useSocket";
import type {
    ReactionTapLatestOutcome,
    ReactionTapProgressSnapshot,
} from "../types";
import sharedStyles from "../styles/Player.module.css";
import styles from "../styles/ReactionTapPlayer.module.css";

type SignalKind = "idle" | "go" | "decoy";

interface SignalState {
    kind: SignalKind;
    label: string;
}

interface Props {
    roomCode: string;
    playerName: string;
    totalPrompts: number;
    goPrompts: number;
}

const INITIAL_SIGNAL: SignalState = {
    kind: "idle",
    label: "Stand by",
};

function formatReactionTime(value: number | null): string {
    return value === null ? "—" : `${value} ms`;
}

function describeOutcome(
    outcome: ReactionTapLatestOutcome,
    reactionTime: number | null,
): string {
    if (outcome === "success") {
        return reactionTime === null ? "Hit" : `Hit in ${reactionTime} ms`;
    }
    if (outcome === "penalty") return "False tap penalty";
    if (outcome === "missed") return "Missed the signal";
    if (outcome === "decoy") return "Stayed disciplined";
    return "Waiting for the next cue";
}

export function ReactionTapPlayer({
    roomCode,
    playerName,
    totalPrompts,
    goPrompts,
}: Props) {
    const [snapshot, setSnapshot] = useState<ReactionTapProgressSnapshot>({
        playerId: socket.id ?? "",
        promptsCompleted: 0,
        totalPrompts,
        goPrompts,
        successfulPrompts: 0,
        missedPrompts: 0,
        penalties: 0,
        score: 0,
        averageReactionTime: null,
        bestReactionTime: null,
        latestReactionTime: null,
        latestOutcome: null,
        done: false,
    });
    const [signal, setSignal] = useState<SignalState>(INITIAL_SIGNAL);

    const onUpdate = useCallback((nextSnapshot: ReactionTapProgressSnapshot) => {
        setSnapshot(nextSnapshot);
    }, []);

    const onSignal = useCallback(
        ({ kind, label }: { kind: SignalKind; label: string }) => {
            setSignal({ kind, label });
        },
        [],
    );

    useSocket("reactiontap:update", onUpdate as never);
    useSocket("reactiontap:signal", onSignal as never);

    const promptProgress = Math.min(snapshot.promptsCompleted + 1, totalPrompts);
    const outcomeText = describeOutcome(
        snapshot.latestOutcome,
        snapshot.latestReactionTime,
    );

    return (
        <div className={sharedStyles.page}>
            <header className={sharedStyles.header}>
                <div className={sharedStyles.logo}>⚡ Quick Draw</div>
                <div className={sharedStyles.meta}>
                    {playerName} · {roomCode}
                </div>
            </header>

            <div className={sharedStyles.content}>
                <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <span className={styles.statLabel}>Prompt</span>
                        <span className={styles.statValue}>
                            {snapshot.promptsCompleted >= totalPrompts
                                ? `${totalPrompts}/${totalPrompts}`
                                : `${promptProgress}/${totalPrompts}`}
                        </span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statLabel}>Hits</span>
                        <span className={styles.statValue}>
                            {snapshot.successfulPrompts}/{goPrompts}
                        </span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statLabel}>Penalties</span>
                        <span className={styles.statValue}>{snapshot.penalties}</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statLabel}>Score</span>
                        <span className={styles.statValue}>{snapshot.score}</span>
                    </div>
                </div>

                <div
                    className={`${styles.signalPanel} ${signal.kind === "go" ? styles.signalGo : signal.kind === "decoy" ? styles.signalDecoy : styles.signalIdle}`}
                >
                    <div className={styles.signalEyebrow}>Current signal</div>
                    <div className={styles.signalLabel}>{signal.label}</div>
                    <div className={styles.signalHint}>
                        {signal.kind === "go"
                            ? "Tap now. First clean hit counts."
                            : signal.kind === "decoy"
                              ? "Hands off. Any tap here costs points."
                              : "Get ready for the next cue."}
                    </div>
                </div>

                <button
                    type="button"
                    className={`${styles.tapButton} ${signal.kind === "go" ? styles.tapButtonGo : signal.kind === "decoy" ? styles.tapButtonDecoy : styles.tapButtonIdle}`}
                    onClick={() => socket.emit("reactiontap:tap")}
                    aria-label="Reaction tap button"
                >
                    {signal.kind === "go"
                        ? "TAP!"
                        : signal.kind === "decoy"
                          ? "WAIT"
                          : "READY"}
                </button>

                <div className={styles.paceRow}>
                    <div className={styles.paceCard}>
                        <span className={styles.statLabel}>Best</span>
                        <span className={styles.paceValue}>
                            {formatReactionTime(snapshot.bestReactionTime)}
                        </span>
                    </div>
                    <div className={styles.paceCard}>
                        <span className={styles.statLabel}>Average</span>
                        <span className={styles.paceValue}>
                            {formatReactionTime(snapshot.averageReactionTime)}
                        </span>
                    </div>
                </div>

                <div className={styles.feedbackCard}>{outcomeText}</div>

                {snapshot.done ? (
                    <div className={sharedStyles.solvedOverlay}>
                        <div className={sharedStyles.solvedTitle}>Round Locked</div>
                        <div className={sharedStyles.solvedStats}>
                            {snapshot.successfulPrompts}/{goPrompts} hits · {snapshot.penalties} penalties
                        </div>
                        <div className={sharedStyles.solvedWait}>
                            Waiting for everyone else to finish…
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
