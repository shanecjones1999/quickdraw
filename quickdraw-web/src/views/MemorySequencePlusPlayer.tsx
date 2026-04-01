import { useEffect, useMemo, useState } from "react";
import { socket } from "../socket";
import { useSocket } from "../hooks/useSocket";
import type { MemorySequencePlusResult } from "../types";
import sharedStyles from "../styles/Player.module.css";
import styles from "../styles/MemorySequencePlusPlayer.module.css";

const MEDALS = ["🥇", "🥈", "🥉"];

type Phase = "watching" | "input" | "solved" | "failed" | "results";

interface Props {
    roomCode: string;
    playerName: string;
    sequence: number[];
    gridSize: number;
    maxRounds: number;
}

export function MemorySequencePlusPlayer({
    roomCode,
    playerName,
    sequence,
    gridSize,
    maxRounds,
}: Props) {
    const [phase, setPhase] = useState<Phase>("watching");
    const [round, setRound] = useState(1);
    const [input, setInput] = useState<number[]>([]);
    const [flashCell, setFlashCell] = useState<number | null>(null);
    const [rank, setRank] = useState<number | null>(null);
    const [results, setResults] = useState<MemorySequencePlusResult[]>([]);

    const activeSequence = useMemo(
        () => sequence.slice(0, round),
        [sequence, round],
    );

    useEffect(() => {
        if (phase !== "watching") return;

        const timers: number[] = [];
        activeSequence.forEach((cell, index) => {
            timers.push(
                window.setTimeout(() => setFlashCell(cell), index * 650 + 250),
            );
            timers.push(
                window.setTimeout(() => setFlashCell(null), index * 650 + 560),
            );
        });
        timers.push(
            window.setTimeout(
                () => setPhase("input"),
                activeSequence.length * 650 + 220,
            ),
        );

        return () => {
            timers.forEach((timer) => window.clearTimeout(timer));
        };
    }, [activeSequence, phase]);

    useEffect(() => {
        if (phase !== "input") return;
        if (input.length !== round) return;
        socket.emit("memorysequenceplus:submit", { inputs: input });
    }, [input, phase, round]);

    useSocket("memorysequenceplus:update", ((payload: {
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

    useSocket("memorysequenceplus:solved", ((payload: { rank: number }) => {
        setRank(payload.rank);
        setPhase("solved");
    }) as never);

    useSocket("game:over", ((payload: {
        results: MemorySequencePlusResult[];
    }) => {
        setResults(payload.results);
        setPhase("results");
    }) as never);

    function pressCell(cell: number) {
        if (phase !== "input") return;
        setInput((previous) => [...previous, cell]);
    }

    const cells = Array.from(
        { length: gridSize * gridSize },
        (_, index) => index,
    );

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

                <div className={styles.grid}>
                    {cells.map((cell) => (
                        <button
                            key={cell}
                            type="button"
                            className={`${styles.cell} ${flashCell === cell ? styles.active : ""}`.trim()}
                            onClick={() => pressCell(cell)}
                            disabled={phase !== "input"}
                            aria-label={`Memory cell ${cell + 1}`}
                        >
                            {cell + 1}
                        </button>
                    ))}
                </div>

                <div className={styles.sequencePreview}>
                    {input.map((cell, index) => (
                        <span
                            key={`${cell}-${index}`}
                            className={styles.previewCell}
                        >
                            {cell + 1}
                        </span>
                    ))}
                    {Array.from(
                        { length: round - input.length },
                        (_, index) => (
                            <span
                                key={`empty-${index}`}
                                className={`${styles.previewCell} ${styles.previewEmpty}`}
                            >
                                •
                            </span>
                        ),
                    )}
                </div>

                {phase === "watching" ? (
                    <div className={sharedStyles.hint}>
                        Watch the squares light up, then repeat the order.
                    </div>
                ) : null}
                {phase === "input" ? (
                    <div className={sharedStyles.hint}>
                        Tap the numbered cells in the same sequence.
                    </div>
                ) : null}

                {phase === "solved" ? (
                    <div className={sharedStyles.solvedOverlay}>
                        <div className={sharedStyles.solvedTitle}>
                            Sequence Master!
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
