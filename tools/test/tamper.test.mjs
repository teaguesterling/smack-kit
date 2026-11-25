import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tool = (...a) => spawnSync('node', [path.join(ROOT, 'tools/fixture.mjs'), ...a], { encoding: 'utf8' });

test('tamper: the cc-03 solution plus an edit to checks/ fails scope', () => {
  const w = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tamper-')), 'w');
  assert.equal(tool('start', 'cc-03', w).status, 0);
  fs.cpSync(path.join(ROOT, 'fixtures/solutions/cc-03'), w, { recursive: true });
  fs.appendFileSync(path.join(w, 'checks/rotation.test.mjs'), '\n// loosened\n');
  const r = tool('score', 'cc-03', w);
  assert.equal(r.stdout.trim(), 'FAIL cc-03 scope: checks/rotation.test.mjs not in may_touch');
  assert.equal(r.status, 1);
});
