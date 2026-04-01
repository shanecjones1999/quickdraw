import { useCallback, useState } from "react";
import { socket } from "../socket";
import { useSocket } from "../hooks/useSocket";
import { formatTime } from "../hooks/useTimer";
import { PipeConnectBoard } from "../components/PipeConnectBoard";
import type { PipeConnectResult, PipeConnectTile } from "../types";
import styles from "../styles/Player.module.css";

const MEDALS = ["🥇", "🥈", "🥉"];

type Phase = "playing" | "solved" | "results";

interface Props {
    roomCode: string;
    playerName: string;
    initialTiles: PipeConnectTile[];
}

export function PipeConnectPlayer({
    roomCode,
    playerName,
    initialTiles,
}: Props) {
    const [tiles, setTiles] = useState<PipeConnectTile[]>(initialTiles);
    const [moves, setMoves] = useState(0);
    const [phase, setPhase] = useState<Phase>("playing");
    const [rank, setRank] = useState<number | null>(null);
    const [finishTime, setFinishTime] = useState<number | null>(null);
    const [results, setResults] = useState<PipeConnectResult[]>([]);

    const onUpdate = useCallback(
        ({
            tiles: nextTiles,
            moves: nextMoves,
        }: {
            tiles: PipeConnectTile[];
            moves: number;
            solved: boolean;
        }) => {
            setTiles(nextTiles);
            setMoves(nextMoves);
        },
        [],
    );

    const onSolved = useCallback(
        ({
            rank: nextRank,
            moves: nextMoves,
            finishTime: nextFinishTime,
        }: {
            rank: number;
            moves: number;
            finishTime: number;
        }) => {
            setRank(nextRank);
            setMoves(nextMoves);
            setFinishTime(nextFinishTime);
            setPhase("solved");
        },
        [],
    );

    const onGameOver = useCallback(
        ({ results: nextResults }: { results: PipeConnectResult[] }) => {
            setResults(nextResults);
            setPhase("results");
        },
        [],
    );

    useSocket("pipeconnect:update", onUpdate as never);
    useSocket("pipeconnect:solved", onSolved as never);
    useSocket("game:over", onGameOver as never);

    function rotateTile(tileId: string) {
        socket.emit("pipeconnect:rotate", { tileId });
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
                                            {result.moves} turns
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
                <PipeConnectBoard
                    tiles={tiles}
                    onRotate={phase === "playing" ? rotateTile : undefined}
                    solved={phase === "solved"}
                />

                <div className={styles.stats}>
                    <span>
                        Turns: <span className={styles.statVal}>{moves}</span>
                    </span>
                </div>

                {phase === "playing" ? (
                    <div className={styles.hint}>
                        Tap pipes to rotate them.
                        <br />
                        Connect <span className={styles.hintAccent}>
                            S
                        </span> to <span className={styles.hintAccent}>E</span>.
                    </div>
                ) : null}

                {phase === "solved" ? (
                    <div className={styles.solvedOverlay}>
                        <div className={styles.solvedTitle}>Connected!</div>
                        {rank !== null ? (
                            <div className={styles.solvedRank}>
                                {rank <= 3 ? MEDALS[rank - 1] : `#${rank}`}{" "}
                                Place
                            </div>
                        ) : null}
                        <div className={styles.solvedStats}>
                            {moves} turns · {formatTime(finishTime ?? 0)}
                        </div>
                        <div className={styles.solvedWait}>
                            Waiting for others to finish…
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
