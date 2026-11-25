// Seam: fall speed for each `speed` term value. Pure.

/** Contract: (speed: term `speed`) -> pixels per second. */
export function fallPixelsPerSecond(speed) {
  return { 'super-slow': 20, slow: 40, medium: 70, fast: 110 }[speed] ?? 40;
}
