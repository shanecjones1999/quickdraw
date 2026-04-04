import { useEffect, useState } from "react";
import { Landing } from "./views/Landing";
import { Host } from "./views/Host";
import { Player } from "./views/Player";
import {
    clearHostSession,
    clearPlayerSession,
    loadHostSession,
    loadPlayerSession,
    saveHostSession,
    savePlayerSession,
} from "./sessionState";

type Role = "none" | "host" | "player";

interface HostState {
    roomCode: string;
    hostSessionId: string;
}
interface PlayerState {
    roomCode: string;
    playerName: string;
    playerSessionId: string;
}

export default function App() {
    const restoredPlayerSession = loadPlayerSession();
    const restoredHostSession = loadHostSession();
    const [role, setRole] = useState<Role>(
        restoredHostSession ? "host" : restoredPlayerSession ? "player" : "none",
    );
    const [hostState, setHostState] = useState<HostState | null>(
        restoredHostSession ?? null,
    );
    const [playerState, setPlayerState] = useState<PlayerState | null>(
        restoredPlayerSession,
    );
    const [shouldResumePlayerSession, setShouldResumePlayerSession] = useState(
        Boolean(restoredPlayerSession),
    );
    const [shouldResumeHostSession, setShouldResumeHostSession] = useState(
        Boolean(restoredHostSession),
    );

    useEffect(() => {
        if (role === "player" && playerState) {
            savePlayerSession(playerState);
            clearHostSession();
            return;
        }

        if (role === "host" && hostState) {
            saveHostSession(hostState);
            clearPlayerSession();
            return;
        }

        clearPlayerSession();
        clearHostSession();
    }, [hostState, playerState, role]);

    if (role === "host" && hostState) {
        return (
            <Host
                roomCode={hostState.roomCode}
                hostSessionId={hostState.hostSessionId}
                resumeSession={shouldResumeHostSession}
            />
        );
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
            onHostCreated={(roomCode, hostSessionId) => {
                setHostState({ roomCode, hostSessionId });
                setShouldResumeHostSession(false);
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
