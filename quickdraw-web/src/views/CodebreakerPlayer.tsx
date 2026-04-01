import { useCallback, useMemo, useState } from "react";
import { socket } from "../socket";
import { useSocket } from "../hooks/useSocket";
import { formatTime } from "../hooks/useTimer";
import type { CodebreakerGuess, CodebreakerResult } from "../types";
import sharedStyles from "../styles/Player.module.css";
import styles from "../styles/CodebreakerPlayer.module.css";

type Phase = "playing" | "solved" | "failed" | "results";

const MEDALS = ["🥇", "🥈", "🥉"];

const COLOR_CLASS: Record<string, string> = {
    red: styles.red,
    blue: styles.blue,
    green: styles.green,
    yellow: styles.yellow,
    purple: styles.purple,
    orange: styles.orange,
};

interface Props {
    roomCode: string;
    playerName: string;
    palette: string[];
    codeLength: number;
    maxGuesses: number;
}

export function CodebreakerPlayer({
    roomCode,
    playerName,
    palette,
    codeLength,
    maxGuesses,
}: Props) {
    const [phase, setPhase] = useState<Phase>("playing");
    const [guesses, setGuesses] = useState<CodebreakerGuess[]>([]);
    const [currentGuess, setCurrentGuess] = useState<string[]>(
        Array(codeLength).fill(""),
    );
    const [activeIndex, setActiveIndex] = useState(0);
    const [finishTime, setFinishTime] = useState<number | null>(null);
    const [results, setResults] = useState<CodebreakerResult[]>([]);

    const canSubmit = useMemo(
        () => currentGuess.every(Boolean) && phase === "playing",
        [currentGuess, phase],
    );

    const onUpdate = useCallback(
        ({
            guesses: nextGuesses,
            solved,
            done,
        }: {
            guesses: CodebreakerGuess[];
            solved: boolean;
            done: boolean;
            finishTime: number | null;
        }) => {
            setGuesses(nextGuesses);
            setCurrentGuess(Array(codeLength).fill(""));
            setActiveIndex(0);
            if (done && !solved) {
                setPhase("failed");
            }
        },
        [codeLength],
    );

    const onSolved = useCallback(
        ({
            finishTime: nextFinishTime,
        }: {
            attempts: number;
            finishTime: number;
        }) => {
            setFinishTime(nextFinishTime);
            setPhase("solved");
        },
        [],
    );

    const onGameOver = useCallback(
        ({ results: nextResults }: { results: CodebreakerResult[] }) => {
            setResults(nextResults);
            setPhase("results");
        },
        [],
    );

    useSocket("codebreaker:update", onUpdate as never);
    useSocket("codebreaker:solved", onSolved as never);
    useSocket("game:over", onGameOver as never);

    function setSlotColor(color: string) {
        if (phase !== "playing") return;
        setCurrentGuess((previous) => {
            const next = [...previous];
            next[activeIndex] = color;
            return next;
        });

        setActiveIndex((previous) => {
            const nextIndex = Math.min(previous + 1, codeLength - 1);
            return nextIndex;
        });
    }

    function clearGuess() {
        setCurrentGuess(Array(codeLength).fill(""));
        setActiveIndex(0);
    }

    function removeLast() {
        setCurrentGuess((previous) => {
            const next = [...previous];
            let target = activeIndex;
            if (!next[target] && target > 0) {
                target -= 1;
            }
            next[target] = "";
            setActiveIndex(target);
            return next;
        });
    }

    function submitGuess() {
        if (!canSubmit) return;
        socket.emit("codebreaker:guess", { guess: currentGuess });
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
                {phase === "results" ? (
                    <div className={sharedStyles.centered}>
                        <div className={sharedStyles.waitTitle}>
                            🏆 Game Over!
                        </div>
                        <div className={sharedStyles.resultsList}>
                            {results.map((result) => (
                                <div
                                    key={result.id}
                                    className={`${sharedStyles.resultRow} ${result.id === socket.id ? sharedStyles.highlight : ""}`}
                                >
                                    <span>
                                        {result.rank !== null &&
                                        result.rank <= 3
                                            ? MEDALS[result.rank - 1]
                                            : (result.rank ?? "—")}
                                    </span>
                                    <span className={sharedStyles.resultName}>
                                        {result.name}
                                        {result.id === socket.id
                                            ? " (you)"
                                            : ""}
                                    </span>
                                    <span className={sharedStyles.resultTime}>
                                        {result.solved
                                            ? `${result.attempts} guesses · ${formatTime(result.finishTime ?? 0)}`
                                            : `${result.attempts}/${maxGuesses} guesses`}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className={sharedStyles.waitSub}>
                            Waiting for host to start again…
                        </div>
                    </div>
                ) : (
                    <>
                        <div className={styles.currentRow}>
                            {currentGuess.map((color, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    className={`${styles.slot} ${color ? (COLOR_CLASS[color] ?? "") : styles.slotEmpty} ${activeIndex === index ? styles.slotActive : ""}`.trim()}
                                    onClick={() => setActiveIndex(index)}
                                >
                                    {color ? "" : index + 1}
                                </button>
                            ))}
                        </div>

                        <div className={styles.controls}>
                            <button
                                type="button"
                                className={styles.secondaryBtn}
                                onClick={removeLast}
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                className={styles.secondaryBtn}
                                onClick={clearGuess}
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                className={styles.primaryBtn}
                                onClick={submitGuess}
                                disabled={!canSubmit}
                            >
                                Submit
                            </button>
                        </div>

                        <div className={styles.palette}>
                            {palette.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    className={`${styles.paletteSwatch} ${COLOR_CLASS[color] ?? ""}`.trim()}
                                    onClick={() => setSlotColor(color)}
                                    aria-label={`Select ${color}`}
                                />
                            ))}
                        </div>

                        <div className={sharedStyles.stats}>
                            <span>
                                Guesses:{" "}
                                <span className={sharedStyles.statVal}>
                                    {guesses.length}/{maxGuesses}
                                </span>
                            </span>
                        </div>

                        <div className={styles.history}>
                            {guesses.length === 0 ? (
                                <div className={styles.emptyState}>
                                    Make a guess to start cracking the code.
                                </div>
                            ) : (
                                guesses.map((guess, index) => (
                                    <div
                                        key={index}
                                        className={styles.historyRow}
                                    >
                                        <div className={styles.historyGuess}>
                                            {guess.colors.map(
                                                (color, colorIndex) => (
                                                    <span
                                                        key={`${color}-${colorIndex}`}
                                                        className={`${styles.historyDot} ${COLOR_CLASS[color] ?? ""}`.trim()}
                                                    />
                                                ),
                                            )}
                                        </div>
                                        <div className={styles.feedback}>
                                            <span>Exact {guess.exact}</span>
                                            <span>Close {guess.partial}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {phase === "playing" && (
                            <div className={sharedStyles.hint}>
                                Crack the hidden 4-color code.
                                <br />
                                <span className={sharedStyles.hintAccent}>
                                    Exact
                                </span>{" "}
                                means right color, right spot.
                            </div>
                        )}

                        {phase === "solved" && (
                            <div className={sharedStyles.solvedOverlay}>
                                <div className={sharedStyles.solvedTitle}>
                                    Cracked!
                                </div>
                                <div className={sharedStyles.solvedStats}>
                                    {guesses.length} guesses ·{" "}
                                    {formatTime(finishTime ?? 0)}
                                </div>
                                <div className={sharedStyles.solvedWait}>
                                    Waiting for others to finish…
                                </div>
                            </div>
                        )}

                        {phase === "failed" && (
                            <div className={sharedStyles.solvedOverlay}>
                                <div className={sharedStyles.solvedTitle}>
                                    Locked Out
                                </div>
                                <div className={sharedStyles.solvedStats}>
                                    {guesses.length}/{maxGuesses} guesses used
                                </div>
                                <div className={sharedStyles.solvedWait}>
                                    Waiting for others to finish…
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
