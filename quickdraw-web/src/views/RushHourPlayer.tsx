import { useState, useCallback } from 'react';
import { socket } from '../socket';
import { useSocket } from '../hooks/useSocket';
import { RushHourBoard } from '../components/RushHourBoard';
import type { RushHourVehicle, RushHourResult } from '../types';
import styles from '../styles/Player.module.css';

const CELL = 72;
const MEDALS = ['🥇', '🥈', '🥉'];

interface Props {
  roomCode: string;
  playerName: string;
  initialVehicles: RushHourVehicle[];
}

type Phase = 'playing' | 'solved' | 'results';

export function RushHourPlayer({ roomCode, playerName, initialVehicles }: Props) {
  const [vehicles, setVehicles] = useState<RushHourVehicle[]>(initialVehicles);
  const [moves,    setMoves]    = useState(0);
  const [phase,    setPhase]    = useState<Phase>('playing');
  const [rank,     setRank]     = useState<number | null>(null);
  const [results,  setResults]  = useState<RushHourResult[]>([]);

  const onUpdate = useCallback(({ vehicles: v, moves: m }: { vehicles: RushHourVehicle[]; moves: number; solved: boolean }) => {
    setVehicles(v);
    setMoves(m);
  }, []);

  const onSolved = useCallback(({ rank: r, moves: m }: { rank: number; moves: number }) => {
    setRank(r);
    setMoves(m);
    setPhase('solved');
  }, []);

  const onGameOver = useCallback(({ results: r }: { results: RushHourResult[] }) => {
    setResults(r);
    setPhase('results');
  }, []);

  useSocket('rushhour:update', onUpdate as never);
  useSocket('rushhour:solved', onSolved as never);
  useSocket('game:over',       onGameOver as never);

  function handleMove(vehicleId: string, delta: number) {
    socket.emit('rushhour:move', { vehicleId, delta });
  }

  if (phase === 'results') {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.logo}>⚡ Quick Draw</div>
          <div className={styles.meta}>{playerName} · {roomCode}</div>
        </header>
        <div className={styles.content}>
          <div className={styles.centered}>
            <div className={styles.waitTitle}>🏆 Game Over!</div>
            <div className={styles.resultsList}>
              {results.map((r, i) => (
                <div
                  key={r.id}
                  className={`${styles.resultRow} ${r.id === socket.id ? styles.highlight : ''}`}
                >
                  <span>{r.rank !== null && r.rank <= 3 ? MEDALS[r.rank - 1] : `#${r.rank ?? i + 1}`}</span>
                  <span className={styles.resultName}>{r.name}{r.id === socket.id ? ' (you)' : ''}</span>
                  {r.moves !== null
                    ? <span className={styles.resultTime}>{r.moves} moves</span>
                    : <span className={styles.resultDnf}>DNF</span>}
                </div>
              ))}
            </div>
            <div className={styles.waitSub}>Waiting for host to start again…</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>⚡ Quick Draw</div>
        <div className={styles.meta}>{playerName} · {roomCode}</div>
      </header>

      <div className={styles.content}>
        <RushHourBoard
          vehicles={vehicles}
          cellSize={CELL}
          solved={phase === 'solved'}
          onMove={handleMove}
        />

        <div className={styles.stats}>
          <span>Moves: <span className={styles.statVal}>{moves}</span></span>
        </div>

        {phase === 'playing' && (
          <div className={styles.hint}>
            Drag vehicles to slide them.<br />
            Get <span className={styles.hintAccent}>🚗 red</span> to the exit on the right!
          </div>
        )}

        {phase === 'solved' && (
          <div className={styles.solvedOverlay}>
            <div className={styles.solvedTitle}>Solved!</div>
            {rank !== null && (
              <div className={styles.solvedRank}>
                {rank <= 3 ? MEDALS[rank - 1] : `#${rank}`} Place
              </div>
            )}
            <div className={styles.solvedStats}>{moves} moves</div>
            <div className={styles.solvedWait}>Waiting for others to finish…</div>
          </div>
        )}
      </div>
    </div>
  );
}
