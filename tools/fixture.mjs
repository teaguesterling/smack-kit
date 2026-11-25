#!/usr/bin/env node
// Fixture tool: start a task workdir, score it, validate every task both ways.
// Output contract: one line per score, `PASS <id>` or `FAIL <id> <step>: <reason>`.
// Exit: 0 PASS, 1 FAIL, 2 usage or workdir error.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { drift } from './check/drift.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATEGORIES = ['data', 'definitions', 'seam', 'theme', 'layout', 'copy', 'model', 'store', 'roles', 'decline'];
const TASK_KEYS = { id: 1, app: 1, category: 1, tier: 1, prompt: 1, may_touch: 1, decline: 1, expect_regions: 0, verify: 0, seed: 0 };
const NOT_WORKDIR = 'not a fixture workdir (run start first)';

class Usage extends Error {}

export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') { i++; if (glob[i + 1] === '/') { re += '(?:.*/)?'; i++; } else re += '.*'; }
    else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export function loadTask(fixtures, id) {
  const file = path.join(fixtures, 'tasks', `${id}.yaml`);
  if (!fs.existsSync(file)) throw new Usage(`no task ${id} in ${fixtures}/tasks`);
  const t = YAML.parse(fs.readFileSync(file, 'utf8'));
  for (const k of Object.keys(t)) if (!(k in TASK_KEYS)) throw new Usage(`task ${id}: unknown key ${k}`);
  for (const [k, req] of Object.entries(TASK_KEYS)) if (req && !(k in t)) throw new Usage(`task ${id}: missing key ${k}`);
  if (t.id !== id) throw new Usage(`task ${id}: id field is ${t.id}`);
  if (!CATEGORIES.includes(t.category)) throw new Usage(`task ${id}: category ${t.category} is not one of ${CATEGORIES.join(', ')}`);
  if (![1, 2, 3, 4].includes(t.tier)) throw new Usage(`task ${id}: tier must be 1-4`);
  if (!Array.isArray(t.may_touch)) throw new Usage(`task ${id}: may_touch must be a list`);
  if (!t.decline && !t.verify) throw new Usage(`task ${id}: verify is required unless decline`);
  return t;
}

function git(dir, ...args) {
  return execFileSync('git', ['-C', dir, '-c', 'user.name=fixture', '-c', 'user.email=fixture@localhost', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

export function start(fixtures, id, workdir, out = process.stdout) {
  const t = loadTask(fixtures, id);
  const app = path.join(fixtures, 'apps', t.app);
  if (!fs.existsSync(app)) throw new Usage(`task ${id}: no app ${t.app}`);
  if (fs.existsSync(workdir) && fs.readdirSync(workdir).length) throw new Usage(`workdir ${workdir} is not empty`);
  fs.mkdirSync(workdir, { recursive: true });
  const seed = seedDir(fixtures, t);
  fs.cpSync(app, workdir, { recursive: true });
  if (seed) fs.cpSync(seed, workdir, { recursive: true });
  git(workdir, 'init', '-q', '-b', 'main');
  fs.appendFileSync(path.join(workdir, '.git', 'info', 'exclude'), '.fixture-task\n');
  fs.writeFileSync(path.join(workdir, '.fixture-task'), `${id}\n`);
  git(workdir, 'add', '-A');
  git(workdir, 'commit', '-q', '-m', `fixture start ${id}`);
  out.write(promptText(fixtures, t));
}

export function promptText(fixtures, t) {
  const card = path.join(fixtures, 'CARD.md');
  const head = fs.existsSync(card) ? fs.readFileSync(card, 'utf8').trimEnd() + '\n\n' : '';
  return `${head}Task: ${t.prompt}\n`;
}

function listFiles(dir, base = dir, out = new Map()) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    const rel = path.relative(base, abs).split(path.sep).join('/');
    if (rel === '.git' || rel === '.fixture-task') continue;
    if (ent.isDirectory()) listFiles(abs, base, out);
    else out.set(rel, abs);
  }
  return out;
}

// Changed paths are measured against the app as shipped, not against git, so an agent's commits cannot hide them.
/** The task's seed directory (fixtures/seeds/<seed>/), or null. A named seed that is missing is a usage error. */
function seedDir(fixtures, t) {
  if (!t.seed) return null;
  const d = path.join(fixtures, 'seeds', t.seed);
  if (!fs.existsSync(d)) throw new Usage(`task ${t.id}: no seed ${t.seed} in fixtures/seeds`);
  return d;
}

/** The files a task starts from: the app, with the seed laid over it. rel -> abs */
function startFiles(fixtures, t) {
  const files = listFiles(path.join(fixtures, 'apps', t.app));
  const seed = seedDir(fixtures, t);
  if (seed) for (const [rel, abs] of listFiles(seed)) files.set(rel, abs);
  return files;
}

function changedPaths(w, was) {
  const now = listFiles(w);
  const changed = [];
  for (const [rel, abs] of now) if (!was.has(rel) || !fs.readFileSync(abs).equals(fs.readFileSync(was.get(rel)))) changed.push(rel);
  for (const rel of was.keys()) if (!now.has(rel)) changed.push(rel);
  return changed.sort();
}

/** True when the workdir's start commit does not hold exactly the app's current files (the app changed since start). */
function startDiffers(w, files) {
  const root = git(w, 'rev-list', '--max-parents=0', 'HEAD').trim().split('\n')[0];
  const tree = new Map(git(w, 'ls-tree', '-r', root).split('\n').filter(Boolean).map(l => {
    const [meta, rel] = l.split('\t'); return [rel, meta.split(' ')[2]];
  }));
  if (tree.size !== files.size) return true;
  const rels = [...files.keys()];
  const hashes = execFileSync('git', ['hash-object', '--stdin-paths'], { cwd: w, input: rels.map(r => files.get(r)).join('\n'), encoding: 'utf8' }).trim().split('\n');
  return rels.some((r, i) => tree.get(r) !== hashes[i]);
}

function driftReason(w) {
  return drift(w)[0]?.reason ?? null;
}

function firstLine(s) { return String(s).split('\n')[0].slice(0, 160); }

const NOEXIT = path.join(ROOT, 'tools', 'noexit.cjs');

// Runs node --test under coreutils `timeout`, which signals the whole process group, so a hung test cannot linger.
function nodeTest(files, env) {
  const ms = Number(process.env.FIXTURE_TIMEOUT_MS ?? 120000);
  const nodeOptions = [process.env.NODE_OPTIONS, `--require ${NOEXIT}`].filter(Boolean).join(' ');
  // NODE_TEST_CONTEXT is dropped so a score run inside another test run still prints plain TAP.
  const { NODE_TEST_CONTEXT, ...parentEnv } = process.env;
  const r = spawnSync('timeout', ['-k', '2', `${ms / 1000}s`, process.execPath, '--test', ...files], {
    encoding: 'utf8', env: { ...parentEnv, ...env, NODE_OPTIONS: nodeOptions }, maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status === 124 || r.status === 137) return `timed out after ${Math.round(ms / 1000)} s`;
  if (r.status === 0) return null;
  return failureReason(r.stdout || '') ?? `exit ${r.status}`;
}

// The first failing test's title; when the title is a file path (the file failed before any test ran),
// the file's name and its first error message instead.
function failureReason(tap) {
  const lines = tap.split('\n');
  const i = lines.findIndex(l => /^\s*not ok \d+ - /.test(l));
  if (i < 0) return null;
  const title = lines[i].replace(/^\s*not ok \d+ - /, '').trim();
  if (!title.startsWith('/')) return title;
  const comment = lines.slice(0, i).map(l => l.replace(/^\s*# ?/, '')).find(l => /\b\w*Error\b:/.test(l));
  let msg = comment;
  if (!msg) {
    const e = lines.slice(i).findIndex(l => /^\s*error: /.test(l));
    if (e >= 0) {
      const raw = lines[i + e].replace(/^\s*error: /, '').trim();
      msg = /^[|>]-?$/.test(raw) ? (lines[i + e + 1] ?? '').trim() : raw.replace(/^'|'$/g, '');
    }
  }
  return `${path.basename(title)}: ${firstLine(msg ?? 'failed before any test ran')}`;
}

// The maintainer's ruling (2026-11-11): an edit to only the prose of definitions.yaml is in scope for every task.
// Prose is a term's `means` and `notes`, and comments. Values, terms and the `good` rules must not change.
function proseOnly(startDefs, w) {
  const strip = file => {
    let doc;
    try { doc = YAML.parse(fs.readFileSync(file, 'utf8')) ?? {}; } catch { return null; }
    for (const def of Object.values(doc.terms ?? {})) if (def && typeof def === 'object') { delete def.means; delete def.notes; }
    return JSON.stringify(doc);
  };
  const a = startDefs ? strip(startDefs) : null, b = strip(path.join(w, 'definitions.yaml'));
  return a !== null && a === b;
}

export function score(fixtures, id, workdir) {
  const t = loadTask(fixtures, id);
  const w = path.resolve(workdir);
  const marker = path.join(w, '.fixture-task');
  let first = '';
  try { first = git(w, 'log', '--reverse', '--format=%s').split('\n')[0]; } catch { /* not a repo */ }
  if (!fs.existsSync(marker) || fs.readFileSync(marker, 'utf8').trim() !== id || first !== `fixture start ${id}`) {
    return { code: 2, line: NOT_WORKDIR };
  }
  const base = startFiles(fixtures, t);
  if (startDiffers(w, base)) {
    return { code: 2, line: `STALE ${id}: this workdir started from a different version of the app ${t.app}; score it with the kit commit it started from` };
  }
  const fail = (step, reason) => ({ code: 1, line: `FAIL ${id} ${step}: ${reason}` });
  const changed = changedPaths(w, base);
  if (t.decline) {
    if (changed.length) return fail('scope', `${changed[0]} changed, but this task should change nothing`);
  } else {
    const res = t.may_touch.map(globToRegExp);
    const bad = changed.find(p => !res.some(r => r.test(p)) && !(p === 'definitions.yaml' && proseOnly(base.get('definitions.yaml'), w)));
    if (bad) return fail('scope', `${bad} not in may_touch`);
  }
  const d = driftReason(w);
  if (d) return fail('drift', d);
  const checksDir = path.join(w, 'checks');
  if (fs.existsSync(checksDir)) {
    const files = fs.readdirSync(checksDir).filter(f => f.endsWith('.test.mjs')).sort().map(f => path.join(checksDir, f));
    if (files.length) { const r = nodeTest(files, {}); if (r) return fail('checks', r); }
  }
  if (t.verify) {
    const r = nodeTest([path.join(fixtures, t.verify)], { APP_DIR: w });
    if (r) return fail('verify', r);
  }
  return { code: 0, line: `PASS ${id}` };
}

function applyOverlay(src, w) {
  for (const ent of fs.readdirSync(src, { recursive: true, withFileTypes: true })) {
    if (!ent.isFile()) continue;
    const abs = path.join(ent.parentPath ?? ent.path, ent.name);
    const rel = path.relative(src, abs);
    if (rel.endsWith('.delete')) fs.rmSync(path.join(w, rel.slice(0, -'.delete'.length)), { force: true });
    else { fs.mkdirSync(path.dirname(path.join(w, rel)), { recursive: true }); fs.copyFileSync(abs, path.join(w, rel)); }
  }
}

export function validate(fixtures, ids) {
  if (!ids.length) ids = fs.readdirSync(path.join(fixtures, 'tasks')).filter(f => f.endsWith('.yaml') && !f.startsWith('_')).map(f => f.slice(0, -5)).sort();
  const rows = []; let ok = true;
  for (const id of ids) {
    const t = loadTask(fixtures, id);
    const w = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-validate-')), 'work');
    start(fixtures, id, w, { write() {} });
    const s0 = score(fixtures, id, w);
    let startCell, solCell;
    if (t.decline) {
      startCell = s0.code === 0 ? 'PASS (decline)' : 'FAIL (expected PASS)';
      solCell = 'n/a';
      if (s0.code !== 0) ok = false;
    } else {
      const at = s0.code === 1 ? (s0.line.match(/^FAIL \S+ (\w+):/) ?? [])[1] : null;
      startCell = s0.code === 0 ? 'PASS (expected FAIL)' : s0.code !== 1 ? 'ERROR' : at === 'verify' ? 'FAIL' : `FAIL at ${at} (expected verify): ${s0.line}`;
      if (startCell !== 'FAIL') ok = false;
      const sol = path.join(fixtures, 'solutions', id);
      if (!fs.existsSync(sol)) { solCell = 'missing'; ok = false; }
      else {
        applyOverlay(sol, w);
        const s1 = score(fixtures, id, w);
        solCell = s1.code === 0 ? 'PASS' : `FAIL (expected PASS): ${s1.line}`;
        if (s1.code !== 0) ok = false;
      }
    }
    rows.push(`| ${id} | ${startCell} | ${solCell} |`);
  }
  const md = `# Fixture validation\n\nGenerated by \`node tools/fixture.mjs validate\`. A sound task FAILs on the untouched start and PASSes after its reference solution. A decline task PASSes unchanged.\n\n| task | start | solution |\n|---|---|---|\n${rows.join('\n')}\n`;
  fs.writeFileSync(path.join(fixtures, 'VALIDATION.md'), md);
  process.stdout.write(rows.join('\n') + '\n');
  return ok ? 0 : 1;
}

function main(argv) {
  let fixtures = path.join(ROOT, 'fixtures');
  const a = [...argv];
  const fi = a.indexOf('--fixtures');
  if (fi >= 0) { fixtures = path.resolve(a[fi + 1]); a.splice(fi, 2); }
  const [cmd, ...rest] = a;
  try {
    if (cmd === 'start' && rest.length === 2) { start(fixtures, rest[0], path.resolve(rest[1])); return 0; }
    if (cmd === 'score' && rest.length === 2) { const r = score(fixtures, rest[0], rest[1]); console.log(r.line); return r.code; }
    if (cmd === 'validate') return validate(fixtures, rest);
    throw new Usage('usage: fixture.mjs [--fixtures DIR] start <task> <workdir> | score <task> <workdir> | validate [task...]');
  } catch (e) {
    if (e instanceof Usage) { console.error(e.message); return 2; }
    throw e;
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) process.exitCode = main(process.argv.slice(2));
