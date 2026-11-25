// kit check step 4, tests: the app's own checks/*.test.mjs, one fault per failing test at its file and line.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** (appDir) -> Fault[] (rule 'tests') */
export function tests(appDir) {
  const dir = path.join(appDir, 'checks');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.mjs')).sort().map(f => `checks/${f}`);
  if (!files.length) return [];
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], { cwd: appDir, env, encoding: 'utf8', timeout: 120000, maxBuffer: 64 << 20 });
  if (r.error?.code === 'ETIMEDOUT') return [{ file: 'checks', line: 1, rule: 'tests', message: 'timed out after 120 s' }];
  if (r.status === 0) return [];
  const lines = r.stdout.split('\n'), out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*not ok \d+ - (.*)$/);
    if (!m) continue;
    const yaml = [];
    for (let j = i + 1; j < lines.length && !/^\s*(not )?ok \d+ - /.test(lines[j]) && !/^\s*\.\.\.\s*$/.test(lines[j]); j++) yaml.push(lines[j]);
    const block = yaml.join('\n');
    if (/\d+ subtests? failed/.test(block)) continue; // a parent of failing tests; the leaves are reported
    const loc = block.match(/location: '(.+):(\d+):\d+'/);
    const em = block.match(/^\s*error: (?:\|-?\s*\n\s*(.*)|'?(.*?)'?)$/m);
    let msg = (em?.[1] ?? em?.[2] ?? 'failed').trim();
    const exp = block.match(/^\s*expected: (.*)$/m), act = block.match(/^\s*actual: (.*)$/m);
    if (exp && act) msg += ` expected ${exp[1].trim()}, got ${act[1].trim()}`;
    let name = m[1].trim();
    // The file threw while loading: the test is named after the file (absolute before Node 22, relative to cwd
    // from 22 on). Take the error from the comments above.
    if ((name.startsWith('/') || /\.test\.mjs$/.test(name)) && msg === 'test failed') {
      const thrown = lines.slice(0, i).reverse().find(l => /^# \w*Error\b/.test(l));
      if (name.startsWith('/')) name = path.relative(appDir, name); msg = `failed to load: ${thrown ? thrown.slice(2).trim() : msg}`;
    }
    if (loc) out.push({ file: path.relative(appDir, loc[1].startsWith('file:') ? fileURLToPath(loc[1]) : loc[1]), line: Number(loc[2]), rule: 'tests', message: name.startsWith('checks/') ? msg : `${name}: ${msg}` });
    else out.push({ file: name.startsWith('/') ? path.relative(appDir, name) : 'checks', line: 1, rule: 'tests', message: `failed to run: ${msg}` });
  }
  return out.length ? out : [{ file: 'checks', line: 1, rule: 'tests', message: `node --test exited ${r.status}` }];
}
