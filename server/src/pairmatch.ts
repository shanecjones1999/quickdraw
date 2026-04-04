export const PAIR_MATCH_GRID_SIZE = 4;
export const PAIR_MATCH_PAIR_COUNT = 8;
export const PAIR_MATCH_MISMATCH_REVEAL_MS = 900;

const PAIR_MATCH_SYMBOLS = [
    "🍎",
    "🌙",
    "⭐",
    "🎈",
    "🎵",
    "🦄",
    "⚡",
    "🌈",
    "🍀",
    "🔥",
    "🎯",
    "🪐",
] as const;

export type PairMatchSymbol = (typeof PAIR_MATCH_SYMBOLS)[number];

export interface PairMatchTile {
    id: string;
    symbol: PairMatchSymbol;
    matched: boolean;
    revealed: boolean;
}

export interface PairMatchPublicTile {
    id: string;
    state: "hidden" | "revealed" | "matched";
    symbol: PairMatchSymbol | null;
}

export interface PairMatchState {
    tiles: PairMatchTile[];
    attempts: number;
    pairsFound: number;
    solved: boolean;
    done: boolean;
    busy: boolean;
    startTime: number;
    finishTime: number | null;
    mismatchTimeout: ReturnType<typeof setTimeout> | null;
}

function shuffle<T>(items: T[]): T[] {
    const next = [...items];

    for (let index = next.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }

    return next;
}

function createSymbols(): PairMatchSymbol[] {
    return shuffle([...PAIR_MATCH_SYMBOLS]).slice(0, PAIR_MATCH_PAIR_COUNT);
}

function createTileLayout(layout?: PairMatchSymbol[]): PairMatchTile[] {
    const symbols = layout
        ? [...layout]
        : shuffle(
              createSymbols().flatMap((symbol) => [symbol, symbol] as const),
          );

    return symbols.map((symbol, index) => ({
        id: `tile-${index}`,
        symbol,
        matched: false,
        revealed: false,
    }));
}

export function createPairMatchState(layout?: PairMatchSymbol[]): PairMatchState {
    return {
        tiles: createTileLayout(layout),
        attempts: 0,
        pairsFound: 0,
        solved: false,
        done: false,
        busy: false,
        startTime: Date.now(),
        finishTime: null,
        mismatchTimeout: null,
    };
}

export function getPairMatchLayout(state: PairMatchState): PairMatchSymbol[] {
    return state.tiles.map((tile) => tile.symbol);
}

export function toPublicPairMatchTiles(
    tiles: PairMatchTile[],
): PairMatchPublicTile[] {
    return tiles.map((tile) => ({
        id: tile.id,
        state: tile.matched ? "matched" : tile.revealed ? "revealed" : "hidden",
        symbol: tile.matched || tile.revealed ? tile.symbol : null,
    }));
}

export function clearPairMatchMismatch(
    state: PairMatchState,
): PairMatchState {
    return {
        ...state,
        tiles: state.tiles.map((tile) =>
            tile.matched ? tile : { ...tile, revealed: false },
        ),
        busy: false,
        mismatchTimeout: null,
    };
}

export function flipPairMatchTile(
    state: PairMatchState,
    tileId: string,
): { ok: boolean; state: PairMatchState } {
    if (state.done || state.busy) return { ok: false, state };

    const tileIndex = state.tiles.findIndex((tile) => tile.id === tileId);
    if (tileIndex === -1) return { ok: false, state };

    const targetTile = state.tiles[tileIndex];
    if (targetTile.matched || targetTile.revealed) {
        return { ok: false, state };
    }

    const tiles = state.tiles.map((tile, index) =>
        index === tileIndex ? { ...tile, revealed: true } : tile,
    );
    const revealedTiles = tiles.filter((tile) => tile.revealed && !tile.matched);

    if (revealedTiles.length < 2) {
        return {
            ok: true,
            state: {
                ...state,
                tiles,
            },
        };
    }

    const [firstTile, secondTile] = revealedTiles;
    const attempts = state.attempts + 1;

    if (firstTile.symbol !== secondTile.symbol) {
        return {
            ok: true,
            state: {
                ...state,
                tiles,
                attempts,
                busy: true,
            },
        };
    }

    const pairsFound = state.pairsFound + 1;
    const solved = pairsFound >= PAIR_MATCH_PAIR_COUNT;

    return {
        ok: true,
        state: {
            ...state,
            tiles: tiles.map((tile) =>
                tile.id === firstTile.id || tile.id === secondTile.id
                    ? { ...tile, matched: true, revealed: false }
                    : tile,
            ),
            attempts,
            pairsFound,
            solved,
            done: solved,
            busy: false,
            finishTime: solved ? Date.now() - state.startTime : null,
        },
    };
}
