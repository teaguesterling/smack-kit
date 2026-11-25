import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './_lib.mjs';

// Seed the done list (the store's localStorage key), open the board, read the order of the names.
async function boardOrder(done) {
  const init = `localStorage.setItem('kit:chore-chart:done', ${JSON.stringify(JSON.stringify(done))});`;
  return withPage('today=2026-11-11&tab=board', { width: 390, height: 844 }, async page => {
    const text = await page.locator('main').innerText();
    return ['Ari', 'Bo', 'Cy', 'Bartholomew'].map(n => [n, text.search(new RegExp(`\\b${n}\\b`))])
      .filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]).map(([n]) => n);
  }, init);
}
const d = (person, chore) => ({ date: '2026-11-10', person, chore });

// dishes 2, feed the fish 1, hoover the stairs 3 (data/chores.json). Two orders, so a fixed list cannot pass.
test('Bo 5, Cy 3, Ari 1, Bartholomew 0: the board lists Bo, Cy, Ari, Bartholomew', async () => {
  const done = [d('Bo', 'hoover the stairs'), d('Bo', 'dishes'), d('Cy', 'hoover the stairs'), d('Ari', 'feed the fish')];
  assert.deepEqual(await boardOrder(done), ['Bo', 'Cy', 'Ari', 'Bartholomew']);
});

test('Bartholomew 5, Ari 3, Cy 2, Bo 0: the board lists Bartholomew, Ari, Cy, Bo', async () => {
  const done = [d('Bartholomew', 'hoover the stairs'), d('Bartholomew', 'dishes'), d('Ari', 'hoover the stairs'), d('Cy', 'dishes')];
  assert.deepEqual(await boardOrder(done), ['Bartholomew', 'Ari', 'Cy', 'Bo']);
});
