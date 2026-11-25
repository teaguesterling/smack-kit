// Seam: a reader's streak. Pure: no network, storage or globals.

const DAY_MS = 86400000;
const prev = date => new Date(Date.parse(`${date}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);

/** Contract: (reader: string, entries: {date, reader}[], today: 'YYYY-MM-DD') -> days in a row with reading, ending today (0 if none today). */
export function streakFor(reader, entries, today) {
  const days = new Set(entries.filter(e => e.reader === reader).map(e => e.date));
  let n = 0;
  for (let d = today; days.has(d); d = prev(d)) n++;
  return n;
}
