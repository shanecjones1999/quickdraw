import { useState, useCallback, useEffect } from "react";
import { socket } from "../socket";
import { useSocket } from "../hooks/useSocket";
import { useTimer, formatTime } from "../hooks/useTimer";
import { useCellSize } from "../hooks/useCellSize";
import { KlotskiBoard } from "../components/KlotskiBoard";
import { BowmanPlayer } from "./BowmanPlayer";
import { CodebreakerPlayer } from "./CodebreakerPlayer";
import { LightsOutPlayer } from "./LightsOutPlayer";
import { MemorySequencePlusPlayer } from "./MemorySequencePlusPlayer";
import { PipeConnectPlayer } from "./PipeConnectPlayer";
import { RushHourPlayer } from "./RushHourPlayer";
import { SimonCopyPlayer } from "./SimonCopyPlayer";
import type {
    BowmanResult,
    CodebreakerResult,
    CodebreakerConfig,
    LightsOutResult,
    MatchStanding,
    MemorySequencePlusConfig,
    MemorySequencePlusResult,
    Piece,
    PipeConnectResult,
    PipeConnectTile,
    RushHourResult,
    SimonCopyConfig,
    SimonCopyResult,
    Direction,
    Result,
    GameType,
    RushHourVehicle,
} from "../types";
import styles from "../styles/Player.module.css";

type Phase = "waiting" | "playing" | "solved" | "results";
type RoundResult =
    | Result
    | BowmanResult
    | CodebreakerResult
    | LightsOutResult
    | PipeConnectResult
    | SimonCopyResult
    | MemorySequencePlusResult
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
}

export function Player({ roomCode, playerName }: Props) {
    const [gameType, setGameType] = useState<GameType>("klotski");
    const [phase, setPhase] = useState<Phase>("waiting");
    const [totalRounds, setTotalRounds] = useState(5);
    const [currentRound, setCurrentRound] = useState(0);
    const [matchOver, setMatchOver] = useState(false);
    const [standings, setStandings] = useState<MatchStanding[]>([]);
    const [viewKey, setViewKey] = useState("waiting");
    const [bowmanWind, setBowmanWind] = useState(0);
    const [codebreakerConfig, setCodebreakerConfig] =
        useState<CodebreakerConfig | null>(null);
    const [simonCopyConfig, setSimonCopyConfig] =
        useState<SimonCopyConfig | null>(null);
    const [memorySequencePlusConfig, setMemorySequencePlusConfig] =
        useState<MemorySequencePlusConfig | null>(null);
    const [lightsOutBoard, setLightsOutBoard] = useState<boolean[][] | null>(
        null,
    );
    const [pipeConnectTiles, setPipeConnectTiles] = useState<
        PipeConnectTile[] | null
    >(null);
    const [rushHourVehicles, setRushHourVehicles] = useState<
        RushHourVehicle[] | null
    >(null);
    const [pieces, setPieces] = useState<Record<string, Piece> | null>(null);
    const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
    const [moves, setMoves] = useState(0);
    const [rank, setRank] = useState<number | null>(null);
    const [solveTime, setSolveTime] = useState<number | null>(null);
    const [results, setResults] = useState<RoundResult[]>([]);
    const [startTime, setStartTime] = useState<number | null>(null);
    const elapsed = useTimer(startTime);
    const cellSize = useCellSize();

    // Sync game type when host changes it in the lobby
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
            roundNumber,
            totalRounds: nextTotalRounds,
        }: {
            gameType: GameType;
            board?: (string | null)[][] | boolean[][];
            tiles?: PipeConnectTile[];
            pieces?: Record<string, Piece>;
            wind?: number;
            vehicles?: RushHourVehicle[];
            palette?: string[];
            codeLength?: number;
            maxGuesses?: number;
            sequence?: number[] | ("red" | "blue" | "green" | "yellow")[];
            colors?: ("red" | "blue" | "green" | "yellow")[];
            gridSize?: number;
            maxRounds?: number;
            roundNumber: number;
            totalRounds: number;
        }) => {
            setGameType(gt);
            setCurrentRound(roundNumber);
            setTotalRounds(nextTotalRounds);
            setMatchOver(false);
            setStandings([]);
            setResults([]);
            setViewKey(`${roundNumber}-${gt}`);
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
            } else if (gt === "memorysequenceplus") {
                setMemorySequencePlusConfig({
                    sequence: (sequence as number[]) ?? [],
                    gridSize: gridSize ?? 3,
                    maxRounds: maxRounds ?? 8,
                });
                setPhase("playing");
            } else if (gt === "pipeconnect") {
                setPipeConnectTiles(t ?? []);
                setPhase("playing");
            } else if (gt === "lightsout") {
                setLightsOutBoard((b as boolean[][]) ?? []);
                setPhase("playing");
            } else if (gt === "rushhour") {
                setRushHourVehicles(v ?? []);
                setPhase("playing");
            } else {
                setBowmanWind(w ?? 0);
                setPhase("playing");
            }
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
        }: {
            results: RoundResult[];
            gameType: GameType;
            roundNumber: number;
            totalRounds: number;
            matchOver: boolean;
            standings: MatchStanding[];
        }) => {
            setGameType(gt);
            setResults(roundResults);
            setCurrentRound(roundNumber);
            setTotalRounds(nextTotalRounds);
            setMatchOver(isMatchOver);
            setStandings(nextStandings);
            setStartTime(null);
            setPhase("results");
        },
        [],
    );

    const onGameReset = useCallback(() => {
        setPhase("waiting");
        setCurrentRound(0);
        setMatchOver(false);
        setStandings([]);
        setCodebreakerConfig(null);
        setSimonCopyConfig(null);
        setMemorySequencePlusConfig(null);
        setPieces(null);
        setLightsOutBoard(null);
        setPipeConnectTiles(null);
        setMoves(0);
        setSelectedPiece(null);
        setStartTime(null);
        setResults([]);
    }, []);

    useSocket("room:settings", onRoomSettings as never);
    useSocket("room:gameType", onRoomGameType as never);
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
    if (gameType === "bowman" && phase !== "waiting" && phase !== "results") {
        return (
            <BowmanPlayer
                key={viewKey}
                roomCode={roomCode}
                playerName={playerName}
                initialWind={bowmanWind}
            />
        );
    }

    if (
        gameType === "codebreaker" &&
        phase !== "waiting" &&
        phase !== "results" &&
        codebreakerConfig
    ) {
        return (
            <CodebreakerPlayer
                key={viewKey}
                roomCode={roomCode}
                playerName={playerName}
                palette={codebreakerConfig.palette}
                codeLength={codebreakerConfig.codeLength}
                maxGuesses={codebreakerConfig.maxGuesses}
            />
        );
    }

    if (
        gameType === "lightsout" &&
        phase !== "waiting" &&
        phase !== "results" &&
        lightsOutBoard
    ) {
        return (
            <LightsOutPlayer
                key={viewKey}
                roomCode={roomCode}
                playerName={playerName}
                initialBoard={lightsOutBoard}
            />
        );
    }

    if (
        gameType === "simoncopy" &&
        phase !== "waiting" &&
        phase !== "results" &&
        simonCopyConfig
    ) {
        return (
            <SimonCopyPlayer
                key={viewKey}
                roomCode={roomCode}
                playerName={playerName}
                sequence={simonCopyConfig.sequence}
                colors={simonCopyConfig.colors}
                maxRounds={simonCopyConfig.maxRounds}
            />
        );
    }

    if (
        gameType === "memorysequenceplus" &&
        phase !== "waiting" &&
        phase !== "results" &&
        memorySequencePlusConfig
    ) {
        return (
            <MemorySequencePlusPlayer
                key={viewKey}
                roomCode={roomCode}
                playerName={playerName}
                sequence={memorySequencePlusConfig.sequence}
                gridSize={memorySequencePlusConfig.gridSize}
                maxRounds={memorySequencePlusConfig.maxRounds}
            />
        );
    }

    if (
        gameType === "pipeconnect" &&
        phase !== "waiting" &&
        phase !== "results" &&
        pipeConnectTiles
    ) {
        return (
            <PipeConnectPlayer
                key={viewKey}
                roomCode={roomCode}
                playerName={playerName}
                initialTiles={pipeConnectTiles}
            />
        );
    }

    // ── Rush Hour: hand off to dedicated view ────────────────────────────────
    if (
        gameType === "rushhour" &&
        phase !== "waiting" &&
        phase !== "results" &&
        rushHourVehicles
    ) {
        return (
            <RushHourPlayer
                key={viewKey}
                roomCode={roomCode}
                playerName={playerName}
                initialVehicles={rushHourVehicles}
            />
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
                {phase === "waiting" && (
                    <div className={styles.centered}>
                        <div className={styles.waitTitle}>You're in!</div>
                        <div className={styles.waitSub}>
                            Waiting for the host to start the game…
                        </div>
                        <div className={styles.hint}>
                            Match length: {totalRounds} random rounds
                        </div>
                    </div>
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
                        <div className={styles.resultsList}>
                            {results.map((r, i) => (
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
                                : "Waiting for host to start the next round…"}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
