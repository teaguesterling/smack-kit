import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validate } from '../kit/gate.js';

const read = p => JSON.parse(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

test('data/levels.json passes its schema', () => {
  assert.deepEqual(validate(read('data/schema/levels.json'), read('data/levels.json')), []);
});
