import { useEffect, useMemo, useState } from "react";
import { socket } from "../socket";
import { useSocket } from "../hooks/useSocket";
import type { SimonCopyColor, SimonCopyResult } from "../types";
import sharedStyles from "../styles/Player.module.css";
import styles from "../styles/SimonCopyPlayer.module.css";

const MEDALS = ["🥇", "🥈", "🥉"];

const COLOR_CLASS: Record<SimonCopyColor, string> = {
    red: styles.red,
    blue: styles.blue,
    green: styles.green,
    yellow: styles.yellow,
};

type Phase = "watching" | "input" | "solved" | "failed" | "results";

interface Props {
    roomCode: string;
    playerName: string;
    sequence: SimonCopyColor[];
    colors: SimonCopyColor[];
    maxRounds: number;
}

export function SimonCopyPlayer({
    roomCode,
    playerName,
    sequence,
    colors,
    maxRounds,
}: Props) {
    const [phase, setPhase] = useState<Phase>("watching");
    const [round, setRound] = useState(1);
    const [input, setInput] = useState<SimonCopyColor[]>([]);
    const [flashColor, setFlashColor] = useState<SimonCopyColor | null>(null);
    const [rank, setRank] = useState<number | null>(null);
    const [results, setResults] = useState<SimonCopyResult[]>([]);

    const activeSequence = useMemo(
        () => sequence.slice(0, round),
        [sequence, round],
    );

    useEffect(() => {
        if (phase !== "watching") return;

        const timers: number[] = [];
        activeSequence.forEach((color, index) => {
            timers.push(
                window.setTimeout(
                    () => setFlashColor(color),
                    index * 700 + 250,
                ),
            );
            timers.push(
                window.setTimeout(() => setFlashColor(null), index * 700 + 650),
            );
        });
        timers.push(
            window.setTimeout(
                () => setPhase("input"),
                activeSequence.length * 700 + 250,
            ),
        );

        return () => {
            timers.forEach((timer) => window.clearTimeout(timer));
        };
    }, [activeSequence, phase]);

    useEffect(() => {
        if (phase !== "input") return;
        if (input.length !== round) return;
        socket.emit("simoncopy:submit", { inputs: input });
    }, [input, phase, round]);

    useSocket("simoncopy:update", ((payload: {
        currentRound: number;
        solved: boolean;
        done: boolean;
        failed: boolean;
    }) => {
        if (payload.failed) {
            setPhase("failed");
            return;
        }
        if (payload.solved) {
            setPhase("solved");
            return;
        }
        setRound(payload.currentRound);
        setInput([]);
        setPhase("watching");
    }) as never);

    useSocket("simoncopy:solved", ((payload: { rank: number }) => {
        setRank(payload.rank);
        setPhase("solved");
    }) as never);

    useSocket("game:over", ((payload: { results: SimonCopyResult[] }) => {
        setResults(payload.results);
        setPhase("results");
    }) as never);

    function pressColor(color: SimonCopyColor) {
        if (phase !== "input") return;
        setInput((previous) => [...previous, color]);
    }

    if (phase === "results") {
        return (
            <div className={sharedStyles.page}>
                <header className={sharedStyles.header}>
                    <div className={sharedStyles.logo}>⚡ Quick Draw</div>
                    <div className={sharedStyles.meta}>
                        {playerName} · {roomCode}
                    </div>
                </header>
                <div className={sharedStyles.content}>
                    <div className={sharedStyles.centered}>
                        <div className={sharedStyles.waitTitle}>
                            🏆 Game Over!
                        </div>
                        <div className={sharedStyles.resultsList}>
                            {results.map((result, index) => (
                                <div
                                    key={result.id}
                                    className={`${sharedStyles.resultRow} ${result.id === socket.id ? sharedStyles.highlight : ""}`}
                                >
                                    <span>
                                        {result.rank !== null &&
                                        result.rank <= 3
                                            ? MEDALS[result.rank - 1]
                                            : `#${result.rank ?? index + 1}`}
                                    </span>
                                    <span className={sharedStyles.resultName}>
                                        {result.name}
                                        {result.id === socket.id
                                            ? " (you)"
                                            : ""}
                                    </span>
                                    <span className={sharedStyles.resultTime}>
                                        {result.solved
                                            ? `Round ${result.roundReached}`
                                            : `Out at ${result.roundReached}`}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className={sharedStyles.waitSub}>
                            Waiting for host to start again…
                        </div>
                    </div>
                </div>
            </div>
        );
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
                <div className={sharedStyles.stats}>
                    <span>
                        Round{" "}
                        <span className={sharedStyles.statVal}>
                            {round}/{maxRounds}
                        </span>
                    </span>
                </div>

                <div className={styles.pad}>
                    {colors.map((color) => (
                        <button
                            key={color}
                            type="button"
                            className={`${styles.padButton} ${COLOR_CLASS[color]} ${flashColor === color ? styles.active : ""}`.trim()}
                            onClick={() => pressColor(color)}
                            disabled={phase !== "input"}
                            aria-label={`Simon color ${color}`}
                        />
                    ))}
                </div>

                <div className={styles.sequencePreview}>
                    {input.map((color, index) => (
                        <span
                            key={`${color}-${index}`}
                            className={`${styles.previewDot} ${COLOR_CLASS[color]}`}
                        />
                    ))}
                    {Array.from(
                        { length: round - input.length },
                        (_, index) => (
                            <span
                                key={`empty-${index}`}
                                className={`${styles.previewDot} ${styles.previewEmpty}`}
                            />
                        ),
                    )}
                </div>

                {phase === "watching" ? (
                    <div className={sharedStyles.hint}>
                        Watch the pattern, then repeat it.
                    </div>
                ) : null}
                {phase === "input" ? (
                    <div className={sharedStyles.hint}>
                        Tap the colors in the same order.
                    </div>
                ) : null}

                {phase === "solved" ? (
                    <div className={sharedStyles.solvedOverlay}>
                        <div className={sharedStyles.solvedTitle}>
                            Perfect Memory!
                        </div>
                        {rank !== null ? (
                            <div className={sharedStyles.solvedRank}>
                                {rank <= 3 ? MEDALS[rank - 1] : `#${rank}`}{" "}
                                Place
                            </div>
                        ) : null}
                        <div className={sharedStyles.solvedStats}>
                            All {maxRounds} rounds cleared
                        </div>
                        <div className={sharedStyles.solvedWait}>
                            Waiting for others to finish…
                        </div>
                    </div>
                ) : null}

                {phase === "failed" ? (
                    <div className={sharedStyles.solvedOverlay}>
                        <div className={sharedStyles.solvedTitle}>
                            Missed It
                        </div>
                        <div className={sharedStyles.solvedStats}>
                            Reached round {round}
                        </div>
                        <div className={sharedStyles.solvedWait}>
                            Waiting for others to finish…
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
