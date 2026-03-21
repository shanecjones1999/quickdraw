import { useRef } from 'react';
import type { Piece, Direction } from '../types';
import styles from '../styles/KlotskiBoard.module.css';

const PIECE_COLORS: Record<string, string> = {
  A: '#e74c3c',
  B: '#3498db',
  C: '#9b59b6',
  D: '#2ecc71',
  E: '#f39c12',
  F: '#1abc9c',
  G: '#e67e22',
  H: '#e91e63',
};

interface Props {
  pieces: Record<string, Piece>;
  cellSize: number;
  selectedPiece?: string | null;
  onPieceSelect?: (id: string) => void;
  onMove?: (pieceId: string, direction: Direction) => void;
  mini?: boolean;
}

export function KlotskiBoard({ pieces, cellSize, selectedPiece, onPieceSelect, onMove, mini = false }: Props) {
  const gap = mini ? 1 : 3;
  const touchRef = useRef<{ pieceId: string; startX: number; startY: number } | null>(null);

  function handleTouchStart(e: React.TouchEvent, pieceId: string) {
    if (mini || !onMove) return;
    e.preventDefault();
    const t = e.touches[0];
    touchRef.current = { pieceId, startX: t.clientX, startY: t.clientY };
    onPieceSelect?.(pieceId);
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!touchRef.current || !onMove) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    const dx = t.clientX - touchRef.current.startX;
    const dy = t.clientY - touchRef.current.startY;
    const THRESHOLD = 25;
    if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) {
      touchRef.current = null;
      return;
    }
    let dir: Direction;
    if (Math.abs(dx) > Math.abs(dy)) {
      dir = dx > 0 ? 'right' : 'left';
    } else {
      dir = dy > 0 ? 'down' : 'up';
    }
    onMove(touchRef.current.pieceId, dir);
    touchRef.current = null;
  }

  function handleClick(pieceId: string) {
    if (mini) return;
    onPieceSelect?.(pieceId);
  }

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.board}
        style={{ width: cellSize * 4, height: cellSize * 5 }}
      >
        {Object.values(pieces).map((piece) => {
          const rows = piece.cells.map(([r]) => r);
          const cols = piece.cells.map(([, c]) => c);
          const minRow = Math.min(...rows);
          const minCol = Math.min(...cols);
          const maxRow = Math.max(...rows);
          const maxCol = Math.max(...cols);
          const top = minRow * cellSize + gap;
          const left = minCol * cellSize + gap;
          const width = (maxCol - minCol + 1) * cellSize - gap * 2;
          const height = (maxRow - minRow + 1) * cellSize - gap * 2;
          const isSelected = piece.id === selectedPiece;

          return (
            <div
              key={piece.id}
              className={`${styles.piece} ${mini ? styles.mini : ''} ${isSelected ? styles.selected : ''}`}
              style={{
                top,
                left,
                width,
                height,
                backgroundColor: PIECE_COLORS[piece.id] ?? '#888',
              }}
              onTouchStart={(e) => handleTouchStart(e, piece.id)}
              onTouchEnd={handleTouchEnd}
              onClick={() => handleClick(piece.id)}
            >
              {!mini && piece.id}
            </div>
          );
        })}
        <div className={styles.exit}>
          {!mini && <span className={styles.exitLabel}>EXIT</span>}
        </div>
      </div>
    </div>
  );
}
