import { RushHourBoard } from './RushHourBoard';
import type { RushHourProgressSnapshot } from '../types';
import styles from '../styles/RushHourPlayerCard.module.css';

interface Props {
  name: string;
  snapshot: RushHourProgressSnapshot | null;
}

const CELL = 36;

export function RushHourPlayerCard({ name, snapshot }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.name}>{name}</span>
        {snapshot?.solved && <span className={styles.done}>✓ Solved</span>}
      </div>
      {snapshot ? (
        <>
          <RushHourBoard
            vehicles={snapshot.vehicles}
            cellSize={CELL}
            solved={snapshot.solved}
            readonly
          />
          <div className={styles.stats}>
            <span>{snapshot.moves} moves</span>
            {snapshot.rank !== null && (
              <span className={styles.rank}>#{snapshot.rank}</span>
            )}
          </div>
        </>
      ) : (
        <div className={styles.waiting}>Waiting…</div>
      )}
    </div>
  );
}
