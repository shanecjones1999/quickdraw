import { ArcheryRange } from './ArcheryRange';
import type { BowmanProgressSnapshot } from '../types';
import { MAX_SHOTS } from '../bowmanConstants';

interface Props {
  name:     string;
  snapshot: BowmanProgressSnapshot | null;
}

export function BowmanPlayerCard({ name, snapshot }: Props) {
  const done = snapshot?.done ?? false;

  return (
    <div style={{
      background:    'rgba(255,255,255,0.05)',
      border:        `1px solid ${done ? 'rgba(46,204,113,0.4)' : 'rgba(255,255,255,0.1)'}`,
      borderRadius:  '0.75rem',
      padding:       '0.75rem',
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      gap:           '0.5rem',
    }}>
      {/* Name row */}
      <div style={{ fontWeight: 600, fontSize: '1rem', color: done ? '#2ecc71' : '#fff' }}>
        {done ? '✅ ' : ''}{name}
      </div>

      {snapshot ? (
        <>
          {/* Mini range */}
          <div style={{ width: '100%', aspectRatio: '800 / 420', borderRadius: '0.4rem', overflow: 'hidden' }}>
            <ArcheryRange wind={snapshot.wind} shots={snapshot.shots} mini />
          </div>

          {/* Stats row */}
          <div style={{
            display:       'flex',
            gap:           '0.75rem',
            fontSize:      '0.8rem',
            color:         'rgba(255,255,255,0.7)',
            alignItems:    'center',
          }}>
            <span style={{ color: '#ffd700', fontWeight: 700, fontSize: '1rem' }}>
              {snapshot.totalScore}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>pts</span>
            <span>{snapshot.shots.length}/{MAX_SHOTS} shots</span>
          </div>

          {/* Per-shot mini scores */}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {Array.from({ length: MAX_SHOTS }, (_, i) => {
              const shot  = snapshot.shots[i];
              const color = shot
                ? ({ bullseye: '#ffd700', inner: '#2ecc71', middle: '#3498db', outer: '#e67e22', miss: '#e74c3c' }[shot.ring] ?? '#aaa')
                : 'rgba(255,255,255,0.15)';
              return (
                <div key={i} style={{
                  width:        '32px',
                  height:       '32px',
                  borderRadius: '50%',
                  background:   color,
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent: 'center',
                  fontSize:     '0.7rem',
                  fontWeight:   700,
                  color:        shot ? '#000' : 'rgba(255,255,255,0.2)',
                }}>
                  {shot ? shot.score : '—'}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>Waiting…</div>
      )}
    </div>
  );
}
