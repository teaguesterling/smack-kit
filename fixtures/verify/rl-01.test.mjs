import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson, readYaml, withPage } from './_lib.mjs';

const kinds = readJson('data/kinds.json');
const audio = kinds.find(k => /audio/i.test(k));

test('an audiobook kind exists, and the old kinds stay', () => {
  assert.ok(audio, `kinds: ${kinds.join(', ')}`);
  for (const k of ['book', 'comic', 'magazine']) assert.ok(kinds.includes(k), k);
  assert.ok(readYaml('definitions.yaml').terms.kind.values.includes(audio), 'definitions.yaml terms.kind.values');
});

test('the Add reading form offers it', async () => {
  const opts = await withPage('today=2026-11-11&tab=add', { width: 390, height: 844 }, page => page.$$eval('select[name=kind] option', os => os.map(o => o.value)));
  assert.ok(opts.includes(audio), opts.join(', '));
});
