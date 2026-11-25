import fs from 'node:fs';
import path from 'node:path';
// kit check runner (spec 6.5): steps in order, stop after the first step that reports a fault.
import { drift } from './drift.mjs';
import { schema } from './schema.mjs';
import { purity } from './purity.mjs';
import { tests } from './tests.mjs';
import { layout } from './layout.mjs';

/** Fault = {file: string, line: number, rule: string, message: string} */
export const format = f => `${f.file}:${f.line} ${f.rule} ${f.message}`;

const STEPS = [['drift', drift], ['schema', schema], ['purity', purity], ['tests', tests], ['layout', layout]];
const PROFILES = { dev: ['drift', 'schema', 'purity', 'tests', 'layout'], install: ['drift', 'schema', 'purity', 'tests'] };

/** (appDir, {profile: 'dev'|'install'}) -> Promise<Fault[]> */
export async function runCheck(appDir, { profile = 'dev' } = {}) {
  const want = PROFILES[profile];
  if (!want) throw new Error(`unknown profile ${profile}`);
  if (!fs.existsSync(path.join(appDir, 'app.json'))) return [{ file: 'app.json', line: 1, rule: 'check', message: 'not an app directory: no app.json' }];
  for (const [name, step] of STEPS) {
    if (!want.includes(name)) continue;
    const faults = await step(appDir);
    if (faults.length) return faults;
  }
  return [];
}
