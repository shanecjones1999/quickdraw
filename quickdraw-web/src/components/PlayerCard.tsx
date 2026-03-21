import { KlotskiBoard } from './KlotskiBoard';
import type { ProgressSnapshot } from '../types';
import { formatTime } from '../hooks/useTimer';

interface Props {
  name: string;
  snapshot: ProgressSnapshot | null;
  gameStartTime: number | null;
  now: number;
}

export function PlayerCard({ name, snapshot, gameStartTime, now }: Props) {
  const elapsed = gameStartTime ? now - gameStartTime : 0;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '0.75rem',
      padding: '0.75rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.5rem',
    }}>
      <div style={{ fontWeight: 600, fontSize: '1rem', color: snapshot?.solved ? '#2ecc71' : '#fff' }}>
        {snapshot?.solved && `🥇 `}{name}
      </div>
      {snapshot ? (
        <>
          <KlotskiBoard pieces={snapshot.pieces} cellSize={30} mini />
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
            {snapshot.solved
              ? `✓ ${formatTime(snapshot.solveTime ?? 0)} · ${snapshot.moves} moves`
              : `${snapshot.moves} moves · ${formatTime(elapsed)}`}
          </div>
        </>
      ) : (
        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>Waiting…</div>
      )}
    </div>
  );
}
