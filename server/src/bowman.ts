// ─── Bowman Archery Game Logic ───────────────────────────────────────────────
//
// Physics model (2-D, y-up):
//   x(t) = vx·t + ½·wind·t²
//   y(t) = vy·t − ½·GRAVITY·t²
//
// Scene:
//   Archer at world origin (0, 0).
//   Target at x = TARGET_X.  Bullseye centre at y = BULLSEYE_Y.
//   Score = f(|y_impact − BULLSEYE_Y|).

export const GRAVITY    = 150;   // world units / s²  (game-scaled, not real)
export const MAX_SPEED  = 400;   // world units / s  at 100 % power
export const TARGET_X   = 600;   // horizontal distance to the target
export const BULLSEYE_Y = 150;   // height of bullseye centre from ground
export const MAX_SHOTS  = 3;

export const RINGS = [
  { radius: 15,  score: 10, name: 'bullseye' },
  { radius: 40,  score:  7, name: 'inner'    },
  { radius: 80,  score:  4, name: 'middle'   },
  { radius: 130, score:  1, name: 'outer'    },
] as const;

export interface ShotResult {
  angle:                number;  // degrees
  power:                number;  // 0–100
  landingY:             number;  // world y when arrow reaches TARGET_X
  distanceFromBullseye: number;  // |landingY − BULLSEYE_Y|
  score:                number;
  ring:                 string;  // 'bullseye' | 'inner' | 'middle' | 'outer' | 'miss'
}

export interface BowmanState {
  wind:        number;          // horizontal acceleration (world units / s²)
  shots:       ShotResult[];
  totalScore:  number;
  done:        boolean;
  startTime:   number;          // Date.now() when game started for this player
  finishTime:  number | null;   // ms elapsed when last shot fired (not wall-clock)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Solve x(t) = TARGET_X for the positive root. */
function impactTime(vx: number, wind: number): number {
  if (Math.abs(wind) < 0.01) return TARGET_X / vx;
  const a = 0.5 * wind;
  const b = vx;
  const c = -TARGET_X;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return TARGET_X / vx; // fallback (should not happen in valid shots)
  const t1 = (-b + Math.sqrt(disc)) / (2 * a);
  const t2 = (-b - Math.sqrt(disc)) / (2 * a);
  // Return the smallest positive root
  if (t1 > 0 && t2 > 0) return Math.min(t1, t2);
  return t1 > 0 ? t1 : t2;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function createBowmanState(wind?: number): BowmanState {
  return {
    wind:       wind ?? Math.round((Math.random() * 60 - 30) * 10) / 10,
    shots:      [],
    totalScore: 0,
    done:       false,
    startTime:  Date.now(),
    finishTime: null,
  };
}

export function processShot(
  state: BowmanState,
  angle: number,
  power: number,
): { ok: boolean; state: BowmanState; result: ShotResult | null } {
  if (state.done) return { ok: false, state, result: null };

  const θ    = Math.max(5, Math.min(85, angle));
  const p    = Math.max(5, Math.min(100, power));
  const θrad = (θ * Math.PI) / 180;
  const v0   = MAX_SPEED * (p / 100);
  const vx   = v0 * Math.cos(θrad);
  const vy   = v0 * Math.sin(θrad);

  const t        = impactTime(vx, state.wind);
  const landingY = vy * t - 0.5 * GRAVITY * t * t;
  const dist     = Math.abs(landingY - BULLSEYE_Y);

  let score = 0;
  let ring  = 'miss';
  for (const r of RINGS) {
    if (dist <= r.radius) { score = r.score; ring = r.name; break; }
  }

  const result: ShotResult = { angle: θ, power: p, landingY, distanceFromBullseye: dist, score, ring };
  const newShots  = [...state.shots, result];
  const newTotal  = state.totalScore + score;
  const done      = newShots.length >= MAX_SHOTS;

  const newState: BowmanState = {
    ...state,
    shots:      newShots,
    totalScore: newTotal,
    done,
    finishTime: done ? Date.now() - state.startTime : null,
  };

  return { ok: true, state: newState, result };
}

/** Generate trajectory sample points (world coordinates) for client preview. */
export function trajectoryPoints(
  angle: number,
  power: number,
  wind: number,
  steps = 80,
): { x: number; y: number }[] {
  const θrad = (angle * Math.PI) / 180;
  const v0   = MAX_SPEED * (power / 100);
  const vx   = v0 * Math.cos(θrad);
  const vy   = v0 * Math.sin(θrad);
  const tEnd = impactTime(vx, wind);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (tEnd * i) / steps;
    pts.push({
      x: vx * t + 0.5 * wind * t * t,
      y: vy * t - 0.5 * GRAVITY * t * t,
    });
  }
  return pts;
}
