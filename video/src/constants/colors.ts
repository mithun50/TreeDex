// Pure CSS color strings — no THREE.Color
export const COLORS = {
  bg: "#020817",
  primary: "#06b6d4",       // cyan
  accent: "#3b82f6",        // blue
  success: "#22c55e",       // green
  chaos: "#f59e0b",         // amber
  chaosRed: "#ef4444",      // red
  white: "#f8fafc",
  muted: "#64748b",
  dim: "#1e293b",
} as const;

// Terminal-specific
export const TERM = {
  bg: "#0d1117",
  border: "#21262d",
  titleBar: "#161b22",
  trafficRed: "#ff5f57",
  trafficYellow: "#febc2e",
  trafficGreen: "#28c840",
  text: "#c9d1d9",
  prompt: "#58a6ff",
  command: "#f0f6fc",
  output: "#8b949e",
  success: "#3fb950",
  error: "#f85149",
  cursor: "#58a6ff",
} as const;

// Gradient helpers
export const GRADIENTS = {
  heroRadial: `radial-gradient(ellipse at 50% 50%, ${COLORS.primary}15, ${COLORS.bg} 70%)`,
  accentRadial: `radial-gradient(circle at 50% 50%, ${COLORS.accent}20, transparent 60%)`,
} as const;
