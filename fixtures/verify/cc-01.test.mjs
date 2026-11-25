import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson, need } from './_lib.mjs';

test('a daily 1-point chore about the cat exists, and the data still passes its schema', async () => {
  const chores = readJson('data/chores.json');
  assert.ok(chores.some(c => /cat/i.test(c.name) && c.every === 'daily' && c.points === 1), 'no daily 1-point cat chore');
  const { validate } = await need('kit/gate.js', 'validate');
  assert.deepEqual(validate(readJson('data/schema/chores.json'), chores), []);
});
