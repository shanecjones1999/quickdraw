// BFS solver — run with: npx tsx src/solve.ts
import { createInitialState, applyMove } from './klotski.js';
import type { PuzzleState } from './types.js';

const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;

function stateKey(state: PuzzleState): string {
  return Object.values(state.pieces)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(p => `${p.id}:${p.cells.map(([r,c]) => `${r},${c}`).join(';')}`)
    .join('|');
}

function solve() {
  const initial = createInitialState();
  const queue: { state: PuzzleState; path: string[] }[] = [{ state: initial, path: [] }];
  const visited = new Set<string>();
  visited.add(stateKey(initial));

  let iterations = 0;
  while (queue.length > 0) {
    iterations++;
    if (iterations % 5000 === 0) process.stdout.write(`  [${iterations} states explored, queue: ${queue.length}]\n`);
    if (iterations > 500_000) { console.log(`Giving up after ${iterations} states`); break; }

    const { state, path } = queue.shift()!;

    for (const pieceId of Object.keys(state.pieces)) {
      for (const dir of DIRECTIONS) {
        const { ok, state: next } = applyMove(state, pieceId, dir);
        if (!ok) continue;

        if (next.solved) {
          const solution = [...path, `${pieceId} ${dir}`];
          console.log(`\nSolveable! Solution in ${solution.length} moves:`);
          solution.slice(0, 15).forEach((s, i) => console.log(`  ${i+1}. ${s}`));
          if (solution.length > 15) console.log(`  ... (${solution.length - 15} more moves)`);
          return;
        }

        const key = stateKey(next);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({ state: next, path: [...path, `${pieceId} ${dir}`] });
        }
      }
    }
  }
  // Print a few reachable states to help diagnose
  console.log(`No solution found after ${iterations} states, visited: ${visited.size}`);
  console.log('Sample reachable piece-A positions:');
  const seen = new Set<string>();
  for (const key of visited) {
    const aPos = key.split('|').find(s => s.startsWith('A:'))?.split(':')[1];
    if (aPos && !seen.has(aPos)) { seen.add(aPos); console.log(' A:', aPos); }
  }
}

console.log('Running BFS solver…');
solve();
