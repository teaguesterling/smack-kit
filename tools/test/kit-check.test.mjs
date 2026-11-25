// kit check (spec 6.5): quiet on success, one `file:line rule message` line per fault, non-zero exit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export function kit(args, env = {}) {
  const r = spawnSync('node', [path.join(ROOT, 'tools/kit.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
export function appCopy(name) {
  const d = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kit-check-')), name);
  fs.cpSync(path.join(ROOT, 'fixtures/apps', name), d, { recursive: true });
  return d;
}
const edit = (dir, rel, fn) => { const f = path.join(dir, rel); fs.writeFileSync(f, fn(fs.readFileSync(f, 'utf8'))); };

test('kit check on letter-drop with the install profile prints nothing and exits 0', () => {
  const r = kit(['check', appCopy('letter-drop'), '--profile', 'install']);
  assert.equal(r.out + r.err, '');
  assert.equal(r.code, 0);
});

test('a schema enum that differs from definitions.yaml is one drift line', () => {
  const app = appCopy('letter-drop');
  edit(app, 'data/schema/levels.json', s => s.replace('"enum": ["slow", "medium", "fast"]', '"enum": ["slow", "medium"]'));
  const r = kit(['check', app, '--profile', 'install']);
  assert.equal(r.out, 'data/schema/levels.json:1 drift /items/properties/speed enum differs from terms.speed.values\n');
  assert.equal(r.code, 1);
});

test('an unknown argument prints usage and exits 2', () => {
  const r = kit(['check', '--frobnicate']);
  assert.equal(r.code, 2);
  assert.match(r.err, /^usage: kit check \[appdir\] \[--profile dev\|install\]/);
});

// Task 2: schema step.
test('a level with speed "turbo" is one schema line at the line of that item', () => {
  const app = appCopy('letter-drop');
  edit(app, 'data/levels.json', s => s.replace(/\n\]\s*$/, ',\n  {"name":"T","speed":"turbo","pool":["a"]}\n]\n'));
  const r = kit(['check', app, '--profile', 'install']);
  assert.equal(r.out, 'data/levels.json:4 schema [2].speed: "turbo" is not one of slow, medium, fast\n');
  assert.equal(r.code, 1);
});

test('a data file with no schema is reported', () => {
  const app = appCopy('letter-drop');
  fs.writeFileSync(path.join(app, 'data/extra.json'), '[]\n');
  assert.equal(kit(['check', app, '--profile', 'install']).out, 'data/extra.json:1 schema no schema data/schema/extra.json\n');
});

test('an app with no data/schema directory reports nothing from schema', () => {
  const app = appCopy('letter-drop');
  for (const d of ['data', 'checks', 'definitions.yaml']) fs.rmSync(path.join(app, d), { recursive: true });
  const r = kit(['check', app, '--profile', 'install']);
  assert.equal(r.out, '');
});

// Task 3: purity step. One temp seam per case; the install profile stops before layout.
function seam(src, name = 'probe.js') {
  const app = appCopy('letter-drop');
  fs.writeFileSync(path.join(app, 'seams', name), src);
  return kit(['check', app, '--profile', 'install']);
}

test("globalThis['fe'+'tch'] is caught", () => {
  const r = seam("export const f = x => globalThis['fe' + 'tch'](x);\n");
  assert.match(r.out, /^seams\/probe\.js:1 purity globalThis is not allowed in a seam/);
  assert.equal(r.code, 1);
});

test('fetch, localStorage and document are each one line, with their line numbers', () => {
  const r = seam('export function f(x) {\n  fetch(x);\n  localStorage.getItem(x);\n  return document.title;\n}\n');
  assert.deepEqual(r.out.trim().split('\n').map(l => l.split(' ').slice(0, 3).join(' ')),
    ['seams/probe.js:2 purity fetch', 'seams/probe.js:3 purity localStorage', 'seams/probe.js:4 purity document']);
});

test('a local variable called document is allowed', () => {
  assert.equal(seam('export function f(document) { return document.title; }\n').out, '');
});

test('Math.random() and new Date() with no arguments are caught; new Date("2026-11-14") is allowed', () => {
  const r = seam('export const a = () => Math.random();\nexport const b = () => new Date();\nexport const c = () => new Date("2026-11-14");\nexport const d = () => Date.now();\n');
  assert.deepEqual(r.out.trim().split('\n').map(l => l.split(' ')[0]), ['seams/probe.js:1', 'seams/probe.js:2', 'seams/probe.js:4']);
});

test('importing ./other.js and ../kit/dates.js is allowed; ../kit/uprompt.js is caught', () => {
  assert.equal(seam("import { scoreFor } from './score.js';\nimport { weekdayOf } from '../kit/dates.js';\nexport const f = () => scoreFor(true, 0) + weekdayOf('2026-11-14');\n").out, '');
  assert.match(seam("import { call } from '../kit/uprompt.js';\nexport const f = () => call;\n").out, /^seams\/probe\.js:1 purity \.\.\/kit\/uprompt\.js is not allowed in a seam/);
});

test('import() is caught', () => {
  assert.match(seam("export const f = () => import('./score.js');\n").out, /^seams\/probe\.js:1 purity import\(\) is not allowed in a seam/);
});

test('a syntax error is one line: cannot parse', () => {
  const r = seam('export function f( {\n');
  assert.match(r.out, /^seams\/probe\.js:2 purity cannot parse: Unexpected token/); // acorn stops at end of input, line 2
  assert.equal(r.out.trim().split('\n').length, 1);
});

test("both example apps' seams pass", () => {
  for (const a of ['letter-drop', 'chore-chart', 'reading-log']) assert.equal(kit(['check', appCopy(a), '--profile', 'install']).out, '', a);
});

// Task 4: tests step.
test("a broken seam gives one tests line per failing test, at the test's file and line", () => {
  const app = appCopy('letter-drop');
  edit(app, 'seams/score.js', s => s.replace('return hit ? 1 : 0;', 'return hit ? 2 : 0;'));
  const r = kit(['check', app, '--profile', 'install']);
  const lines = r.out.trim().split('\n');
  assert.equal(lines.length, 1, r.out);
  assert.match(lines[0], /^checks\/score\.test\.mjs:5 tests a hit scores 1: /);
  assert.equal(r.code, 1);
});

test('an app with no checks directory reports nothing from tests', () => {
  const app = appCopy('letter-drop');
  fs.rmSync(path.join(app, 'checks'), { recursive: true });
  assert.equal(kit(['check', app, '--profile', 'install']).out, '');
});

test('a check file that throws while loading is one line: failed to load', () => {
  const app = appCopy('letter-drop');
  fs.writeFileSync(path.join(app, 'checks/zz.test.mjs'), "throw new Error('boom');\n");
  assert.equal(kit(['check', app, '--profile', 'install']).out, 'checks/zz.test.mjs:1 tests failed to load: Error: boom\n');
});

// Purity bypasses from the automated security review (2026-11-11). The step is a guard for honest mistakes,
// not a sandbox; these two are cheap to close.
test("reaching Function through .constructor is caught", () => {
  const r = seam("export const f = () => ''.constructor.constructor('return 1')();\n");
  assert.match(r.out, /^seams\/probe\.js:1 purity \.constructor is not allowed in a seam/);
});

test('an import that leaves seams/ by an encoded or odd path is caught', () => {
  for (const s of ['./%2e%2e/kit/uprompt.js', './a/../../kit/store.js', '.\\\\..\\\\kit\\\\store.js']) {
    assert.match(seam(`import x from '${s}';\nexport const f = () => x;\n`).out, /^seams\/probe\.js:1 purity .* is not allowed in a seam/, s);
  }
  assert.equal(seam("import { scoreFor } from './score.js';\nexport const f = () => scoreFor(true, 0);\n").out, '');
});

// Task 5: layout step. Faults read `index.html:1 layout [<screen query>] <kind>: <detail>`.
const layoutLines = r => r.out.trim().split('\n').filter(Boolean);
const kinds = lines => [...new Set(lines.map(l => l.match(/^index\.html:1 layout \[([^\]]*)\] ([a-z ]+):/)?.slice(1).join(' | ') ?? `UNPARSED ${l}`))].sort();
const taskStart = id => { const w = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kit-task-')), 'w'); spawnSync('node', [path.join(ROOT, 'tools/fixture.mjs'), 'start', id, w]); return w; };
const solved = (name, ...ids) => { const app = appCopy(name); for (const id of ids) fs.cpSync(path.join(ROOT, 'fixtures/solutions', id), app, { recursive: true }); return app; };

test('the cc-06 start has exactly its seeded faults', () => {
  const r = kit(['check', taskStart('cc-06')]);
  assert.deepEqual(kinds(layoutLines(r)), ['today=2026-11-11&tab=board | cut off', 'today=2026-11-11&tab=board | inline style'], r.out);
  assert.equal(r.code, 1);
});

test('the ld-04 start has exactly its seeded fault, on the menu and in the game', () => {
  const r = kit(['check', taskStart('ld-04')]);
  assert.deepEqual(kinds(layoutLines(r)), [' | overlaps', 'level=0 | overlaps'], r.out);
  assert.match(r.out, /overlaps: "Score 0" \(span#score\) overlaps header\.kit-header/);
});

test('both untouched apps pass every step, layout included', () => {
  for (const a of ['chore-chart', 'letter-drop', 'reading-log']) { const r = kit(['check', appCopy(a)]); assert.equal(r.out, '', a); assert.equal(r.code, 0); }
});

test('with the cc-06 and ld-04 reference solutions applied, layout reports nothing', () => {
  for (const id of ['cc-06', 'ld-04']) {
    const w = taskStart(id); fs.cpSync(path.join(ROOT, 'fixtures/solutions', id), w, { recursive: true });
    const r = kit(['check', w]);
    assert.equal(r.out, '', `${id}: ${r.out}`);
    assert.equal(r.code, 0);
  }
});

test('no browser is one fault, not a pass', () => {
  const r = kit(['check', solved('letter-drop', 'ld-04')], { CHROME_PATH: '/nonexistent/chrome' });
  assert.match(r.out, /^index\.html:1 layout cannot run: /);
  assert.equal(layoutLines(r).length, 1);
  assert.equal(r.code, 1);
});

// Final review fixes (2026-11-11).
test('a missing or empty directory is one fault, not a silent pass', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-empty-'));
  for (const d of [empty, path.join(empty, 'nope')]) {
    const r = kit(['check', d, '--profile', 'install']);
    assert.equal(r.out, 'app.json:1 check not an app directory: no app.json\n', d);
    assert.equal(r.code, 1);
  }
});

test('the install profile runs without playwright', async () => {
  // A copy of the kit tools with node_modules holding only acorn and yaml, as on a device.
  const k = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-noplaywright-'));
  fs.cpSync(path.join(ROOT, 'tools'), path.join(k, 'tools'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'fixtures/kit-standin'), path.join(k, 'fixtures/kit-standin'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'package.json'), path.join(k, 'package.json'));
  for (const m of ['acorn', 'yaml']) fs.cpSync(path.join(ROOT, 'node_modules', m), path.join(k, 'node_modules', m), { recursive: true });
  const run = args => spawnSync('node', [path.join(k, 'tools/kit.mjs'), ...args], { encoding: 'utf8' });
  const ok = run(['check', appCopy('letter-drop'), '--profile', 'install']);
  assert.equal(ok.stdout + ok.stderr, '');
  assert.equal(ok.status, 0);
  const dev = run(['check', appCopy('letter-drop')]);
  assert.match(dev.stdout, /^index\.html:1 layout cannot run: /);
});

test('a schema that is not valid JSON is one drift line, without a false second line', () => {
  const app = appCopy('letter-drop');
  fs.writeFileSync(path.join(app, 'data/schema/levels.json'), '{\n');
  const r = kit(['check', app, '--profile', 'install']);
  assert.equal(r.out.trim().split('\n').length, 1, r.out);
  assert.match(r.out, /^data\/schema\/levels\.json:1 drift is not valid JSON/);
});

test('crypto.randomUUID(), performance.now() and Date() are caught', () => {
  const r = seam('export const a = () => crypto.randomUUID();\nexport const b = () => performance.now();\nexport const c = () => Date();\n');
  assert.deepEqual(r.out.trim().split('\n').map(l => l.split(' ')[0]), ['seams/probe.js:1', 'seams/probe.js:2', 'seams/probe.js:3']);
});

test("the schema step uses the app's own vendored kit/gate.js", () => {
  const app = appCopy('letter-drop');
  // An app whose vendored gate refuses everything: the check must follow it, not the kit repo's copy.
  fs.writeFileSync(path.join(app, 'kit/gate.js'), "export function validate() { return ['[0]: refused by this app\\'s gate']; }\n");
  assert.match(kit(['check', app, '--profile', 'install']).out, /^data\/levels\.json:\d+ schema \[0\]: refused by this app's gate/);
});
