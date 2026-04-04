// ArcheryRange – SVG archery scene used on both player screen and host cards.
//
// World coordinate system (matches server physics):
//   origin = archer feet, x right, y up
//   TARGET_X = 600, BULLSEYE_Y = 150
//   GRAVITY = 80, MAX_SPEED = 400

import { useState, useEffect, useRef } from 'react';
import type { ShotResult } from '../types';
import styles from '../styles/ArcheryRange.module.css';

// ─── Physics constants (must match server/src/bowman.ts) ─────────────────────
const GRAVITY    = 80;
const MAX_SPEED  = 400;
const TARGET_X   = 600;
const BULLSEYE_Y = 150;

// ─── SVG layout ──────────────────────────────────────────────────────────────
const VB_W       = 800;
const VB_H       = 420;
const ARCHER_X   = 55;
const GROUND_Y   = 370;
const SCALE_X    = (680 - ARCHER_X) / TARGET_X;
const SCALE_Y    = (GROUND_Y - 190) / BULLSEYE_Y;

// Archer bow position — origin of the rubber band and aiming line
const BOW_X = ARCHER_X + 12;
const BOW_Y = GROUND_Y - 100; // shoulder height

function wx(worldX: number) { return ARCHER_X + worldX * SCALE_X; }
function wy(worldY: number) { return GROUND_Y - worldY * SCALE_Y; }

const TARGET_SVG_X   = wx(TARGET_X);
const BULLSEYE_SVG_Y = wy(BULLSEYE_Y);

const RING_DEFS = [
  { r: 68, color: '#1a1a2e' },
  { r: 52, color: '#e74c3c' },
  { r: 36, color: '#e74c3c' },
  { r: 22, color: '#f8f8f8' },
  { r: 10, color: '#f8d700' },
];

const RING_COLORS: Record<string, string> = {
  bullseye: '#ffd700',
  inner:    '#2ecc71',
  middle:   '#3498db',
  outer:    '#e67e22',
  miss:     '#e74c3c',
};

// ─── Trajectory calculation ───────────────────────────────────────────────────
function impactTime(vx: number, wind: number): number {
  if (Math.abs(wind) < 0.01) return TARGET_X / vx;
  const a = 0.5 * wind, b = vx, c = -TARGET_X;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return TARGET_X / vx;
  const t1 = (-b + Math.sqrt(disc)) / (2 * a);
  const t2 = (-b - Math.sqrt(disc)) / (2 * a);
  if (t1 > 0 && t2 > 0) return Math.min(t1, t2);
  return t1 > 0 ? t1 : t2;
}

function buildPath(angle: number, power: number, wind: number): string {
  const θ   = (angle * Math.PI) / 180;
  const v0  = MAX_SPEED * (power / 100);
  const vx  = v0 * Math.cos(θ);
  const vy  = v0 * Math.sin(θ);
  const tEnd = impactTime(vx, wind);
  const pts: string[] = [];
  for (let i = 0; i <= 80; i++) {
    const t  = (tEnd * i) / 80;
    const px = vx * t + 0.5 * wind * t * t;
    const py = vy * t - 0.5 * GRAVITY * t * t;
    pts.push(`${wx(px).toFixed(1)},${wy(py).toFixed(1)}`);
  }
  return 'M ' + pts.join(' L ');
}

/** Extend a direction vector from (BOW_X, BOW_Y) to the SVG viewport edge. */
function aimLineEnd(ldx: number, ldy: number): [number, number] {
  const tRight = ldx > 0.001  ? (VB_W - 20 - BOW_X) / ldx : 99999;
  const tTop   = ldy < -0.001 ? (15 - BOW_Y) / ldy          : 99999;
  const tLeft  = ldx < -0.001 ? (20 - BOW_X) / ldx          : 99999;
  const tBot   = ldy > 0.001  ? (VB_H - 20 - BOW_Y) / ldy   : 99999;
  const t = Math.min(tRight, tTop, tLeft, tBot);
  return [BOW_X + t * ldx, BOW_Y + t * ldy];
}

// ─── Component ────────────────────────────────────────────────────────────────

const ANIM_DURATION = 900; // ms — must match BowmanPlayer

interface Props {
  wind?:       number;
  shots:       ShotResult[];
  // Drag-based aiming (player screen only)
  dragDxSvg?:  number;
  dragDySvg?:  number;
  angle?:      number | null;
  power?:      number | null;
  mini?:       boolean;
  // In-flight arrow animation
  flyingShot?: { angle: number; power: number } | null;
}

export function ArcheryRange({ wind = 0, shots, dragDxSvg, dragDySvg, angle, power, mini, flyingShot }: Props) {
  // ── Arrow flight animation ─────────────────────────────────────────────────
  const [arrowPos, setArrowPos] = useState<{ x: number; y: number; deg: number } | null>(null);
  const rafRef       = useRef<number | null>(null);
  const animStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!flyingShot) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const θ   = (flyingShot.angle * Math.PI) / 180;
    const v0  = MAX_SPEED * (flyingShot.power / 100);
    const vx  = v0 * Math.cos(θ);
    const vy  = v0 * Math.sin(θ);
    const tEnd = impactTime(vx, wind);
    animStartRef.current = null;

    function frame(ts: number) {
      if (animStartRef.current === null) animStartRef.current = ts;
      const frac = Math.min((ts - animStartRef.current) / ANIM_DURATION, 1);
      const t    = frac * tEnd;
      const px   = vx * t + 0.5 * wind * t * t;
      const py   = vy * t - 0.5 * GRAVITY * t * t;
      // Velocity direction → SVG rotation angle
      const vyt  = vy - GRAVITY * t;
      const deg  = Math.atan2(-vyt * SCALE_Y, vx * SCALE_X) * (180 / Math.PI);
      setArrowPos({ x: wx(px), y: wy(py), deg });
      if (frac < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        setArrowPos(null);
      }
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [flyingShot, wind]);
  // ──────────────────────────────────────────────────────────────────────────
  const hasDrag = !mini
    && dragDxSvg !== undefined && dragDySvg !== undefined
    && (Math.abs(dragDxSvg) > 2 || Math.abs(dragDySvg) > 2);

  // Launch direction = opposite of drag
  const ldx = hasDrag ? -dragDxSvg! : 0;
  const ldy = hasDrag ? -dragDySvg! : 0;
  const [aimEndX, aimEndY] = hasDrag ? aimLineEnd(ldx, ldy) : [BOW_X, BOW_Y];

  // Pull point: where the hand is (bow + drag delta)
  const pullX = hasDrag ? BOW_X + dragDxSvg! : BOW_X;
  const pullY = hasDrag ? BOW_Y + dragDySvg! : BOW_Y;

  // Color intensity based on power
  const powerFrac = power != null ? power / 100 : 0;
  const aimColor  = hasDrag
    ? `rgba(${Math.round(255 * powerFrac)}, ${Math.round(215 * (1 - powerFrac * 0.5))}, 0, 0.9)`
    : 'rgba(255,255,255,0.7)';

  const labelAnchor = aimEndX > VB_W * 0.55 ? 'end' : 'start';
  const labelOffsetX = labelAnchor === 'end' ? -8 : 8;

  // Ghost trajectory preview during aiming
  const showPreview = hasDrag && angle != null && power != null && power > 5;
  const previewPath    = showPreview ? buildPath(angle!, power!, wind) : null;
  const previewLandY   = showPreview ? (() => {
    const θ = (angle! * Math.PI) / 180;
    const v0 = MAX_SPEED * (power! / 100);
    const vx = v0 * Math.cos(θ), vy = v0 * Math.sin(θ);
    const t  = impactTime(vx, wind);
    return vy * t - 0.5 * GRAVITY * t * t;
  })() : null;

  // Wind indicator label
  const windLabel = Math.abs(wind) >= 1
    ? `Wind ${wind > 0 ? '→' : '←'} ${Math.abs(wind).toFixed(1)}`
    : null;

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className={styles.svg}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#0d0d2b" />
          <stop offset="100%" stopColor="#1a1a4e" />
        </linearGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#1a5c1a" />
          <stop offset="100%" stopColor="#0d3d0d" />
        </linearGradient>
      </defs>

      {/* Sky */}
      <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#sky)" />

      {/* Distant hills */}
      <ellipse cx="200" cy={GROUND_Y} rx="180" ry="40" fill="#0f3d0f" opacity="0.6" />
      <ellipse cx="500" cy={GROUND_Y} rx="220" ry="35" fill="#0f3d0f" opacity="0.5" />

      {/* Ground */}
      <rect x="0" y={GROUND_Y} width={VB_W} height={VB_H - GROUND_Y} fill="url(#ground)" />
      <line x1="0" y1={GROUND_Y} x2={VB_W} y2={GROUND_Y} stroke="#2a7a2a" strokeWidth="2" />

      {/* ── Target ── */}
      <rect
        x={TARGET_SVG_X - 5}
        y={BULLSEYE_SVG_Y - RING_DEFS[0].r}
        width={10}
        height={GROUND_Y - (BULLSEYE_SVG_Y - RING_DEFS[0].r)}
        fill="#8B6914"
      />
      {RING_DEFS.map((ring, i) => (
        <circle
          key={i}
          cx={TARGET_SVG_X}
          cy={BULLSEYE_SVG_Y}
          r={ring.r}
          fill={ring.color}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
        />
      ))}

      {/* ── Archer silhouette ── */}
      <Archer x={ARCHER_X} groundY={GROUND_Y} />

      {/* ── Previous shot trajectories ── */}
      {shots.map((shot, i) => {
        const color   = RING_COLORS[shot.ring] ?? '#aaa';
        const pathStr = buildPath(shot.angle, shot.power, wind);
        const impactY = wy(shot.landingY);
        return (
          <g key={i}>
            <path d={pathStr} fill="none" stroke={color} strokeWidth={mini ? 1.5 : 2} strokeOpacity={0.7} />
            <circle cx={TARGET_SVG_X} cy={impactY} r={mini ? 4 : 6} fill={color} stroke="#000" strokeWidth="1" />
            {!mini && (
              <text x={TARGET_SVG_X + 12} y={impactY + 4} fill={color} fontSize="13" fontFamily="Inter,sans-serif" fontWeight="600">
                {shot.score}pt {shot.ring}
              </text>
            )}
          </g>
        );
      })}

      {/* ── Flying arrow animation ── */}
      {flyingShot && arrowPos && (
        <g transform={`translate(${arrowPos.x.toFixed(1)},${arrowPos.y.toFixed(1)}) rotate(${arrowPos.deg.toFixed(1)})`}>
          {/* shaft */}
          <line x1="-12" y1="0" x2="5" y2="0" stroke="#e0d090" strokeWidth="2.5" strokeLinecap="round" />
          {/* head */}
          <polygon points="8,0 2,-3 2,3" fill="#e0d090" />
          {/* tail feathers */}
          <line x1="-12" y1="0" x2="-8" y2="-4" stroke="#e74c3c" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="-12" y1="0" x2="-8" y2="4"  stroke="#e74c3c" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}

      {/* ── Wind indicator ── */}
      {!mini && windLabel && (
        <text
          x={VB_W / 2}
          y="24"
          fill="rgba(180,220,255,0.85)"
          fontSize="18"
          fontFamily="Inter,sans-serif"
          fontWeight="600"
          textAnchor="middle"
        >
          {windLabel}
        </text>
      )}

      {/* ── Ghost trajectory preview (aiming) ── */}
      {showPreview && previewPath && (
        <g>
          <path
            d={previewPath}
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1.5"
            strokeDasharray="8 5"
          />
          {previewLandY !== null && (
            <circle
              cx={TARGET_SVG_X}
              cy={wy(previewLandY)}
              r="5"
              fill="rgba(255,255,255,0.6)"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth="1.5"
            />
          )}
        </g>
      )}

      {/* ── Drag aiming (player screen only) ── */}
      {hasDrag && (
        <g>
          {/* Rubber band: bow → pull point */}
          <line
            x1={BOW_X} y1={BOW_Y}
            x2={pullX}  y2={pullY}
            stroke="rgba(224,208,144,0.75)"
            strokeWidth="2"
            strokeDasharray="6 3"
          />
          {/* Pull handle dot */}
          <circle cx={pullX} cy={pullY} r="7" fill="rgba(224,208,144,0.9)" stroke="#fff" strokeWidth="1.5" />

          {/* Aiming line: bow → SVG edge */}
          <line
            x1={BOW_X} y1={BOW_Y}
            x2={aimEndX} y2={aimEndY}
            stroke={aimColor}
            strokeWidth="2.5"
          />

          {/* Angle label near tip of aiming line */}
          {angle != null && (
            <text
              x={aimEndX + labelOffsetX}
              y={Math.max(28, aimEndY - 10)}
              fill={aimColor}
              fontSize="22"
              fontFamily="Inter,sans-serif"
              fontWeight="700"
              textAnchor={labelAnchor}
            >
              {angle.toFixed(1)}°
            </text>
          )}

          {/* Power label — lower left */}
          {power != null && (
            <text
              x="20"
              y={GROUND_Y - 22}
              fill="rgba(255,255,255,0.85)"
              fontSize="22"
              fontFamily="Inter,sans-serif"
              fontWeight="700"
            >
              {power.toFixed(0)}%
            </text>
          )}
        </g>
      )}
    </svg>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Archer({ x, groundY }: { x: number; groundY: number }) {
  const footY   = groundY;
  const kneeY   = footY  - 28;
  const hipY    = footY  - 55;
  const shouldY = footY  - 100;
  const headY   = footY  - 120;
  const bowX    = x + 12;

  return (
    <g fill="none" stroke="#c0b090" strokeWidth="3" strokeLinecap="round">
      <line x1={x - 8} y1={footY}   x2={x}       y2={kneeY}      />
      <line x1={x + 8} y1={footY}   x2={x}       y2={kneeY}      />
      <line x1={x}     y1={kneeY}   x2={x}       y2={hipY}       />
      <line x1={x}     y1={hipY}    x2={x}       y2={shouldY}    />
      <line x1={x}     y1={shouldY} x2={x - 14}  y2={hipY + 12}  />
      <line x1={x}     y1={shouldY} x2={bowX + 8} y2={shouldY - 8} />
      <circle cx={x} cy={headY - 8} r="9" fill="#c0b090" stroke="none" />
      <path
        d={`M ${bowX} ${shouldY - 28} Q ${bowX + 18} ${shouldY - 10} ${bowX} ${shouldY + 8}`}
        stroke="#8B6914"
        strokeWidth="4"
        fill="none"
      />
      <line x1={bowX} y1={shouldY - 28} x2={x - 14} y2={hipY + 12} stroke="#e0d090" strokeWidth="1.5" />
      <line x1={bowX} y1={shouldY + 8}  x2={x - 14} y2={hipY + 12} stroke="#e0d090" strokeWidth="1.5" />
    </g>
  );
}
