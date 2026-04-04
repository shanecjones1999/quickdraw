# Quick Draw — Game Ideas

This document tracks proposed new mini-games for the Quick Draw rotation, covering both **solo** (every player competes individually) and **team** (players are grouped and collaborate or compete as a unit).

Existing games for reference: Klotski, Bowman, Codebreaker, Pipe Connect, Simon Copy, Memory Sequence+, Rush Hour, Lights Out.

---

## Format Key

Each entry includes:

- **Category** — `logic` · `speed` · `memory` · `precision` · `creativity` · `reaction`
- **Format** — `solo` · `team`
- **Complexity** — rough implementation effort: `low` · `medium` · `high`
- **Round type** — `race` (finish first) · `score` (highest score) · `survival` (last standing)

---

## Solo Games

Each player competes independently. Host screen shows all players' progress cards.

---

### 🔢 Number Slide

**Category:** logic · **Format:** solo · **Complexity:** low · **Round type:** race

The classic 15-puzzle. Slide numbered tiles on a 4×4 grid (one blank space) until they are in order.

- **Controls:** Tap a tile adjacent to the blank space to slide it.
- **Win condition:** Fastest player to arrange all tiles in order wins.
- **Notes:** Server generates the same shuffled starting layout for all players. Solvability must be validated server-side. Pairs well with Rush Hour as a "slide" category twin.

---

### 🧮 Math Sprint

**Category:** speed · **Format:** solo · **Complexity:** low · **Round type:** score

Players solve a rapid stream of simple arithmetic questions within a fixed time limit (e.g. 45 seconds).

- **Controls:** Tap the correct answer from 4 choices.
- **Win condition:** Most correct answers wins; ties broken by time of last answer.
- **Notes:** Difficulty can scale per question (addition → subtraction → multiplication). Accessible to all ages. Very fast to implement.

---

### ⚡ Reaction Tap

**Category:** reaction · **Format:** solo · **Complexity:** low · **Round type:** score

The screen flashes a color or shape trigger. Players tap as fast as possible when the correct trigger appears, and must not tap on decoys.

- **Controls:** Tap the screen when the correct signal appears.
- **Win condition:** Lowest average reaction time across N rounds wins; penalize false taps.
- **Notes:** Decoys (wrong color/shape) punish reckless tapping. Great round pacing contrast against logic-heavy games.

---

### 🎯 Steady Hand

**Category:** precision · **Format:** solo · **Complexity:** medium · **Round type:** score

A cursor (controlled by drag) must travel from start to end through a winding narrow corridor without touching the walls.

- **Controls:** Drag your finger slowly and carefully along the path.
- **Win condition:** Fastest clean completion wins; touching walls adds a time penalty per touch.
- **Notes:** Path is server-generated and identical for all players. Works well on phones with touch drag. High spectator value on the host screen.

---

### 🔍 Odd One Out

**Category:** speed · **Format:** solo · **Complexity:** low · **Round type:** race

A grid of symbols, colors, or shapes is shown. All items match except one. Players must identify and tap the odd one out.

- **Controls:** Tap the cell that doesn't belong.
- **Win condition:** Fastest correct tap wins; wrong taps add a short lockout.
- **Notes:** Categories can rotate: color shade, shape orientation, symbol count, rotated character. Very quick rounds (5–10 seconds each). Can run multiple rounds within the mini-game to aggregate a score.

---

### 🃏 Pair Match

**Category:** memory · **Format:** solo · **Complexity:** low · **Round type:** race

A grid of face-down tiles hides matching pairs. Players flip two tiles at a time to find all pairs.

- **Controls:** Tap to reveal a tile; tap a second tile to attempt a match.
- **Win condition:** Fastest player to clear all pairs wins.
- **Notes:** Each player has their own independent board. Board size can vary (e.g. 4×4 = 8 pairs). A classic that needs no explanation at the start of a round.

---

### 🌀 Maze Runner

**Category:** logic · **Format:** solo · **Complexity:** medium · **Round type:** race

Players navigate a randomly generated maze from entrance to exit by swiping directions.

- **Controls:** Swipe or tap directional arrows to move.
- **Win condition:** Fastest player to reach the exit wins.
- **Notes:** Server generates the same maze for all players. Host screen shows each player's position in their maze (% progress or distance to exit). Can vary maze size by difficulty setting.

---

### 📦 Sokoban

**Category:** logic · **Format:** solo · **Complexity:** medium · **Round type:** race

Players push crates onto target squares on a small grid. Crates can only be pushed, not pulled.

- **Controls:** Tap a direction to move the player one step.
- **Win condition:** Fastest player to place all crates on targets wins.
- **Notes:** All players receive the same puzzle. Pairs naturally with Klotski and Rush Hour in the "sliding objects" family. Server validates each move.

---

### 🔵 Nonogram

**Category:** logic · **Format:** solo · **Complexity:** medium · **Round type:** race

Fill grid cells based on number clues for each row and column. The completed grid reveals a hidden pixel image.

- **Controls:** Tap to fill a cell, long-press or double-tap to mark it as empty.
- **Win condition:** Fastest correct solution wins; partially incorrect boards do not count.
- **Notes:** Use small grids (5×5 or 7×7) to keep rounds short. All players solve the same puzzle.

---

### 🃏 Card Count

**Category:** memory · **Format:** solo · **Complexity:** low · **Round type:** score

A sequence of playing cards is briefly shown (e.g. a fast flip animation). Players must answer a question about the sequence — how many red cards, the sum of face cards, the last card shown, etc.

- **Controls:** Tap the correct answer from multiple choice options.
- **Win condition:** Most correct answers wins; ties broken by combined response time.
- **Notes:** Question type changes each sub-round. Short, punchy, and easy to understand.

---

### 🎨 Color Match

**Category:** precision · **Format:** solo · **Complexity:** low · **Round type:** score

Players use three sliders (hue, saturation, lightness) to mix a color that matches a target swatch as closely as possible within a time limit.

- **Controls:** Drag three sliders to dial in the color.
- **Win condition:** Smallest color distance delta from the target wins.
- **Notes:** Host screen shows each player's attempt vs the target in real time. Visually fun to spectate. Works well as a late-game round because it rewards precision over reflexes.

---

### 🔤 Word Unscramble

**Category:** speed · **Format:** solo · **Complexity:** low · **Round type:** race

A word is scrambled into a random letter order. Players rearrange the letters to spell the correct word.

- **Controls:** Tap letters in order to spell the word, or drag-to-rearrange.
- **Win condition:** Fastest correct answer wins.
- **Notes:** All players receive the same scrambled word. Word list should avoid proper nouns and ambiguous multi-solution scrambles. Best paired with rounds of 3–5 words scored cumulatively.

---

### 🧩 Pattern Copy

**Category:** memory · **Format:** solo · **Complexity:** low · **Round type:** score

A pattern is briefly flashed on a grid (lit cells form a shape or image). After a short hide window, players must recreate it from memory.

- **Controls:** Tap cells to toggle them on or off, then submit.
- **Win condition:** Highest accuracy wins; ties broken by submission speed.
- **Notes:** Distinct from Memory Sequence+ because it tests spatial recall, not tap order. Patterns grow more complex across rounds.

---

## Team Games

Players are divided into teams (2+ players per team). Some games are **collaborative** (teammates work together toward a shared goal); others are **competitive** (teams race or score against each other).

Team assignment should be automatic (balanced by player count) or optional host-controlled.

---

### 🏃 Relay Race

**Category:** speed · **Format:** team · **Complexity:** medium · **Round type:** race

Each team member must complete a short sub-puzzle in sequence. When one player finishes their stage, the next player's stage unlocks.

- **Controls:** Stage-dependent (could be a quick tap challenge, math question, or Simon-style sequence).
- **Win condition:** First team to have all members complete their stage wins.
- **Notes:** Stages should be parallel in difficulty. Host screen shows each team's relay chain with player checkmarks lighting up. Creates natural "come on!" moments as team members cheer each other.

---

### 💣 Team Tug of War

**Category:** speed · **Format:** team · **Complexity:** low · **Round type:** score

Both teams tap (or solve simple micro-tasks) as fast as possible. Each action moves a shared indicator toward the tapping team's side.

- **Controls:** Tap repeatedly, or solve a quick task (e.g. tap the correct color).
- **Win condition:** The team that pulls the indicator past the finish line wins.
- **Notes:** Real-time shared state on the host screen showing the tug-of-war bar. Highly social — loud, fast, and visual. Low complexity to implement.

---

### 🤝 Collective Codebreaker

**Category:** logic · **Format:** team · **Complexity:** medium · **Round type:** race

Teams share a single hidden code, but each player can only see their own guesses and feedback. The team must communicate verbally and coordinate their guesses to crack the code in fewer attempts than the opposing team.

- **Controls:** Same as solo Codebreaker — build a guess and submit it.
- **Win condition:** Team that solves the code in fewer total guesses wins; ties broken by time.
- **Notes:** Encourages verbal communication, which is the point in a party setting. Team guess history is visible to all teammates. Host screen shows combined guess count per team.

---

### 🧠 Team Memory Chain

**Category:** memory · **Format:** team · **Complexity:** medium · **Round type:** survival

A growing sequence of items is shown. The team must collectively recall it — but each player is only responsible for memorizing their assigned positions in the sequence.

- **Controls:** Watch the sequence, then each player taps the items assigned to them in order.
- **Win condition:** Team with the longest streak without errors survives longest.
- **Notes:** Works like Memory Sequence+ but distributes cognitive load across teammates. Host screen shows which team member is responsible for which part of the sequence.

---

### 🗺️ Territory Capture

**Category:** strategy · **Format:** team · **Complexity:** high · **Round type:** score

A shared grid is shown on all players' phones. Players from each team tap cells to claim them for their team. Claimed cells can be contested by opponents.

- **Controls:** Tap any unclaimed (or opponent-claimed) cell to claim it.
- **Win condition:** Team with the most cells claimed when the timer runs out wins.
- **Notes:** All players share a single board state (server authoritative). High server event volume — requires debouncing. Host screen shows the live territory board in real time. High spectator value.

---

### 🔔 Hot Potato

**Category:** reaction · **Format:** team · **Complexity:** medium · **Round type:** survival

A digital "bomb" timer is passed between all players. The player holding it when the timer hits zero is out. Last player (or team) standing wins.

- **Controls:** Tap "Pass" to throw the potato to a random teammate or opponent.
- **Win condition:** Last player remaining wins; team version: last team with any surviving member wins.
- **Notes:** Pass timing is hidden (random countdown) so players cannot time-game the pass. Host screen shows who currently holds the potato with a ticking visual.

---

### 🎤 Team Word Chain

**Category:** creativity · **Format:** team · **Complexity:** low · **Round type:** survival

Teams take turns adding a word that begins with the last letter of the previous word. A player who can't answer in time or repeats a word is eliminated.

- **Controls:** Type a word and submit; server validates it starts with the correct letter and hasn't been used.
- **Win condition:** Team with players still standing at the end survives; other team loses.
- **Notes:** Requires a dictionary lookup on the server. Best played with a short timer (5–8 seconds per turn). Low visual complexity, high verbal energy.

---

### ❓ Team Trivia

**Category:** knowledge · **Format:** team · **Complexity:** low · **Round type:** score

Each team is given the same trivia question. All team members submit an answer individually; the team's score is based on majority vote correctness (or fastest correct answer).

- **Controls:** Tap one of four multiple-choice answers.
- **Win condition:** Team with the most correct answers (or points from fastest correct picks) wins.
- **Notes:** Requires a curated question bank on the server. Host screen shows team answer distribution in real time before revealing correct answer. Natural crowd moment when the answer flips.

---

### 🏗️ Cooperative Build

**Category:** logic · **Format:** team · **Complexity:** high · **Round type:** race

A multi-part logic puzzle (e.g. a pipe network, a circuit, a bridge) is split across team members. Each player solves their section; the pieces must fit together when combined.

- **Controls:** Section-dependent; could be pipe rotation, grid filling, or path drawing.
- **Win condition:** First team to complete and connect all sections wins.
- **Notes:** High coordination value. Distinct from Relay Race because all members work simultaneously. Requires careful interface design for section handoff.

---

## Possible New Categories

The existing games cover `logic`, `speed`, `memory`, and `precision`. These ideas introduce additional categories worth discussing:

| Category | Description | Example games |
|---|---|---|
| `reaction` | Respond to a stimulus as fast as possible | Reaction Tap, Hot Potato |
| `creativity` | Open-ended or subjective output | Word Chain, Color Match |
| `knowledge` | Recall of external facts | Team Trivia, Card Count |
| `strategy` | Shared board decisions with tradeoffs | Territory Capture, Cooperative Build |

---

## Implementation Priority Suggestions

### Easiest solo wins (low effort, high fun)

1. **Math Sprint** — clear mechanics, fast to build, broad appeal
2. **Odd One Out** — very short rounds, easy logic, high contrast with existing games
3. **Pair Match** — zero learning curve, familiar format
4. **Reaction Tap** — fast-paced round type the current roster lacks

### Best team game to ship first

1. **Team Tug of War** — lowest complexity, real-time shared state already supported by the server model, high social energy

### Longest runway but highest impact

1. **Territory Capture** — visually spectacular on the host screen, introduces a new shared-board mechanic
2. **Cooperative Build** — genuinely novel team coordination format
