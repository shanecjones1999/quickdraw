import { useState, useRef, useCallback } from 'react';
import type { RushHourVehicle } from '../types';
import styles from '../styles/RushHourBoard.module.css';

const GRID = 6;

const VEHICLE_COLORS: Record<string, string> = {
  red: '#e53935',
  A:   '#1e88e5',
  B:   '#43a047',
  C:   '#fb8c00',
  D:   '#8e24aa',
  E:   '#00acc1',
  F:   '#f4511e',
  G:   '#6d4c41',
  H:   '#3949ab',
  I:   '#00897b',
  J:   '#c0ca33',
  K:   '#e91e63',
  L:   '#607d8b',
};

function getColor(id: string) {
  return VEHICLE_COLORS[id] ?? '#999';
}

interface Props {
  vehicles: RushHourVehicle[];
  cellSize: number;
  solved: boolean;
  onMove?: (vehicleId: string, delta: number) => void;
  readonly?: boolean;
}

export function RushHourBoard({ vehicles, cellSize, solved, onMove, readonly = false }: Props) {
  const [dragging, setDragging] = useState<{
    id: string;
    orientation: 'H' | 'V';
    startX: number;
    startY: number;
    origRow: number;
    origCol: number;
    dragDelta: number;
  } | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);

  const vehicleMap = Object.fromEntries(vehicles.map(v => [v.id, v]));

  const onPointerDown = useCallback((e: React.PointerEvent, id: string) => {
    if (readonly || solved) return;
    const v = vehicleMap[id];
    if (!v) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging({
      id,
      orientation: v.orientation,
      startX: e.clientX,
      startY: e.clientY,
      origRow: v.row,
      origCol: v.col,
      dragDelta: 0,
    });
    e.preventDefault();
  }, [vehicleMap, readonly, solved]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.startX;
    const dy = e.clientY - dragging.startY;
    const raw = dragging.orientation === 'H' ? dx : dy;
    const delta = Math.round(raw / cellSize);
    setDragging(prev => prev ? { ...prev, dragDelta: delta } : null);
  }, [dragging, cellSize]);

  const onPointerUp = useCallback(() => {
    if (!dragging) return;
    const { id, dragDelta } = dragging;
    if (dragDelta !== 0 && onMove) {
      onMove(id, dragDelta > 0 ? 1 : -1);
      // For multi-step drags, emit multiple moves
      const steps = Math.abs(dragDelta);
      for (let i = 1; i < steps; i++) {
        onMove(id, dragDelta > 0 ? 1 : -1);
      }
    }
    setDragging(null);
  }, [dragging, onMove]);

  const boardPx = cellSize * GRID;

  return (
    <div
      className={styles.wrapper}
      style={{ width: boardPx, height: boardPx }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      ref={boardRef}
    >
      {/* Grid lines */}
      <svg
        className={styles.grid}
        width={boardPx}
        height={boardPx}
        viewBox={`0 0 ${boardPx} ${boardPx}`}
      >
        {Array.from({ length: GRID + 1 }, (_, i) => (
          <g key={i}>
            <line x1={i * cellSize} y1={0} x2={i * cellSize} y2={boardPx} stroke="#ccc" strokeWidth={1} />
            <line x1={0} y1={i * cellSize} x2={boardPx} y2={i * cellSize} stroke="#ccc" strokeWidth={1} />
          </g>
        ))}
        {/* Exit arrow on the right of row 2 */}
        <polygon
          points={`${boardPx + 2},${2.5 * cellSize} ${boardPx + cellSize * 0.4},${2.2 * cellSize} ${boardPx + cellSize * 0.4},${2.8 * cellSize}`}
          fill="#e53935"
          opacity={0.8}
        />
      </svg>

      {/* Vehicles */}
      {vehicles.map(v => {
        let visualRow = v.row;
        let visualCol = v.col;

        if (dragging && dragging.id === v.id) {
          if (v.orientation === 'H') {
            visualCol = v.col + dragging.dragDelta;
            visualCol = Math.max(0, Math.min(GRID - v.length, visualCol));
          } else {
            visualRow = v.row + dragging.dragDelta;
            visualRow = Math.max(0, Math.min(GRID - v.length, visualRow));
          }
        }

        const top  = visualRow * cellSize;
        const left = visualCol * cellSize;
        const width  = v.orientation === 'H' ? v.length * cellSize : cellSize;
        const height = v.orientation === 'V' ? v.length * cellSize : cellSize;
        const color = getColor(v.id);
        const isRed = v.id === 'red';
        const isDragging = dragging?.id === v.id;

        return (
          <div
            key={v.id}
            className={`${styles.vehicle} ${isRed ? styles.redCar : ''} ${isDragging ? styles.dragging : ''}`}
            style={{
              top: top + 3,
              left: left + 3,
              width: width - 6,
              height: height - 6,
              background: color,
              cursor: readonly || solved ? 'default' : (v.orientation === 'H' ? 'ew-resize' : 'ns-resize'),
              zIndex: isDragging ? 10 : 1,
            }}
            onPointerDown={e => onPointerDown(e, v.id)}
          >
            <span className={styles.label}>{isRed ? '🚗' : v.id}</span>
          </div>
        );
      })}

      {solved && (
        <div className={styles.solvedOverlay}>Solved! 🎉</div>
      )}
    </div>
  );
}
