export interface LandingDraft {
    screen: "home" | "join";
    roomCode: string;
    playerName: string;
}

export interface PlayerSession {
    roomCode: string;
    playerName: string;
    playerSessionId: string;
}

export interface HostSession {
    roomCode: string;
    hostSessionId: string;
}

const LANDING_DRAFT_KEY = "quickdraw:landing-draft";
const PLAYER_SESSION_KEY = "quickdraw:player-session";
const HOST_SESSION_KEY = "quickdraw:host-session";

function createSessionId() {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return `player-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function canUseStorage() {
    return typeof window !== "undefined";
}

export function loadLandingDraft(): LandingDraft | null {
    if (!canUseStorage()) return null;

    const raw = window.sessionStorage.getItem(LANDING_DRAFT_KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as LandingDraft;
        if (
            (parsed.screen === "home" || parsed.screen === "join") &&
            typeof parsed.roomCode === "string" &&
            typeof parsed.playerName === "string"
        ) {
            return parsed;
        }
    } catch {
        window.sessionStorage.removeItem(LANDING_DRAFT_KEY);
    }

    return null;
}

export function saveLandingDraft(draft: LandingDraft) {
    if (!canUseStorage()) return;
    window.sessionStorage.setItem(LANDING_DRAFT_KEY, JSON.stringify(draft));
}

export function clearLandingDraft() {
    if (!canUseStorage()) return;
    window.sessionStorage.removeItem(LANDING_DRAFT_KEY);
}

export function loadPlayerSession(): PlayerSession | null {
    if (!canUseStorage()) return null;

    const raw = window.sessionStorage.getItem(PLAYER_SESSION_KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as PlayerSession;
        if (
            typeof parsed.roomCode === "string" &&
            typeof parsed.playerName === "string" &&
            typeof parsed.playerSessionId === "string" &&
            parsed.roomCode.trim() &&
            parsed.playerName.trim() &&
            parsed.playerSessionId.trim()
        ) {
            return {
                roomCode: parsed.roomCode.toUpperCase().trim(),
                playerName: parsed.playerName.trim(),
                playerSessionId: parsed.playerSessionId.trim(),
            };
        }
    } catch {
        window.sessionStorage.removeItem(PLAYER_SESSION_KEY);
    }

    return null;
}

export function savePlayerSession(session: PlayerSession) {
    if (!canUseStorage()) return;
    window.sessionStorage.setItem(
        PLAYER_SESSION_KEY,
        JSON.stringify({
            roomCode: session.roomCode.toUpperCase().trim(),
            playerName: session.playerName.trim(),
            playerSessionId: session.playerSessionId.trim(),
        }),
    );
}

export function getOrCreatePlayerSessionId() {
    return loadPlayerSession()?.playerSessionId ?? createSessionId();
}

export function clearPlayerSession() {
    if (!canUseStorage()) return;
    window.sessionStorage.removeItem(PLAYER_SESSION_KEY);
}

export function loadHostSession(): HostSession | null {
    if (!canUseStorage()) return null;

    const raw = window.sessionStorage.getItem(HOST_SESSION_KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as HostSession;
        if (
            typeof parsed.roomCode === "string" &&
            typeof parsed.hostSessionId === "string" &&
            parsed.roomCode.trim() &&
            parsed.hostSessionId.trim()
        ) {
            return {
                roomCode: parsed.roomCode.toUpperCase().trim(),
                hostSessionId: parsed.hostSessionId.trim(),
            };
        }
    } catch {
        window.sessionStorage.removeItem(HOST_SESSION_KEY);
    }

    return null;
}

export function saveHostSession(session: HostSession) {
    if (!canUseStorage()) return;
    window.sessionStorage.setItem(
        HOST_SESSION_KEY,
        JSON.stringify({
            roomCode: session.roomCode.toUpperCase().trim(),
            hostSessionId: session.hostSessionId.trim(),
        }),
    );
}

export function clearHostSession() {
    if (!canUseStorage()) return;
    window.sessionStorage.removeItem(HOST_SESSION_KEY);
}
