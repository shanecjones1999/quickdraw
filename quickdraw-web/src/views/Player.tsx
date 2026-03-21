import { useState, useCallback, useEffect } from 'react';
import { socket } from '../socket';
import { useSocket } from '../hooks/useSocket';
import { useTimer, formatTime } from '../hooks/useTimer';
import { KlotskiBoard } from '../components/KlotskiBoard';
import type { Piece, Direction, Result } from '../types';
import styles from '../styles/Player.module.css';

type Phase = 'waiting' | 'playing' | 'solved' | 'results';

interface Props {
  roomCode: string;
  playerName: string;
}

export function Player({ roomCode, playerName }: Props) {
  const [phase, setPhase] = useState<Phase>('waiting');
  const [pieces, setPieces] = useState<Record<string, Piece> | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [moves, setMoves] = useState(0);
  const [rank, setRank] = useState<number | null>(null);
  const [solveTime, setSolveTime] = useState<number | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const elapsed = useTimer(startTime);

  const onGameStarted = useCallback(({ pieces: p }: { board: (string | null)[][]; pieces: Record<string, Piece> }) => {
    setPieces(p);
    setMoves(0);
    setSelectedPiece(null);
    setSolveTime(null);
    setRank(null);
    setStartTime(Date.now());
    setPhase('playing');
  }, []);

  const onStateUpdate = useCallback(({ pieces: p, moves: m }: { board: (string | null)[][]; pieces: Record<string, Piece>; moves: number; solved: boolean }) => {
    setPieces(p);
    setMoves(m);
  }, []);

  const onPuzzleSolved = useCallback(({ rank: r, moves: m, solveTime: t }: { rank: number; moves: number; solveTime: number }) => {
    setRank(r);
    setMoves(m);
    setSolveTime(t);
    setStartTime(null);
    setPhase('solved');
  }, []);

  const onGameOver = useCallback(({ results: r }: { results: Result[] }) => {
    setResults(r);
    setPhase('results');
  }, []);

  const onGameReset = useCallback(() => {
    setPhase('waiting');
    setPieces(null);
    setMoves(0);
    setSelectedPiece(null);
    setStartTime(null);
    setResults([]);
  }, []);

  useSocket('game:started', onGameStarted as never);
  useSocket('state:update', onStateUpdate as never);
  useSocket('puzzle:solved', onPuzzleSolved as never);
  useSocket('game:over', onGameOver as never);
  useSocket('game:reset', onGameReset as never);

  function move(pieceId: string, direction: Direction) {
    socket.emit('player:move', { pieceId, direction });
  }

  // Keyboard controls
  useEffect(() => {
    if (phase !== 'playing') return;
    function onKey(e: KeyboardEvent) {
      const dirs: Record<string, Direction> = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      };
      const dir = dirs[e.key];
      if (dir && selectedPiece) {
        e.preventDefault();
        move(selectedPiece, dir);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, selectedPiece]);

  const MEDALS = ['🥇', '🥈', '🥉'];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>⚡ Quick Draw</div>
        <div className={styles.meta}>{playerName} · {roomCode}</div>
      </header>

      <div className={styles.content}>
        {phase === 'waiting' && (
          <div className={styles.centered}>
            <div className={styles.waitTitle}>You're in!</div>
            <div className={styles.waitSub}>Waiting for the host to start the game…</div>
          </div>
        )}

        {(phase === 'playing' || phase === 'solved') && pieces && (
          <>
            <KlotskiBoard
              pieces={pieces}
              cellSize={72}
              selectedPiece={selectedPiece}
              onPieceSelect={setSelectedPiece}
              onMove={move}
            />
            <div className={styles.stats}>
              <span>Moves: <span className={styles.statVal}>{moves}</span></span>
              <span>Time: <span className={styles.statVal}>{formatTime(elapsed)}</span></span>
            </div>
            {phase === 'playing' && (
              <div className={styles.hint}>
                Drag pieces to slide them.<br />
                Get <span className={styles.hintAccent}>🔴 A</span> to the exit at the bottom!
              </div>
            )}
          </>
        )}

        {phase === 'solved' && (
          <div className={styles.solvedOverlay}>
            <div className={styles.solvedTitle}>Solved!</div>
            {rank !== null && (
              <div className={styles.solvedRank}>
                {rank <= 3 ? MEDALS[rank - 1] : `#${rank}`} Place
              </div>
            )}
            <div className={styles.solvedStats}>
              {moves} moves · {formatTime(solveTime ?? 0)}
            </div>
            <div className={styles.solvedWait}>
              Waiting for others to finish…
            </div>
          </div>
        )}

        {phase === 'results' && (
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
                  {r.solveTime !== null
                    ? <span className={styles.resultTime}>{formatTime(r.solveTime)}</span>
                    : <span className={styles.resultDnf}>DNF</span>}
                </div>
              ))}
            </div>
            <div className={styles.waitSub}>Waiting for host to start again…</div>
          </div>
        )}
      </div>
    </div>
  );
}
