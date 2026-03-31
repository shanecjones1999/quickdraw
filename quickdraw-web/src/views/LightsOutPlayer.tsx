import { useCallback, useState } from "react";
import { socket } from "../socket";
import { useSocket } from "../hooks/useSocket";
import { LightsOutBoard } from "../components/LightsOutBoard";
import type { LightsOutResult } from "../types";
import styles from "../styles/Player.module.css";

type Phase = "playing" | "solved" | "results";

const MEDALS = ["🥇", "🥈", "🥉"];

interface Props {
    roomCode: string;
    playerName: string;
    initialBoard: boolean[][];
}

export function LightsOutPlayer({ roomCode, playerName, initialBoard }: Props) {
    const [board, setBoard] = useState<boolean[][]>(initialBoard);
    const [moves, setMoves] = useState(0);
    const [phase, setPhase] = useState<Phase>("playing");
    const [rank, setRank] = useState<number | null>(null);
    const [results, setResults] = useState<LightsOutResult[]>([]);

    const onUpdate = useCallback(
        ({
            board: nextBoard,
            moves: nextMoves,
        }: {
            board: boolean[][];
            moves: number;
            solved: boolean;
        }) => {
            setBoard(nextBoard);
            setMoves(nextMoves);
        },
        [],
    );

    const onSolved = useCallback(
        ({
            rank: nextRank,
            moves: nextMoves,
        }: {
            rank: number;
            moves: number;
            finishTime: number;
        }) => {
            setRank(nextRank);
            setMoves(nextMoves);
            setPhase("solved");
        },
        [],
    );

    const onGameOver = useCallback(
        ({ results: nextResults }: { results: LightsOutResult[] }) => {
            setResults(nextResults);
            setPhase("results");
        },
        [],
    );

    useSocket("lightsout:update", onUpdate as never);
    useSocket("lightsout:solved", onSolved as never);
    useSocket("game:over", onGameOver as never);

    function pressCell(row: number, col: number) {
        socket.emit("lightsout:move", { row, col });
    }

    if (phase === "results") {
        return (
            <div className={styles.page}>
                <header className={styles.header}>
                    <div className={styles.logo}>⚡ Quick Draw</div>
                    <div className={styles.meta}>
                        {playerName} · {roomCode}
                    </div>
                </header>
                <div className={styles.content}>
                    <div className={styles.centered}>
                        <div className={styles.waitTitle}>🏆 Game Over!</div>
                        <div className={styles.resultsList}>
                            {results.map((result, index) => (
                                <div
                                    key={result.id}
                                    className={`${styles.resultRow} ${result.id === socket.id ? styles.highlight : ""}`}
                                >
                                    <span>
                                        {result.rank !== null &&
                                        result.rank <= 3
                                            ? MEDALS[result.rank - 1]
                                            : `#${result.rank ?? index + 1}`}
                                    </span>
                                    <span className={styles.resultName}>
                                        {result.name}
                                        {result.id === socket.id
                                            ? " (you)"
                                            : ""}
                                    </span>
                                    {result.moves !== null ? (
                                        <span className={styles.resultTime}>
                                            {result.moves} taps
                                        </span>
                                    ) : (
                                        <span className={styles.resultDnf}>
                                            DNF
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className={styles.waitSub}>
                            Waiting for host to start again…
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.logo}>⚡ Quick Draw</div>
                <div className={styles.meta}>
                    {playerName} · {roomCode}
                </div>
            </header>

            <div className={styles.content}>
                <LightsOutBoard
                    board={board}
                    onCellPress={phase === "playing" ? pressCell : undefined}
                    solved={phase === "solved"}
                />

                <div className={styles.stats}>
                    <span>
                        Taps: <span className={styles.statVal}>{moves}</span>
                    </span>
                </div>

                {phase === "playing" && (
                    <div className={styles.hint}>
                        Tap a tile to flip it and its neighbors.
                        <br />
                        Turn{" "}
                        <span className={styles.hintAccent}>
                            every light off
                        </span>
                        .
                    </div>
                )}

                {phase === "solved" && (
                    <div className={styles.solvedOverlay}>
                        <div className={styles.solvedTitle}>Solved!</div>
                        {rank !== null && (
                            <div className={styles.solvedRank}>
                                {rank <= 3 ? MEDALS[rank - 1] : `#${rank}`}{" "}
                                Place
                            </div>
                        )}
                        <div className={styles.solvedStats}>{moves} taps</div>
                        <div className={styles.solvedWait}>
                            Waiting for others to finish…
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
