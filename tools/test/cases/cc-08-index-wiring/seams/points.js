// Seam: how many points a person has. Pure: no network, storage or globals.

/** Contract: (person: string, doneList: {date, person, chore}[], chores: {name, points}[]) -> number. */
export function pointsFor(person, doneList, chores) {
  const worth = new Map(chores.map(c => [c.name, c.points]));
  return doneList.filter(d => d.person === person).reduce((sum, d) => sum + (worth.get(d.chore) ?? 0), 0);
}

/** Contract: (chore: string, every: string) -> {role, content}[] for call('points', messages). */
export function pointsPrompt(chore, every) {
  return [
    { role: 'system', content: 'You suggest how many points a household chore is worth on a chore board, from 1 (quick, easy) to 5 (long, hard). Answer only with JSON like {"points": 2}.' },
    { role: 'user', content: `Chore: ${chore}\nHow often: ${every}` },
  ];
}

/** Contract: (text: string) -> number | null. Reads the points from a model answer; null if there is none. */
export function readPoints(text) {
  try {
    const v = JSON.parse(text)?.points;
    return Number.isInteger(v) ? v : null;
  } catch {
    return null;
  }
}
