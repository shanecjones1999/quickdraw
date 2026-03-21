# Quick Draw — Game Design Document

## Overview

Quick Draw is a browser-based multiplayer party game. A host (laptop connected to a TV) creates a room and displays a 4-letter code. Players join on their phones by navigating to the game URL and entering the code. The TV shows everyone's progress in real time while players compete on their own screens.

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Server                          │
│   - Room management (in-memory)                     │
│   - WebSocket hub (Socket.io or similar)            │
│   - Game state authority (validates moves)          │
│   - Serves React app as static build                │
└──────────────────┬──────────────────────────────────┘
                   │  WebSocket
        ┌──────────┴──────────┐
        │                     │
┌───────▼──────┐     ┌────────▼────────┐
│  Host Client │     │  Player Clients  │
│  (Laptop/TV) │     │  (Phones ×N)     │
│              │     │                  │
│  React app   │     │  React app       │
│  route: /host│     │  route: /play    │
└──────────────┘     └─────────────────┘
```

### Tech Stack

| Layer      | Choice                              |
|------------|-------------------------------------|
| Frontend   | React (Vite), CSS Modules           |
| Realtime   | Socket.io (or native WebSockets)    |
| Backend    | Node.js + Express + Socket.io       |
| State      | In-memory (no database)             |
| Deployment | Single server, static React build   |

---

## URL / Routing

| URL             | View         | Description                          |
|-----------------|--------------|--------------------------------------|
| `/`             | Landing      | Choose Host or Join                  |
| `/host`         | Host View    | TV screen — room code, player boards |
| `/play`         | Player View  | Phone screen — the actual game       |

Players navigate to `/play` with their name and room code filled in from the landing page form. The host navigates directly to `/host`.

---

## Room Lifecycle

```
Host opens /host
     │
     ▼
[LOBBY] ── Room code displayed ── Players join via /play
     │
     │  Host clicks "Start Game"
     ▼
[PLAYING] ── Puzzle sent to all players ── TV shows live boards
     │
     │  All players solve (or host skips)
     ▼
[RESULTS] ── Leaderboard shown on TV and phones
     │
     │  Host clicks "Play Again" or "Next Game"
     ▼
[LOBBY] (loop)
```

---

## Socket Events

### Client → Server

| Event              | Payload                        | Description                      |
|--------------------|--------------------------------|----------------------------------|
| `host:create`      | —                              | Host requests a new room         |
| `player:join`      | `{ roomCode, playerName }`     | Player joins a room              |
| `host:start`       | —                              | Host starts the round            |
| `player:move`      | `{ pieceId, direction }`       | Player submits a puzzle move     |
| `host:reset`       | —                              | Host returns room to lobby       |

### Server → Client

| Event                | Payload                                        | Sent To         |
|----------------------|------------------------------------------------|-----------------|
| `room:created`       | `{ roomCode }`                                 | Host            |
| `room:updated`       | `{ players: Player[] }`                        | All in room     |
| `game:started`       | `{ board, pieces }`                            | All in room     |
| `state:update`       | `{ board, pieces, moves, solved }`             | That player     |
| `player:progress`    | `{ playerId, board, pieces, moves, solved, rank, solveTime }` | Host only |
| `puzzle:solved`      | `{ rank, moves, solveTime }`                   | That player     |
| `game:over`          | `{ results: Result[] }`                        | All in room     |
| `game:reset`         | —                                              | All in room     |
| `error`              | `{ message }`                                  | Requester       |

---

## Server-Side State

```
Room {
  code: string                    // 4-letter code, e.g. "KPLW"
  hostSocketId: string
  players: Map<socketId, Player>
  phase: 'lobby' | 'playing' | 'results'
  gameStartTime: number | null
  finishOrder: socketId[]
}

Player {
  id: socketId
  name: string
  puzzleState: PuzzleState | null
  rank: number | null
}

PuzzleState {
  board: (string | null)[][]      // 5 rows × 4 cols, cell = pieceId or null
  pieces: Record<string, Piece>
  moves: number
  solved: boolean
  startTime: number
  solveTime: number | null
}
```

---

## Minigame #1 — Klotski

### What is Klotski?

A sliding block puzzle. The board is 4 columns × 5 rows. Players slide pieces around to maneuver the large 2×2 red block to the exit at the bottom center.

### Classic Layout

```
Col:   0    1    2    3
     ┌────┬────┬────┬────┐
Row 0│ A  │ A  │ B  │ C  │
     │    │    │    │    │
Row 1│ A  │ A  │ B  │ C  │
     ├────┼────┼────┼────┤
Row 2│ D  │ E  │ E  │ F  │
     ├────┼────┼────┼────┤
Row 3│ D  │ G  │ H  │ F  │
     ├────┼────┼────┼────┤
Row 4│    │ G  │ H  │    │
     └────┴────┴────┴────┘
                ↑ EXIT (cols 1–2, below row 4)
```

| Piece | Shape     | Color    | Role          |
|-------|-----------|----------|---------------|
| A     | 2×2       | Red      | The key piece |
| B     | 2×1 vert  | Blue     |               |
| C     | 2×1 vert  | Purple   |               |
| D     | 2×1 vert  | Green    |               |
| E     | 1×2 horiz | Orange   |               |
| F     | 2×1 vert  | Teal     |               |
| G     | 2×1 vert  | Amber    |               |
| H     | 2×1 vert  | Pink     |               |

Empty cells at start: `(4,0)` and `(4,3)`

### Win Condition

Piece A occupies cells `(3,1), (3,2), (4,1), (4,2)` — i.e. it has reached the exit.

### Move Validation (server-side)

1. Look up the piece's current cells.
2. For each cell, compute `newPos = cell + direction`.
3. Reject if any `newPos` is out of bounds.
4. Reject if any `newPos` is occupied by a *different* piece.
5. Otherwise apply the move: update all cells for that piece.

### Ranking

- Players are ranked in order of solve time (wall clock from game start).
- If a player has not solved by the time the host resets, they are unranked.

---

## React App Structure

```
src/
├── main.jsx                    # React entry, router setup
├── socket.js                   # Singleton socket connection
├── pages/
│   ├── Landing.jsx             # / — host or join
│   ├── Host.jsx                # /host — TV view
│   └── Player.jsx              # /play — phone view
├── components/
│   ├── KlotskiBoard.jsx        # Renders a Klotski board (full or mini)
│   ├── PlayerCard.jsx          # Host view: one player's mini board + stats
│   ├── Lobby.jsx               # Host lobby: player list + start button
│   ├── ResultsBoard.jsx        # Post-game leaderboard
│   └── SolvedOverlay.jsx       # Player celebration screen
├── hooks/
│   ├── useSocket.js            # Subscribe to socket events, auto-cleanup
│   └── useTimer.js             # Elapsed time ticker
└── styles/
    ├── global.css
    ├── Landing.module.css
    ├── Host.module.css
    ├── Player.module.css
    └── KlotskiBoard.module.css
```

---

## Component Details

### `KlotskiBoard`

Props: `pieces`, `cellSize`, `selectedPiece`, `onPieceSelect`, `mini` (boolean)

- Renders a `position: relative` container sized `4*cellSize × 5*cellSize`.
- Each piece is an absolutely positioned `div` derived from its cell coordinates.
- Exit indicator: a gold notch below the bottom-center of the board.
- In `mini` mode: no interaction, no labels, smaller shadows — just a live visual snapshot.

### `Player.jsx`

State machine:
```
idle → joining → waiting (lobby) → playing → solved → (waiting for game:over) → results
```

Touch controls:
- `touchstart` on a piece element → record `(pieceId, x, y)`, call `preventDefault()`
- `touchend` → compute `(dx, dy)`, threshold 25px, emit `player:move` with the dominant axis direction
- Keyboard fallback: arrow keys move the currently selected piece

### `Host.jsx`

State machine:
```
connecting → lobby → playing → results
```

- In `playing` phase, maintains a `Map<playerId, progressSnapshot>` in local state, updated on each `player:progress` event.
- Renders a responsive grid of `PlayerCard` components.
- Timer ticks every second via `useTimer` to show elapsed time per player.

---

## Visual Design

### Theme

- **Background:** Deep navy `#0d0d2b`
- **Title font:** Bold display font (e.g. *Russo One* or *Black Han Sans*)
- **Body font:** Clean sans-serif or monospace
- **Primary accent:** Gold `#ffd700`
- **Success:** Green `#2ecc71`

### Piece Colors

Consistent across full board and mini boards:

| Piece | Color               |
|-------|---------------------|
| A     | `#e74c3c` (red)     |
| B     | `#3498db` (blue)    |
| C     | `#9b59b6` (purple)  |
| D     | `#2ecc71` (green)   |
| E     | `#f39c12` (orange)  |
| F     | `#1abc9c` (teal)    |
| G     | `#e67e22` (amber)   |
| H     | `#e91e63` (pink)    |

### Host TV View Layout

```
┌─────────────────────────────────────────────────────┐
│  ⚡ QUICK DRAW                    Room: KPLW  🔴LIVE │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │  Alice   │  │   Bob    │  │  Carol   │          │
│  │ [board]  │  │ [board]  │  │ [board]  │          │
│  │ 12 moves │  │ 🥇 1:23  │  │ 8 moves  │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Player Phone View Layout

```
┌─────────────────┐
│ ⚡ Quick Draw   │
│ Alice · KPLW   │
├─────────────────┤
│                 │
│  ┌───────────┐  │
│  │  Klotski  │  │
│  │   Board   │  │
│  │  (full)   │  │
│  └───────────┘  │
│                 │
│  Moves: 14      │
│  Time:  0:47    │
│                 │
│ Drag pieces to  │
│ slide them. Get │
│ 🔴 to the exit! │
└─────────────────┘
```

---

## Future Minigames (Extensibility)

The architecture supports adding new minigames. Each minigame needs:

1. A server-side module exporting: `createState()`, `applyInput(state, input)`, `isComplete(state)`
2. A React component for the player view
3. A React component for the host mini-preview

The host's room object tracks `currentGame: 'klotski' | ...` so the server knows which logic to apply and clients know which component to render.

Potential future games:
- **Color Match** — tap the button matching the displayed color
- **Sequence Memory** — repeat a flashing pattern
- **Word Scramble** — unscramble a word as fast as possible
- **Reaction Time** — tap when the screen turns green

---

## Open Questions / Future Work

- [ ] Should the room code be shareable as a QR code on the host screen?
- [ ] Should players be able to join mid-game as spectators?
- [ ] Minimum player count to start (currently: 1)?
- [ ] Should the server kick idle rooms after N minutes?
- [ ] Persistent leaderboard across multiple rounds in a session?
- [ ] Sound effects / haptic feedback on solve?
