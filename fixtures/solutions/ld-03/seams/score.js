// Seam: points for one letter. Pure: no network, storage or globals.

/** Contract: (hit: boolean, streak: integer >= 0, hits in a row before this one) -> number.
 *  Every fifth hit in a row scores 3 instead of 1. */
export function scoreFor(hit, streak) {
  if (!hit) return 0;
  return (streak + 1) % 5 === 0 ? 3 : 1;
}
