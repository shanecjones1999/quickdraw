import { useState, useCallback } from "react";
import { socket } from "../socket";
import { useSocket } from "../hooks/useSocket";
import { useTimer, formatTime } from "../hooks/useTimer";
import { formatGameLabel } from "../gameMeta";
import { PlayerCard } from "../components/PlayerCard";
import { BowmanPlayerCard } from "../components/BowmanPlayerCard";
import { CodebreakerPlayerCard } from "../components/CodebreakerPlayerCard";
import { LightsOutPlayerCard } from "../components/LightsOutPlayerCard";
import { MemorySequencePlusPlayerCard } from "../components/MemorySequencePlusPlayerCard";
import { PipeConnectPlayerCard } from "../components/PipeConnectPlayerCard";
import { RushHourPlayerCard } from "../components/RushHourPlayerCard";
import { SimonCopyPlayerCard } from "../components/SimonCopyPlayerCard";
import { ResultsBoard } from "../components/ResultsBoard";
import { RoundShuffleOverlay } from "../components/RoundShuffleOverlay";
import type {
    PlayerInfo,
    ProgressSnapshot,
    Result,
    GameType,
    MatchStanding,
    BowmanProgressSnapshot,
    BowmanResult,
    CodebreakerProgressSnapshot,
    CodebreakerResult,
    LightsOutProgressSnapshot,
    LightsOutResult,
    MemorySequencePlusProgressSnapshot,
    MemorySequencePlusResult,
    PipeConnectProgressSnapshot,
    PipeConnectResult,
    RoundShufflePayload,
    RushHourProgressSnapshot,
    RushHourResult,
    SimonCopyProgressSnapshot,
    SimonCopyResult,
} from "../types";
import styles from "../styles/Host.module.css";

type Phase = "lobby" | "shuffling" | "playing" | "results";

interface Props {
    roomCode: string;
}

const MEDALS = ["🥇", "🥈", "🥉"];
const DEFAULT_TOTAL_ROUNDS = 5;
const MIN_TOTAL_ROUNDS = 1;
const MAX_TOTAL_ROUNDS = 12;

interface ShuffleState {
    gameType: GameType;
    roundNumber: number;
    totalRounds: number;
    durationMs: number;
    landingBufferMs: number;
}

export function Host({ roomCode }: Props) {
    const [phase, setPhase] = useState<Phase>("lobby");
    const [players, setPlayers] = useState<PlayerInfo[]>([]);
    const [gameType, setGameTypeState] = useState<GameType>("klotski");
    const [totalRounds, setTotalRounds] = useState(DEFAULT_TOTAL_ROUNDS);
    const [currentRound, setCurrentRound] = useState(0);
    const [matchOver, setMatchOver] = useState(false);
    const [standings, setStandings] = useState<MatchStanding[]>([]);
    const [progress, setProgress] = useState<Map<string, ProgressSnapshot>>(
        new Map(),
    );
    const [bowmanProg, setBowmanProg] = useState<
        Map<string, BowmanProgressSnapshot>
    >(new Map());
    const [codebreakerProg, setCodebreakerProg] = useState<
        Map<string, CodebreakerProgressSnapshot>
    >(new Map());
    const [lightsOutProg, setLightsOutProg] = useState<
        Map<string, LightsOutProgressSnapshot>
    >(new Map());
    const [pipeConnectProg, setPipeConnectProg] = useState<
        Map<string, PipeConnectProgressSnapshot>
    >(new Map());
    const [simonCopyProg, setSimonCopyProg] = useState<
        Map<string, SimonCopyProgressSnapshot>
    >(new Map());
    const [memorySequencePlusProg, setMemorySequencePlusProg] = useState<
        Map<string, MemorySequencePlusProgressSnapshot>
    >(new Map());
    const [results, setResults] = useState<Result[]>([]);
    const [bowmanResults, setBowmanResults] = useState<BowmanResult[]>([]);
    const [codebreakerResults, setCodebreakerResults] = useState<
        CodebreakerResult[]
    >([]);
    const [lightsOutResults, setLightsOutResults] = useState<LightsOutResult[]>(
        [],
    );
    const [pipeConnectResults, setPipeConnectResults] = useState<
        PipeConnectResult[]
    >([]);
    const [simonCopyResults, setSimonCopyResults] = useState<SimonCopyResult[]>(
        [],
    );
    const [memorySequencePlusResults, setMemorySequencePlusResults] = useState<
        MemorySequencePlusResult[]
    >([]);
    const [rushHourProg, setRushHourProg] = useState<
        Map<string, RushHourProgressSnapshot>
    >(new Map());
    const [rushHourResults, setRushHourResults] = useState<RushHourResult[]>(
        [],
    );
    const [gameStartTime, setGameStartTime] = useState<number | null>(null);
    const [shuffleState, setShuffleState] = useState<ShuffleState | null>(null);
    const now = useTimer(gameStartTime);

    const onRoomUpdated = useCallback(
        ({ players: p }: { players: PlayerInfo[] }) => {
            setPlayers(p);
        },
        [],
    );

    const onRoomSettings = useCallback(
        ({
            totalRounds: nextTotalRounds,
            currentRound: nextCurrentRound,
        }: {
            totalRounds: number;
            currentRound: number;
        }) => {
            setTotalRounds(nextTotalRounds);
            setCurrentRound(nextCurrentRound);
        },
        [],
    );

    const onGameStarted = useCallback(
        ({
            gameType: gt,
            roundNumber,
            totalRounds: nextTotalRounds,
        }: {
            gameType: GameType;
            roundNumber: number;
            totalRounds: number;
        }) => {
            setShuffleState(null);
            setGameTypeState(gt);
            setCurrentRound(roundNumber);
            setTotalRounds(nextTotalRounds);
            setMatchOver(false);
            setPhase("playing");
            setProgress(new Map());
            setBowmanProg(new Map());
            setCodebreakerProg(new Map());
            setLightsOutProg(new Map());
            setPipeConnectProg(new Map());
            setSimonCopyProg(new Map());
            setMemorySequencePlusProg(new Map());
            setRushHourProg(new Map());
            setGameStartTime(Date.now());
        },
        [],
    );

    const onRoundShuffle = useCallback(
        ({
            gameType: gt,
            roundNumber,
            totalRounds: nextTotalRounds,
            durationMs,
            landingBufferMs,
        }: RoundShufflePayload) => {
            setGameTypeState(gt);
            setCurrentRound(roundNumber);
            setTotalRounds(nextTotalRounds);
            setGameStartTime(null);
            setMatchOver(false);
            setPhase("shuffling");
            setShuffleState({
                gameType: gt,
                roundNumber,
                totalRounds: nextTotalRounds,
                durationMs,
                landingBufferMs,
            });
        },
        [],
    );

    const onPlayerProgress = useCallback((snap: ProgressSnapshot) => {
        setProgress((prev) => new Map(prev).set(snap.playerId, snap));
    }, []);

    const onBowmanProgress = useCallback((snap: BowmanProgressSnapshot) => {
        setBowmanProg((prev) => new Map(prev).set(snap.playerId, snap));
    }, []);

    const onCodebreakerProgress = useCallback(
        (snap: CodebreakerProgressSnapshot) => {
            setCodebreakerProg((prev) =>
                new Map(prev).set(snap.playerId, snap),
            );
        },
        [],
    );

    const onLightsOutProgress = useCallback(
        (snap: LightsOutProgressSnapshot) => {
            setLightsOutProg((prev) => new Map(prev).set(snap.playerId, snap));
        },
        [],
    );

    const onPipeConnectProgress = useCallback(
        (snap: PipeConnectProgressSnapshot) => {
            setPipeConnectProg((prev) =>
                new Map(prev).set(snap.playerId, snap),
            );
        },
        [],
    );

    const onSimonCopyProgress = useCallback(
        (snap: SimonCopyProgressSnapshot) => {
            setSimonCopyProg((prev) => new Map(prev).set(snap.playerId, snap));
        },
        [],
    );

    const onMemorySequencePlusProgress = useCallback(
        (snap: MemorySequencePlusProgressSnapshot) => {
            setMemorySequencePlusProg((prev) =>
                new Map(prev).set(snap.playerId, snap),
            );
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
            roundNumber,
            totalRounds: nextTotalRounds,
            matchOver: isMatchOver,
            standings: nextStandings,
        }: {
            results: never;
            gameType: GameType;
            roundNumber: number;
            totalRounds: number;
            matchOver: boolean;
            standings: MatchStanding[];
        }) => {
            setShuffleState(null);
            setPhase("results");
            setGameTypeState(gt);
            setCurrentRound(roundNumber);
            setTotalRounds(nextTotalRounds);
            setMatchOver(isMatchOver);
            setStandings(nextStandings);
            if (gt === "bowman") setBowmanResults(r);
            else if (gt === "codebreaker") setCodebreakerResults(r);
            else if (gt === "lightsout") setLightsOutResults(r);
            else if (gt === "pipeconnect") setPipeConnectResults(r);
            else if (gt === "simoncopy") setSimonCopyResults(r);
            else if (gt === "memorysequenceplus") {
                setMemorySequencePlusResults(r);
            } else if (gt === "rushhour") setRushHourResults(r);
            else setResults(r);
            setGameStartTime(null);
        },
        [],
    );

    const onGameReset = useCallback(() => {
        setPhase("lobby");
        setCurrentRound(0);
        setMatchOver(false);
        setShuffleState(null);
        setStandings([]);
        setProgress(new Map());
        setBowmanProg(new Map());
        setCodebreakerProg(new Map());
        setLightsOutProg(new Map());
        setPipeConnectProg(new Map());
        setSimonCopyProg(new Map());
        setMemorySequencePlusProg(new Map());
        setRushHourProg(new Map());
        setResults([]);
        setBowmanResults([]);
        setCodebreakerResults([]);
        setLightsOutResults([]);
        setPipeConnectResults([]);
        setSimonCopyResults([]);
        setMemorySequencePlusResults([]);
        setRushHourResults([]);
        setGameStartTime(null);
    }, []);

    useSocket("room:updated", onRoomUpdated as never);
    useSocket("room:settings", onRoomSettings as never);
    useSocket("round:shuffle", onRoundShuffle as never);
    useSocket("game:started", onGameStarted as never);
    useSocket("player:progress", onPlayerProgress as never);
    useSocket("bowman:progress", onBowmanProgress as never);
    useSocket("codebreaker:progress", onCodebreakerProgress as never);
    useSocket("lightsout:progress", onLightsOutProgress as never);
    useSocket("pipeconnect:progress", onPipeConnectProgress as never);
    useSocket("simoncopy:progress", onSimonCopyProgress as never);
    useSocket(
        "memorysequenceplus:progress",
        onMemorySequencePlusProgress as never,
    );
    useSocket("rushhour:progress", onRushHourProgress as never);
    useSocket("game:over", onGameOver as never);
    useSocket("game:reset", onGameReset as never);

    function updateTotalRounds(value: number) {
        const nextValue = Math.min(
            MAX_TOTAL_ROUNDS,
            Math.max(MIN_TOTAL_ROUNDS, Math.round(value)),
        );
        setTotalRounds(nextValue);
        socket.emit("host:setTotalRounds", { totalRounds: nextValue });
    }

    function startGame() {
        socket.emit("host:start");
    }
    function nextRound() {
        socket.emit("host:nextRound");
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
                    {currentRound > 0 && (
                        <span className={styles.roundBadge}>
                            Round {currentRound}/{totalRounds}
                        </span>
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

                        <div className={styles.configCard}>
                            <div className={styles.configTitle}>
                                Match Setup
                            </div>
                            <div className={styles.configRow}>
                                <label
                                    htmlFor="round-count"
                                    className={styles.configLabel}
                                >
                                    Random rounds
                                </label>
                                <input
                                    id="round-count"
                                    type="number"
                                    min={MIN_TOTAL_ROUNDS}
                                    max={MAX_TOTAL_ROUNDS}
                                    value={totalRounds}
                                    className={styles.roundInput}
                                    onChange={(event) =>
                                        updateTotalRounds(
                                            Number(event.target.value),
                                        )
                                    }
                                />
                            </div>
                            <div className={styles.configHint}>
                                Each match deals a random mini game every round.
                            </div>
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
                            <div>
                                <div className={styles.roundHeading}>
                                    Round {currentRound}/{totalRounds}
                                </div>
                                <div className={styles.roundGame}>
                                    {formatGameLabel(gameType)}
                                </div>
                            </div>
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
                                ) : gameType === "codebreaker" ? (
                                    <CodebreakerPlayerCard
                                        key={p.id}
                                        name={p.name}
                                        snapshot={
                                            codebreakerProg.get(p.id) ?? null
                                        }
                                    />
                                ) : gameType === "lightsout" ? (
                                    <LightsOutPlayerCard
                                        key={p.id}
                                        name={p.name}
                                        snapshot={
                                            lightsOutProg.get(p.id) ?? null
                                        }
                                    />
                                ) : gameType === "pipeconnect" ? (
                                    <PipeConnectPlayerCard
                                        key={p.id}
                                        name={p.name}
                                        snapshot={
                                            pipeConnectProg.get(p.id) ?? null
                                        }
                                    />
                                ) : gameType === "simoncopy" ? (
                                    <SimonCopyPlayerCard
                                        key={p.id}
                                        name={p.name}
                                        snapshot={
                                            simonCopyProg.get(p.id) ?? null
                                        }
                                    />
                                ) : gameType === "memorysequenceplus" ? (
                                    <MemorySequencePlusPlayerCard
                                        key={p.id}
                                        name={p.name}
                                        snapshot={
                                            memorySequencePlusProg.get(p.id) ??
                                            null
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

                {phase === "shuffling" && shuffleState && (
                    <RoundShuffleOverlay
                        gameType={shuffleState.gameType}
                        roundNumber={shuffleState.roundNumber}
                        totalRounds={shuffleState.totalRounds}
                        durationMs={shuffleState.durationMs}
                        landingBufferMs={shuffleState.landingBufferMs}
                        title="Shuffling the next mini game"
                        subtitle="The reel is spinning through every challenge and locking in this round’s pick."
                    />
                )}

                {/* ── Results ─────────────────────────────────────── */}
                {phase === "results" && (
                    <div className={styles.results}>
                        <div className={styles.resultsTitle}>
                            {matchOver
                                ? "🏆 Final Standings"
                                : `✅ Round ${currentRound} Complete`}
                        </div>
                        <div className={styles.resultsSubtitle}>
                            {formatGameLabel(gameType)} · {currentRound}/
                            {totalRounds} rounds
                        </div>

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
                        ) : gameType === "codebreaker" ? (
                            <div className={styles.bowmanResults}>
                                {codebreakerResults.map((r) => (
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
                                            {r.solved
                                                ? `${r.attempts} guesses`
                                                : `${r.attempts} used`}
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
                        ) : gameType === "pipeconnect" ? (
                            <div className={styles.bowmanResults}>
                                {pipeConnectResults.map((r) => (
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
                                                ? `${r.moves} turns`
                                                : "DNF"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : gameType === "simoncopy" ? (
                            <div className={styles.bowmanResults}>
                                {simonCopyResults.map((r) => (
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
                                            {r.solved
                                                ? `Round ${r.roundReached}`
                                                : `Out at ${r.roundReached}`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : gameType === "memorysequenceplus" ? (
                            <div className={styles.bowmanResults}>
                                {memorySequencePlusResults.map((r) => (
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
                                            {r.solved
                                                ? `Round ${r.roundReached}`
                                                : `Out at ${r.roundReached}`}
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

                        <div className={styles.standingsCard}>
                            <div className={styles.standingsTitle}>
                                {matchOver
                                    ? "Overall leaderboard"
                                    : "Match standings so far"}
                            </div>
                            <div className={styles.standingsList}>
                                {standings.map((standing) => (
                                    <div
                                        key={standing.id}
                                        className={styles.standingRow}
                                    >
                                        <span
                                            className={styles.standingPosition}
                                        >
                                            {standing.position <= 3
                                                ? MEDALS[standing.position - 1]
                                                : `#${standing.position}`}
                                        </span>
                                        <span className={styles.standingName}>
                                            {standing.name}
                                        </span>
                                        <span className={styles.standingDelta}>
                                            +{standing.lastRoundPoints} pts
                                        </span>
                                        <span className={styles.standingScore}>
                                            {standing.totalPoints} total
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            type="button"
                            className={styles.resetBtn}
                            onClick={matchOver ? resetGame : nextRound}
                        >
                            {matchOver
                                ? "Play Again"
                                : `Start Round ${currentRound + 1}`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
