# Quick Draw — Current Design

## Overview

Quick Draw is a browser-based local-multiplayer party game.

- One **host** creates a room and displays a 4-letter code on a shared screen.
- Players join on their phones.
- A match consists of **X rounds of random mini-games**, where **X is configurable by the host**.
- After each round, the host screen and player phones show **round results** plus **cumulative match standings**.
- When the final round ends, the room shows the **final leaderboard** and can be reset back to the lobby.

The current implementation uses a single shared React app plus a Node/Socket.io server that owns all room and game state.

---

## Core Match Loop

### Player Experience

1. Host creates a room.
2. Players join with a name and room code.
3. Host sets the number of rounds for the match.
4. Host starts the match.
5. The server generates a random sequence of mini-games.
6. Players compete in the current mini-game.
7. The room shows round results and updated overall standings.
8. Host starts the next round.
9. After the final round, the room shows final standings.
10. Host resets the room to begin a new match.

### Room Lifecycle

```text
Host creates room
          ↓
[LOBBY]
- Room code visible
- Players join
- Host sets total rounds
          ↓
Host clicks Start Game
          ↓
[PLAYING ROUND 1]
          ↓
[ROUND RESULTS + MATCH STANDINGS]
          ↓
Host clicks Start Next Round
          ↓
[PLAYING ROUND 2..N]
          ↓
[FINAL RESULTS]
          ↓
Host clicks Play Again
          ↓
[LOBBY]
```

---

## System Architecture

```text
┌─────────────────────────────────────────────────────┐
│                     Server                          │
│   - Express HTTP/HTTPS server                       │
│   - Socket.io realtime hub                          │
│   - In-memory rooms                                 │
│   - Authoritative game logic per mini-game          │
│   - Match sequencing + standings                    │
│   - Serves built React app                          │
└──────────────────┬──────────────────────────────────┘
                                              │ WebSocket
                    ┌──────────┴──────────┐
                    │                     │
┌───────▼──────┐     ┌────────▼────────┐
│  Host Client │     │  Player Clients  │
│  (TV/Laptop) │     │  (Phones)        │
│              │     │                  │
│  React app   │     │  React app       │
└──────────────┘     └─────────────────┘
```

### Tech Stack

| Layer | Current Choice |
| --- | --- |
| Frontend | React + Vite + TypeScript |
| Styling | CSS Modules |
| Realtime | Socket.io |
| Backend | Node.js + Express + TypeScript |
| State | In-memory room state |
| Deployment shape | Single server serving API + built frontend |

---

## Routing Model

Everything currently lives at `/`.

The app does not use URL routing. Instead, it renders based on local app state:

| Client Role / State | View |
| --- | --- |
| No role chosen | `Landing` |
| Host | `Host` |
| Player waiting / Klotski | `Player` |
| Player in dedicated mini-game | One of the mini-game player views |

---

## Current Mini-Game Roster

These are the mini-games in the current random rotation:

1. **Klotski**
2. **Bowman**
3. **Codebreaker**
4. **Pipe Connect**
5. **Simon Copy**
6. **Memory Sequence+**
7. **Rush Hour**
8. **Lights Out**

### Round selection rules

- The server builds a shuffled bag of all available mini-games.
- It consumes that bag until the requested round count is reached.
- If more rounds are needed than there are unique games, it reshuffles and continues.
- It avoids immediately repeating the same mini-game across consecutive rounds.

### Match length

- Default: **5** rounds
- Min: **1** round
- Max: **12** rounds

---

## Match Scoring

At the end of each round:

- Ranked players earn points based on placement.
- First place gets the most points.
- Unranked players get `0` points.
- A player also tracks how many rounds they won.

Current standings are sorted by:

1. **Total match points**
2. **Rounds won**
3. **Player name**

This makes standings deterministic even when players tie on points.

---

## Socket Events

The event surface is larger than the original single-puzzle design because each mini-game has its own progress/update channel.

### Shared lobby / match events

#### Client → Server

| Event | Payload | Purpose |
| --- | --- | --- |
| `host:create` | — | Create a new room |
| `host:setTotalRounds` | `{ totalRounds }` | Configure match length in lobby |
| `host:start` | — | Start a new match |
| `host:nextRound` | — | Advance from results to the next round |
| `host:end` | — | End the current round early |
| `host:reset` | — | Reset the room back to lobby |
| `player:join` | `{ roomCode, playerName }` | Join a room |

#### Server → Client

| Event | Payload | Sent To | Purpose |
| --- | --- | --- | --- |
| `room:created` | `{ roomCode }` | Host | Return new room code |
| `room:updated` | `{ players }` | Room | Sync lobby player list |
| `room:settings` | `{ totalRounds, currentRound }` | Room / joiner | Sync match settings |
| `room:gameType` | `{ gameType }` | Room / joiner | Sync current configured game type state |
| `game:started` | Round-specific payload + `{ gameType, roundNumber, totalRounds }` | Room | Start a round |
| `game:over` | `{ results, gameType, roundNumber, totalRounds, matchOver, standings }` | Room | Show round results and match standings |
| `game:reset` | — | Room | Return all clients to lobby/waiting |
| `error` | `{ message }` | Requester / room | Error state |

### Klotski events

| Direction | Event | Payload |
| --- | --- | --- |
| Client → Server | `player:move` | `{ pieceId, direction }` |
| Server → Player | `state:update` | `{ board, pieces, moves, solved }` |
| Server → Host | `player:progress` | `{ playerId, board, pieces, moves, solved, rank, solveTime }` |
| Server → Player | `puzzle:solved` | `{ rank, moves, solveTime }` |

### Bowman events

| Direction | Event | Payload |
| --- | --- | --- |
| Client → Server | `bowman:shot` | `{ angle, power }` |
| Server → Player | `bowman:result` | `{ result, totalScore, shotsLeft, done }` |
| Server → Host | `bowman:progress` | `{ playerId, shots, totalScore, done, finishTime, wind }` |

### Rush Hour events

| Direction | Event | Payload |
| --- | --- | --- |
| Client → Server | `rushhour:move` | `{ vehicleId, delta }` |
| Server → Player | `rushhour:update` | `{ vehicles, moves, solved }` |
| Server → Player | `rushhour:solved` | `{ rank, moves, finishTime }` |
| Server → Host | `rushhour:progress` | `{ playerId, vehicles, moves, solved, rank, finishTime }` |

### Lights Out events

| Direction | Event | Payload |
| --- | --- | --- |
| Client → Server | `lightsout:move` | `{ row, col }` |
| Server → Player | `lightsout:update` | `{ board, moves, solved }` |
| Server → Player | `lightsout:solved` | `{ rank, moves, finishTime }` |
| Server → Host | `lightsout:progress` | `{ playerId, board, moves, solved, rank, finishTime }` |

### Codebreaker events

| Direction | Event | Payload |
| --- | --- | --- |
| Client → Server | `codebreaker:guess` | `{ guess }` |
| Server → Player | `codebreaker:update` | `{ guesses, solved, done, finishTime }` |
| Server → Player | `codebreaker:solved` | `{ attempts, finishTime }` |
| Server → Host | `codebreaker:progress` | `{ playerId, attempts, solved, done, finishTime, lastGuess }` |

### Pipe Connect events

| Direction | Event | Payload |
| --- | --- | --- |
| Client → Server | `pipeconnect:rotate` | `{ tileId }` |
| Server → Player | `pipeconnect:update` | `{ tiles, moves, solved }` |
| Server → Player | `pipeconnect:solved` | `{ rank, moves, finishTime }` |
| Server → Host | `pipeconnect:progress` | `{ playerId, tiles, moves, solved, rank, finishTime }` |

### Simon Copy events

| Direction | Event | Payload |
| --- | --- | --- |
| Client → Server | `simoncopy:submit` | `{ inputs }` |
| Server → Player | `simoncopy:update` | `{ currentRound, solved, done, failed, finishTime }` |
| Server → Player | `simoncopy:solved` | `{ rank, roundReached, finishTime }` |
| Server → Host | `simoncopy:progress` | `{ playerId, currentRound, solved, done, failed, finishTime, latestColor }` |

### Memory Sequence+ events

| Direction | Event | Payload |
| --- | --- | --- |
| Client → Server | `memorysequenceplus:submit` | `{ inputs }` |
| Server → Player | `memorysequenceplus:update` | `{ currentRound, solved, done, failed, finishTime }` |
| Server → Player | `memorysequenceplus:solved` | `{ rank, roundReached, finishTime }` |
| Server → Host | `memorysequenceplus:progress` | `{ playerId, currentRound, solved, done, failed, finishTime, latestCell }` |

---

## Server-Side State

### Room

```ts
Room {
     code: string
     hostSocketId: string
     players: Map<socketId, Player>
     phase: 'lobby' | 'playing' | 'results'
     gameType: GameType
     totalRounds: number
     currentRound: number
     roundSequence: GameType[]
     gameStartTime: number | null
     finishOrder: socketId[]
}
```

### Player

```ts
Player {
     id: socketId
     name: string
     puzzleState: PuzzleState | null
     bowmanState: BowmanState | null
     rushHourState: RushHourState | null
     lightsOutState: LightsOutState | null
     codebreakerState: CodebreakerState | null
     pipeConnectState: PipeConnectState | null
     simonCopyState: SimonCopyState | null
     memorySequencePlusState: MemorySequencePlusState | null
     rank: number | null
     matchPoints: number
     roundsWon: number
}
```

### MatchStanding

```ts
MatchStanding {
     id: string
     name: string
     position: number
     totalPoints: number
     roundsWon: number
     lastRoundPoints: number
}
```

### Notes

- Rooms are stored entirely in memory.
- Resetting a room clears all per-round game state.
- Starting a new match resets standings and builds a new random round sequence.
- The server remains authoritative for all move validation and ranking.

---

## Mini-Game Summaries

### Klotski

- Sliding block puzzle on a `4 × 5` board.
- Goal: move the red `2 × 2` piece to the exit.
- Ranking is based on completion order.

### Bowman

- Players fire a limited number of arrows.
- Score is based on where arrows land on the target.
- Ranking is based on total score, then finish time.

### Rush Hour

- Players slide vehicles to free the target car.
- Ranking is based on solve order.

### Lights Out

- Tapping a cell toggles it and its neighbors.
- Goal: turn every light off.
- Ranking is based on solve order.

### Codebreaker

- Players guess a secret color code.
- Feedback is provided as exact/partial matches.
- Solved players rank above unsolved players.

### Pipe Connect

- Players rotate pipe tiles to complete the path.
- Ranking is based on solve order.

### Simon Copy

- Players repeat an increasingly long color sequence.
- The game tracks the highest round reached.
- Solved players rank above failed players.

### Memory Sequence+

- Players repeat an increasingly long cell sequence on a grid.
- The game tracks the highest round reached.
- Solved players rank above failed players.

---

## Frontend Structure

```text
quickdraw-web/src/
├── App.tsx
├── main.tsx
├── socket.ts
├── types.ts
├── bowmanConstants.ts
├── codebreakerConstants.ts
├── components/
│   ├── ArcheryRange.tsx
│   ├── BowmanPlayerCard.tsx
│   ├── CodebreakerPlayerCard.tsx
│   ├── KlotskiBoard.tsx
│   ├── LightsOutBoard.tsx
│   ├── LightsOutPlayerCard.tsx
│   ├── MemorySequencePlusPlayerCard.tsx
│   ├── PipeConnectBoard.tsx
│   ├── PipeConnectPlayerCard.tsx
│   ├── PlayerCard.tsx
│   ├── ResultsBoard.tsx
│   ├── RushHourBoard.tsx
│   ├── RushHourPlayerCard.tsx
│   └── SimonCopyPlayerCard.tsx
├── hooks/
│   ├── useCellSize.ts
│   ├── useSocket.ts
│   └── useTimer.ts
├── views/
│   ├── BowmanPlayer.tsx
│   ├── CodebreakerPlayer.tsx
│   ├── Host.tsx
│   ├── Landing.tsx
│   ├── LightsOutPlayer.tsx
│   ├── MemorySequencePlusPlayer.tsx
│   ├── PipeConnectPlayer.tsx
│   ├── Player.tsx
│   ├── RushHourPlayer.tsx
│   └── SimonCopyPlayer.tsx
└── styles/
          └── *.module.css
```

### View responsibilities

- `Landing.tsx`: choose host or player flow.
- `Host.tsx`: room code, lobby, match configuration, live progress grid, round results, standings.
- `Player.tsx`: shared waiting/results shell plus Klotski play.
- Dedicated `*Player.tsx` views: per-mini-game phone interactions.

---

## Current UI Design Notes

### Host screen

- Large room code and clear lobby state.
- Match setup card for configurable round count.
- `Round X / Y` badge while match is active.
- Live grid of per-player mini-cards during a round.
- Results screen shows:
  - round-specific ranking
  - cumulative standings
  - `Start Round N` or `Play Again`

### Player screen

- Lightweight waiting screen while host is in the lobby.
- Dedicated full-screen play view for each mini-game.
- Shared round-results screen between rounds.
- Final match-complete screen after the last round.

### Theme

- Dark navy background
- Gold accent for key actions and headings
- High-contrast TV-friendly typography
- Large chips/cards for couch-play readability

---

## Implementation Notes

- The server can run in HTTP or locally generated HTTPS mode.
- The React client uses a singleton Socket.io client.
- Host progress uses mini-game-specific snapshot events rather than a single generic progress model.
- Some legacy single-round concepts still exist in the codebase, but the active user flow is now **multi-round random match play**.

---

## Open Areas / Possible Next Steps

- Persist standings or session history across resets.
- Add a host-visible preview of the upcoming random round.
- Add team mode or alternate scoring formulas.
- Allow spectators or late joiners between rounds.
- Add sound, vibration, or celebratory transitions.
- Surface tie-break explanations in the UI.
