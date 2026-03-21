import { useState } from 'react';
import { socket } from '../socket';
import styles from '../styles/Landing.module.css';

type Screen = 'home' | 'join';

interface Props {
  onHostCreated: (roomCode: string) => void;
  onPlayerJoined: (roomCode: string, playerName: string) => void;
}

export function Landing({ onHostCreated, onPlayerJoined }: Props) {
  const [screen, setScreen] = useState<Screen>('home');
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleHost() {
    setLoading(true);
    socket.connect();
    socket.once('room:created', ({ roomCode }: { roomCode: string }) => {
      setLoading(false);
      onHostCreated(roomCode);
    });
    socket.once('error', ({ message }: { message: string }) => {
      setLoading(false);
      setError(message);
    });
    socket.emit('host:create');
  }

  function handleJoinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roomCode.trim() || !playerName.trim()) {
      setError('Enter both a room code and your name.');
      return;
    }
    setError('');
    setLoading(true);
    if (!socket.connected) socket.connect();

    socket.once('room:updated', () => {
      setLoading(false);
      onPlayerJoined(roomCode.toUpperCase().trim(), playerName.trim());
    });
    socket.once('error', ({ message }: { message: string }) => {
      setLoading(false);
      setError(message);
    });
    socket.emit('player:join', { roomCode: roomCode.toUpperCase().trim(), playerName: playerName.trim() });
  }

  if (screen === 'join') {
    return (
      <div className={styles.page}>
        <div className={styles.logo}>
          <span className={styles.lightning}>⚡</span> QUICK DRAW
        </div>
        <form className={styles.joinForm} onSubmit={handleJoinSubmit}>
          <h2>Join a Room</h2>
          <input
            className={styles.input}
            placeholder="Room Code"
            maxLength={4}
            value={roomCode}
            onChange={e => setRoomCode(e.target.value.toUpperCase())}
            autoFocus
          />
          <input
            className={`${styles.input} ${styles.inputName}`}
            placeholder="Your name"
            maxLength={16}
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
          />
          {error && <div className={styles.error}>{error}</div>}
          <button className={styles.btnPrimary} type="submit" disabled={loading}>
            {loading ? 'Joining…' : 'Join Game →'}
          </button>
          <button type="button" className={styles.back} onClick={() => { setScreen('home'); setError(''); }}>
            ← Back
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.logo}>
        <span className={styles.lightning}>⚡</span> QUICK DRAW
      </div>
      <div className={styles.subtitle}>Multiplayer party games</div>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.buttons}>
        <button className={styles.btnPrimary} onClick={handleHost} disabled={loading}>
          {loading ? 'Creating…' : '📺 Host a Game'}
        </button>
        <button className={styles.btnSecondary} onClick={() => { setScreen('join'); setError(''); }}>
          📱 Join a Game
        </button>
      </div>
    </div>
  );
}
