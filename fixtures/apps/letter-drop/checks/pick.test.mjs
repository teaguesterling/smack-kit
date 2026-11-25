import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextLetter } from '../seams/pick.js';

test('nextLetter always comes from the pool', () => {
  const pool = ['a', 's', 'd'];
  for (const r of [0, 0.2, 0.5, 0.99]) assert.ok(pool.includes(nextLetter(pool, () => r)));
});

test('nextLetter is deterministic for a fixed rand', () => {
  assert.equal(nextLetter(['a', 's', 'd', 'f'], () => 0.5), nextLetter(['a', 's', 'd', 'f'], () => 0.5));
  assert.equal(nextLetter(['a', 's', 'd', 'f'], () => 0), 'a');
});
