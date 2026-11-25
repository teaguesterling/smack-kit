// Seam: who does which chore on which day. Pure: no network, storage or globals.

const DAY_MS = 86400000;

/** Contract: (date: 'YYYY-MM-DD', n: integer) -> 'YYYY-MM-DD', n days later. */
export function addDays(date, n) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Contract: (every: term `every`, dayIndex: 0 = Monday .. 6 = Sunday) -> boolean. */
export function happensOn(every, dayIndex) {
  if (every === 'daily') return true;
  if (every === 'weekly') return dayIndex === 0;
  if (every === 'school-days') return dayIndex <= 4;
  return false;
}

/**
 * Contract: (chores: {name, every, points}[], people: {name}[], weekStart: 'YYYY-MM-DD', a Monday)
 *   -> {date, person, chore}[]
 * A chore moves to the next person every day, so nobody does it two days in a row.
 */
export function assignWeek(chores, people, weekStart) {
  const out = [];
  if (!people.length) return out;
  for (let day = 0; day < 7; day++) {
    chores.forEach((chore, ci) => {
      if (!happensOn(chore.every, day)) return;
      const person = people[(ci + day) % people.length].name;
      out.push({ date: addDays(weekStart, day), person, chore: chore.name });
    });
  }
  return out;
}
