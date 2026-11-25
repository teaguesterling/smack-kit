import { card, list, emptyState } from '../kit/parts.js';
import { call } from '../kit/uprompt.js';
import { historyFor, suggestionMessages, checkSuggestions } from '../seams/suggest.js';

const para = (text, cls) => Object.assign(document.createElement('p'), { textContent: text, className: cls ?? '' });

export function render(root, state) {
  const out = document.createElement('div');
  out.setAttribute('aria-live', 'polite');

  const go = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Suggest next books' });
  go.addEventListener('click', async () => {
    go.disabled = true;
    out.replaceChildren(para('Thinking…'));
    try {
      const history = historyFor(state.readers, state.entries);
      const { text } = await call('suggest', suggestionMessages(history));
      const { suggestions, errors } = checkSuggestions(text, state.suggestionSchema, state.readers, state.entries);
      const parts = [];
      if (suggestions.length) {
        parts.push(list(suggestions, s => {
          const p = document.createElement('p');
          p.append(Object.assign(document.createElement('strong'), { textContent: s.reader }), `: ${s.title}. ${s.reason}`);
          return p;
        }));
      } else {
        parts.push(emptyState('No suggestions passed the checks.'));
      }
      for (const err of errors) parts.push(para(`Left out: ${err}`, 'week-goal'));
      out.replaceChildren(...parts);
    } catch (err) {
      out.replaceChildren(para(`Could not get suggestions: ${err.message}`));
    } finally {
      go.disabled = false;
    }
  });

  const body = document.createElement('div');
  body.append(go, out);
  root.replaceChildren(card({ title: 'Next book for each child', body }));
}
