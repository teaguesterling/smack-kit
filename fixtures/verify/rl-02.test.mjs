import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './_lib.mjs';

// Seed the entries (the store's localStorage key), open the month screen, and read each child's streak:
// the number on a line that names the child and says "streak" or "in a row".
async function streaks(today, entries) {
  const init = `localStorage.setItem('kit:reading-log:entries', ${JSON.stringify(JSON.stringify(entries))});`;
  const text = await withPage(`today=${today}&tab=month`, { width: 390, height: 844 }, page => page.locator('main').innerText(), init);
  const out = {};
  for (const name of ['Dee', 'Eli']) {
    const line = text.split('\n').find(l => new RegExp(`\\b${name}\\b`).test(l) && /streak|in a row/i.test(l));
    const rest = line?.replace(name, '');
    out[name] = !line ? `no streak line for ${name}` : /\d/.test(rest) ? Number(rest.match(/\d+/)[0]) : /\b(no|none|not yet|zero)\b/i.test(rest) ? 0 : NaN;
  }
  return out;
}
const e = (date, reader, minutes = 20) => ({ date, reader, kind: 'book', title: 'Moon Kites', minutes });

test('Dee read the last 3 days and Eli read today and 2 days ago: 3 and 1', async () => {
  assert.deepEqual(await streaks('2026-11-11', [e('2026-11-09', 'Dee'), e('2026-11-10', 'Dee'), e('2026-11-11', 'Dee'), e('2026-11-09', 'Eli'), e('2026-11-11', 'Eli')]), { Dee: 3, Eli: 1 });
});

test('a streak that crosses into a new month counts every day; no reading since last week is 0', async () => {
  assert.deepEqual(await streaks('2026-12-02', [e('2026-11-30', 'Dee'), e('2026-12-01', 'Dee'), e('2026-12-02', 'Dee', 5), e('2026-11-25', 'Eli')]), { Dee: 3, Eli: 0 });
});
