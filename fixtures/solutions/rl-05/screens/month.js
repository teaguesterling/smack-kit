import { card, list } from '../kit/parts.js';
import { weekdayOf } from '../kit/dates.js';
import { call } from '../kit/uprompt.js';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
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
  const lead = (weekdayOf(first) + 6) % 7; // Monday first
  for (let i = 0; i < lead; i++) grid.append(document.createElement('div'));
  for (let n = 1; n <= days; n++) {
    const date = `${first.slice(0, 8)}${String(n).padStart(2, '0')}`;
    const cell = Object.assign(document.createElement('button'), { type: 'button', className: 'day' + (minutes[date] ? ' read' : '') });
    cell.dataset.date = date;
    cell.append(Object.assign(document.createElement('span'), { textContent: String(n) }));
    if (minutes[date]) cell.append(Object.assign(document.createElement('span'), { className: 'mins', textContent: `${minutes[date]}m` }));
    grid.append(cell);
  }

  const weekStart = addDays(state.today, -((weekdayOf(state.today) + 6) % 7));
  const inWeek = e => e.date >= weekStart && e.date <= addDays(weekStart, 6);
  const goals = list(state.readers, r => {
    const done = state.entries.filter(e => e.reader === r.name && inWeek(e)).reduce((s, e) => s + e.minutes, 0);
    return Object.assign(document.createElement('p'), { className: 'week-goal', textContent: `${r.name}: ${done} of ${r.goal} minutes this week` });
  });
  const ask = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Suggest next books' });
  const ideas = document.createElement('div');
  ask.addEventListener('click', () => suggest(state, ideas));
  const next = document.createElement('div'); next.append(ask, ideas);
  root.replaceChildren(card({ title: first.slice(0, 7), body: grid }), card({ title: 'This week', body: goals }), card({ title: 'Next book', body: next }));
}

/** One model call per child (app.json models.suggest), with the titles that child read. No answer, no suggestion. */
async function suggest(state, out) {
  out.replaceChildren();
  for (const r of state.readers) {
    const titles = [...new Set(state.entries.filter(e => e.reader === r.name).map(e => e.title))];
    let text = '';
    try {
      const a = await call('suggest', [
        { role: 'system', content: 'Suggest one book title for a child. Answer with the title only.' },
        { role: 'user', content: `${r.name} has read: ${titles.join(', ') || 'nothing yet'}. What should they read next?` },
      ]);
      text = a.text.trim().slice(0, 80);
    } catch { /* no model: no suggestion */ }
    if (text) out.append(Object.assign(document.createElement('p'), { textContent: `${r.name}: ${text}` }));
  }
}
