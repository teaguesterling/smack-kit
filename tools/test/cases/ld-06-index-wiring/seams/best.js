// Seam: the high score kept across games. Pure: no network, storage or globals.

/** Contract: (best: integer >= 0 or undefined when none is stored, score: integer >= 0) -> integer >= 0, the larger of the two. */
export function bestAfter(best, score) {
  return Math.max(best ?? 0, score);
}
