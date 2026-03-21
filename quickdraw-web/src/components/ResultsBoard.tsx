import type { Result } from '../types';
import { formatTime } from '../hooks/useTimer';

const MEDALS = ['🥇', '🥈', '🥉'];

interface Props {
  results: Result[];
}

export function ResultsBoard({ results }: Props) {
  return (
    <div style={{ width: '100%', maxWidth: 480 }}>
      {results.map((r, i) => (
        <div key={r.id} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.85rem 1rem',
          borderRadius: '0.5rem',
          background: i === 0 ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${i === 0 ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
          marginBottom: '0.5rem',
        }}>
          <span style={{ fontSize: '1.5rem', width: '2rem' }}>
            {r.rank !== null && r.rank <= 3 ? MEDALS[r.rank - 1] : r.rank ?? '—'}
          </span>
          <span style={{ flex: 1, fontWeight: 600, fontSize: '1.1rem' }}>{r.name}</span>
          {r.solveTime !== null ? (
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
              {formatTime(r.solveTime)} · {r.moves} moves
            </span>
          ) : (
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem' }}>DNF</span>
          )}
        </div>
      ))}
    </div>
  );
}
