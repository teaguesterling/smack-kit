#!/usr/bin/env node
// kit: the Tiiny app kit command. `kit check [appdir] [--profile dev|install]` prints one line per fault, nothing on success.
import path from 'node:path';
import { runCheck, format } from './check/run.mjs';

const USAGE = 'usage: kit check [appdir] [--profile dev|install]';
const args = process.argv.slice(2);
let dir = '.', profile = 'dev';
if (args[0] !== 'check') { process.stderr.write(USAGE + '\n'); process.exit(2); }
for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a === '--profile' && ['dev', 'install'].includes(args[i + 1])) profile = args[++i];
  else if (!a.startsWith('-') && dir === '.') dir = a;
  else { process.stderr.write(USAGE + '\n'); process.exit(2); }
}
const faults = await runCheck(path.resolve(dir), { profile });
for (const f of faults) process.stdout.write(format(f) + '\n');
process.exitCode = faults.length ? 1 : 0;
