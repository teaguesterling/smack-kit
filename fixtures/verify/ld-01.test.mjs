import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson, need } from './_lib.mjs';

test('some level drops exactly the letters m, i and a', async () => {
  const levels = readJson('data/levels.json');
  const want = 'a,i,m';
  assert.ok(levels.some(l => [...new Set(l.pool.map(x => x.toLowerCase()))].sort().join(',') === want && l.pool.length >= 3), JSON.stringify(levels.map(l => l.pool)));
  const { validate } = await need('kit/gate.js', 'validate');
  assert.deepEqual(validate(readJson('data/schema/levels.json'), levels), []);
});
