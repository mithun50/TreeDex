// Video specs
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const TOTAL_FRAMES = 1800; // 60s

// Act durations (frames) — used by <Series.Sequence durationInFrames={}>
export const ACT_DURATIONS = {
  hero: 270,      // 9s
  problem: 330,   // 11s
  solution: 480,  // 16s
  query: 360,     // 12s
  closing: 360,   // 12s
} as const;

// Fade in/out (frames at start/end of each act)
export const FADE_FRAMES = 15;

// ── Act 1: Hero ──────────────────────────────────
export const ACT1 = {
  duration: ACT_DURATIONS.hero, // 270
  particleCoalesce: { start: 0, end: 150 },
  titleReveal: { start: 90, end: 180 },
  tagline: { start: 170, end: 260 },
};

// ── Act 2: Problem ───────────────────────────────
export const ACT2 = {
  duration: ACT_DURATIONS.problem, // 330
  terminalType: { start: 20, end: 160 },
  cardsFloat: { start: 0, end: 150 },
  cardsShatter: { start: 160, end: 260 },
  failText: { start: 200, end: 310 },
};

// ── Act 3: Solution (centerpiece) ────────────────
export const ACT3 = {
  duration: ACT_DURATIONS.solution, // 480
  pipInstall: { start: 10, end: 80 },
  importLine: { start: 90, end: 140 },
  createIndex: { start: 150, end: 220 },
  scanning: { start: 230, end: 300 },
  treeGrow: { start: 250, end: 420 },
  indexReady: { start: 380, end: 460 },
};

// ── Act 4: Query ─────────────────────────────────
export const ACT4 = {
  duration: ACT_DURATIONS.query, // 360
  queryType: { start: 10, end: 90 },
  traversal: { start: 100, end: 220 },
  highlight: { start: 180, end: 280 },
  response: { start: 240, end: 340 },
};

// ── Act 5: Closing ───────────────────────────────
export const ACT5 = {
  duration: ACT_DURATIONS.closing, // 360
  treeFullGlow: { start: 0, end: 360 },
  providerOrbit: { start: 30, end: 300 },
  title: { start: 20, end: 340 },
  installBadge: { start: 80, end: 300 },
  tagline: { start: 120, end: 310 },
  github: { start: 160, end: 310 },
  fadeOut: { start: 310, end: 360 },
};
