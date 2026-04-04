import { useCallback, useMemo, useState } from "react";
import { socket } from "../socket";
import { useSocket } from "../hooks/useSocket";
import { formatTime } from "../hooks/useTimer";
import type { PairMatchResult, PairMatchTile } from "../types";
import sharedStyles from "../styles/Player.module.css";
import styles from "../styles/PairMatchPlayer.module.css";

const MEDALS = ["🥇", "🥈", "🥉"];

type Phase = "playing" | "solved" | "results";

interface Props {
    roomCode: string;
    playerName: string;
    initialTiles: PairMatchTile[];
}

export function PairMatchPlayer({
    roomCode,
    playerName,
    initialTiles,
}: Props) {
    const [phase, setPhase] = useState<Phase>("playing");
    const [tiles, setTiles] = useState<PairMatchTile[]>(initialTiles);
    const [attempts, setAttempts] = useState(0);
    const [pairsFound, setPairsFound] = useState(0);
    const [busy, setBusy] = useState(false);
    const [finishTime, setFinishTime] = useState<number | null>(null);
    const [rank, setRank] = useState<number | null>(null);
    const [results, setResults] = useState<PairMatchResult[]>([]);

    const totalPairs = useMemo(() => initialTiles.length / 2, [initialTiles.length]);

    const onUpdate = useCallback(
        ({
            tiles: nextTiles,
            attempts: nextAttempts,
            pairsFound: nextPairsFound,
            busy: nextBusy,
            finishTime: nextFinishTime,
        }: {
            tiles: PairMatchTile[];
            attempts: number;
            pairsFound: number;
            totalPairs: number;
            solved: boolean;
            done: boolean;
            busy: boolean;
            finishTime: number | null;
        }) => {
            setTiles(nextTiles);
            setAttempts(nextAttempts);
            setPairsFound(nextPairsFound);
            setBusy(nextBusy);
            setFinishTime(nextFinishTime);
        },
        [],
    );

    const onSolved = useCallback(
        ({
            rank: nextRank,
            attempts: nextAttempts,
            finishTime: nextFinishTime,
        }: {
            rank: number;
            attempts: number;
            finishTime: number | null;
        }) => {
            setRank(nextRank);
            setAttempts(nextAttempts);
            setFinishTime(nextFinishTime);
            setPhase("solved");
        },
        [],
    );

    const onGameOver = useCallback(
        ({ results: nextResults }: { results: PairMatchResult[] }) => {
            setResults(nextResults);
            setPhase("results");
        },
        [],
    );

    useSocket("pairmatch:update", onUpdate as never);
    useSocket("pairmatch:solved", onSolved as never);
    useSocket("game:over", onGameOver as never);

    function flipTile(tileId: string) {
        if (phase !== "playing" || busy) return;
        socket.emit("pairmatch:flip", { tileId });
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
                        <div className={sharedStyles.waitTitle}>🏆 Game Over!</div>
                        <div className={sharedStyles.resultsList}>
                            {results.map((result, index) => (
                                <div
                                    key={result.id}
                                    className={`${sharedStyles.resultRow} ${result.id === socket.id ? sharedStyles.highlight : ""}`}
                                >
                                    <span>
                                        {result.rank !== null && result.rank <= 3
                                            ? MEDALS[result.rank - 1]
                                            : `#${result.rank ?? index + 1}`}
                                    </span>
                                    <span className={sharedStyles.resultName}>
                                        {result.name}
                                        {result.id === socket.id ? " (you)" : ""}
                                    </span>
                                    <span className={sharedStyles.resultTime}>
                                        {result.solved
                                            ? `${result.attempts} tries · ${formatTime(result.finishTime ?? 0)}`
                                            : `${result.pairsFound}/${result.totalPairs} pairs`}
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
                        <div className={sharedStyles.stats}>
                            <span>
                                Pairs{" "}
                                <span className={sharedStyles.statVal}>
                                    {pairsFound}/{totalPairs}
                                </span>
                            </span>
                            <span>
                                Attempts{" "}
                                <span className={sharedStyles.statVal}>
                                    {attempts}
                                </span>
                            </span>
                        </div>

                        <div className={styles.grid}>
                            {tiles.map((tile) => (
                                <button
                                    key={tile.id}
                                    type="button"
                                    className={`${styles.tile} ${styles[tile.state]}`.trim()}
                                    onClick={() => flipTile(tile.id)}
                                    disabled={
                                        phase !== "playing" ||
                                        busy ||
                                        tile.state !== "hidden"
                                    }
                                    aria-label={
                                        tile.symbol
                                            ? `Tile showing ${tile.symbol}`
                                            : "Hidden tile"
                                    }
                                >
                                    <span className={styles.tileFace}>
                                        {tile.symbol ?? "?"}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className={styles.progressBar}>
                            <div
                                className={styles.progressFill}
                                style={{ width: `${(pairsFound / totalPairs) * 100}%` }}
                            />
                        </div>

                        <div className={sharedStyles.hint}>
                            Reveal two tiles at a time and remember every match.
                            <br />
                            Clear the whole board faster than everyone else.
                        </div>

                        {phase === "solved" && (
                            <div className={sharedStyles.solvedOverlay}>
                                <div className={sharedStyles.solvedTitle}>
                                    Board Cleared!
                                </div>
                                {rank !== null ? (
                                    <div className={sharedStyles.solvedRank}>
                                        {rank <= 3 ? MEDALS[rank - 1] : `#${rank}`} Place
                                    </div>
                                ) : null}
                                <div className={sharedStyles.solvedStats}>
                                    {attempts} attempts · {formatTime(finishTime ?? 0)}
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
