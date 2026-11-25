import { card, list, formRow } from '../kit/parts.js';
import { call } from '../kit/uprompt.js';
import { validate } from '../kit/gate.js';
import { pointsPrompt, readPoints } from '../seams/points.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function render(root, state) {
  const days = DAYS.map((d, i) => ({ day: d, items: state.week.filter(a => a.date === state.dates[i]) }));
  const plan = card({ title: 'This week', body: list(days, d => dayBlock(d)) });
  root.replaceChildren(plan, addForm(state));
}

function dayBlock(d) {
  const box = document.createElement('div');
  const h = document.createElement('strong');
  h.textContent = d.day;
  const p = document.createElement('p');
  p.textContent = d.items.map(a => `${a.person}: ${a.chore}`).join(', ') || 'Nothing';
  box.append(h, p);
  return box;
}

function addForm(state) {
  const form = document.createElement('form');
  form.id = 'add-chore';
  const name = Object.assign(document.createElement('input'), { name: 'name', required: true });
  const every = document.createElement('select');
  every.name = 'every';
  for (const v of state.terms.every) every.append(new Option(v, v));
  const points = document.createElement('select');
  points.name = 'points';
  for (const v of state.terms.points) points.append(new Option(String(v), String(v)));
  const suggest = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Suggest points' });
  const hint = document.createElement('span');
  suggest.addEventListener('click', async () => {
    const chore = name.value.trim();
    if (!chore) { hint.textContent = 'Type a chore first.'; return; }
    hint.textContent = 'Thinking…';
    try {
      const r = await call('points', pointsPrompt(chore, every.value));
      const n = readPoints(r.text);
      if (n === null || validate(state.pointsSchema, n).length) { hint.textContent = 'No suggestion. Pick points yourself.'; return; }
      points.value = String(n);
      hint.textContent = `Suggested ${n}`;
    } catch {
      hint.textContent = 'No suggestion available.';
    }
  });
  const pointsCell = document.createElement('span');
  pointsCell.append(points, suggest, hint);
  const go = Object.assign(document.createElement('button'), { type: 'submit', textContent: 'Add chore' });
  form.append(formRow('Chore', name), formRow('How often', every), formRow('Points', pointsCell), go);
  form.addEventListener('submit', e => {
    e.preventDefault();
    state.actions.addChore({ name: name.value.trim(), every: every.value, points: Number(points.value) });
  });
  return card({ title: 'Add a chore', body: form });
}
