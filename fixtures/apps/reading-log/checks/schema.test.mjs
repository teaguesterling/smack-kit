import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validate } from '../kit/gate.js';

const read = p => JSON.parse(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

for (const name of ['readers', 'kinds']) {
  test(`data/${name}.json passes its schema`, () => {
    assert.deepEqual(validate(read(`data/schema/${name}.json`), read(`data/${name}.json`)), []);
  });
}
