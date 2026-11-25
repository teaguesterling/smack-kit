// Counterexamples from the whole-branch review: wrong answers that must FAIL, and alternative correct answers that must PASS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tool = (...a) => spawnSync('node', [path.join(ROOT, 'tools/fixture.mjs'), ...a], { encoding: 'utf8' });

/** Start a task, optionally apply its reference solution, then mutate; return the score line. */
function scoreCase(id, { solution = true, mutate = () => {} } = {}) {
  const w = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'counter-')), 'w');
  assert.equal(tool('start', id, w).status, 0);
  if (solution) fs.cpSync(path.join(ROOT, 'fixtures/solutions', id), w, { recursive: true });
  const edit = (rel, fn) => { const f = path.join(w, rel); fs.writeFileSync(f, fn(fs.readFileSync(f, 'utf8'))); };
  mutate(edit, w);
  return tool('score', id, w).stdout.trim();
}

test('cc-07: a blanket chore→job rename that breaks the field names fails', () => {
  const out = scoreCase('cc-07', { mutate: edit => {
    for (const f of ['screens/today.js', 'screens/week.js']) edit(f, s => s.replace(/chore/g, 'job').replace(/Chore/g, 'Job'));
  } });
  assert.match(out, /^FAIL cc-07 verify: /);
});

test('cc-08: setting the select to 3 without asking the model fails', () => {
  const out = scoreCase('cc-08', { solution: false, mutate: edit => {
    edit('screens/week.js', s => s.replace("  const go = Object.assign", "  points.value = '3';\n  const go = Object.assign"));
  } });
  assert.match(out, /^FAIL cc-08 verify: /);
});

test('cc-08: a suggestion behind an "Ask AI" button passes', () => {
  const out = scoreCase('cc-08', { mutate: edit => {
    edit('screens/week.js', s => s.replace(
      "  name.addEventListener('change', () => suggestPoints(name.value.trim(), state.terms.points, points, hint));\n  form.append(hint);",
      "  const ask = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Ask AI' });\n  ask.addEventListener('click', () => suggestPoints(name.value.trim(), state.terms.points, points, hint));\n  form.append(ask, hint);"));
  } });
  assert.equal(out, 'PASS cc-08');
});

test('cc-02: the value "weekend" (singular) passes', () => {
  const out = scoreCase('cc-02', { mutate: edit => {
    for (const f of ['definitions.yaml', 'data/schema/chores.json', 'seams/rotation.js']) edit(f, s => s.replace(/weekends/g, 'weekend'));
  } });
  assert.equal(out, 'PASS cc-02');
});

for (const accent of ['green', '#0a0', 'rgb(46, 139, 87)']) {
  test(`cc-05: accent ${accent} passes`, () => {
    assert.equal(scoreCase('cc-05', { mutate: edit => edit('theme.json', s => s.replace('"#237a4b"', JSON.stringify(accent))) }), 'PASS cc-05');
  });
}

test('ld-05: short hex colours #111 on #eee pass', () => {
  const out = scoreCase('ld-05', { mutate: edit => edit('theme.json', s => s.replace('"#1b1b22"', '"#111"').replace('"#f2f2f2"', '"#eee"')) });
  assert.equal(out, 'PASS ld-05');
});

test('ld-04: hiding the header fails', () => {
  const out = scoreCase('ld-04', { solution: false, mutate: edit => edit('app.css', s => s + '\n.kit-header { display: none; }\n') });
  assert.match(out, /^FAIL ld-04 verify: /);
});

test('ld-06: "Top score: 7" passes', () => {
  assert.equal(scoreCase('ld-06', { mutate: edit => edit('screens/game.js', s => s.replace('`High score: ${b ?? 0}`', '`Top score: ${b ?? 0}`')) }), 'PASS ld-06');
});

test('ld-06: label and value in separate elements pass', () => {
  const out = scoreCase('ld-06', { mutate: edit => edit('screens/game.js', s => s.replace(
    "  store.get('best').then(b => { best.textContent = `High score: ${b ?? 0}`; });",
    "  store.get('best').then(b => { best.innerHTML = `<div>Best score</div><div>${b ?? 0}</div>`; });")) });
  assert.equal(out, 'PASS ld-06');
});

test('ld-02: removing the schema constraint for speed fails', () => {
  const out = scoreCase('ld-02', { mutate: edit => edit('data/schema/levels.json', s =>
    s.replace(/"speed": \{[^}]*\}/, '"speed": {"type": "string"}')) });
  assert.match(out, /^FAIL ld-02 drift: /);
});

// From a Haiku run on 2026-11-11: the store is opened in index.html, so that is where a high score gets wired.
test('ld-06: wiring the high score in index.html passes', () => {
  const out = scoreCase('ld-06', { solution: false, mutate: (edit, w) => {
    fs.cpSync(path.join(ROOT, 'tools/test/cases/ld-06-index-wiring'), w, { recursive: true });
  } });
  assert.equal(out, 'PASS ld-06');
});

test('cc-09: a profile with a value its schema does not allow fails', () => {
  const out = scoreCase('cc-09', { solution: false, mutate: (edit, w) => {
    fs.writeFileSync(path.join(w, '.kit/profile.json'), JSON.stringify({ dev: 'elsewhere', inference: { on: 'tiiny' }, hosting: 'static', storage: 'cloud' }));
  } });
  assert.match(out, /^FAIL cc-09 verify: /);
});

// From a Haiku run on 2026-11-11: index.html loads the schema, so passing it into the screens' state happens there.
test('cc-08: passing the points schema through index.html passes', () => {
  const out = scoreCase('cc-08', { solution: false, mutate: (edit, w) => {
    fs.cpSync(path.join(ROOT, 'tools/test/cases/cc-08-index-wiring'), w, { recursive: true });
  } });
  assert.equal(out, 'PASS cc-08');
});

// From a Haiku run on 2026-11-11. The maintainer's ruling (2026-11-11): the app name "Chore chart" may stay.
const keepName = (edit, w) => fs.cpSync(path.join(ROOT, 'tools/test/cases/cc-07-keep-app-name'), w, { recursive: true });

test('cc-07: renaming every label but keeping the app name passes', () => {
  assert.equal(scoreCase('cc-07', { solution: false, mutate: keepName }), 'PASS cc-07');
});

test('cc-07: keeping the app name and one "Add chore" button fails', () => {
  const out = scoreCase('cc-07', { solution: false, mutate: (edit, w) => {
    keepName(edit, w);
    edit('screens/week.js', s => s.replace("textContent: 'Add job'", "textContent: 'Add chore'"));
  } });
  assert.match(out, /^FAIL cc-07 verify: /);
});

// Held-out tasks (cc-11, cc-12, ld-07, ld-08, ld-09), written 2026-11-11 before any model saw them.
test('cc-11: hard-coding the name "Bartholomew" in the seam fails', () => {
  const out = scoreCase('cc-11', { solution: false, mutate: edit => {
    edit('seams/rotation.js', s => s.replace('  for (let day = 0; day < 7; day++) {\n',
      "  for (let day = 0; day < 7; day++) {\n    const here = people.filter(p => p.name !== 'Bartholomew' || day >= 5);\n")
      .replace('people[(ci + Math.floor(day / 2)) % people.length]', 'here[(ci + Math.floor(day / 2)) % here.length]'));
  } });
  assert.match(out, /^FAIL cc-11 verify: /);
});

test('cc-11: taking Bartholomew off the chart fails', () => {
  const out = scoreCase('cc-11', { solution: false, mutate: edit => edit('data/people.json', s => s.replace(',{"name":"Bartholomew"}', '')) });
  assert.match(out, /^FAIL cc-11 /);
});

test('cc-12: sorting in a new seam file passes', () => {
  const out = scoreCase('cc-12', { solution: false, mutate: (edit, w) => {
    fs.writeFileSync(path.join(w, 'seams/rank.js'), '// Seam: board order. Pure.\nexport const byPoints = rows => [...rows].sort((a, b) => b.points - a.points);\n');
    edit('screens/board.js', s => s.replace("import { pointsFor } from '../seams/points.js';", "import { pointsFor } from '../seams/points.js';\nimport { byPoints } from '../seams/rank.js';")
      .replace('body: list(rows,', 'body: list(byPoints(rows),'));
  } });
  assert.equal(out, 'PASS cc-12');
});

test('ld-07: a fixed message with no model call fails', () => {
  const out = scoreCase('ld-07', { solution: false, mutate: edit => edit('index.html', s => s.replace('emptyState(`You scored ${score}.`)', 'emptyState(`You scored ${score}. Great catching, keep going!`)')) });
  assert.match(out, /^FAIL ld-07 verify: /);
});

test('ld-07: calling a model that app.json does not list fails', () => {
  const out = scoreCase('ld-07', { mutate: edit => edit('app.json', s => s.replace('"cheer"', '"praise"')) });
  assert.match(out, /^FAIL ld-07 verify: each model call names a model listed in app.json/);
});

test('ld-08: digits as numbers, not strings, fail the schema check', () => {
  const out = scoreCase('ld-08', { mutate: edit => edit('data/levels.json', s => s.replace('["1","2","3","4","5","6","7","8","9"]', '[1,2,3,4,5,6,7,8,9]')) });
  assert.match(out, /^FAIL ld-08 checks: /);
});

// From a real Haiku run (haiku-ho ld-07-r1): the card says to check a model answer against a schema,
// and schemas live in data/schema/. A new schema file there is in scope.
test('ld-07: a new schema file in data/schema for the model answer passes', () => {
  const out = scoreCase('ld-07', { solution: false, mutate: (edit, w) => {
    fs.cpSync(path.join(ROOT, 'tools/test/cases/ld-07-schema-file'), w, { recursive: true });
  } });
  assert.equal(out, 'PASS ld-07');
});

// The maintainer's ruling (2026-11-11): an edit to only the prose of definitions.yaml (a term's means or notes)
// is in scope for every task. A change to values, or a new or removed term, is not.
test('cc-04: adding a notes line for the rule under points passes (real Haiku run, haiku-v4 r3)', () => {
  const out = scoreCase('cc-04', { mutate: edit => edit('definitions.yaml', s => s.replace(
    '    values: [1, 2, 3, 4, 5]\n', '    values: [1, 2, 3, 4, 5]\n    notes:\n      saturday: "a chore done on a Saturday is worth double its points"\n')) });
  assert.equal(out, 'PASS cc-04');
});

test('ld-08: widening what pool means passes (real Haiku run, haiku-ho r2)', () => {
  const out = scoreCase('ld-08', { mutate: edit => edit('definitions.yaml', s => s.replace('the letters or words a level drops', 'the letters, digits or words a level drops')) });
  assert.equal(out, 'PASS ld-08');
});

test('ld-08: adding a speed value outside scope still fails scope', () => {
  const out = scoreCase('ld-08', { mutate: edit => edit('definitions.yaml', s => s.replace('values: [slow, medium, fast]', 'values: [slow, medium, fast, turbo]')) });
  assert.match(out, /^FAIL ld-08 scope: definitions.yaml not in may_touch/);
});

test('cc-12: adding a new term outside scope still fails scope', () => {
  const out = scoreCase('cc-12', { mutate: edit => edit('definitions.yaml', s => s.replace('good:\n', '  rank:\n    means: "place on the board"\ngood:\n')) });
  assert.match(out, /^FAIL cc-12 scope: definitions.yaml not in may_touch/);
});

test('cc-12: changing the good rules outside scope still fails scope', () => {
  const out = scoreCase('cc-12', { mutate: edit => edit('definitions.yaml', s => s.replace('everyone gets work every day they are home', 'most points first')) });
  assert.match(out, /^FAIL cc-12 scope: definitions.yaml not in may_touch/);
});

// From a Haiku run (haiku-kc ld-05-r2): after a dark theme, kit check flags the header's contrast, and the
// card tells the agent to fix every fault. Keeping the header readable in app.css is in scope.
test('ld-05: a dark theme plus readable header text in app.css passes', () => {
  const out = scoreCase('ld-05', { mutate: edit => edit('app.css', s => s.replace('box-sizing: border-box; }', 'box-sizing: border-box; color: var(--kit-text); }')) });
  assert.equal(out, 'PASS ld-05');
});

// reading-log held-out tasks (rl-01..rl-06), written 2026-11-11 before any model saw the app.
test('rl-03: relabelling the day headers without moving the days fails', () => {
  const out = scoreCase('rl-03', { solution: false, mutate: edit => edit('screens/month.js', s => s.replace("['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']", "['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']")) });
  assert.match(out, /^FAIL rl-03 verify: /);
});

test('rl-05: a fixed suggestion with no model call fails', () => {
  const out = scoreCase('rl-05', { solution: false, mutate: edit => edit('screens/month.js', s => s.replace("card({ title: 'This week', body: goals })", "card({ title: 'This week', body: goals }), card({ title: 'Next book', body: 'The Snail Who Flew' })")) });
  assert.match(out, /^FAIL rl-05 verify: /);
});

// From a Haiku run (haiku-rl rl-05-r1): one call asking for a JSON array of {reader, title, reason}, checked
// against its own schema. The fake model must answer in the shape the app asked for (fakeModelInit).
test('rl-05: a JSON-array suggestion design passes', () => {
  const out = scoreCase('rl-05', { solution: false, mutate: (edit, w) => fs.cpSync(path.join(ROOT, 'tools/test/cases/rl-05-json-array'), w, { recursive: true }) });
  assert.equal(out, 'PASS rl-05');
});

// From a local-model run (oc-rl rl-02-r1): the streak logic is right, and a child with no streak reads
// "Eli: no streak yet". That says 0; the verifier must accept words for zero, not only the digit.
test('rl-02: "no streak yet" for zero passes', () => {
  const out = scoreCase('rl-02', { solution: false, mutate: (edit, w) => fs.cpSync(path.join(ROOT, 'tools/test/cases/rl-02-no-streak-words'), w, { recursive: true }) });
  assert.equal(out, 'PASS rl-02');
});
