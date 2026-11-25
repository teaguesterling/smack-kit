// Seam: how many points a person has. Pure: no network, storage or globals.

/** Contract: (date: 'YYYY-MM-DD') -> 2 on a Saturday, else 1. */
export function dayMultiplier(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay() === 6 ? 2 : 1;
}

/** Contract: (person: string, doneList: {date, person, chore}[], chores: {name, points}[]) -> number. Saturdays count double. */
export function pointsFor(person, doneList, chores) {
  const worth = new Map(chores.map(c => [c.name, c.points]));
  return doneList.filter(d => d.person === person).reduce((sum, d) => sum + (worth.get(d.chore) ?? 0) * dayMultiplier(d.date), 0);
}
