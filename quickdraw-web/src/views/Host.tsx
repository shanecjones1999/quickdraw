import { useState, useCallback } from 'react';
import { socket } from '../socket';
import { useSocket } from '../hooks/useSocket';
import { useTimer, formatTime } from '../hooks/useTimer';
import { PlayerCard } from '../components/PlayerCard';
import { ResultsBoard } from '../components/ResultsBoard';
import type { PlayerInfo, ProgressSnapshot, Result } from '../types';
import styles from '../styles/Host.module.css';

type Phase = 'lobby' | 'playing' | 'results';

interface Props {
  roomCode: string;
}

export function Host({ roomCode }: Props) {
  const [phase, setPhase] = useState<Phase>('lobby');
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [progress, setProgress] = useState<Map<string, ProgressSnapshot>>(new Map());
  const [results, setResults] = useState<Result[]>([]);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const now = useTimer(gameStartTime);

  const onRoomUpdated = useCallback(({ players: p }: { players: PlayerInfo[] }) => {
    setPlayers(p);
  }, []);

  const onGameStarted = useCallback(() => {
    setPhase('playing');
    setProgress(new Map());
    setGameStartTime(Date.now());
  }, []);

  const onPlayerProgress = useCallback((snap: ProgressSnapshot) => {
    setProgress(prev => new Map(prev).set(snap.playerId, snap));
  }, []);

  const onGameOver = useCallback(({ results: r }: { results: Result[] }) => {
    setPhase('results');
    setResults(r);
    setGameStartTime(null);
  }, []);

  const onGameReset = useCallback(() => {
    setPhase('lobby');
    setProgress(new Map());
    setResults([]);
    setGameStartTime(null);
  }, []);

  useSocket('room:updated', onRoomUpdated as never);
  useSocket('game:started', onGameStarted as never);
  useSocket('player:progress', onPlayerProgress as never);
  useSocket('game:over', onGameOver as never);
  useSocket('game:reset', onGameReset as never);

  function startGame() {
    socket.emit('host:start');
  }

  function resetGame() {
    socket.emit('host:reset');
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>⚡ QUICK DRAW</div>
        <div className={styles.roomInfo}>
          <span className={styles.roomCode}>Room: {roomCode}</span>
          {phase === 'playing' && <span className={styles.liveBadge}>🔴 LIVE</span>}
        </div>
      </header>

      <div className={styles.content}>
        {phase === 'lobby' && (
          <div className={styles.lobby}>
            <div className={styles.lobbyTitle}>Waiting for players…</div>
            <div className={styles.roomCode} style={{ fontSize: '3rem', letterSpacing: '0.4em' }}>
              {roomCode}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>
              Players go to this URL and enter the code
            </div>
            <div className={styles.playerList}>
              {players.length === 0
                ? <div className={styles.noPlayers}>No players yet</div>
                : players.map(p => (
                    <div key={p.id} className={styles.playerChip}>{p.name}</div>
                  ))
              }
            </div>
            <button
              className={styles.startBtn}
              onClick={startGame}
              disabled={players.length === 0}
            >
              Start Game →
            </button>
          </div>
        )}

        {phase === 'playing' && (
          <>
            <div className={styles.timer}>{formatTime(now)}</div>
            <div className={styles.grid}>
              {players.map(p => (
                <PlayerCard
                  key={p.id}
                  name={p.name}
                  snapshot={progress.get(p.id) ?? null}
                  gameStartTime={gameStartTime}
                  now={Date.now()}
                />
              ))}
            </div>
          </>
        )}

        {phase === 'results' && (
          <div className={styles.results}>
            <div className={styles.resultsTitle}>🏆 Results</div>
            <ResultsBoard results={results} />
            <button className={styles.resetBtn} onClick={resetGame}>
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
