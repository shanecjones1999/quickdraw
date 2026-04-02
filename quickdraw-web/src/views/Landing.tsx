import { useEffect, useState } from "react";
import { ConnectionNotice } from "../components/ConnectionNotice";
import {
    getConnectErrorNotice,
    getServerErrorNotice,
    type ConnectionNoticeData,
} from "../connectionMessages";
import { socket } from "../socket";
import {
    clearLandingDraft,
    getOrCreatePlayerSessionId,
    loadLandingDraft,
    saveLandingDraft,
} from "../sessionState";
import styles from "../styles/Landing.module.css";

type Screen = "home" | "join";

interface Props {
    onHostCreated: (roomCode: string) => void;
    onPlayerJoined: (
        roomCode: string,
        playerName: string,
        playerSessionId: string,
    ) => void;
}

export function Landing({ onHostCreated, onPlayerJoined }: Props) {
    const initialDraft = loadLandingDraft();
    const [screen, setScreen] = useState<Screen>(
        initialDraft?.screen ?? "home",
    );
    const [roomCode, setRoomCode] = useState(initialDraft?.roomCode ?? "");
    const [playerName, setPlayerName] = useState(
        initialDraft?.playerName ?? "",
    );
    const [error, setError] = useState("");
    const [notice, setNotice] = useState<ConnectionNoticeData | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        saveLandingDraft({
            screen,
            roomCode,
            playerName,
        });
    }, [playerName, roomCode, screen]);

    function clearUiMessages() {
        setError("");
        setNotice(null);
    }

    function submitJoin() {
        if (!roomCode.trim() || !playerName.trim()) {
            setError("Enter both a room code and your name.");
            return;
        }

        clearUiMessages();
        setLoading(true);
        const normalizedRoomCode = roomCode.toUpperCase().trim();
        const normalizedPlayerName = playerName.trim();
        const playerSessionId = getOrCreatePlayerSessionId();

        const handleConnectError = () => {
            cleanup();
            setLoading(false);
            setNotice(getConnectErrorNotice("landing"));
        };

        const handleServerError = ({ message }: { message?: string }) => {
            cleanup();
            setLoading(false);
            setNotice(
                getServerErrorNotice(
                    message ?? "Connection problem",
                    "landing",
                ),
            );
        };

        const handleJoined = () => {
            cleanup();
            setLoading(false);
            clearLandingDraft();
            onPlayerJoined(
                normalizedRoomCode,
                normalizedPlayerName,
                playerSessionId,
            );
        };

        const cleanup = () => {
            socket.off("connect_error", handleConnectError);
            socket.off("error", handleServerError);
            socket.off("room:updated", handleJoined);
        };

        socket.once("connect_error", handleConnectError);
        socket.once("error", handleServerError);
        socket.once("room:updated", handleJoined);

        if (!socket.connected) socket.connect();

        socket.emit("player:join", {
            roomCode: normalizedRoomCode,
            playerName: normalizedPlayerName,
            playerSessionId,
        });
    }

    function handleHost() {
        clearUiMessages();
        setLoading(true);
        const handleConnectError = () => {
            cleanup();
            setLoading(false);
            setNotice(getConnectErrorNotice("landing"));
        };

        const handleServerError = ({ message }: { message?: string }) => {
            cleanup();
            setLoading(false);
            setNotice(
                getServerErrorNotice(
                    message ?? "Connection problem",
                    "landing",
                ),
            );
        };

        const handleCreated = ({ roomCode }: { roomCode: string }) => {
            cleanup();
            setLoading(false);
            clearLandingDraft();
            onHostCreated(roomCode);
        };

        const cleanup = () => {
            socket.off("connect_error", handleConnectError);
            socket.off("error", handleServerError);
            socket.off("room:created", handleCreated);
        };

        socket.once("connect_error", handleConnectError);
        socket.once("error", handleServerError);
        socket.once("room:created", handleCreated);

        socket.connect();
        socket.emit("host:create");
    }

    function handleJoinSubmit(e: React.FormEvent) {
        e.preventDefault();
        submitJoin();
    }

    if (screen === "join") {
        return (
            <div className={styles.page}>
                <div className={styles.logo}>
                    <span className={styles.lightning}>⚡</span> QUICK DRAW
                </div>
                <form className={styles.joinForm} onSubmit={handleJoinSubmit}>
                    <h2>Join a Room</h2>
                    <input
                        className={styles.input}
                        placeholder="Room Code"
                        maxLength={4}
                        value={roomCode}
                        onChange={(e) =>
                            setRoomCode(e.target.value.toUpperCase())
                        }
                        autoFocus
                    />
                    <input
                        className={`${styles.input} ${styles.inputName}`}
                        placeholder="Your name"
                        maxLength={16}
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                    />
                    {notice && (
                        <ConnectionNotice
                            tone={notice.tone}
                            title={notice.title}
                            message={notice.message}
                            actionLabel="Try again"
                            onAction={() => {
                                setNotice(null);
                                submitJoin();
                            }}
                            onDismiss={() => setNotice(null)}
                        />
                    )}
                    {error && <div className={styles.error}>{error}</div>}
                    <button
                        className={styles.btnPrimary}
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? "Joining…" : "Join Game →"}
                    </button>
                    <button
                        type="button"
                        className={styles.back}
                        onClick={() => {
                            setScreen("home");
                            clearUiMessages();
                        }}
                    >
                        ← Back
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.logo}>
                <span className={styles.lightning}>⚡</span> QUICK DRAW
            </div>
            <div className={styles.subtitle}>Multiplayer party games</div>
            {notice && (
                <ConnectionNotice
                    tone={notice.tone}
                    title={notice.title}
                    message={notice.message}
                    actionLabel="Try again"
                    onAction={() => {
                        setNotice(null);
                        handleHost();
                    }}
                    onDismiss={() => setNotice(null)}
                />
            )}
            <div className={styles.explainer}>
                <div className={styles.explainerTitle}>How it works</div>
                <div className={styles.explainerSteps}>
                    <div className={styles.explainerStep}>
                        <div className={styles.stepNumber}>1</div>
                        <div>
                            <div className={styles.stepHeading}>
                                Host creates room
                            </div>
                            <div className={styles.stepText}>
                                Start the match on the shared screen.
                            </div>
                        </div>
                    </div>
                    <div className={styles.explainerStep}>
                        <div className={styles.stepNumber}>2</div>
                        <div>
                            <div className={styles.stepHeading}>
                                Players join on phones
                            </div>
                            <div className={styles.stepText}>
                                Enter the 4-letter code and your name.
                            </div>
                        </div>
                    </div>
                    <div className={styles.explainerStep}>
                        <div className={styles.stepNumber}>3</div>
                        <div>
                            <div className={styles.stepHeading}>
                                Battle through mini-games
                            </div>
                            <div className={styles.stepText}>
                                Compete across fast rounds to top the
                                leaderboard.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.buttons}>
                <button
                    className={styles.btnPrimary}
                    onClick={handleHost}
                    disabled={loading}
                >
                    {loading ? "Creating…" : "📺 Host a Game"}
                </button>
                <button
                    className={styles.btnSecondary}
                    onClick={() => {
                        setScreen("join");
                        clearUiMessages();
                    }}
                >
                    📱 Join a Game
                </button>
            </div>
        </div>
    );
}
