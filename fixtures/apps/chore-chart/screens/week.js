import { card, list, formRow } from '../kit/parts.js';

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
  const go = Object.assign(document.createElement('button'), { type: 'submit', textContent: 'Add chore' });
  form.append(formRow('Chore', name), formRow('How often', every), formRow('Points', points), go);
  form.addEventListener('submit', e => {
    e.preventDefault();
    state.actions.addChore({ name: name.value.trim(), every: every.value, points: Number(points.value) });
  });
  return card({ title: 'Add a chore', body: form });
}
