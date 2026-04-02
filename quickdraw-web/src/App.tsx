import { useEffect, useState } from "react";
import { Landing } from "./views/Landing";
import { Host } from "./views/Host";
import { Player } from "./views/Player";
import {
    clearPlayerSession,
    loadPlayerSession,
    savePlayerSession,
} from "./sessionState";

type Role = "none" | "host" | "player";

interface HostState {
    roomCode: string;
}
interface PlayerState {
    roomCode: string;
    playerName: string;
    playerSessionId: string;
}

export default function App() {
    const restoredPlayerSession = loadPlayerSession();
    const [role, setRole] = useState<Role>(
        restoredPlayerSession ? "player" : "none",
    );
    const [hostState, setHostState] = useState<HostState | null>(null);
    const [playerState, setPlayerState] = useState<PlayerState | null>(
        restoredPlayerSession,
    );
    const [shouldResumePlayerSession, setShouldResumePlayerSession] = useState(
        Boolean(restoredPlayerSession),
    );

    useEffect(() => {
        if (role === "player" && playerState) {
            savePlayerSession(playerState);
            return;
        }

        clearPlayerSession();
    }, [playerState, role]);

    if (role === "host" && hostState) {
        return <Host roomCode={hostState.roomCode} />;
    }

    if (role === "player" && playerState) {
        return (
            <Player
                roomCode={playerState.roomCode}
                playerName={playerState.playerName}
                playerSessionId={playerState.playerSessionId}
                resumeSession={shouldResumePlayerSession}
            />
        );
    }

    return (
        <Landing
            onHostCreated={(roomCode) => {
                setHostState({ roomCode });
                setRole("host");
            }}
            onPlayerJoined={(roomCode, playerName, playerSessionId) => {
                setPlayerState({ roomCode, playerName, playerSessionId });
                setShouldResumePlayerSession(false);
                setRole("player");
            }}
        />
    );
}
