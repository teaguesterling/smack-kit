import { card, list } from '../kit/parts.js';
import { weekdayOf } from '../kit/dates.js';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MS = 86400000;
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

export function render(root, state) {
  const first = `${state.today.slice(0, 8)}01`;
  const days = new Date(Date.UTC(+first.slice(0, 4), +first.slice(5, 7), 0)).getUTCDate();
  const minutes = {};
  for (const e of state.entries) minutes[e.date] = (minutes[e.date] ?? 0) + e.minutes;

  const grid = document.createElement('div');
  grid.className = 'month-grid';
  for (const d of DOW) grid.append(Object.assign(document.createElement('div'), { className: 'dow', textContent: d }));
  const lead = weekdayOf(first); // Sunday first
  for (let i = 0; i < lead; i++) grid.append(document.createElement('div'));
  for (let n = 1; n <= days; n++) {
    const date = `${first.slice(0, 8)}${String(n).padStart(2, '0')}`;
    const cell = Object.assign(document.createElement('button'), { type: 'button', className: 'day' + (minutes[date] ? ' read' : '') });
    cell.dataset.date = date;
    cell.append(Object.assign(document.createElement('span'), { textContent: String(n) }));
    if (minutes[date]) cell.append(Object.assign(document.createElement('span'), { className: 'mins', textContent: `${minutes[date]}m` }));
    grid.append(cell);
  }

  const weekStart = addDays(state.today, -weekdayOf(state.today));
  const inWeek = e => e.date >= weekStart && e.date <= addDays(weekStart, 6);
  const goals = list(state.readers, r => {
    const done = state.entries.filter(e => e.reader === r.name && inWeek(e)).reduce((s, e) => s + e.minutes, 0);
    return Object.assign(document.createElement('p'), { className: 'week-goal', textContent: `${r.name}: ${done} of ${r.goal} minutes this week` });
  });
  root.replaceChildren(card({ title: first.slice(0, 7), body: grid }), card({ title: 'This week', body: goals }));
}
