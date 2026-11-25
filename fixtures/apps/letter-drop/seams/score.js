// Seam: points for one letter. Pure: no network, storage or globals.

/** Contract: (hit: boolean, streak: integer >= 0, hits in a row before this one) -> number. */
export function scoreFor(hit, streak) {
  return hit ? 1 : 0;
}
