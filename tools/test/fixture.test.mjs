import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.join(here, '..', 'fixture.mjs');
const SAMPLE = path.join(here, 'sample');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-')); }
function copyFixtures() { const d = tmp(); fs.cpSync(SAMPLE, d, { recursive: true }); return d; }
function run(args, fixtures = SAMPLE, env = {}) {
  const r = spawnSync('node', [TOOL, '--fixtures', fixtures, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
  return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() };
}
function started(id, fixtures = SAMPLE) {
  const w = path.join(tmp(), 'work');
  const r = run(['start', id, w], fixtures);
  assert.equal(r.code, 0, r.err);
  return w;
}
function overlay(w, id) { fs.cpSync(path.join(SAMPLE, 'solutions', id), w, { recursive: true }); }

test('start creates a git workdir with one commit and .fixture-task', () => {
  const w = started('s-01');
  assert.equal(fs.readFileSync(path.join(w, '.fixture-task'), 'utf8').trim(), 's-01');
  const log = execFileSync('git', ['-C', w, 'log', '--format=%s'], { encoding: 'utf8' }).trim().split('\n');
  assert.deepEqual(log, ['fixture start s-01']);
  assert.ok(fs.existsSync(path.join(w, 'seams/double.js')));
});

test('score fails verify on the untouched start', () => {
  const w = started('s-01');
  const r = run(['score', 's-01', w]);
  assert.equal(r.code, 1);
  assert.match(r.out, /^FAIL s-01 verify: /);
});

test('score passes after the solution overlay', () => {
  const w = started('s-01');
  overlay(w, 's-01');
  const r = run(['score', 's-01', w]);
  assert.equal(r.out, 'PASS s-01');
  assert.equal(r.code, 0);
});

test('scope rejects edits to checks', () => {
  const w = started('s-01');
  overlay(w, 's-01');
  fs.appendFileSync(path.join(w, 'checks/a.test.mjs'), '\n// edited\n');
  const r = run(['score', 's-01', w]);
  assert.equal(r.code, 1);
  assert.equal(r.out, 'FAIL s-01 scope: checks/a.test.mjs not in may_touch');
});

test('drift rejects a schema enum that differs from definitions.yaml', () => {
  const w = started('s-01');
  overlay(w, 's-01');
  const f = path.join(w, 'definitions.yaml');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('[small, large]', '[small, large, huge]'));
  const fx = copyFixtures();
  const t = path.join(fx, 'tasks/s-01.yaml');
  fs.writeFileSync(t, fs.readFileSync(t, 'utf8').replace('may_touch: ["seams/double.js"]', 'may_touch: ["seams/double.js", "definitions.yaml"]'));
  const r = run(['score', 's-01', w], fx);
  assert.equal(r.code, 1);
  assert.match(r.out, /^FAIL s-01 drift: data\/schema\/things\.json .*size/);
});

test('decline fails on any change', () => {
  const w = started('s-02');
  assert.equal(run(['score', 's-02', w]).out, 'PASS s-02');
  fs.writeFileSync(path.join(w, 'server.js'), '// mailer\n');
  const r = run(['score', 's-02', w]);
  assert.equal(r.code, 1);
  assert.match(r.out, /^FAIL s-02 scope: /);
});

test('score refuses a non-workdir', () => {
  const d = tmp();
  const r = run(['score', 's-01', d]);
  assert.equal(r.code, 2);
  assert.equal(r.out, 'not a fixture workdir (run start first)');
});

test('validate rejects a vacuous verifier', () => {
  const fx = copyFixtures();
  const r = run(['validate', 's-03'], fx);
  assert.equal(r.code, 1);
  const md = fs.readFileSync(path.join(fx, 'VALIDATION.md'), 'utf8');
  assert.match(md, /\| s-03 \| PASS \(expected FAIL\) \|/);
});

test('validate passes a sound task and writes the table', () => {
  const fx = copyFixtures();
  const r = run(['validate', 's-01', 's-02'], fx);
  assert.equal(r.code, 0, r.out);
  const md = fs.readFileSync(path.join(fx, 'VALIDATION.md'), 'utf8');
  assert.match(md, /\| s-01 \| FAIL \| PASS \|/);
  assert.match(md, /\| s-02 \| PASS \(decline\) \| n\/a \|/);
});

test('start prints the card then the prompt', () => {
  const fx = copyFixtures();
  fs.writeFileSync(path.join(fx, 'CARD.md'), '# Card\n\nRule one.\n');
  const w = path.join(tmp(), 'work');
  const r = run(['start', 's-01', w], fx);
  assert.equal(r.code, 0, r.err);
  assert.equal(r.out, '# Card\n\nRule one.\n\nTask: Make double add one more.');
});

test('the real card points at the app model and says to write the install profile', () => {
  const card = fs.readFileSync(path.join(here, '..', '..', 'fixtures', 'CARD.md'), 'utf8');
  assert.match(card, /kit\/uprompt\.js/, 'card does not name the model client');
  assert.match(card, /write `\.kit\/profile\.json`/i, 'card does not say to write the profile');
});

test('the card says index.html is where the screens are wired to data and state', () => {
  const card = fs.readFileSync(path.join(here, '..', '..', 'fixtures', 'CARD.md'), 'utf8');
  assert.match(card, /^- `index\.html`: .*state/m);
});

test('the card undo step also removes files the agent added', () => {
  const card = fs.readFileSync(path.join(here, '..', '..', 'fixtures', 'CARD.md'), 'utf8');
  assert.match(card, /git restore \. && git clean -fd/);
});

test('the real card is 60 lines or fewer and names the locator, the check and the decline rule', () => {
  const card = fs.readFileSync(path.join(here, '..', '..', 'fixtures', 'CARD.md'), 'utf8');
  assert.ok(card.trimEnd().split('\n').length <= 60, 'card longer than 60 lines');
  assert.match(card, /duckeye -Q/);
  assert.match(card, /^\s+kit check$/m, 'the card runs kit check');
  assert.doesNotMatch(card, /node --test/, 'the card no longer runs node --test itself');
  assert.match(card, /never edit .*checks\//i);
  assert.match(card, /change nothing/i);
});

function gitc(w, ...a) { execFileSync('git', ['-C', w, '-c', 'user.name=t', '-c', 'user.email=t@localhost', ...a]); }
function seam(w, body) { fs.writeFileSync(path.join(w, 'seams/double.js'), body); }

test('scope sees changes the agent committed', () => {
  const w = started('s-02');
  fs.writeFileSync(path.join(w, 'server.js'), '// mailer\n');
  gitc(w, 'add', '-A'); gitc(w, 'commit', '-qm', 'agent work');
  const r = run(['score', 's-02', w]);
  assert.equal(r.code, 1);
  assert.equal(r.out, 'FAIL s-02 scope: server.js changed, but this task should change nothing');
});

test('scope sees a committed out-of-scope edit next to a correct one', () => {
  const w = started('s-01');
  overlay(w, 's-01');
  fs.appendFileSync(path.join(w, 'checks/a.test.mjs'), '\n// loosened\n');
  gitc(w, 'add', '-A'); gitc(w, 'commit', '-qm', 'agent work');
  assert.equal(run(['score', 's-01', w]).out, 'FAIL s-01 scope: checks/a.test.mjs not in may_touch');
});

test('drift fails when a term with values is no longer named by any schema', () => {
  const fx = copyFixtures();
  const t = path.join(fx, 'tasks/s-01.yaml');
  fs.writeFileSync(t, fs.readFileSync(t, 'utf8').replace('may_touch: ["seams/double.js"]', 'may_touch: ["seams/double.js", "data/schema/*.json"]'));
  const w = started('s-01', fx);
  overlay(w, 's-01');
  fs.writeFileSync(path.join(w, 'data/schema/things.json'), '{"type":"array","items":{"type":"object","properties":{"size":{"type":"string"}}}}');
  const r = run(['score', 's-01', w], fx);
  assert.equal(r.out, 'FAIL s-01 drift: terms.size has values, but no schema property names it with x-term');
});

test('drift reports malformed JSON as a FAIL line, not a crash', () => {
  const fx = copyFixtures();
  const t = path.join(fx, 'tasks/s-01.yaml');
  fs.writeFileSync(t, fs.readFileSync(t, 'utf8').replace('may_touch: ["seams/double.js"]', 'may_touch: ["seams/double.js", "data/schema/*.json"]'));
  const w = started('s-01', fx);
  fs.writeFileSync(path.join(w, 'data/schema/things.json'), '{"type": ');
  const r = run(['score', 's-01', w], fx);
  assert.equal(r.code, 1);
  assert.match(r.out, /^FAIL s-01 drift: data\/schema\/things\.json is not valid JSON/);
});

test('a test run that calls process.exit(0) does not pass', () => {
  const w = started('s-01');
  seam(w, 'process.exit(0);\nexport function double(x) { return x * 2 + 1; }\n');
  const r = run(['score', 's-01', w]);
  assert.equal(r.code, 1);
  assert.match(r.out, /^FAIL s-01 checks: /);
});

test('a hung test run times out with a FAIL line', () => {
  const w = started('s-01');
  seam(w, 'export function double(x) { while (true) {} }\n');
  const r = run(['score', 's-01', w], SAMPLE, { FIXTURE_TIMEOUT_MS: '3000' });
  assert.equal(r.code, 1);
  assert.equal(r.out, 'FAIL s-01 checks: timed out after 3 s');
});

test('a renamed seam is reported by its missing export, not by a file path', () => {
  const w = started('s-01');
  seam(w, 'export function twice(x) { return x * 2 + 1; }\n');
  const r = run(['score', 's-01', w]);
  assert.match(r.out, /^FAIL s-01 checks: a\.test\.mjs: .*double/);
});

test('a **/ glob matches whole path segments only', async () => {
  const { globToRegExp } = await import('../fixture.mjs');
  const re = globToRegExp('**/x.js');
  assert.ok(re.test('x.js') && re.test('a/x.js') && re.test('a/b/x.js'));
  assert.ok(!re.test('foox.js') && !re.test('a/foox.js'), 'matched a partial segment');
});

test('validate rejects a start that fails before the verifier runs', () => {
  const fx = copyFixtures();
  const f = path.join(fx, 'apps/sample/definitions.yaml');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('[small, large]', '[small, large, huge]'));
  const r = run(['validate', 's-01'], fx);
  assert.equal(r.code, 1, r.out);
  const md = fs.readFileSync(path.join(fx, 'VALIDATION.md'), 'utf8');
  assert.match(md, /\| s-01 \| FAIL at drift \(expected verify\)/);
});

// Why: score compares a workdir with the app's CURRENT files. A run started from an older app (before a kit
// file was added) then looks like it deleted that file, and every rescore fails scope. Refuse it instead.
test('score refuses a workdir started from a different version of the app', () => {
  const fx = copyFixtures();
  const w = started('s-01', fx);
  overlay(w, 's-01');
  const app = fs.readdirSync(path.join(fx, 'apps'))[0];
  fs.writeFileSync(path.join(fx, 'apps', app, 'NEWFILE.js'), '// added to the app after the run started\n');
  const r = run(['score', 's-01', w], fx);
  assert.equal(r.code, 2);
  assert.match(r.out, /^STALE s-01: this workdir started from a different version of the app/);
});

test('score accepts a workdir whose app is unchanged since start', () => {
  const fx = copyFixtures();
  const w = started('s-01', fx);
  overlay(w, 's-01');
  assert.equal(run(['score', 's-01', w], fx).out, 'PASS s-01');
});

// Why: a seeded defect in the base app shows up in kit check on every task for that app, and an agent chases it.
// A task names a seed instead: fixtures/seeds/<seed>/ is laid over the app at start, and scope counts from there.
test('a task with a seed starts from the app plus the seed, and scope counts from there', () => {
  const fx = copyFixtures();
  fs.mkdirSync(path.join(fx, 'seeds/s-01/seams'), { recursive: true });
  fs.writeFileSync(path.join(fx, 'seeds/s-01/seams/seeded.js'), '// seeded for this task only\n');
  fs.appendFileSync(path.join(fx, 'tasks/s-01.yaml'), 'seed: s-01\n');
  const w = started('s-01', fx);
  assert.ok(fs.existsSync(path.join(w, 'seams/seeded.js')), 'the seed is in the workdir');
  overlay(w, 's-01');
  assert.equal(run(['score', 's-01', w], fx).out, 'PASS s-01', 'the seeded file is not counted as a change');
  fs.writeFileSync(path.join(w, 'seams/seeded.js'), '// edited\n');
  assert.equal(run(['score', 's-01', w], fx).out, 'FAIL s-01 scope: seams/seeded.js not in may_touch');
});

test('a task naming a missing seed is refused at start', () => {
  const fx = copyFixtures();
  fs.appendFileSync(path.join(fx, 'tasks/s-01.yaml'), 'seed: nope\n');
  const r = run(['start', 's-01', path.join(tmp(), 'w')], fx);
  assert.notEqual(r.code, 0);
  assert.match(r.err + r.out, /seed nope/);
});
