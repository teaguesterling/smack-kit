import { card, list } from '../kit/parts.js';
import { pointsFor } from '../seams/points.js';

export function render(root, state) {
  const rows = state.people.map(p => ({ name: p.name, points: pointsFor(p.name, state.done, state.chores) }));
  root.replaceChildren(card({ title: 'Points board', body: list(rows, r => row(r)) }));
}

function row(r) {
  const line = document.createElement('div');
  line.className = 'board-row';
  const name = document.createElement('span');
  name.className = 'name';
  // fixture: seeded defect cc-06
  name.setAttribute('style', 'display:inline-block;width:64px;white-space:nowrap;overflow:hidden');
  name.textContent = r.name;
  const pts = document.createElement('span');
  pts.className = 'points';
  pts.textContent = ` ${r.points} points`;
  line.append(name, pts);
  return line;
}
