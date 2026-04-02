import type { GameType } from "./types";

export interface GameInstructionMeta {
    label: string;
    shortLabel: string;
    category: "logic" | "speed" | "memory" | "precision";
    objective: string;
    controls: string;
    winCondition: string;
}

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

export const GAME_INSTRUCTION_META: Record<GameType, GameInstructionMeta> = {
    klotski: {
        label: "🧩 Klotski",
        shortLabel: "Klotski",
        category: "logic",
        objective: "Slide the blocks to free the red piece.",
        controls: "Tap or drag pieces, then move them one space at a time.",
        winCondition: "Fastest solve wins.",
    },
    bowman: {
        label: "🏹 Bowman",
        shortLabel: "Bowman",
        category: "precision",
        objective: "Aim your shots and rack up the highest score.",
        controls: "Drag to set angle and power, then release to fire.",
        winCondition: "Highest total score wins after all shots.",
    },
    codebreaker: {
        label: "🔐 Codebreaker",
        shortLabel: "Codebreaker",
        category: "logic",
        objective:
            "Crack the hidden color code using feedback from each guess.",
        controls: "Build a guess from the color palette, then submit it.",
        winCondition: "Solve in the fewest guesses, then the fastest time.",
    },
    pipeconnect: {
        label: "🪠 Pipe Connect",
        shortLabel: "Pipe Connect",
        category: "logic",
        objective: "Rotate the tiles until the pipe network is connected.",
        controls: "Tap a tile to rotate it into the correct direction.",
        winCondition: "Fastest completed connection wins.",
    },
    simoncopy: {
        label: "🟡 Simon Copy",
        shortLabel: "Simon Copy",
        category: "memory",
        objective: "Memorize the flashing color pattern and repeat it.",
        controls: "Watch first, then tap the colors in the same order.",
        winCondition:
            "Reach the highest round; fastest perfect clear wins ties.",
    },
    memorysequenceplus: {
        label: "🧠 Memory Sequence+",
        shortLabel: "Memory Sequence+",
        category: "memory",
        objective: "Remember the numbered cell sequence and replay it exactly.",
        controls: "Watch the flash order, then tap the cells in sequence.",
        winCondition:
            "Reach the highest round; fastest perfect clear wins ties.",
    },
    rushhour: {
        label: "🚗 Rush Hour",
        shortLabel: "Rush Hour",
        category: "logic",
        objective: "Slide vehicles until the red car can escape.",
        controls: "Drag vehicles only along their allowed direction.",
        winCondition: "Fastest solve wins.",
    },
    lightsout: {
        label: "💡 Lights Out",
        shortLabel: "Lights Out",
        category: "speed",
        objective: "Turn every light off on the board.",
        controls: "Tap a tile to flip it and its neighbors.",
        winCondition: "Fastest clean solve wins.",
    },
};

export function formatGameLabel(gameType: GameType): string {
    return GAME_INSTRUCTION_META[gameType].label;
}

export function getGameInstructionMeta(
    gameType: GameType,
): GameInstructionMeta {
    return GAME_INSTRUCTION_META[gameType];
}
