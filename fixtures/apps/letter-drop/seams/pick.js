// Seam: which letter falls next. Pure: randomness comes in as `rand`.

/** Contract: (pool: string[], rand: () => number in [0, 1)) -> string from pool. */
export function nextLetter(pool, rand) {
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}
