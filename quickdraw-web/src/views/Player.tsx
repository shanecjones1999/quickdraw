import { useState, useCallback, useEffect } from "react";
import { socket } from "../socket";
import { useSocket } from "../hooks/useSocket";
import { useTimer, formatTime } from "../hooks/useTimer";
import { useCellSize } from "../hooks/useCellSize";
import { ConnectionNotice } from "../components/ConnectionNotice";
import { formatGameLabel } from "../gameMeta";
import { useConnectionNotice } from "../hooks/useConnectionNotice";
import { KlotskiBoard } from "../components/KlotskiBoard";
import { RoundShuffleOverlay } from "../components/RoundShuffleOverlay";
import { BowmanPlayer } from "./BowmanPlayer";
import { CodebreakerPlayer } from "./CodebreakerPlayer";
import { LightsOutPlayer } from "./LightsOutPlayer";
import { MathSprintPlayer } from "./MathSprintPlayer";
import { MemorySequencePlusPlayer } from "./MemorySequencePlusPlayer";
import { PairMatchPlayer } from "./PairMatchPlayer";
import { ReactionTapPlayer } from "./ReactionTapPlayer";
import { OddOneOutPlayer } from "./OddOneOutPlayer";
import { PipeConnectPlayer } from "./PipeConnectPlayer";
import { RushHourPlayer } from "./RushHourPlayer";
import { SimonCopyPlayer } from "./SimonCopyPlayer";
import { TeamTugPlayer } from "./TeamTugPlayer";
import type {
    BowmanResult,
    CodebreakerResult,
    CodebreakerConfig,
    GameOverPayload,
    LightsOutResult,
    MatchStanding,
    MathSprintConfig,
    MathSprintQuestion,
    MathSprintResult,
    MemorySequencePlusConfig,
    MemorySequencePlusResult,
    PairMatchResult,
    PairMatchTile,
    ReactionTapConfig,
    ReactionTapResult,
    OddOneOutConfig,
    OddOneOutPrompt,
    OddOneOutResult,
    Piece,
    PipeConnectResult,
    PipeConnectTile,
    RoundReadyStatusPayload,
    RushHourResult,
    SimonCopyConfig,
    SimonCopyResult,
    Direction,
    Result,
    GameType,
    RoundShufflePayload,
    RushHourVehicle,
    TeamTugStateSnapshot,
    TeamTugTeamResult,
} from "../types";
import styles from "../styles/Player.module.css";

type Phase = "waiting" | "shuffling" | "playing" | "solved" | "results";
type RoundResult =
    | Result
    | BowmanResult
    | CodebreakerResult
    | MathSprintResult
    | LightsOutResult
    | PipeConnectResult
    | SimonCopyResult
    | MemorySequencePlusResult
    | PairMatchResult
    | OddOneOutResult
    | ReactionTapResult
    | RushHourResult;

function describeRoundResult(result: RoundResult, gameType: GameType): string {
    if (gameType === "bowman") {
        return `${(result as BowmanResult).totalScore} pts`;
    }
    if (gameType === "codebreaker") {
        const entry = result as CodebreakerResult;
        return entry.solved
            ? `${entry.attempts} guesses`
            : `${entry.attempts} used`;
    }
    if (gameType === "mathsprint") {
        const entry = result as MathSprintResult;
        return `${entry.score} pts · ${entry.answeredCount} answered`;
    }
    if (gameType === "lightsout") {
        const entry = result as LightsOutResult;
        return entry.moves !== null ? `${entry.moves} taps` : "DNF";
    }
    if (gameType === "pipeconnect") {
        const entry = result as PipeConnectResult;
        return entry.moves !== null ? `${entry.moves} turns` : "DNF";
    }
    if (gameType === "simoncopy") {
        const entry = result as SimonCopyResult;
        return entry.solved
            ? `Round ${entry.roundReached}`
            : `Out at ${entry.roundReached}`;
    }
    if (gameType === "memorysequenceplus") {
        const entry = result as MemorySequencePlusResult;
        return entry.solved
            ? `Round ${entry.roundReached}`
            : `Out at ${entry.roundReached}`;
    }
    if (gameType === "oddoneout") {
        const entry = result as OddOneOutResult;
        return `${entry.score} pts · ${formatTime(entry.totalResponseTime)}`;
    }
    if (gameType === "pairmatch") {
        const entry = result as PairMatchResult;
        return entry.solved
            ? `${entry.attempts} attempts`
            : `${entry.pairsFound}/${entry.totalPairs} pairs`;
    }
    if (gameType === "reactiontap") {
        const entry = result as ReactionTapResult;
        return `${entry.score} pts · ${entry.successfulPrompts}/${entry.goPrompts} hits · ${entry.penalties} pen`;
    }
    if (gameType === "rushhour") {
        const entry = result as RushHourResult;
        return entry.moves !== null ? `${entry.moves} moves` : "DNF";
    }

    const entry = result as Result;
    return entry.solveTime !== null ? formatTime(entry.solveTime) : "DNF";
}

interface Props {
    roomCode: string;
    playerName: string;
    playerSessionId: string;
    resumeSession?: boolean;
}

interface ShuffleState {
    gameType: GameType;
    roundNumber: number;
    totalRounds: number;
    durationMs: number;
    landingBufferMs: number;
}

interface ShuffleReadyState {
    readyCount: number;
    readyTarget: number;
    readyThresholdMet: boolean;
    playerReady: boolean;
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

export function Player({
    roomCode,
    playerName,
    playerSessionId,
    resumeSession = false,
}: Props) {
    const [gameType, setGameType] = useState<GameType>("klotski");
    const [phase, setPhase] = useState<Phase>("waiting");
    const [playerCount, setPlayerCount] = useState<number | null>(null);
    const [totalRounds, setTotalRounds] = useState(5);
    const [currentRound, setCurrentRound] = useState(0);
    const [matchOver, setMatchOver] = useState(false);
    const [standings, setStandings] = useState<MatchStanding[]>([]);
    const [viewKey, setViewKey] = useState("waiting");
    const [bowmanWind, setBowmanWind] = useState(0);
    const [codebreakerConfig, setCodebreakerConfig] =
        useState<CodebreakerConfig | null>(null);
    const [mathSprintConfig, setMathSprintConfig] =
        useState<MathSprintConfig | null>(null);
    const [simonCopyConfig, setSimonCopyConfig] =
        useState<SimonCopyConfig | null>(null);
    const [memorySequencePlusConfig, setMemorySequencePlusConfig] =
        useState<MemorySequencePlusConfig | null>(null);
    const [oddOneOutConfig, setOddOneOutConfig] =
        useState<OddOneOutConfig | null>(null);
    const [reactionTapConfig, setReactionTapConfig] =
        useState<ReactionTapConfig | null>(null);
    const [lightsOutBoard, setLightsOutBoard] = useState<boolean[][] | null>(
        null,
    );
    const [pipeConnectTiles, setPipeConnectTiles] = useState<
        PipeConnectTile[] | null
    >(null);
    const [pairMatchTiles, setPairMatchTiles] = useState<PairMatchTile[] | null>(
        null,
    );
    const [rushHourVehicles, setRushHourVehicles] = useState<
        RushHourVehicle[] | null
    >(null);
    const [pieces, setPieces] = useState<Record<string, Piece> | null>(null);
    const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
    const [moves, setMoves] = useState(0);
    const [rank, setRank] = useState<number | null>(null);
    const [solveTime, setSolveTime] = useState<number | null>(null);
    const [results, setResults] = useState<RoundResult[]>([]);
    const [teamTugState, setTeamTugState] =
        useState<TeamTugStateSnapshot | null>(null);
    const [teamTugResults, setTeamTugResults] = useState<TeamTugTeamResult[]>([]);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [shuffleState, setShuffleState] = useState<ShuffleState | null>(null);
    const [shuffleReadyState, setShuffleReadyState] =
        useState<ShuffleReadyState | null>(null);
    const [resultsAutoAdvanceAt, setResultsAutoAdvanceAt] = useState<
        number | null
    >(null);
    const [resultsCountdownNow, setResultsCountdownNow] = useState(() =>
        Date.now(),
    );
    const elapsed = useTimer(startTime);
    const cellSize = useCellSize();
    const { notice, dismissNotice, retryConnection } = useConnectionNotice({
        role: "player",
        roomCode,
        playerName,
        playerSessionId,
    });
    const recentWinnerName =
        gameType === "teamtug" ? getTopName(teamTugResults) : getTopName(results);
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

    useEffect(() => {
        if (!resumeSession) return;

        const normalizedRoomCode = roomCode.toUpperCase().trim();
        const normalizedPlayerName = playerName.trim();

        const joinRoom = () => {
            socket.emit("player:join", {
                roomCode: normalizedRoomCode,
                playerName: normalizedPlayerName,
                playerSessionId,
            });
        };

        if (socket.connected) {
            joinRoom();
            return;
        }

        socket.connect();
        socket.once("connect", joinRoom);

        return () => {
            socket.off("connect", joinRoom);
        };
    }, [playerName, playerSessionId, resumeSession, roomCode]);

    // Sync game type when host changes it in the lobby
    const onRoomUpdated = useCallback(
        ({ players }: { players: Array<{ id: string; name: string }> }) => {
            setPlayerCount(players.length);
        },
        [],
    );

    const onRoomGameType = useCallback(
        ({ gameType: gt }: { gameType: GameType }) => {
            setGameType(gt);
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
            pieces: p,
            wind: w,
            vehicles: v,
            board: b,
            tiles: t,
            palette,
            codeLength,
            maxGuesses,
            sequence,
            colors,
            gridSize,
            maxRounds,
            prompt,
            promptCount,
            roundNumber,
            totalRounds: nextTotalRounds,
            durationMs,
            endAt,
            question,
            score,
            answeredCount,
            streak,
            bestStreak,
            lastAnswerCorrect,
            totalPrompts,
            goPrompts,
            teamTugState: nextTeamTugState,
        }: {
            gameType: GameType;
            board?: (string | null)[][] | boolean[][];
            tiles?: PipeConnectTile[] | PairMatchTile[];
            pieces?: Record<string, Piece>;
            wind?: number;
            durationMs?: number;
            endAt?: number | null;
            question?: MathSprintQuestion;
            score?: number;
            answeredCount?: number;
            streak?: number;
            bestStreak?: number;
            lastAnswerCorrect?: boolean | null;
            teamTugState?: TeamTugStateSnapshot | null;
            vehicles?: RushHourVehicle[];
            palette?: string[];
            codeLength?: number;
            maxGuesses?: number;
            sequence?: number[] | ("red" | "blue" | "green" | "yellow")[];
            colors?: ("red" | "blue" | "green" | "yellow")[];
            gridSize?: number;
            maxRounds?: number;
            prompt?: OddOneOutPrompt | null;
            promptCount?: number;
            totalPrompts?: number;
            goPrompts?: number;
            roundNumber: number;
            totalRounds: number;
        }) => {
            setShuffleState(null);
            setResultsAutoAdvanceAt(null);
            setGameType(gt);
            setCurrentRound(roundNumber);
            setTotalRounds(nextTotalRounds);
            setMatchOver(false);
            setStandings([]);
            setResults([]);
            setTeamTugResults([]);
            setViewKey(`${roundNumber}-${gt}`);
            setShuffleReadyState(null);
            if (gt === "klotski") {
                setPieces(p ?? null);
                setMoves(0);
                setSelectedPiece(null);
                setSolveTime(null);
                setRank(null);
                setStartTime(Date.now());
                setPhase("playing");
            } else if (gt === "codebreaker") {
                setCodebreakerConfig({
                    palette: palette ?? [],
                    codeLength: codeLength ?? 4,
                    maxGuesses: maxGuesses ?? 8,
                });
                setPhase("playing");
            } else if (gt === "simoncopy") {
                setSimonCopyConfig({
                    sequence:
                        (sequence as ("red" | "blue" | "green" | "yellow")[]) ??
                        [],
                    colors: colors ?? ["red", "blue", "green", "yellow"],
                    maxRounds: maxRounds ?? 6,
                });
                setPhase("playing");
            } else if (gt === "mathsprint") {
                setMathSprintConfig({
                    durationMs: durationMs ?? 30000,
                    endAt: endAt ?? null,
                    question: question ?? { id: 0, prompt: "0 + 0", answers: [] },
                    score: score ?? 0,
                    answeredCount: answeredCount ?? 0,
                    streak: streak ?? 0,
                    bestStreak: bestStreak ?? 0,
                    lastAnswerCorrect: lastAnswerCorrect ?? null,
                });
                setPhase("playing");
            } else if (gt === "memorysequenceplus") {
                setMemorySequencePlusConfig({
                    sequence: (sequence as number[]) ?? [],
                    gridSize: gridSize ?? 3,
                    maxRounds: maxRounds ?? 8,
                });
                setPhase("playing");
            } else if (gt === "pairmatch") {
                setPairMatchTiles((t as PairMatchTile[]) ?? []);
                setPhase("playing");
            } else if (gt === "reactiontap") {
                setReactionTapConfig({
                    totalPrompts: totalPrompts ?? 6,
                    goPrompts: goPrompts ?? 4,
                });
                setPhase("playing");
            } else if (gt === "oddoneout") {
                setOddOneOutConfig({
                    prompt: prompt ?? null,
                    promptCount: promptCount ?? 0,
                });
                setPhase("playing");
            } else if (gt === "pipeconnect") {
                setPipeConnectTiles((t as PipeConnectTile[]) ?? []);
                setPhase("playing");
            } else if (gt === "lightsout") {
                setLightsOutBoard((b as boolean[][]) ?? []);
                setPhase("playing");
            } else if (gt === "rushhour") {
                setRushHourVehicles(v ?? []);
                setPhase("playing");
            } else if (gt === "teamtug") {
                setTeamTugState(nextTeamTugState ?? null);
                setPhase("playing");
            } else {
                setBowmanWind(w ?? 0);
                setPhase("playing");
            }
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
            setGameType(gt);
            setCurrentRound(roundNumber);
            setTotalRounds(nextTotalRounds);
            setMatchOver(false);
            setStartTime(null);
            setPhase("shuffling");
            setResultsAutoAdvanceAt(null);
            setShuffleState({
                gameType: gt,
                roundNumber,
                totalRounds: nextTotalRounds,
                durationMs,
                landingBufferMs,
            });
            setShuffleReadyState({
                readyCount: 0,
                readyTarget: 1,
                readyThresholdMet: false,
                playerReady: false,
            });
        },
        [],
    );

    const onRoundReadyStatus = useCallback(
        ({
            readyCount,
            readyTarget,
            readyThresholdMet,
            playerReady,
        }: RoundReadyStatusPayload) => {
            setShuffleReadyState({
                readyCount,
                readyTarget,
                readyThresholdMet,
                playerReady,
            });
        },
        [],
    );

    const onStateUpdate = useCallback(
        ({
            pieces: p,
            moves: m,
        }: {
            board: (string | null)[][];
            pieces: Record<string, Piece>;
            moves: number;
            solved: boolean;
        }) => {
            setPieces(p);
            setMoves(m);
        },
        [],
    );

    const onPuzzleSolved = useCallback(
        ({
            rank: r,
            moves: m,
            solveTime: t,
        }: {
            rank: number;
            moves: number;
            solveTime: number;
        }) => {
            setRank(r);
            setMoves(m);
            setSolveTime(t);
            setStartTime(null);
            setPhase("solved");
        },
        [],
    );

    const onMatchGameOver = useCallback(
        ({
            results: roundResults,
            gameType: gt,
            roundNumber,
            totalRounds: nextTotalRounds,
            matchOver: isMatchOver,
            standings: nextStandings,
            autoAdvanceAt,
        }: GameOverPayload<RoundResult[]>) => {
            setShuffleState(null);
            setGameType(gt);
            if (gt === "teamtug") {
                setTeamTugResults(
                    roundResults as unknown as TeamTugTeamResult[],
                );
                setResults([]);
            } else {
                setResults(roundResults);
                setTeamTugResults([]);
            }
            setCurrentRound(roundNumber);
            setTotalRounds(nextTotalRounds);
            setMatchOver(isMatchOver);
            setStandings(nextStandings);
            setResultsAutoAdvanceAt(autoAdvanceAt);
            setResultsCountdownNow(Date.now());
            setStartTime(null);
            setPhase("results");
        },
        [],
    );

    const onGameReset = useCallback(() => {
        setPhase("waiting");
        setCurrentRound(0);
        setMatchOver(false);
        setResultsAutoAdvanceAt(null);
        setShuffleState(null);
        setStandings([]);
        setCodebreakerConfig(null);
        setMathSprintConfig(null);
        setSimonCopyConfig(null);
        setMemorySequencePlusConfig(null);
        setPairMatchTiles(null);
        setReactionTapConfig(null);
        setTeamTugState(null);
        setTeamTugResults([]);
        setOddOneOutConfig(null);
        setPieces(null);
        setLightsOutBoard(null);
        setPipeConnectTiles(null);
        setMoves(0);
        setSelectedPiece(null);
        setStartTime(null);
        setResults([]);
        setShuffleReadyState(null);
    }, []);

    useSocket("room:updated", onRoomUpdated as never);
    useSocket("room:settings", onRoomSettings as never);
    useSocket("room:gameType", onRoomGameType as never);
    useSocket("round:shuffle", onRoundShuffle as never);
    useSocket("round:readyStatus", onRoundReadyStatus as never);
    useSocket("game:started", onGameStarted as never);
    useSocket("state:update", onStateUpdate as never);
    useSocket("puzzle:solved", onPuzzleSolved as never);
    useSocket("game:over", onMatchGameOver as never);
    useSocket("game:reset", onGameReset as never);

    function move(pieceId: string, direction: Direction) {
        socket.emit("player:move", { pieceId, direction });
    }

    // Keyboard controls for Klotski
    useEffect(() => {
        if (phase !== "playing" || gameType !== "klotski") return;
        function onKey(e: KeyboardEvent) {
            const dirs: Record<string, Direction> = {
                ArrowUp: "up",
                ArrowDown: "down",
                ArrowLeft: "left",
                ArrowRight: "right",
            };
            const dir = dirs[e.key];
            if (dir && selectedPiece) {
                e.preventDefault();
                move(selectedPiece, dir);
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [phase, gameType, selectedPiece]);

    // ── Bowman: hand off to dedicated view ──────────────────────────────────
    if (gameType === "bowman" && phase === "playing") {
        return (
            <>
                {notice && (
                    <ConnectionNotice
                        floating
                        tone={notice.tone}
                        title={notice.title}
                        message={notice.message}
                        actionLabel="Retry now"
                        onAction={retryConnection}
                        onDismiss={dismissNotice}
                    />
                )}
                <BowmanPlayer
                    key={viewKey}
                    roomCode={roomCode}
                    playerName={playerName}
                    initialWind={bowmanWind}
                />
            </>
        );
    }

    if (
        gameType === "codebreaker" &&
        phase === "playing" &&
        codebreakerConfig
    ) {
        return (
            <>
                {notice && (
                    <ConnectionNotice
                        floating
                        tone={notice.tone}
                        title={notice.title}
                        message={notice.message}
                        actionLabel="Retry now"
                        onAction={retryConnection}
                        onDismiss={dismissNotice}
                    />
                )}
                <CodebreakerPlayer
                    key={viewKey}
                    roomCode={roomCode}
                    playerName={playerName}
                    palette={codebreakerConfig.palette}
                    codeLength={codebreakerConfig.codeLength}
                    maxGuesses={codebreakerConfig.maxGuesses}
                />
            </>
        );
    }

    if (gameType === "lightsout" && phase === "playing" && lightsOutBoard) {
        return (
            <>
                {notice && (
                    <ConnectionNotice
                        floating
                        tone={notice.tone}
                        title={notice.title}
                        message={notice.message}
                        actionLabel="Retry now"
                        onAction={retryConnection}
                        onDismiss={dismissNotice}
                    />
                )}
                <LightsOutPlayer
                    key={viewKey}
                    roomCode={roomCode}
                    playerName={playerName}
                    initialBoard={lightsOutBoard}
                />
            </>
        );
    }

    if (gameType === "mathsprint" && phase === "playing" && mathSprintConfig) {
        return (
            <>
                {notice && (
                    <ConnectionNotice
                        floating
                        tone={notice.tone}
                        title={notice.title}
                        message={notice.message}
                        actionLabel="Retry now"
                        onAction={retryConnection}
                        onDismiss={dismissNotice}
                    />
                )}
                <MathSprintPlayer
                    key={viewKey}
                    roomCode={roomCode}
                    playerName={playerName}
                    durationMs={mathSprintConfig.durationMs}
                    endAt={mathSprintConfig.endAt}
                    question={mathSprintConfig.question}
                    score={mathSprintConfig.score}
                    answeredCount={mathSprintConfig.answeredCount}
                    streak={mathSprintConfig.streak}
                    bestStreak={mathSprintConfig.bestStreak}
                    lastAnswerCorrect={mathSprintConfig.lastAnswerCorrect}
                />
            </>
        );
    }

    if (gameType === "simoncopy" && phase === "playing" && simonCopyConfig) {
        return (
            <>
                {notice && (
                    <ConnectionNotice
                        floating
                        tone={notice.tone}
                        title={notice.title}
                        message={notice.message}
                        actionLabel="Retry now"
                        onAction={retryConnection}
                        onDismiss={dismissNotice}
                    />
                )}
                <SimonCopyPlayer
                    key={viewKey}
                    roomCode={roomCode}
                    playerName={playerName}
                    sequence={simonCopyConfig.sequence}
                    colors={simonCopyConfig.colors}
                    maxRounds={simonCopyConfig.maxRounds}
                />
            </>
        );
    }

    if (
        gameType === "memorysequenceplus" &&
        phase === "playing" &&
        memorySequencePlusConfig
    ) {
        return (
            <>
                {notice && (
                    <ConnectionNotice
                        floating
                        tone={notice.tone}
                        title={notice.title}
                        message={notice.message}
                        actionLabel="Retry now"
                        onAction={retryConnection}
                        onDismiss={dismissNotice}
                    />
                )}
                <MemorySequencePlusPlayer
                    key={viewKey}
                    roomCode={roomCode}
                    playerName={playerName}
                    sequence={memorySequencePlusConfig.sequence}
                    gridSize={memorySequencePlusConfig.gridSize}
                    maxRounds={memorySequencePlusConfig.maxRounds}
                />
            </>
        );
    }

    if (gameType === "oddoneout" && phase === "playing" && oddOneOutConfig) {
        return (
            <>
                {notice && (
                    <ConnectionNotice
                        floating
                        tone={notice.tone}
                        title={notice.title}
                        message={notice.message}
                        actionLabel="Retry now"
                        onAction={retryConnection}
                        onDismiss={dismissNotice}
                    />
                )}
                <OddOneOutPlayer
                    key={viewKey}
                    roomCode={roomCode}
                    playerName={playerName}
                    initialPrompt={oddOneOutConfig.prompt}
                    totalPrompts={oddOneOutConfig.promptCount}
                />
            </>
        );
    }

    if (gameType === "reactiontap" && phase === "playing" && reactionTapConfig) {
        return (
            <>
                {notice && (
                    <ConnectionNotice
                        floating
                        tone={notice.tone}
                        title={notice.title}
                        message={notice.message}
                        actionLabel="Retry now"
                        onAction={retryConnection}
                        onDismiss={dismissNotice}
                    />
                )}
                <ReactionTapPlayer
                    key={viewKey}
                    roomCode={roomCode}
                    playerName={playerName}
                    totalPrompts={reactionTapConfig.totalPrompts}
                    goPrompts={reactionTapConfig.goPrompts}
                />
            </>
        );
    }

    if (gameType === "pairmatch" && phase === "playing" && pairMatchTiles) {
        return (
            <>
                {notice && (
                    <ConnectionNotice
                        floating
                        tone={notice.tone}
                        title={notice.title}
                        message={notice.message}
                        actionLabel="Retry now"
                        onAction={retryConnection}
                        onDismiss={dismissNotice}
                    />
                )}
                <PairMatchPlayer
                    key={viewKey}
                    roomCode={roomCode}
                    playerName={playerName}
                    initialTiles={pairMatchTiles}
                />
            </>
        );
    }

    if (gameType === "pipeconnect" && phase === "playing" && pipeConnectTiles) {
        return (
            <>
                {notice && (
                    <ConnectionNotice
                        floating
                        tone={notice.tone}
                        title={notice.title}
                        message={notice.message}
                        actionLabel="Retry now"
                        onAction={retryConnection}
                        onDismiss={dismissNotice}
                    />
                )}
                <PipeConnectPlayer
                    key={viewKey}
                    roomCode={roomCode}
                    playerName={playerName}
                    initialTiles={pipeConnectTiles}
                />
            </>
        );
    }

    // ── Rush Hour: hand off to dedicated view ────────────────────────────────
    if (gameType === "rushhour" && phase === "playing" && rushHourVehicles) {
        return (
            <>
                {notice && (
                    <ConnectionNotice
                        floating
                        tone={notice.tone}
                        title={notice.title}
                        message={notice.message}
                        actionLabel="Retry now"
                        onAction={retryConnection}
                        onDismiss={dismissNotice}
                    />
                )}
                <RushHourPlayer
                    key={viewKey}
                    roomCode={roomCode}
                    playerName={playerName}
                    initialVehicles={rushHourVehicles}
                />
            </>
        );
    }

    if (gameType === "teamtug" && phase === "playing" && teamTugState) {
        return (
            <>
                {notice && (
                    <ConnectionNotice
                        floating
                        tone={notice.tone}
                        title={notice.title}
                        message={notice.message}
                        actionLabel="Retry now"
                        onAction={retryConnection}
                        onDismiss={dismissNotice}
                    />
                )}
                <TeamTugPlayer
                    key={viewKey}
                    roomCode={roomCode}
                    playerName={playerName}
                    playerSessionId={playerSessionId}
                    initialState={teamTugState}
                />
            </>
        );
    }

    // ── Klotski (and waiting-room shared by both games) ──────────────────────
    const MEDALS = ["🥇", "🥈", "🥉"];

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.logo}>⚡ Quick Draw</div>
                <div className={styles.meta}>
                    {playerName} · {roomCode}
                </div>
            </header>

            <div className={styles.content}>
                {notice && (
                    <ConnectionNotice
                        tone={notice.tone}
                        title={notice.title}
                        message={notice.message}
                        actionLabel="Retry now"
                        onAction={retryConnection}
                        onDismiss={dismissNotice}
                    />
                )}
                {phase === "waiting" && (
                    <div className={styles.centered}>
                        <div className={styles.waitCard}>
                            <div
                                className={styles.waitPulse}
                                aria-hidden="true"
                            />
                            <div className={styles.waitEyebrow}>
                                Connected to room
                            </div>
                            <div className={styles.waitTitle}>You're in!</div>
                            <div className={styles.waitSub}>
                                Waiting for the host to start the game…
                            </div>
                            <div className={styles.joinDetails}>
                                <div className={styles.joinDetailItem}>
                                    <span className={styles.joinDetailLabel}>
                                        Room
                                    </span>
                                    <span className={styles.joinDetailValue}>
                                        {roomCode}
                                    </span>
                                </div>
                                <div className={styles.joinDetailItem}>
                                    <span className={styles.joinDetailLabel}>
                                        Player
                                    </span>
                                    <span className={styles.joinDetailValue}>
                                        {playerName}
                                    </span>
                                </div>
                            </div>
                            {playerCount !== null && (
                                <div className={styles.playerCountBadge}>
                                    {playerCount} player
                                    {playerCount === 1 ? "" : "s"} joined
                                </div>
                            )}
                        </div>
                        <div className={styles.hint}>
                            Keep this phone open — your mini-game will appear
                            here.
                        </div>
                        <div className={styles.waitMeta}>
                            Match length: {totalRounds} random rounds
                        </div>
                    </div>
                )}

                {phase === "shuffling" && shuffleState && (
                    <RoundShuffleOverlay
                        key={`${shuffleState.roundNumber}-${shuffleState.gameType}`}
                        gameType={shuffleState.gameType}
                        roundNumber={shuffleState.roundNumber}
                        totalRounds={shuffleState.totalRounds}
                        durationMs={shuffleState.durationMs}
                        landingBufferMs={shuffleState.landingBufferMs}
                        title="Drawing the next mini game"
                        subtitle={`Get ready — ${formatGameLabel(shuffleState.gameType)} is about to begin.`}
                        readyCount={shuffleReadyState?.readyCount ?? 0}
                        readyTarget={shuffleReadyState?.readyTarget ?? 1}
                        readyThresholdMet={
                            shuffleReadyState?.readyThresholdMet ?? false
                        }
                        canReady
                        playerReady={shuffleReadyState?.playerReady ?? false}
                        recentWinnerName={recentWinnerName}
                        leaderName={leaderName}
                        onReady={() => socket.emit("player:ready")}
                    />
                )}

                {(phase === "playing" || phase === "solved") && pieces && (
                    <>
                        <KlotskiBoard
                            pieces={pieces}
                            cellSize={cellSize}
                            selectedPiece={selectedPiece}
                            onPieceSelect={setSelectedPiece}
                            onMove={move}
                        />
                        <div className={styles.stats}>
                            <span>
                                Moves:{" "}
                                <span className={styles.statVal}>{moves}</span>
                            </span>
                            <span>
                                Time:{" "}
                                <span className={styles.statVal}>
                                    {formatTime(elapsed)}
                                </span>
                            </span>
                        </div>
                        {phase === "playing" && (
                            <div className={styles.hint}>
                                Drag pieces to slide them.
                                <br />
                                Get{" "}
                                <span className={styles.hintAccent}>
                                    🔴 A
                                </span>{" "}
                                to the exit at the bottom!
                            </div>
                        )}
                    </>
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
                        <div className={styles.solvedStats}>
                            {moves} moves · {formatTime(solveTime ?? 0)}
                        </div>
                        <div className={styles.solvedWait}>
                            Waiting for others to finish…
                        </div>
                    </div>
                )}

                {phase === "results" && (
                    <div className={styles.centered}>
                        <div className={styles.waitTitle}>
                            {matchOver
                                ? "🏆 Match Complete!"
                                : `✅ Round ${currentRound} Complete`}
                        </div>
                        <div className={styles.waitSub}>
                            {currentRound}/{totalRounds} rounds played
                        </div>
                        {!matchOver && resultsCountdownSeconds !== null && (
                            <div className={styles.resultsCountdown}>
                                Next round starts in {resultsCountdownSeconds}s
                            </div>
                        )}
                        <div className={styles.resultsList}>
                            {gameType === "teamtug"
                                ? teamTugResults.map((team) => (
                                      <div
                                          key={team.id}
                                          className={styles.resultRow}
                                      >
                                          <span>
                                              {team.rank <= 3
                                                  ? MEDALS[team.rank - 1]
                                                  : `#${team.rank}`}
                                          </span>
                                          <span className={styles.resultName}>
                                              {team.name} Team
                                              {team.members.some(
                                                  (member) =>
                                                      member.sessionId ===
                                                      playerSessionId,
                                              )
                                                  ? " (you)"
                                                  : ""}
                                          </span>
                                          <span className={styles.resultTime}>
                                              {team.pulls} pulls
                                          </span>
                                      </div>
                                  ))
                                : results.map((r, i) => (
                                      <div
                                          key={r.id}
                                          className={`${styles.resultRow} ${r.id === socket.id ? styles.highlight : ""}`}
                                      >
                                          <span>
                                              {r.rank !== null && r.rank <= 3
                                                  ? MEDALS[r.rank - 1]
                                                  : `#${r.rank ?? i + 1}`}
                                          </span>
                                          <span className={styles.resultName}>
                                              {r.name}
                                              {r.id === socket.id ? " (you)" : ""}
                                          </span>
                                          <span className={styles.resultTime}>
                                              {describeRoundResult(r, gameType)}
                                          </span>
                                      </div>
                                  ))}
                        </div>
                        {gameType === "teamtug" && (
                            <div className={styles.resultsList}>
                                {teamTugResults.map((team) =>
                                    team.members.map((member) => (
                                        <div
                                            key={`${team.id}-${member.sessionId}`}
                                            className={`${styles.resultRow} ${member.sessionId === playerSessionId ? styles.highlight : ""}`}
                                        >
                                            <span>•</span>
                                            <span className={styles.resultName}>
                                                {member.name}
                                                {member.sessionId === playerSessionId
                                                    ? " (you)"
                                                    : ""}
                                            </span>
                                            <span className={styles.resultTime}>
                                                {team.name} · {member.contribution} pulls
                                            </span>
                                        </div>
                                    )),
                                )}
                            </div>
                        )}

                        <div className={styles.resultsList}>
                            {standings.map((standing) => (
                                <div
                                    key={standing.id}
                                    className={`${styles.resultRow} ${standing.id === socket.id ? styles.highlight : ""}`}
                                >
                                    <span>
                                        {standing.position <= 3
                                            ? MEDALS[standing.position - 1]
                                            : `#${standing.position}`}
                                    </span>
                                    <span className={styles.resultName}>
                                        {standing.name}
                                        {standing.id === socket.id
                                            ? " (you)"
                                            : ""}
                                    </span>
                                    <span className={styles.resultTime}>
                                        {standing.totalPoints} pts
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className={styles.waitSub}>
                            {matchOver
                                ? "Waiting for host to reset the room…"
                                : resultsCountdownSeconds !== null
                                  ? `Auto-transitioning in ${resultsCountdownSeconds}s…`
                                  : "Waiting for host to start the next round…"}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
