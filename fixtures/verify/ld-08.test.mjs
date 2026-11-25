import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson, originalJson, withPage } from './_lib.mjs';

const levels = readJson('data/levels.json');

test('a medium level called Numbers drops the digits 1 to 9', () => {
  const lv = levels.find(l => /^numbers$/i.test(l.name.trim()));
  assert.ok(lv, `no level called Numbers in ${levels.map(l => l.name).join(', ')}`);
  assert.equal(lv.speed, 'medium');
  assert.deepEqual([...lv.pool].sort(), ['1', '2', '3', '4', '5', '6', '7', '8', '9']);
});

test('the levels that were there are unchanged', () => {
  for (const old of originalJson('letter-drop', 'data/levels.json')) assert.deepEqual(levels.find(l => l.name === old.name), old);
});

test('the menu offers Numbers', async () => {
  const text = await withPage('', { width: 390, height: 844 }, page => page.locator('main').innerText());
  assert.match(text, /numbers/i);
});
