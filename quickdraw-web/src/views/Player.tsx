import { useState, useCallback, useEffect } from "react";
import { socket } from "../socket";
import { useSocket } from "../hooks/useSocket";
import { useTimer, formatTime } from "../hooks/useTimer";
import { useCellSize } from "../hooks/useCellSize";
import { KlotskiBoard } from "../components/KlotskiBoard";
import { BowmanPlayer } from "./BowmanPlayer";
import { CodebreakerPlayer } from "./CodebreakerPlayer";
import { LightsOutPlayer } from "./LightsOutPlayer";
import { RushHourPlayer } from "./RushHourPlayer";
import type {
    CodebreakerConfig,
    Piece,
    Direction,
    Result,
    GameType,
    RushHourVehicle,
} from "../types";
import styles from "../styles/Player.module.css";

type Phase = "waiting" | "playing" | "solved" | "results";

interface Props {
    roomCode: string;
    playerName: string;
}

export function Player({ roomCode, playerName }: Props) {
    const [gameType, setGameType] = useState<GameType>("klotski");
    const [phase, setPhase] = useState<Phase>("waiting");
    const [bowmanWind, setBowmanWind] = useState(0);
    const [codebreakerConfig, setCodebreakerConfig] =
        useState<CodebreakerConfig | null>(null);
    const [lightsOutBoard, setLightsOutBoard] = useState<boolean[][] | null>(
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
    const [results, setResults] = useState<Result[]>([]);
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

    const onGameStarted = useCallback(
        ({
            gameType: gt,
            pieces: p,
            wind: w,
            vehicles: v,
            board: b,
            palette,
            codeLength,
            maxGuesses,
        }: {
            gameType: GameType;
            board?: (string | null)[][] | boolean[][];
            pieces?: Record<string, Piece>;
            wind?: number;
            vehicles?: RushHourVehicle[];
            palette?: string[];
            codeLength?: number;
            maxGuesses?: number;
        }) => {
            setGameType(gt);
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

    const onGameOver = useCallback(({ results: r }: { results: Result[] }) => {
        setResults(r);
        setPhase("results");
    }, []);

    const onGameReset = useCallback(() => {
        setPhase("waiting");
        setCodebreakerConfig(null);
        setPieces(null);
        setLightsOutBoard(null);
        setMoves(0);
        setSelectedPiece(null);
        setStartTime(null);
        setResults([]);
    }, []);

    useSocket("room:gameType", onRoomGameType as never);
    useSocket("game:started", onGameStarted as never);
    useSocket("state:update", onStateUpdate as never);
    useSocket("puzzle:solved", onPuzzleSolved as never);
    useSocket("game:over", onGameOver as never);
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
    if (gameType === "bowman" && phase !== "waiting") {
        return (
            <BowmanPlayer
                roomCode={roomCode}
                playerName={playerName}
                initialWind={bowmanWind}
            />
        );
    }

    if (
        gameType === "codebreaker" &&
        phase !== "waiting" &&
        codebreakerConfig
    ) {
        return (
            <CodebreakerPlayer
                roomCode={roomCode}
                playerName={playerName}
                palette={codebreakerConfig.palette}
                codeLength={codebreakerConfig.codeLength}
                maxGuesses={codebreakerConfig.maxGuesses}
            />
        );
    }

    if (gameType === "lightsout" && phase !== "waiting" && lightsOutBoard) {
        return (
            <LightsOutPlayer
                roomCode={roomCode}
                playerName={playerName}
                initialBoard={lightsOutBoard}
            />
        );
    }

    // ── Rush Hour: hand off to dedicated view ────────────────────────────────
    if (gameType === "rushhour" && phase !== "waiting" && rushHourVehicles) {
        return (
            <RushHourPlayer
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
                        <div className={styles.waitTitle}>🏆 Game Over!</div>
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
                                    {r.solveTime !== null ? (
                                        <span className={styles.resultTime}>
                                            {formatTime(r.solveTime)}
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
                )}
            </div>
        </div>
    );
}
