export type GameType =
    | "klotski"
    | "bowman"
    | "rushhour"
    | "lightsout"
    | "codebreaker"
    | "mathsprint"
    | "pipeconnect"
    | "simoncopy"
    | "memorysequenceplus"
    | "oddoneout"
    | "pairmatch"
    | "teamtug"
    | "reactiontap";

// ─── Klotski ─────────────────────────────────────────────────────────────────

export interface Piece {
    id: string;
    cells: [number, number][];
}

export interface PlayerInfo {
    id: string;
    name: string;
    rank: number | null;
}

export interface MatchStanding {
    id: string;
    name: string;
    position: number;
    totalPoints: number;
    roundsWon: number;
    lastRoundPoints: number;
}

export interface GameOverPayload<T = unknown> {
    results: T;
    gameType: GameType;
    roundNumber: number;
    totalRounds: number;
    matchOver: boolean;
    standings: MatchStanding[];
    autoAdvanceAt: number | null;
}

export interface RoundShufflePayload {
    gameType: GameType;
    roundNumber: number;
    totalRounds: number;
    durationMs: number;
    landingBufferMs: number;
}

export interface RoundReadyStatusPayload {
    readyCount: number;
    readyTarget: number;
    readyThresholdMet: boolean;
    playerReady: boolean;
}

export type TeamTugTeamId = "red" | "blue";

export interface TeamTugMemberSnapshot {
    id: string;
    sessionId: string;
    name: string;
    connected: boolean;
    contribution: number;
}

export interface TeamTugTeamSnapshot {
    id: TeamTugTeamId;
    name: string;
    totalPulls: number;
    members: TeamTugMemberSnapshot[];
}

export interface TeamTugStateSnapshot {
    finishLine: number;
    markerPosition: number;
    timeLimitMs: number;
    startedAt: number;
    winnerTeamId: TeamTugTeamId | null;
    teams: TeamTugTeamSnapshot[];
}

export interface TeamTugTeamResult {
    id: TeamTugTeamId;
    name: string;
    pulls: number;
    winner: boolean;
    rank: number;
    members: Array<{
        id: string;
        sessionId: string;
        name: string;
        contribution: number;
    }>;
}

export interface ProgressSnapshot {
    playerId: string;
    board: (string | null)[][];
    pieces: Record<string, Piece>;
    moves: number;
    solved: boolean;
    rank: number | null;
    solveTime: number | null;
}

export interface Result {
    id: string;
    name: string;
    rank: number | null;
    moves: number | null;
    solveTime: number | null;
}

export type Direction = "up" | "down" | "left" | "right";

// ─── Bowman ──────────────────────────────────────────────────────────────────

export interface ShotResult {
    angle: number;
    power: number;
    landingY: number;
    distanceFromBullseye: number;
    score: number;
    ring: string;
}

export interface BowmanProgressSnapshot {
    playerId: string;
    shots: ShotResult[];
    totalScore: number;
    done: boolean;
    finishTime: number | null;
    wind: number;
}

// ─── Rush Hour ───────────────────────────────────────────────────────────────

export interface RushHourVehicle {
    id: string;
    orientation: "H" | "V";
    row: number;
    col: number;
    length: 2 | 3;
}

export interface RushHourProgressSnapshot {
    playerId: string;
    vehicles: RushHourVehicle[];
    moves: number;
    solved: boolean;
    rank: number | null;
    finishTime: number | null;
}

export interface RushHourResult {
    id: string;
    name: string;
    rank: number | null;
    moves: number | null;
    finishTime: number | null;
}

// ─── Lights Out ──────────────────────────────────────────────────────────────

export interface LightsOutProgressSnapshot {
    playerId: string;
    board: boolean[][];
    moves: number;
    solved: boolean;
    rank: number | null;
    finishTime: number | null;
}

export interface LightsOutResult {
    id: string;
    name: string;
    rank: number | null;
    moves: number | null;
    finishTime: number | null;
}

// ─── Codebreaker ────────────────────────────────────────────────────────────

export interface CodebreakerGuess {
    colors: string[];
    exact: number;
    partial: number;
}

export interface CodebreakerConfig {
    palette: string[];
    codeLength: number;
    maxGuesses: number;
}

export interface CodebreakerProgressSnapshot {
    playerId: string;
    attempts: number;
    solved: boolean;
    done: boolean;
    finishTime: number | null;
    lastGuess: CodebreakerGuess | null;
}

export interface CodebreakerResult {
    id: string;
    name: string;
    rank: number | null;
    attempts: number;
    finishTime: number | null;
    solved: boolean;
}

// ─── Math Sprint ─────────────────────────────────────────────────────────────

export interface MathSprintQuestion {
    id: number;
    prompt: string;
    answers: number[];
}

export interface MathSprintConfig {
    durationMs: number;
    endAt: number | null;
    question: MathSprintQuestion;
    score: number;
    answeredCount: number;
    streak: number;
    bestStreak: number;
    lastAnswerCorrect: boolean | null;
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

export interface MathSprintResult {
    id: string;
    name: string;
    rank: number | null;
    score: number;
    answeredCount: number;
    bestStreak: number;
    lastCorrectAt: number | null;
}

// ─── Pipe Connect ───────────────────────────────────────────────────────────

export interface PipeConnectTile {
    id: string;
    row: number;
    col: number;
    mask: number;
    locked: boolean;
    start: boolean;
    end: boolean;
}

export interface PipeConnectProgressSnapshot {
    playerId: string;
    tiles: PipeConnectTile[];
    moves: number;
    solved: boolean;
    rank: number | null;
    finishTime: number | null;
}

export interface PipeConnectResult {
    id: string;
    name: string;
    rank: number | null;
    moves: number | null;
    finishTime: number | null;
}

// ─── Simon Copy ─────────────────────────────────────────────────────────────

export type SimonCopyColor = "red" | "blue" | "green" | "yellow";

export interface SimonCopyConfig {
    sequence: SimonCopyColor[];
    maxRounds: number;
    colors: SimonCopyColor[];
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

export interface SimonCopyResult {
    id: string;
    name: string;
    rank: number | null;
    roundReached: number;
    finishTime: number | null;
    solved: boolean;
    failed: boolean;
}

// ─── Memory Sequence Plus ───────────────────────────────────────────────────

export interface MemorySequencePlusConfig {
    sequence: number[];
    gridSize: number;
    maxRounds: number;
}

export interface MemorySequencePlusProgressSnapshot {
    playerId: string;
    currentRound: number;
    solved: boolean;
    done: boolean;
    failed: boolean;
    finishTime: number | null;
    latestCell: number | null;
}

export interface MemorySequencePlusResult {
    id: string;
    name: string;
    rank: number | null;
    roundReached: number;
    finishTime: number | null;
    solved: boolean;
    failed: boolean;
}

export type ReactionTapLatestOutcome =
    | "success"
    | "penalty"
    | "missed"
    | "decoy"
    | null;

export interface ReactionTapConfig {
    totalPrompts: number;
    goPrompts: number;
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

export interface ReactionTapResult {
    id: string;
    name: string;
    rank: number | null;
    successfulPrompts: number;
    goPrompts: number;
    missedPrompts: number;
    penalties: number;
    score: number;
    averageReactionTime: number | null;
    bestReactionTime: number | null;
    finishTime: number | null;
}

// ─── Odd One Out ──────────────────────────────────────────────────────────────

export type OddOneOutShape =
    | "circle"
    | "square"
    | "triangle"
    | "diamond"
    | "star";

export interface OddOneOutCell {
    shape: OddOneOutShape;
    color: string;
}

export interface OddOneOutPrompt {
    rows: number;
    cols: number;
    items: OddOneOutCell[];
}

export interface OddOneOutConfig {
    prompt: OddOneOutPrompt | null;
    promptCount: number;
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

export interface OddOneOutResult {
    id: string;
    name: string;
    rank: number | null;
    promptsCleared: number;
    totalPrompts: number;
    score: number;
    totalResponseTime: number;
    penaltyCount: number;
    finishTime: number | null;
}

export interface PairMatchTile {
    id: string;
    state: "hidden" | "revealed" | "matched";
    symbol: string | null;
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
    tiles: PairMatchTile[];
}

export interface PairMatchResult {
    id: string;
    name: string;
    rank: number | null;
    attempts: number;
    pairsFound: number;
    totalPairs: number;
    finishTime: number | null;
    solved: boolean;
}

export interface BowmanResult {
    id: string;
    name: string;
    rank: number | null;
    totalScore: number;
    finishTime: number | null;
    shots: ShotResult[];
}
