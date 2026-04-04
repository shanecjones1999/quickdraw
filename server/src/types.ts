import type { ShotResult } from "./bowman.js";
import type { CodebreakerGuess } from "./codebreaker.js";
import type { MathSprintQuestion } from "./mathsprint.js";
import type { MemorySequencePlusCell } from "./memorysequenceplus.js";
import type { PairMatchPublicTile } from "./pairmatch.js";
import type { OddOneOutPrompt } from "./oddoneout.js";
import type { PipeConnectPublicTile } from "./pipeconnect.js";
import type {
    ReactionTapLatestOutcome,
    ReactionTapRoomState,
} from "./reactiontap.js";
import type { SimonCopyColor } from "./simoncopy.js";
import type { TeamTugState } from "./teamtug.js";
export type GameType =
    | "klotski"
    | "bowman"
    | "rushhour"
    | "lightsout"
    | "codebreaker"
    | "mathsprint"
    | "pairmatch"
    | "pipeconnect"
    | "simoncopy"
    | "memorysequenceplus"
    | "oddoneout"
    | "teamtug"
    | "reactiontap";

export interface Piece {
    id: string;
    cells: [number, number][]; // [row, col]
}

export interface PuzzleState {
    board: (string | null)[][]; // 5 rows × 4 cols, cell = pieceId or null
    pieces: Record<string, Piece>;
    moves: number;
    solved: boolean;
    startTime: number;
    solveTime: number | null;
}

export interface Player {
    id: string; // socketId
    sessionId: string;
    name: string;
    connected: boolean;
    disconnectTimeout: ReturnType<typeof setTimeout> | null;
    gameState: unknown;
    rank: number | null;
    matchPoints: number;
    roundsWon: number;
}

export interface Room {
    code: string;
    hostSocketId: string;
    players: Map<string, Player>;
    phase: "lobby" | "shuffling" | "playing" | "results";
    gameType: GameType;
    totalRounds: number;
    currentRound: number;
    roundSequence: GameType[];
    gameStartTime: number | null;
    finishOrder: string[];
    roundReadyPlayerSessionIds: Set<string>;
    roundReadyOpensAt: number | null;
    roundRevealTimeout: ReturnType<typeof setTimeout> | null;
    resultsAutoAdvanceAt: number | null;
    resultsAutoAdvanceTimeout: ReturnType<typeof setTimeout> | null;
    roundEndAt: number | null;
    roundEndTimeout: ReturnType<typeof setTimeout> | null;
    teamTugState: TeamTugState | null;
    reactionTapRoomState: ReactionTapRoomState | null;
}

export interface MatchStanding {
    id: string;
    name: string;
    position: number;
    totalPoints: number;
    roundsWon: number;
    lastRoundPoints: number;
}

export interface BowmanProgressSnapshot {
    playerId: string;
    shots: ShotResult[];
    totalScore: number;
    done: boolean;
    finishTime: number | null;
    wind: number;
}

export interface LightsOutProgressSnapshot {
    playerId: string;
    board: boolean[][];
    moves: number;
    solved: boolean;
    rank: number | null;
    finishTime: number | null;
}

export interface CodebreakerProgressSnapshot {
    playerId: string;
    attempts: number;
    solved: boolean;
    done: boolean;
    finishTime: number | null;
    lastGuess: CodebreakerGuess | null;
}

export interface MathSprintProgressSnapshot {
    playerId: string;
    score: number;
    answeredCount: number;
    streak: number;
    bestStreak: number;
    lastAnswerCorrect: boolean | null;
    currentQuestion: MathSprintQuestion;
    done: boolean;
    finishTime: number | null;
}

export interface PipeConnectProgressSnapshot {
    playerId: string;
    tiles: PipeConnectPublicTile[];
    moves: number;
    solved: boolean;
    rank: number | null;
    finishTime: number | null;
}

export interface SimonCopyProgressSnapshot {
    playerId: string;
    currentRound: number;
    solved: boolean;
    done: boolean;
    failed: boolean;
    finishTime: number | null;
    latestColor: SimonCopyColor | null;
}

export interface MemorySequencePlusProgressSnapshot {
    playerId: string;
    currentRound: number;
    solved: boolean;
    done: boolean;
    failed: boolean;
    finishTime: number | null;
    latestCell: MemorySequencePlusCell | null;
}

export interface ReactionTapProgressSnapshot {
    playerId: string;
    promptsCompleted: number;
    totalPrompts: number;
    goPrompts: number;
    successfulPrompts: number;
    missedPrompts: number;
    penalties: number;
    score: number;
    averageReactionTime: number | null;
    bestReactionTime: number | null;
    latestReactionTime: number | null;
    latestOutcome: ReactionTapLatestOutcome;
    done: boolean;
}

export interface OddOneOutProgressSnapshot {
    playerId: string;
    promptsCleared: number;
    totalPrompts: number;
    score: number;
    totalResponseTime: number;
    penaltyCount: number;
    lockedOutUntil: number | null;
    done: boolean;
    finishTime: number | null;
    currentPrompt: OddOneOutPrompt | null;
}


export interface PairMatchProgressSnapshot {
    playerId: string;
    attempts: number;
    pairsFound: number;
    totalPairs: number;
    solved: boolean;
    done: boolean;
    busy: boolean;
    rank: number | null;
    finishTime: number | null;
    tiles: PairMatchPublicTile[];
}
