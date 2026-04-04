import { useState, useCallback, useEffect } from "react";
import { ConnectionNotice } from "../components/ConnectionNotice";
import { useConnectionNotice } from "../hooks/useConnectionNotice";
import { socket } from "../socket";
import { useSocket } from "../hooks/useSocket";
import { useTimer, formatTime } from "../hooks/useTimer";
import { formatGameLabel } from "../gameMeta";
import { PlayerCard } from "../components/PlayerCard";
import { BowmanPlayerCard } from "../components/BowmanPlayerCard";
import { CodebreakerPlayerCard } from "../components/CodebreakerPlayerCard";
import { LightsOutPlayerCard } from "../components/LightsOutPlayerCard";
import { MathSprintPlayerCard } from "../components/MathSprintPlayerCard";
import { MemorySequencePlusPlayerCard } from "../components/MemorySequencePlusPlayerCard";
import { OddOneOutPlayerCard } from "../components/OddOneOutPlayerCard";
import { PairMatchPlayerCard } from "../components/PairMatchPlayerCard";
import { ReactionTapPlayerCard } from "../components/ReactionTapPlayerCard";
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
    GameOverPayload,
    LightsOutProgressSnapshot,
    LightsOutResult,
    MathSprintProgressSnapshot,
    MathSprintResult,
    MemorySequencePlusProgressSnapshot,
    MemorySequencePlusResult,
    OddOneOutProgressSnapshot,
    OddOneOutResult,
    PairMatchProgressSnapshot,
    PairMatchResult,
    ReactionTapProgressSnapshot,
    ReactionTapResult,
    PipeConnectProgressSnapshot,
    PipeConnectResult,
    RoundReadyStatusPayload,
    RoundShufflePayload,
    RushHourProgressSnapshot,
    RushHourResult,
    SimonCopyProgressSnapshot,
    SimonCopyResult,
    TeamTugStateSnapshot,
    TeamTugTeamResult,
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
const MIN_PLAYERS_TO_START = 1;

interface ShuffleState {
    gameType: GameType;
    availableGameTypes: GameType[];
    roundNumber: number;
    totalRounds: number;
    durationMs: number;
    landingBufferMs: number;
}

interface ShuffleReadyState {
    readyCount: number;
    readyTarget: number;
    readyThresholdMet: boolean;
}

function getTopName<T extends { name: string; rank: number | null }>(
    entries: T[],
): string | null {
    return (
        entries.find((entry) => entry.rank === 1)?.name ??
        entries.find((entry) => entry.rank !== null)?.name ??
        null
    );
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
    const [mathSprintProg, setMathSprintProg] = useState<
        Map<string, MathSprintProgressSnapshot>
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
    const [oddOneOutProg, setOddOneOutProg] = useState<
        Map<string, OddOneOutProgressSnapshot>
    >(new Map());
    const [pairMatchProg, setPairMatchProg] = useState<
        Map<string, PairMatchProgressSnapshot>
    >(new Map());
    const [reactionTapProg, setReactionTapProg] = useState<
        Map<string, ReactionTapProgressSnapshot>
    >(new Map());
    const [results, setResults] = useState<Result[]>([]);
    const [bowmanResults, setBowmanResults] = useState<BowmanResult[]>([]);
    const [codebreakerResults, setCodebreakerResults] = useState<
        CodebreakerResult[]
    >([]);
    const [lightsOutResults, setLightsOutResults] = useState<LightsOutResult[]>(
        [],
    );
    const [mathSprintResults, setMathSprintResults] = useState<MathSprintResult[]>(
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
    const [oddOneOutResults, setOddOneOutResults] = useState<OddOneOutResult[]>(
        [],
    );
    const [pairMatchResults, setPairMatchResults] = useState<PairMatchResult[]>(
        [],
    );
    const [reactionTapResults, setReactionTapResults] = useState<
        ReactionTapResult[]
    >([]);
    const [rushHourProg, setRushHourProg] = useState<
        Map<string, RushHourProgressSnapshot>
    >(new Map());
    const [rushHourResults, setRushHourResults] = useState<RushHourResult[]>(
        [],
    );
    const [teamTugState, setTeamTugState] =
        useState<TeamTugStateSnapshot | null>(null);
    const [teamTugResults, setTeamTugResults] = useState<TeamTugTeamResult[]>([]);
    const [gameStartTime, setGameStartTime] = useState<number | null>(null);
    const [mathSprintDurationMs, setMathSprintDurationMs] = useState<number | null>(
        null,
    );
    const [shuffleState, setShuffleState] = useState<ShuffleState | null>(null);
    const [shuffleReadyState, setShuffleReadyState] =
        useState<ShuffleReadyState | null>(null);
    const [resultsAutoAdvanceAt, setResultsAutoAdvanceAt] = useState<
        number | null
    >(null);
    const [resultsCountdownNow, setResultsCountdownNow] = useState(() =>
        Date.now(),
    );
    const now = useTimer(gameStartTime);
    const { notice, dismissNotice, retryConnection } = useConnectionNotice({
        role: "host",
    });
    const playerCount = players.length;
    const canStart = playerCount >= MIN_PLAYERS_TO_START;
    const playersNeeded = Math.max(MIN_PLAYERS_TO_START - playerCount, 0);
    const recentWinnerName =
        gameType === "bowman"
            ? getTopName(bowmanResults)
            : gameType === "codebreaker"
              ? getTopName(codebreakerResults)
              : gameType === "mathsprint"
                ? getTopName(mathSprintResults)
              : gameType === "lightsout"
                ? getTopName(lightsOutResults)
                : gameType === "pipeconnect"
                  ? getTopName(pipeConnectResults)
                  : gameType === "simoncopy"
                    ? getTopName(simonCopyResults)
                    : gameType === "memorysequenceplus"
                      ? getTopName(memorySequencePlusResults)
                      : gameType === "oddoneout"
                        ? getTopName(oddOneOutResults)
                       : gameType === "pairmatch"
                         ? getTopName(pairMatchResults)
                         : gameType === "reactiontap"
                           ? getTopName(reactionTapResults)
                       : gameType === "rushhour"
                         ? getTopName(rushHourResults)
                         : gameType === "teamtug"
                           ? getTopName(teamTugResults)
                           : getTopName(results);
    const leaderName =
        standings.find((standing) => standing.position === 1)?.name ?? null;
    const resultsCountdownSeconds =
        resultsAutoAdvanceAt === null
            ? null
            : Math.max(
                  0,
                  Math.ceil(
                      (resultsAutoAdvanceAt - resultsCountdownNow) / 1000,
                   ),
               );
    const timerLabel =
        gameType === "mathsprint" && phase === "playing"
            ? formatTime(Math.max((mathSprintDurationMs ?? 0) - now, 0))
            : gameType === "teamtug" && phase === "playing"
              ? `${Math.max(((teamTugState?.timeLimitMs ?? 0) - now) / 1000, 0).toFixed(1)}s`
              : formatTime(now);
    useEffect(() => {
        if (phase !== "results" || resultsAutoAdvanceAt === null || matchOver) {
            return;
        }

        const intervalId = setInterval(() => {
            setResultsCountdownNow(Date.now());
        }, 250);

        return () => {
            clearInterval(intervalId);
        };
    }, [matchOver, phase, resultsAutoAdvanceAt]);

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
            durationMs,
            teamTugState: nextTeamTugState,
        }: {
            gameType: GameType;
            roundNumber: number;
            totalRounds: number;
            durationMs?: number;
            teamTugState?: TeamTugStateSnapshot | null;
        }) => {
            setShuffleState(null);
            setResultsAutoAdvanceAt(null);
            setGameTypeState(gt);
            setCurrentRound(roundNumber);
            setTotalRounds(nextTotalRounds);
            setMatchOver(false);
            setPhase("playing");
            setShuffleReadyState(null);
            setProgress(new Map());
            setBowmanProg(new Map());
            setCodebreakerProg(new Map());
            setLightsOutProg(new Map());
            setMathSprintProg(new Map());
            setPipeConnectProg(new Map());
            setSimonCopyProg(new Map());
            setMemorySequencePlusProg(new Map());
            setOddOneOutProg(new Map());
            setPairMatchProg(new Map());
            setReactionTapProg(new Map());
            setRushHourProg(new Map());
            setTeamTugState(gt === "teamtug" ? nextTeamTugState ?? null : null);
            setTeamTugResults([]);
            setMathSprintDurationMs(
                gt === "mathsprint" ? durationMs ?? null : null,
            );
            setGameStartTime(Date.now());
        },
        [],
    );

    const onRoundShuffle = useCallback(
        ({
            gameType: gt,
            availableGameTypes,
            roundNumber,
            totalRounds: nextTotalRounds,
            durationMs,
            landingBufferMs,
        }: RoundShufflePayload) => {
            setGameTypeState(gt);
            setCurrentRound(roundNumber);
            setTotalRounds(nextTotalRounds);
            setGameStartTime(null);
            setMathSprintDurationMs(null);
            setMatchOver(false);
            setPhase("shuffling");
            setResultsAutoAdvanceAt(null);
            setShuffleState({
                gameType: gt,
                availableGameTypes,
                roundNumber,
                totalRounds: nextTotalRounds,
                durationMs,
                landingBufferMs,
            });
            setShuffleReadyState({
                readyCount: 0,
                readyTarget: 1,
                readyThresholdMet: false,
            });
        },
        [],
    );

    const onRoundReadyStatus = useCallback(
        ({
            readyCount,
            readyTarget,
            readyThresholdMet,
        }: RoundReadyStatusPayload) => {
            setShuffleReadyState({
                readyCount,
                readyTarget,
                readyThresholdMet,
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

    const onMathSprintProgress = useCallback(
        (snap: MathSprintProgressSnapshot) => {
            setMathSprintProg((prev) => new Map(prev).set(snap.playerId, snap));
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

    const onOddOneOutProgress = useCallback(
        (snap: OddOneOutProgressSnapshot) => {
            setOddOneOutProg((prev) => new Map(prev).set(snap.playerId, snap));
        },
        [],
    );

    const onRushHourProgress = useCallback((snap: RushHourProgressSnapshot) => {
        setRushHourProg((prev) => new Map(prev).set(snap.playerId, snap));
    }, []);

    const onTeamTugUpdate = useCallback((snap: TeamTugStateSnapshot) => {
        setTeamTugState(snap);
    }, []);

    const onPairMatchProgress = useCallback((snap: PairMatchProgressSnapshot) => {
        setPairMatchProg((prev) => new Map(prev).set(snap.playerId, snap));
    }, []);

    const onReactionTapProgress = useCallback(
        (snap: ReactionTapProgressSnapshot) => {
            setReactionTapProg((prev) => new Map(prev).set(snap.playerId, snap));
        },
        [],
    );

    const onGameOver = useCallback(
        ({
            results: r,
            gameType: gt,
            roundNumber,
            totalRounds: nextTotalRounds,
            matchOver: isMatchOver,
            standings: nextStandings,
            autoAdvanceAt,
        }: GameOverPayload<never>) => {
            setShuffleState(null);
            setPhase("results");
            setGameTypeState(gt);
            setCurrentRound(roundNumber);
            setTotalRounds(nextTotalRounds);
            setMatchOver(isMatchOver);
            setStandings(nextStandings);
            setResultsAutoAdvanceAt(autoAdvanceAt);
            setResultsCountdownNow(Date.now());
            setMathSprintDurationMs(null);
            if (gt === "bowman") setBowmanResults(r);
            else if (gt === "codebreaker") setCodebreakerResults(r);
            else if (gt === "mathsprint") setMathSprintResults(r);
            else if (gt === "lightsout") setLightsOutResults(r);
            else if (gt === "pipeconnect") setPipeConnectResults(r);
            else if (gt === "simoncopy") setSimonCopyResults(r);
            else if (gt === "memorysequenceplus") {
                setMemorySequencePlusResults(r);
            } else if (gt === "oddoneout") {
                setOddOneOutResults(r);
            } else if (gt === "pairmatch") {
                setPairMatchResults(r);
            } else if (gt === "reactiontap") {
                setReactionTapResults(r);
            } else if (gt === "rushhour") setRushHourResults(r);
            else if (gt === "teamtug") setTeamTugResults(r);
            else setResults(r);
            setGameStartTime(null);
        },
        [],
    );

    const onGameReset = useCallback(() => {
        setPhase("lobby");
        setCurrentRound(0);
        setMatchOver(false);
        setResultsAutoAdvanceAt(null);
        setShuffleState(null);
        setShuffleReadyState(null);
        setStandings([]);
        setProgress(new Map());
        setBowmanProg(new Map());
        setCodebreakerProg(new Map());
        setLightsOutProg(new Map());
        setOddOneOutProg(new Map());
        setPipeConnectProg(new Map());
        setSimonCopyProg(new Map());
        setMemorySequencePlusProg(new Map());
        setPairMatchProg(new Map());
        setReactionTapProg(new Map());
        setRushHourProg(new Map());
        setMathSprintProg(new Map());
        setTeamTugState(null);
        setTeamTugResults([]);
        setResults([]);
        setBowmanResults([]);
        setCodebreakerResults([]);
        setMathSprintResults([]);
        setLightsOutResults([]);
        setOddOneOutResults([]);
        setPipeConnectResults([]);
        setSimonCopyResults([]);
        setMemorySequencePlusResults([]);
        setPairMatchResults([]);
        setReactionTapResults([]);
        setRushHourResults([]);
        setMathSprintDurationMs(null);
        setGameStartTime(null);
    }, []);

    useSocket("room:updated", onRoomUpdated as never);
    useSocket("room:settings", onRoomSettings as never);
    useSocket("round:shuffle", onRoundShuffle as never);
    useSocket("round:readyStatus", onRoundReadyStatus as never);
    useSocket("game:started", onGameStarted as never);
    useSocket("player:progress", onPlayerProgress as never);
    useSocket("bowman:progress", onBowmanProgress as never);
    useSocket("codebreaker:progress", onCodebreakerProgress as never);
    useSocket("lightsout:progress", onLightsOutProgress as never);
    useSocket("mathsprint:progress", onMathSprintProgress as never);
    useSocket("oddoneout:progress", onOddOneOutProgress as never);
    useSocket("pipeconnect:progress", onPipeConnectProgress as never);
    useSocket("simoncopy:progress", onSimonCopyProgress as never);
    useSocket(
        "memorysequenceplus:progress",
        onMemorySequencePlusProgress as never,
    );
    useSocket("pairmatch:progress", onPairMatchProgress as never);
    useSocket("reactiontap:progress", onReactionTapProgress as never);
    useSocket("rushhour:progress", onRushHourProgress as never);
    useSocket("teamtug:update", onTeamTugUpdate as never);
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

    function renderReactionTapCard(playerId: string, name: string) {
        return (
            <ReactionTapPlayerCard
                key={playerId}
                name={name}
                snapshot={reactionTapProg.get(playerId) ?? null}
            />
        );
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
                {notice && (
                    <ConnectionNotice
                        tone={notice.tone}
                        title={notice.title}
                        message={notice.message}
                        actionLabel="Refresh"
                        onAction={retryConnection}
                        onDismiss={dismissNotice}
                    />
                )}
                {/* ── Lobby ───────────────────────────────────────── */}
                {phase === "lobby" && (
                    <div className={styles.lobby}>
                        <div className={styles.lobbyHero}>
                            <div className={styles.lobbyEyebrow}>
                                Shared screen lobby
                            </div>
                            <div className={styles.lobbyTitle}>
                                {canStart
                                    ? "Room is ready to start"
                                    : playerCount === 0
                                      ? "Waiting for players"
                                      : "Almost ready"}
                            </div>
                            <div className={styles.roomCodeBig}>{roomCode}</div>
                            <div className={styles.lobbyHint}>
                                Players join on their phones with this 4-letter
                                code.
                            </div>
                            <div className={styles.statusRow}>
                                <div className={styles.playerCountBadge}>
                                    {playerCount} player
                                    {playerCount === 1 ? "" : "s"} joined
                                </div>
                                <div
                                    className={`${styles.readinessBadge} ${canStart ? styles.ready : styles.waiting}`}
                                >
                                    {canStart
                                        ? "Ready to start"
                                        : `${playersNeeded} more ${playersNeeded === 1 ? "player" : "players"} needed`}
                                </div>
                            </div>
                        </div>

                        <div
                            className={`${styles.readinessPanel} ${canStart ? styles.readinessPanelReady : styles.readinessPanelWaiting}`}
                        >
                            <div className={styles.readinessTitle}>
                                {canStart
                                    ? "Everyone’s in — kick off the match when ready."
                                    : playerCount === 0
                                      ? "No players yet — keep the room code visible so phones can join."
                                      : "A few more players and you’re good to go."}
                            </div>
                            <div className={styles.readinessText}>
                                {canStart
                                    ? `Starting now will deal ${totalRounds} random mini-games across the match.`
                                    : `Need at least ${MIN_PLAYERS_TO_START} ${MIN_PLAYERS_TO_START === 1 ? "player" : "players"} to start. Current lobby: ${playerCount}.`}
                            </div>
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
                            {playerCount === 0 ? (
                                <div className={styles.noPlayers}>
                                    No players yet — waiting for the first phone
                                    to join.
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
                            disabled={!canStart}
                        >
                            {canStart
                                ? "Start Game →"
                                : `Need ${MIN_PLAYERS_TO_START} ${MIN_PLAYERS_TO_START === 1 ? "Player" : "Players"}`}
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
                                {timerLabel}
                            </div>
                            <button
                                type="button"
                                className={styles.endBtn}
                                onClick={endRound}
                            >
                                End Round
                            </button>
                        </div>
                        {gameType === "teamtug" && teamTugState ? (
                            <div className={styles.tugLayout}>
                                <div className={styles.tugArena}>
                                    <div className={styles.tugArenaHeader}>
                                        <div>
                                            <div className={styles.tugEyebrow}>
                                                Shared bar
                                            </div>
                                            <div className={styles.tugTitle}>
                                                Team Tug of War
                                            </div>
                                        </div>
                                        <div className={styles.tugLead}>
                                            {teamTugState.markerPosition === 0
                                                ? "Dead even"
                                                : `${teamTugState.markerPosition < 0 ? teamTugState.teams[0]?.name : teamTugState.teams[1]?.name} leading`}
                                        </div>
                                    </div>
                                    <div className={styles.tugTrack}>
                                        <div className={styles.tugFinishLeft} />
                                        <div className={styles.tugFinishRight} />
                                        <div className={styles.tugCenterLine} />
                                        <div
                                            className={styles.tugMarker}
                                            style={{
                                                left: `${((teamTugState.markerPosition + teamTugState.finishLine) / (teamTugState.finishLine * 2)) * 100}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className={styles.tugTeams}>
                                    {teamTugState.teams.map((team) => (
                                        <div key={team.id} className={styles.tugTeamCard}>
                                            <div className={styles.tugTeamHeader}>
                                                <span className={styles.tugTeamName}>
                                                    {team.name}
                                                </span>
                                                <span className={styles.tugTeamScore}>
                                                    {team.totalPulls} pulls
                                                </span>
                                            </div>
                                            <div className={styles.tugMemberList}>
                                                {team.members.map((member) => (
                                                    <div key={member.sessionId} className={styles.tugMemberRow}>
                                                        <span>{member.name}</span>
                                                        <span>{member.contribution}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
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
                                    ) : gameType === "mathsprint" ? (
                                        <MathSprintPlayerCard
                                            key={p.id}
                                            name={p.name}
                                            snapshot={mathSprintProg.get(p.id) ?? null}
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
                                    ) : gameType === "oddoneout" ? (
                                        <OddOneOutPlayerCard
                                            key={p.id}
                                            name={p.name}
                                            snapshot={oddOneOutProg.get(p.id) ?? null}
                                        />
                                    ) : gameType === "pairmatch" ? (
                                        <PairMatchPlayerCard
                                            key={p.id}
                                            name={p.name}
                                            snapshot={pairMatchProg.get(p.id) ?? null}
                                        />
                                    ) : gameType === "reactiontap" ? (
                                        renderReactionTapCard(p.id, p.name)
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
                        )}
                    </>
                )}

                {phase === "shuffling" && shuffleState && (
                    <RoundShuffleOverlay
                        key={`${shuffleState.roundNumber}-${shuffleState.gameType}`}
                        gameType={shuffleState.gameType}
                        availableGameTypes={shuffleState.availableGameTypes}
                        roundNumber={shuffleState.roundNumber}
                        totalRounds={shuffleState.totalRounds}
                        durationMs={shuffleState.durationMs}
                        landingBufferMs={shuffleState.landingBufferMs}
                        title="Shuffling the next mini game"
                        subtitle="The reel is spinning through every challenge and locking in this round’s pick."
                        readyCount={shuffleReadyState?.readyCount ?? 0}
                        readyTarget={shuffleReadyState?.readyTarget ?? 1}
                        readyThresholdMet={
                            shuffleReadyState?.readyThresholdMet ?? false
                        }
                        recentWinnerName={recentWinnerName}
                        leaderName={leaderName}
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
                        {!matchOver && resultsCountdownSeconds !== null && (
                            <div className={styles.resultsCountdown}>
                                Auto starting Round {currentRound + 1} in{" "}
                                {resultsCountdownSeconds}s
                            </div>
                        )}

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
                        ) : gameType === "teamtug" ? (
                            <div className={styles.bowmanResults}>
                                {teamTugResults.map((team) => (
                                    <div
                                        key={team.id}
                                        className={styles.tugResultCard}
                                    >
                                        <div className={styles.tugTeamHeader}>
                                            <span
                                                className={styles.bowmanResultRank}
                                            >
                                                {team.rank <= 3
                                                    ? MEDALS[team.rank - 1]
                                                    : `#${team.rank}`}
                                            </span>
                                            <span
                                                className={styles.bowmanResultName}
                                            >
                                                {team.name} Team
                                            </span>
                                            <span
                                                className={styles.bowmanResultScore}
                                            >
                                                {team.pulls} pulls
                                            </span>
                                        </div>
                                        <div className={styles.tugMemberList}>
                                            {team.members.map((member) => (
                                                <div
                                                    key={member.sessionId}
                                                    className={styles.tugMemberRow}
                                                >
                                                    <span>{member.name}</span>
                                                    <span>
                                                        {member.contribution}{" "}
                                                        pulls
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : gameType === "mathsprint" ? (
                            <div className={styles.bowmanResults}>
                                {mathSprintResults.map((r) => (
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
                                            {r.score} pts · {r.answeredCount} answered
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
                        ) : gameType === "oddoneout" ? (
                            <div className={styles.bowmanResults}>
                                {oddOneOutResults.map((r) => (
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
                                            {r.score} pts · {r.promptsCleared}/
                                            {r.totalPrompts} ·{" "}
                                            {formatTime(r.totalResponseTime)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : gameType === "pairmatch" ? (
                            <div className={styles.bowmanResults}>
                                {pairMatchResults.map((r) => (
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
                                                ? `${r.attempts} tries`
                                                : `${r.pairsFound}/${r.totalPairs} pairs`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : gameType === "reactiontap" ? (
                            <div className={styles.bowmanResults}>
                                {reactionTapResults.map((r) => (
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
                                            {r.score} pts · {r.successfulPrompts}/
                                            {r.goPrompts} hits
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
                                : `Start Round ${currentRound + 1} Now`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
