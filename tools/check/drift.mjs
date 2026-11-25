// kit check step 1, drift: each schema x-term enum equals terms.<term>.values in definitions.yaml,
// and each term with values is named by some schema. (Generated-file drift joins when the generator exists.)
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const firstLine = s => String(s).split('\n')[0].slice(0, 160);

function walkTerms(node, at, found) {
  if (node && typeof node === 'object') {
    if (!Array.isArray(node) && typeof node['x-term'] === 'string') found.push({ at, term: node['x-term'], enum: node.enum });
    for (const [k, v] of Object.entries(node)) walkTerms(v, `${at}/${k}`, found);
  }
}

/** -> Fault[] ({file, line, rule: 'drift', message, reason}); `reason` is the one-line text fixture scores print. */
export function drift(appDir) {
  const out = [];
  const add = (file, message, reason = `${file} ${message}`) => out.push({ file, line: 1, rule: 'drift', message, reason });
  const defsFile = path.join(appDir, 'definitions.yaml');
  const schemaDir = path.join(appDir, 'data', 'schema');
  let terms = {};
  if (fs.existsSync(defsFile)) {
    try { terms = YAML.parse(fs.readFileSync(defsFile, 'utf8'))?.terms ?? {}; }
    catch (e) { add('definitions.yaml', `is not valid YAML: ${firstLine(e.message)}`); return out; }
  }
  const named = new Set();
  let unreadable = false; // a schema we could not read may name any term
  const files = fs.existsSync(schemaDir) ? fs.readdirSync(schemaDir).filter(f => f.endsWith('.json')).sort() : [];
  for (const f of files) {
    const rel = `data/schema/${f}`;
    let schema;
    try { schema = JSON.parse(fs.readFileSync(path.join(schemaDir, f), 'utf8')); }
    catch (e) { add(rel, `is not valid JSON: ${firstLine(e.message)}`); unreadable = true; continue; }
    const found = [];
    walkTerms(schema, '', found);
    for (const x of found) {
      named.add(x.term);
      const want = terms[x.term]?.values;
      if (!Array.isArray(want)) { add(rel, `${x.at} names term ${x.term}, which definitions.yaml lacks`); continue; }
      const a = new Set((x.enum ?? []).map(String)), b = new Set(want.map(String));
      if (a.size !== b.size || [...a].some(v => !b.has(v))) add(rel, `${x.at} enum differs from terms.${x.term}.values`);
    }
  }
  for (const [term, def] of Object.entries(terms)) {
    if (Array.isArray(def?.values) && !named.has(term) && !unreadable) {
      const m = `terms.${term} has values, but no schema property names it with x-term`;
      add('definitions.yaml', m, m);
    }
  }
  return out;
}
