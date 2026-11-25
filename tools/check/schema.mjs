// kit check step 2, schema: each data/<name>.json passes data/schema/<name>.json, a closed list (spec 6.4).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validate as standinValidate } from '../../fixtures/kit-standin/gate.js';

/** Line (1-based) where the value at `p` begins in JSON text `src`; p is a gate path such as "[2].speed" or "chores[0]". 1 when unknown. */
export function jsonLine(src, p) {
  const want = [...String(p).matchAll(/([^.[\]]+)|\[(\d+)\]/g)].map(m => (m[2] !== undefined ? Number(m[2]) : m[1]));
  let i = 0, best = 0;
  const ws = () => { while (/\s/.test(src[i] ?? '')) i++; };
  const str = () => { let s = ''; i++; while (i < src.length && src[i] !== '"') { if (src[i] === '\\') i++; s += src[i++]; } i++; return s; };
  function value(depth, onPath) {
    ws();
    if (onPath && depth === want.length) { best = i; return true; }
    const c = src[i];
    if (c === '{') {
      i++; ws();
      if (src[i] === '}') { i++; return false; }
      for (;;) {
        ws(); const k = str(); ws(); i++;
        if (value(depth + 1, onPath && want[depth] === k)) return true;
        ws(); if (src[i] === ',') { i++; continue; } i++; return false;
      }
    }
    if (c === '[') {
      i++; ws();
      if (src[i] === ']') { i++; return false; }
      for (let n = 0; ; n++) {
        if (value(depth + 1, onPath && want[depth] === n)) return true;
        ws(); if (src[i] === ',') { i++; continue; } i++; return false;
      }
    }
    if (c === '"') { str(); return false; }
    while (i < src.length && !/[,\]}\s]/.test(src[i])) i++;
    return false;
  }
  try { if (!value(0, true)) return 1; } catch { return 1; }
  return src.slice(0, best).split('\n').length;
}

/** (appDir) -> Promise<Fault[]> (rule 'schema'). Uses the app's vendored kit/gate.js, as the app does at run time. */
export async function schema(appDir) {
  const own = path.join(appDir, 'kit', 'gate.js');
  const validate = fs.existsSync(own) ? (await import(pathToFileURL(own).href)).validate : standinValidate;
  const dataDir = path.join(appDir, 'data');
  if (!fs.existsSync(dataDir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dataDir).filter(f => f.endsWith('.json')).sort()) {
    const rel = `data/${f}`, schemaRel = `data/schema/${f}`;
    const src = fs.readFileSync(path.join(dataDir, f), 'utf8');
    if (!fs.existsSync(path.join(appDir, schemaRel))) { out.push({ file: rel, line: 1, rule: 'schema', message: `no schema ${schemaRel}` }); continue; }
    let data, sch;
    try { data = JSON.parse(src); } catch (e) { out.push({ file: rel, line: 1, rule: 'schema', message: `is not valid JSON: ${e.message.split('\n')[0]}` }); continue; }
    try { sch = JSON.parse(fs.readFileSync(path.join(appDir, schemaRel), 'utf8')); } catch { continue; } // drift reports a broken schema
    for (const err of validate(sch, data)) {
      const at = err.split(':')[0];
      out.push({ file: rel, line: jsonLine(src, at), rule: 'schema', message: err });
    }
  }
  return out;
}
