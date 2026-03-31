import { useState, useCallback } from "react";
import { socket } from "../socket";
import { useSocket } from "../hooks/useSocket";
import { useTimer, formatTime } from "../hooks/useTimer";
import { PlayerCard } from "../components/PlayerCard";
import { BowmanPlayerCard } from "../components/BowmanPlayerCard";
import { LightsOutPlayerCard } from "../components/LightsOutPlayerCard";
import { RushHourPlayerCard } from "../components/RushHourPlayerCard";
import { ResultsBoard } from "../components/ResultsBoard";
import type {
    PlayerInfo,
    ProgressSnapshot,
    Result,
    GameType,
    BowmanProgressSnapshot,
    BowmanResult,
    LightsOutProgressSnapshot,
    LightsOutResult,
    RushHourProgressSnapshot,
    RushHourResult,
} from "../types";
import styles from "../styles/Host.module.css";

type Phase = "lobby" | "playing" | "results";

interface Props {
    roomCode: string;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function Host({ roomCode }: Props) {
    const [phase, setPhase] = useState<Phase>("lobby");
    const [players, setPlayers] = useState<PlayerInfo[]>([]);
    const [gameType, setGameTypeState] = useState<GameType>("klotski");
    const [progress, setProgress] = useState<Map<string, ProgressSnapshot>>(
        new Map(),
    );
    const [bowmanProg, setBowmanProg] = useState<
        Map<string, BowmanProgressSnapshot>
    >(new Map());
    const [lightsOutProg, setLightsOutProg] = useState<
        Map<string, LightsOutProgressSnapshot>
    >(new Map());
    const [results, setResults] = useState<Result[]>([]);
    const [bowmanResults, setBowmanResults] = useState<BowmanResult[]>([]);
    const [lightsOutResults, setLightsOutResults] = useState<LightsOutResult[]>(
        [],
    );
    const [rushHourProg, setRushHourProg] = useState<
        Map<string, RushHourProgressSnapshot>
    >(new Map());
    const [rushHourResults, setRushHourResults] = useState<RushHourResult[]>(
        [],
    );
    const [gameStartTime, setGameStartTime] = useState<number | null>(null);
    const now = useTimer(gameStartTime);

    const onRoomUpdated = useCallback(
        ({ players: p }: { players: PlayerInfo[] }) => {
            setPlayers(p);
        },
        [],
    );

    const onRoomGameType = useCallback(
        ({ gameType: gt }: { gameType: GameType }) => {
            setGameTypeState(gt);
        },
        [],
    );

    const onGameStarted = useCallback(
        ({ gameType: gt }: { gameType: GameType }) => {
            setGameTypeState(gt);
            setPhase("playing");
            setProgress(new Map());
            setBowmanProg(new Map());
            setLightsOutProg(new Map());
            setRushHourProg(new Map());
            setGameStartTime(Date.now());
        },
        [],
    );

    const onPlayerProgress = useCallback((snap: ProgressSnapshot) => {
        setProgress((prev) => new Map(prev).set(snap.playerId, snap));
    }, []);

    const onBowmanProgress = useCallback((snap: BowmanProgressSnapshot) => {
        setBowmanProg((prev) => new Map(prev).set(snap.playerId, snap));
    }, []);

    const onLightsOutProgress = useCallback(
        (snap: LightsOutProgressSnapshot) => {
            setLightsOutProg((prev) => new Map(prev).set(snap.playerId, snap));
        },
        [],
    );

    const onRushHourProgress = useCallback((snap: RushHourProgressSnapshot) => {
        setRushHourProg((prev) => new Map(prev).set(snap.playerId, snap));
    }, []);

    const onGameOver = useCallback(
        ({
            results: r,
            gameType: gt,
        }: {
            results: never;
            gameType: GameType;
        }) => {
            setPhase("results");
            setGameTypeState(gt);
            if (gt === "bowman") setBowmanResults(r);
            else if (gt === "lightsout") setLightsOutResults(r);
            else if (gt === "rushhour") setRushHourResults(r);
            else setResults(r);
            setGameStartTime(null);
        },
        [],
    );

    const onGameReset = useCallback(() => {
        setPhase("lobby");
        setProgress(new Map());
        setBowmanProg(new Map());
        setLightsOutProg(new Map());
        setRushHourProg(new Map());
        setResults([]);
        setBowmanResults([]);
        setLightsOutResults([]);
        setRushHourResults([]);
        setGameStartTime(null);
    }, []);

    useSocket("room:updated", onRoomUpdated as never);
    useSocket("room:gameType", onRoomGameType as never);
    useSocket("game:started", onGameStarted as never);
    useSocket("player:progress", onPlayerProgress as never);
    useSocket("bowman:progress", onBowmanProgress as never);
    useSocket("lightsout:progress", onLightsOutProgress as never);
    useSocket("rushhour:progress", onRushHourProgress as never);
    useSocket("game:over", onGameOver as never);
    useSocket("game:reset", onGameReset as never);

    function selectGameType(gt: GameType) {
        setGameTypeState(gt);
        socket.emit("host:setGameType", { gameType: gt });
    }

    function startGame() {
        socket.emit("host:start");
    }
    function endRound() {
        socket.emit("host:end");
    }
    function resetGame() {
        socket.emit("host:reset");
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.logo}>⚡ QUICK DRAW</div>
                <div className={styles.roomInfo}>
                    <span className={styles.roomCode}>Room: {roomCode}</span>
                    {phase === "playing" && (
                        <span className={styles.liveBadge}>🔴 LIVE</span>
                    )}
                </div>
            </header>

            <div className={styles.content}>
                {/* ── Lobby ───────────────────────────────────────── */}
                {phase === "lobby" && (
                    <div className={styles.lobby}>
                        <div className={styles.lobbyTitle}>
                            Waiting for players…
                        </div>
                        <div className={styles.roomCodeBig}>{roomCode}</div>
                        <div className={styles.lobbyHint}>
                            Players go to this URL and enter the code
                        </div>

                        {/* Game type selector */}
                        <div className={styles.gameSelector}>
                            {(
                                [
                                    "klotski",
                                    "bowman",
                                    "rushhour",
                                    "lightsout",
                                ] as GameType[]
                            ).map((gt) => (
                                <button
                                    key={gt}
                                    type="button"
                                    className={
                                        gameType === gt
                                            ? styles.gameSelected
                                            : styles.gameOption
                                    }
                                    onClick={() => selectGameType(gt)}
                                >
                                    {gt === "klotski"
                                        ? "🧩 Klotski"
                                        : gt === "bowman"
                                          ? "🏹 Bowman"
                                          : gt === "rushhour"
                                            ? "🚗 Rush Hour"
                                            : "💡 Lights Out"}
                                </button>
                            ))}
                        </div>

                        <div className={styles.playerList}>
                            {players.length === 0 ? (
                                <div className={styles.noPlayers}>
                                    No players yet
                                </div>
                            ) : (
                                players.map((p) => (
                                    <div
                                        key={p.id}
                                        className={styles.playerChip}
                                    >
                                        {p.name}
                                    </div>
                                ))
                            )}
                        </div>

                        <button
                            type="button"
                            className={styles.startBtn}
                            onClick={startGame}
                            disabled={players.length === 0}
                        >
                            Start Game →
                        </button>
                    </div>
                )}

                {/* ── Playing ─────────────────────────────────────── */}
                {phase === "playing" && (
                    <>
                        <div className={styles.timerRow}>
                            <div className={styles.timer}>
                                {formatTime(now)}
                            </div>
                            <button
                                type="button"
                                className={styles.endBtn}
                                onClick={endRound}
                            >
                                End Round
                            </button>
                        </div>
                        <div className={styles.grid}>
                            {players.map((p) =>
                                gameType === "bowman" ? (
                                    <BowmanPlayerCard
                                        key={p.id}
                                        name={p.name}
                                        snapshot={bowmanProg.get(p.id) ?? null}
                                    />
                                ) : gameType === "lightsout" ? (
                                    <LightsOutPlayerCard
                                        key={p.id}
                                        name={p.name}
                                        snapshot={
                                            lightsOutProg.get(p.id) ?? null
                                        }
                                    />
                                ) : gameType === "rushhour" ? (
                                    <RushHourPlayerCard
                                        key={p.id}
                                        name={p.name}
                                        snapshot={
                                            rushHourProg.get(p.id) ?? null
                                        }
                                    />
                                ) : (
                                    <PlayerCard
                                        key={p.id}
                                        name={p.name}
                                        snapshot={progress.get(p.id) ?? null}
                                        elapsedMs={now}
                                    />
                                ),
                            )}
                        </div>
                    </>
                )}

                {/* ── Results ─────────────────────────────────────── */}
                {phase === "results" && (
                    <div className={styles.results}>
                        <div className={styles.resultsTitle}>🏆 Results</div>

                        {gameType === "bowman" ? (
                            <div className={styles.bowmanResults}>
                                {bowmanResults.map((r) => (
                                    <div
                                        key={r.id}
                                        className={styles.bowmanResultRow}
                                    >
                                        <span
                                            className={styles.bowmanResultRank}
                                        >
                                            {r.rank !== null && r.rank <= 3
                                                ? MEDALS[r.rank - 1]
                                                : (r.rank ?? "—")}
                                        </span>
                                        <span
                                            className={styles.bowmanResultName}
                                        >
                                            {r.name}
                                        </span>
                                        <span
                                            className={styles.bowmanResultDots}
                                        >
                                            {r.shots.map((s, si) => (
                                                <span
                                                    key={si}
                                                    className={styles.bowmanDot}
                                                    data-ring={s.ring}
                                                >
                                                    {s.score}
                                                </span>
                                            ))}
                                        </span>
                                        <span
                                            className={styles.bowmanResultScore}
                                        >
                                            {r.totalScore} pts
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : gameType === "lightsout" ? (
                            <div className={styles.bowmanResults}>
                                {lightsOutResults.map((r) => (
                                    <div
                                        key={r.id}
                                        className={styles.bowmanResultRow}
                                    >
                                        <span
                                            className={styles.bowmanResultRank}
                                        >
                                            {r.rank !== null && r.rank <= 3
                                                ? MEDALS[r.rank - 1]
                                                : (r.rank ?? "—")}
                                        </span>
                                        <span
                                            className={styles.bowmanResultName}
                                        >
                                            {r.name}
                                        </span>
                                        <span
                                            className={styles.bowmanResultScore}
                                        >
                                            {r.moves !== null
                                                ? `${r.moves} taps`
                                                : "DNF"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : gameType === "rushhour" ? (
                            <div className={styles.bowmanResults}>
                                {rushHourResults.map((r) => (
                                    <div
                                        key={r.id}
                                        className={styles.bowmanResultRow}
                                    >
                                        <span
                                            className={styles.bowmanResultRank}
                                        >
                                            {r.rank !== null && r.rank <= 3
                                                ? MEDALS[r.rank - 1]
                                                : (r.rank ?? "—")}
                                        </span>
                                        <span
                                            className={styles.bowmanResultName}
                                        >
                                            {r.name}
                                        </span>
                                        <span
                                            className={styles.bowmanResultScore}
                                        >
                                            {r.moves !== null
                                                ? `${r.moves} moves`
                                                : "DNF"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <ResultsBoard results={results} />
                        )}

                        <button
                            type="button"
                            className={styles.resetBtn}
                            onClick={resetGame}
                        >
                            Play Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
