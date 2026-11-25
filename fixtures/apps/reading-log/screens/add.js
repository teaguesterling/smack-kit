import { card, formRow } from '../kit/parts.js';

export function render(root, state) {
  const form = document.createElement('form');
  form.id = 'add-reading';
  const reader = Object.assign(document.createElement('select'), { name: 'reader' });
  for (const r of state.readers) reader.append(new Option(r.name, r.name));
  const kind = Object.assign(document.createElement('select'), { name: 'kind' });
  for (const k of state.kinds) kind.append(new Option(k, k));
  const title = Object.assign(document.createElement('input'), { name: 'title', required: true });
  const minutes = Object.assign(document.createElement('input'), { name: 'minutes', type: 'number', min: '1', max: '300', value: '20', required: true });
  const date = Object.assign(document.createElement('input'), { name: 'date', type: 'date', value: state.today, required: true });
  const go = Object.assign(document.createElement('button'), { type: 'submit', textContent: 'Save' });
  form.append(formRow('Who', reader), formRow('What', kind), formRow('Title', title), formRow('Minutes', minutes), formRow('Day', date), go);
  form.addEventListener('submit', e => {
    e.preventDefault();
    state.actions.addEntry({ date: date.value, reader: reader.value, kind: kind.value, title: title.value.trim(), minutes: Number(minutes.value) });
  });
  root.replaceChildren(card({ title: 'Add reading', body: form }));
}
