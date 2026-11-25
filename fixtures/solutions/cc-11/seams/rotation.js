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

/** Contract: (person: {name, home?: term `home`}, dayIndex: 0 = Monday .. 6 = Sunday) -> boolean. No home means every day. */
export function isHome(person, dayIndex) {
  return person.home !== 'weekends' || dayIndex >= 5;
}

/**
 * Contract: (chores: {name, every, points}[], people: {name, home?}[], weekStart: 'YYYY-MM-DD', a Monday)
 *   -> {date, person, chore}[]
 * Today a person keeps a chore for two days running.
 */
export function assignWeek(chores, people, weekStart) {
  const out = [];
  if (!people.length) return out;
  for (let day = 0; day < 7; day++) {
    const here = people.filter(p => isHome(p, day));
    if (!here.length) continue;
    chores.forEach((chore, ci) => {
      if (!happensOn(chore.every, day)) return;
      const person = here[(ci + Math.floor(day / 2)) % here.length].name;
      out.push({ date: addDays(weekStart, day), person, chore: chore.name });
    });
  }
  return out;
}
