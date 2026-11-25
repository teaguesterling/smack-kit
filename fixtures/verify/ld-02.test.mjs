import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson, readYaml, need } from './_lib.mjs';

test('a new speed value exists in definitions, is used by a level, and falls slower than slow', async () => {
  const values = readYaml('definitions.yaml').terms.speed.values;
  const fresh = values.filter(v => !['slow', 'medium', 'fast'].includes(v));
  assert.equal(fresh.length, 1, `new speed values: ${JSON.stringify(fresh)}`);
  const v = fresh[0];
  assert.ok(readJson('data/levels.json').some(l => l.speed === v), `no level uses ${v}`);
  const { fallPixelsPerSecond } = await need('seams/speed.js', 'fallPixelsPerSecond');
  const px = fallPixelsPerSecond(v);
  assert.ok(px > 0 && px < fallPixelsPerSecond('slow'), `${v} falls at ${px}`);
  const { validate } = await need('kit/gate.js', 'validate');
  assert.deepEqual(validate(readJson('data/schema/levels.json'), readJson('data/levels.json')), []);
});
