// Seam: how many points a person has. Pure: no network, storage or globals.

/** Contract: (person: string, doneList: {date, person, chore}[], chores: {name, points}[]) -> number. */
export function pointsFor(person, doneList, chores) {
  const worth = new Map(chores.map(c => [c.name, c.points]));
  return doneList.filter(d => d.person === person).reduce((sum, d) => sum + (worth.get(d.chore) ?? 0), 0);
}
