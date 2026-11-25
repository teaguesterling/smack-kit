import { card, list, emptyState } from '../kit/parts.js';

export function render(root, state) {
  const mine = state.week.filter(a => a.date === state.today);
  root.replaceChildren(card({ title: `Today's chores`, body: mine.length ? list(mine, a => row(a, state)) : emptyState('No chores today.') }));
}

function row(a, state) {
  const label = document.createElement('label');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = state.isDone(a);
  box.addEventListener('change', () => state.actions.toggleDone(a));
  label.append(box, ` ${a.person}: ${a.chore}`);
  return label;
}
