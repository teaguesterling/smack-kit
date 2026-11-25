import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson, originalJson, hue, rgbOf } from './_lib.mjs';

test('the accent is green (hue 90 to 160 degrees), in any CSS colour form', async () => {
  const [rgb] = await rgbOf(readJson('theme.json').accent);
  const h = hue(rgb);
  assert.ok(h >= 90 && h <= 160, `hue ${h.toFixed(0)}`);
});

test('no other token changed', () => {
  const now = readJson('theme.json'), was = originalJson('chore-chart', 'theme.json');
  delete now.accent; delete was.accent;
  assert.deepEqual(now, was);
});
