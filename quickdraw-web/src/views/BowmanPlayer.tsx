import { useState, useCallback, useRef } from 'react';
import { socket } from '../socket';
import { useSocket } from '../hooks/useSocket';
import { ArcheryRange } from '../components/ArcheryRange';
import type { ShotResult, BowmanResult } from '../types';
import { MAX_SHOTS } from '../bowmanConstants';
import styles from '../styles/BowmanPlayer.module.css';

const RING_META: Record<string, { label: string; color: string }> = {
  bullseye: { label: '🎯 BULLSEYE!', color: '#ffd700' },
  inner:    { label: '🟢 Inner Ring', color: '#2ecc71' },
  middle:   { label: '🔵 Middle Ring', color: '#3498db' },
  outer:    { label: '🟠 Outer Ring', color: '#e67e22' },
  miss:     { label: '❌ MISS',       color: '#e74c3c' },
};

const MEDALS = ['🥇', '🥈', '🥉'];

// SVG viewBox dimensions — must match ArcheryRange constants
const SVG_W = 800;
const SVG_H = 420;

type Phase = 'playing' | 'done' | 'results';

interface Props {
  roomCode:    string;
  playerName:  string;
  initialWind: number;
}

export function BowmanPlayer({ roomCode, playerName }: Props) {
  const [phase,      setPhase]      = useState<Phase>('playing');
  const [shots,      setShots]      = useState<ShotResult[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [lastResult, setLastResult] = useState<ShotResult | null>(null);
  const [showFlash,  setShowFlash]  = useState(false);
  const [results,    setResults]    = useState<BowmanResult[]>([]);

  // Drag state (screen-space deltas, converted to SVG coords for rendering)
  const [isDragging,     setIsDragging]     = useState(false);
  const [dragDxSvg,      setDragDxSvg]      = useState(0);
  const [dragDySvg,      setDragDySvg]      = useState(0);
  const [dragAngle,      setDragAngle]      = useState<number | null>(null);
  const [dragPower,      setDragPower]      = useState<number | null>(null);

  const [flyingShot, setFlyingShot] = useState<{ angle: number; power: number } | null>(null);

  const flashTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flyTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rangeRef     = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Convert screen-space drag to SVG coords and compute angle/power
  function computeDrag(clientX: number, clientY: number) {
    const rect = rangeRef.current!.getBoundingClientRect();
    const dxScreen = clientX - dragStartRef.current.x;
    const dyScreen = clientY - dragStartRef.current.y;
    const dist = Math.sqrt(dxScreen ** 2 + dyScreen ** 2);

    if (dist < 6) {
      setDragDxSvg(0);
      setDragDySvg(0);
      setDragAngle(null);
      setDragPower(null);
      return;
    }

    // Scale screen delta to SVG units
    const dxSvg = dxScreen * (SVG_W / rect.width);
    const dySvg = dyScreen * (SVG_H / rect.height);

    // Angle: fire opposite to drag direction. SVG y is down, world y is up.
    // World angle = atan2(dy_screen_drag, -dx_screen_drag) (negating x gives opposite direction)
    const rawAngle = Math.atan2(dyScreen, -dxScreen) * (180 / Math.PI);
    const angle = Math.max(5, Math.min(85, rawAngle));

    // Power: 30% of container width = 100%
    const power = Math.min(dist / (rect.width * 0.30), 1) * 100;

    setDragDxSvg(dxSvg);
    setDragDySvg(dySvg);
    setDragAngle(angle);
    setDragPower(power);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (phase !== 'playing') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
    setDragDxSvg(0);
    setDragDySvg(0);
    setDragAngle(null);
    setDragPower(null);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging) return;
    computeDrag(e.clientX, e.clientY);
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging) return;
    setIsDragging(false);
    computeDrag(e.clientX, e.clientY);

    if (dragAngle !== null && dragPower !== null && dragPower > 2) {
      const angle = Math.round(dragAngle);
      const power = Math.round(dragPower);
      socket.emit('bowman:shot', { angle, power });
      setFlyingShot({ angle, power });
      if (flyTimer.current) clearTimeout(flyTimer.current);
      flyTimer.current = setTimeout(() => setFlyingShot(null), 900);
    }

    setDragDxSvg(0);
    setDragDySvg(0);
    setDragAngle(null);
    setDragPower(null);
  }

  const onBowmanResult = useCallback((
    { result, totalScore: ts, done }: { result: ShotResult; totalScore: number; done: boolean },
  ) => {
    // Delay showing trajectory + flash until the arrow animation finishes
    setTimeout(() => {
      setShots(prev => [...prev, result]);
      setTotalScore(ts);
      setLastResult(result);
      setShowFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setShowFlash(false), 2000);
      if (done) setPhase('done');
    }, 900);
  }, []);

  const onGameOver = useCallback(({ results: r }: { results: BowmanResult[] }) => {
    setResults(r);
    setPhase('results');
  }, []);

  useSocket('bowman:result', onBowmanResult as never);
  useSocket('game:over',     onGameOver     as never);

  const flash = lastResult ? RING_META[lastResult.ring] : null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>🏹 Bowman</div>
        <div className={styles.meta}>{playerName} · {roomCode}</div>
      </header>

      <div className={styles.content}>

        {/* ── Playing / Done ───────────────────────────────── */}
        {(phase === 'playing' || phase === 'done') && (
          <>
            {/* Archery range — drag to aim and release to fire */}
            <div
              ref={rangeRef}
              className={styles.rangeWrap}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <ArcheryRange
                shots={shots}
                dragDxSvg={isDragging ? dragDxSvg : 0}
                dragDySvg={isDragging ? dragDySvg : 0}
                angle={isDragging ? dragAngle : null}
                power={isDragging ? dragPower : null}
                flyingShot={flyingShot}
              />
            </div>

            {/* Result flash */}
            {showFlash && flash && (
              <div className={styles.flashBanner} data-ring={lastResult?.ring}>
                {flash.label} +{lastResult?.score}
              </div>
            )}

            {/* Stats bar */}
            <div className={styles.statsBar}>
              <span><span className={styles.statLabel}>Score </span><span className={styles.statVal}>{totalScore}</span></span>
              <span><span className={styles.statLabel}>Shots </span><span className={styles.statVal}>{shots.length}/{MAX_SHOTS}</span></span>
            </div>

            {/* Shot dots */}
            <div className={styles.shotDots}>
              {Array.from({ length: MAX_SHOTS }, (_, i) => {
                const s = shots[i];
                return s
                  ? <div key={i} className={styles.shotDot} data-ring={s.ring}>{s.score}</div>
                  : <div key={i} className={`${styles.shotDot} ${styles.shotDotEmpty}`}>—</div>;
              })}
            </div>

            {/* Drag prompt (only when not dragging) */}
            {phase === 'playing' && !isDragging && (
              <div className={styles.tapPrompt}>Drag to aim · release to fire</div>
            )}

            {phase === 'done' && (
              <div className={styles.doneOverlay}>
                <div className={styles.doneTitle}>Arrows spent!</div>
                <div className={styles.doneScore}>{totalScore} pts</div>
                <div className={styles.doneSub}>Waiting for others to finish…</div>
              </div>
            )}
          </>
        )}

        {/* ── Results ─────────────────────────────────────── */}
        {phase === 'results' && (
          <div className={styles.centered}>
            <div className={styles.waitTitle}>🏆 Game Over!</div>
            <div className={styles.resultsList}>
              {results.map((r, i) => (
                <div
                  key={r.id}
                  className={`${styles.resultRow} ${r.id === socket.id ? styles.highlight : ''}`}
                >
                  <span className={styles.resultRankIcon}>
                    {r.rank !== null && r.rank <= 3 ? MEDALS[r.rank - 1] : `#${r.rank ?? i + 1}`}
                  </span>
                  <span className={styles.resultName}>
                    {r.name}{r.id === socket.id ? ' (you)' : ''}
                  </span>
                  <span className={styles.resultScore}>{r.totalScore} pts</span>
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
