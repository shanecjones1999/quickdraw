export type NoticeTone = "warning" | "error" | "success";
export type ConnectionRole = "landing" | "host" | "player";

export interface ConnectionNoticeData {
    tone: NoticeTone;
    title: string;
    message: string;
}

export function getConnectErrorNotice(
    role: ConnectionRole,
): ConnectionNoticeData {
    if (role === "landing") {
        return {
            tone: "error",
            title: "Can’t reach the game server",
            message:
                "Check that the local server is running, then try creating or joining the room again.",
        };
    }

    if (role === "host") {
        return {
            tone: "error",
            title: "Connection lost",
            message:
                "This host screen can’t reach the game server right now. If the room doesn’t recover, refresh to create a new room.",
        };
    }

    return {
        tone: "warning",
        title: "Trying to reconnect",
        message:
            "Keep this phone open while Quick Draw tries to reconnect to the room.",
    };
}

export function getDisconnectNotice(
    role: Exclude<ConnectionRole, "landing">,
    roomCode?: string,
): ConnectionNoticeData {
    if (role === "host") {
        return {
            tone: "error",
            title: "Host screen disconnected",
            message:
                "This room closes if the host disconnects. Refresh this page to create a new room.",
        };
    }

    return {
        tone: "warning",
        title: "Connection lost",
        message: roomCode
            ? `Trying to reconnect to room ${roomCode}. Keep this screen open.`
            : "Trying to reconnect. Keep this screen open.",
    };
}

export function getReconnectAttemptNotice(
    roomCode?: string,
): ConnectionNoticeData {
    return {
        tone: "warning",
        title: "Connection restored",
        message: roomCode
            ? `Trying to rejoin room ${roomCode} now.`
            : "Trying to rejoin your room now.",
    };
}

export function getReconnectSuccessNotice(
    roomCode?: string,
): ConnectionNoticeData {
    return {
        tone: "success",
        title: "Rejoined room",
        message: roomCode
            ? `You’re back in room ${roomCode}.`
            : "You’re back in the room.",
    };
}

export function getServerErrorNotice(
    message: string,
    role: ConnectionRole,
): ConnectionNoticeData {
    if (message === "Room not found.") {
        return {
            tone: "error",
            title: "Room not found",
            message:
                "Double-check the 4-letter code and try again, or ask the host to create a fresh room.",
        };
    }

    if (message === "Game already in progress.") {
        return {
            tone: "error",
            title: "Room unavailable",
            message:
                role === "landing"
                    ? "That room is already mid-match. Wait for the next lobby or ask the host for a new room code."
                    : "The room is already mid-match, so this device can’t rejoin right now. Join again when the host returns to the lobby.",
        };
    }

    if (message === "Name required.") {
        return {
            tone: "error",
            title: "Name required",
            message: "Enter your name before joining the room.",
        };
    }

    if (message === "Host disconnected.") {
        return {
            tone: "error",
            title: "Host disconnected",
            message:
                "The room closed when the host disconnected. Ask them to create a new room, then join again.",
        };
    }

    return {
        tone: "error",
        title:
            role === "landing"
                ? "Couldn’t complete that action"
                : "Connection problem",
        message,
    };
}
