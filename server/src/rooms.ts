import type { Room } from "./types.js";

const rooms = new Map<string, Room>();
const DEFAULT_TOTAL_ROUNDS = 5;

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O to avoid confusion

function generateCode(): string {
    let code: string;
    do {
        code = Array.from(
            { length: 4 },
            () => CHARS[Math.floor(Math.random() * CHARS.length)],
        ).join("");
    } while (rooms.has(code));
    return code;
}

export function createRoom(hostSocketId: string): Room {
    const code = generateCode();
    const room: Room = {
        code,
        hostSocketId,
        players: new Map(),
        phase: "lobby",
        gameType: "klotski",
        totalRounds: DEFAULT_TOTAL_ROUNDS,
        currentRound: 0,
        roundSequence: [],
        gameStartTime: null,
        finishOrder: [],
        roundReadyPlayerSessionIds: new Set(),
        roundReadyOpensAt: null,
        roundRevealTimeout: null,
        resultsAutoAdvanceAt: null,
        resultsAutoAdvanceTimeout: null,
    };
    rooms.set(code, room);
    return room;
}

export function getRoom(code: string): Room | undefined {
    return rooms.get(code);
}

export function getRoomBySocket(socketId: string): Room | undefined {
    for (const room of rooms.values()) {
        if (room.hostSocketId === socketId) return room;
        for (const player of room.players.values()) {
            if (player.id === socketId) return room;
        }
    }
    return undefined;
}

export function deleteRoom(code: string): void {
    rooms.delete(code);
}
