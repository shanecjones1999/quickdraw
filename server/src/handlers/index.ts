import type { GameType } from "../types.js";
import type { GameHandler } from "../gameHandler.js";
import { klotskiHandler } from "./klotski.js";
import { bowmanHandler } from "./bowman.js";
import { rushhourHandler } from "./rushhour.js";
import { lightsoutHandler } from "./lightsout.js";
import { codebreakerHandler } from "./codebreaker.js";
import { pipeconnectHandler } from "./pipeconnect.js";
import { simoncopyHandler } from "./simoncopy.js";
import { memorysequenceplusHandler } from "./memorysequenceplus.js";
import { mathsprintHandler } from "./mathsprint.js";
import { oddoneoutHandler } from "./oddoneout.js";
import { pairmatchHandler } from "./pairmatch.js";
import { reactiontapHandler } from "./reactiontap.js";
import { teamtugHandler } from "./teamtug.js";

const ALL_HANDLERS: GameHandler[] = [
    klotskiHandler,
    bowmanHandler,
    rushhourHandler,
    lightsoutHandler,
    codebreakerHandler,
    pipeconnectHandler,
    simoncopyHandler,
    memorysequenceplusHandler,
    mathsprintHandler,
    oddoneoutHandler,
    pairmatchHandler,
    reactiontapHandler,
    teamtugHandler,
];

export const gameRegistry = new Map<GameType, GameHandler>(
    ALL_HANDLERS.map((h) => [h.type, h]),
);

export const AVAILABLE_GAME_TYPES: GameType[] = ALL_HANDLERS.map(
    (h) => h.type,
);

export function getHandler(type: GameType): GameHandler {
    const handler = gameRegistry.get(type);
    if (!handler) throw new Error(`No handler for game type: ${type}`);
    return handler;
}

export function getAvailableGameTypes(playerCount: number): GameType[] {
    return ALL_HANDLERS.filter(
        (h) => !h.minPlayers || playerCount >= h.minPlayers,
    ).map((h) => h.type);
}
