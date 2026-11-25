// Kit stand-in: calendar dates. Apps store dates as 'YYYY-MM-DD' strings. Pure.

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Contract: (date: 'YYYY-MM-DD') -> 0..6, 0 = Sunday, 6 = Saturday. The same in every time zone.
 *  Use this, not new Date(date).getDay(), which gives the day before west of UTC. */
export function weekdayOf(date) {
  const m = typeof date === 'string' && DATE.exec(date);
  const t = m && Date.UTC(+m[1], +m[2] - 1, +m[3]);
  if (!m || new Date(t).toISOString().slice(0, 10) !== date) throw new Error(`weekdayOf: expected a YYYY-MM-DD date, got ${JSON.stringify(date)}`);
  return new Date(t).getUTCDay();
}
