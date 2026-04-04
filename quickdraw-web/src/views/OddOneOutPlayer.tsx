import { useCallback, useEffect, useMemo, useState } from "react";
import { socket } from "../socket";
import { useSocket } from "../hooks/useSocket";
import { formatTime } from "../hooks/useTimer";
import type { OddOneOutPrompt, OddOneOutResult } from "../types";
import sharedStyles from "../styles/Player.module.css";
import styles from "../styles/OddOneOutPlayer.module.css";

type Phase = "playing" | "done" | "results";

const MEDALS = ["🥇", "🥈", "🥉"];
const SHAPE_SYMBOL: Record<string, string> = {
    circle: "●",
    square: "■",
    triangle: "▲",
    diamond: "◆",
    star: "★",
};

interface Props {
    roomCode: string;
    playerName: string;
    initialPrompt: OddOneOutPrompt | null;
    totalPrompts: number;
}

export function OddOneOutPlayer({
    roomCode,
    playerName,
    initialPrompt,
    totalPrompts,
}: Props) {
    const [phase, setPhase] = useState<Phase>("playing");
    const [prompt, setPrompt] = useState<OddOneOutPrompt | null>(initialPrompt);
    const [score, setScore] = useState(0);
    const [promptsCleared, setPromptsCleared] = useState(0);
    const [penaltyCount, setPenaltyCount] = useState(0);
    const [totalResponseTime, setTotalResponseTime] = useState(0);
    const [finishTime, setFinishTime] = useState<number | null>(null);
    const [lockedOutUntil, setLockedOutUntil] = useState<number | null>(null);
    const [results, setResults] = useState<OddOneOutResult[]>([]);
    const [clock, setClock] = useState(() => Date.now());

    useEffect(() => {
        if (lockedOutUntil === null || lockedOutUntil <= Date.now()) {
            return;
        }

        const intervalId = window.setInterval(() => {
            const now = Date.now();
            setClock(now);
            if (now >= lockedOutUntil) {
                window.clearInterval(intervalId);
            }
        }, 100);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [lockedOutUntil]);

    const onUpdate = useCallback(
        (payload: {
            prompt: OddOneOutPrompt | null;
            promptsCleared: number;
            score: number;
            totalResponseTime: number;
            penaltyCount: number;
            lockedOutUntil: number | null;
            done: boolean;
            finishTime: number | null;
        }) => {
            setPrompt(payload.prompt);
            setPromptsCleared(payload.promptsCleared);
            setScore(payload.score);
            setTotalResponseTime(payload.totalResponseTime);
            setPenaltyCount(payload.penaltyCount);
            setLockedOutUntil(payload.lockedOutUntil);
            setFinishTime(payload.finishTime);
            setPhase(payload.done ? "done" : "playing");
        },
        [],
    );

    const onGameOver = useCallback(
        ({ results: nextResults }: { results: OddOneOutResult[] }) => {
            setResults(nextResults);
            setPhase("results");
        },
        [],
    );

    useSocket("oddoneout:update", onUpdate as never);
    useSocket("game:over", onGameOver as never);

    const isLocked = lockedOutUntil !== null && lockedOutUntil > clock;
    const lockoutMs = Math.max((lockedOutUntil ?? 0) - clock, 0);
    const gridTemplate = useMemo(
        () =>
            prompt
                ? {
                      gridTemplateColumns: `repeat(${prompt.cols}, minmax(0, 1fr))`,
                  }
                : undefined,
        [prompt],
    );

    function selectItem(index: number) {
        if (!prompt || isLocked || phase !== "playing") return;
        socket.emit("oddoneout:select", { index });
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
                        <div className={sharedStyles.waitTitle}>🏆 Game Over!</div>
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
                                        {result.score} pts ·{" "}
                                        {formatTime(result.totalResponseTime)}
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
                        Score <span className={sharedStyles.statVal}>{score}</span>
                    </span>
                    <span>
                        Cleared{" "}
                        <span className={sharedStyles.statVal}>
                            {promptsCleared}/{totalPrompts}
                        </span>
                    </span>
                </div>

                <div className={styles.metaRow}>
                    <span>Time {formatTime(totalResponseTime)}</span>
                    <span>Penalties {penaltyCount}</span>
                    <span>
                        {isLocked
                            ? `Locked ${(lockoutMs / 1000).toFixed(1)}s`
                            : "Tap the odd one out"}
                    </span>
                </div>

                {prompt ? (
                    <div
                        className={`${styles.grid} ${isLocked ? styles.gridLocked : ""}`.trim()}
                        style={gridTemplate}
                    >
                        {prompt.items.map((item, index) => (
                            <button
                                key={`${item.shape}-${index}`}
                                type="button"
                                className={styles.cell}
                                onClick={() => selectItem(index)}
                                disabled={isLocked || phase !== "playing"}
                            >
                                <span
                                    className={styles.glyph}
                                    style={{ color: item.color }}
                                >
                                    {SHAPE_SYMBOL[item.shape] ?? "•"}
                                </span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className={styles.emptyState}>
                        Waiting for the next grid…
                    </div>
                )}

                {phase === "playing" && (
                    <div className={sharedStyles.hint}>
                        Find the one symbol that looks different.
                        <br />
                        Wrong taps trigger a{" "}
                        <span className={sharedStyles.hintAccent}>
                            short lockout
                        </span>
                        .
                    </div>
                )}

                {phase === "done" && (
                    <div className={sharedStyles.solvedOverlay}>
                        <div className={sharedStyles.solvedTitle}>Finished!</div>
                        <div className={sharedStyles.solvedStats}>
                            {score} pts · {formatTime(finishTime ?? totalResponseTime)}
                        </div>
                        <div className={sharedStyles.solvedWait}>
                            Waiting for others to finish…
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
