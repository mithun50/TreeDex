import { useCurrentFrame } from "remotion";

/** Returns 0..1 progress for a local frame range */
export function useProgress(start: number, end: number): number {
  const frame = useCurrentFrame();
  if (frame < start) return 0;
  if (frame >= end) return 1;
  return (frame - start) / (end - start);
}

/** Returns true when frame is within [start, end) */
export function useVisible(start: number, end: number): boolean {
  const frame = useCurrentFrame();
  return frame >= start && frame < end;
}

// ── Easing functions ─────────────────────────────

export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeIn(t: number): number {
  return t * t * t;
}

/** Attempt at a spring-like ease (overshoot then settle) */
export function springEase(t: number, damping = 0.7): number {
  if (t >= 1) return 1;
  const decay = Math.exp(-damping * 8 * t);
  return 1 - decay * Math.cos(t * Math.PI * 2);
}

/** Linear interpolation clamped to [0, 1] */
export function lerp(a: number, b: number, t: number): number {
  const ct = Math.max(0, Math.min(1, t));
  return a + (b - a) * ct;
}

/** Ease-back: overshoots target then settles (Apple-style) */
export function easeOutBack(t: number, overshoot = 1.70158): number {
  const c = overshoot + 1;
  return 1 + c * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
}

/** Exponential decay (fast start, slow settle) */
export function expDecay(t: number, rate = 4): number {
  return 1 - Math.exp(-rate * t);
}

/** Custom cubic bezier approximation */
export function cubicBezier(t: number, p1x: number, p1y: number, p2x: number, p2y: number): number {
  // Simple approximation using Newton's method
  let x = t;
  for (let i = 0; i < 8; i++) {
    const bx = 3 * p1x * x * (1 - x) * (1 - x) + 3 * p2x * x * x * (1 - x) + x * x * x;
    const dx = bx - t;
    if (Math.abs(dx) < 0.001) break;
    const dbx = 3 * p1x * (1 - x) * (1 - x) - 6 * p1x * x * (1 - x) + 6 * p2x * x * (1 - x) - 3 * p2x * x * x + 3 * x * x;
    if (Math.abs(dbx) < 0.0001) break;
    x -= dx / dbx;
  }
  return 3 * p1y * x * (1 - x) * (1 - x) + 3 * p2y * x * x * (1 - x) + x * x * x;
}
