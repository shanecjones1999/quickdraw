import type { GameType } from "./types";

export const ALL_GAME_TYPES: GameType[] = [
    "klotski",
    "bowman",
    "codebreaker",
    "pipeconnect",
    "simoncopy",
    "memorysequenceplus",
    "rushhour",
    "lightsout",
];

export function formatGameLabel(gameType: GameType): string {
    if (gameType === "klotski") return "🧩 Klotski";
    if (gameType === "bowman") return "🏹 Bowman";
    if (gameType === "codebreaker") return "🔐 Codebreaker";
    if (gameType === "pipeconnect") return "🪠 Pipe Connect";
    if (gameType === "simoncopy") return "🟡 Simon Copy";
    if (gameType === "memorysequenceplus") return "🧠 Memory Sequence+";
    if (gameType === "rushhour") return "🚗 Rush Hour";
    return "💡 Lights Out";
}
