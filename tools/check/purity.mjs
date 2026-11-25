// kit check step 3, purity: a seam is a pure function. An AST check, because a regex scan missed
// globalThis['fe'+'tch'] (spec 6.5, research test E3).
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';

const OUTSIDE = new Set(['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'localStorage', 'sessionStorage', 'indexedDB',
  'document', 'window', 'globalThis', 'self', 'navigator', 'location', 'process', 'require', 'eval', 'Function',
  'setTimeout', 'setInterval', 'importScripts', 'crypto', 'performance']);
const KIT_OK = new Set(['../kit/dates.js', '../kit/gate.js']);

/** Resolve the specifier as a browser does (from seams/x.js); allow only other seams and the pure kit files. */
function importAllowed(s) {
  if (/[%\\]/.test(s) || !/^\.\.?\//.test(s)) return false;
  const at = new URL(s, 'http://app/seams/x.js').pathname;
  return (at.startsWith('/seams/') && !at.slice(7).includes('/')) || KIT_OK.has(`..${at}`);
}

function patternNames(p, out) {
  if (!p) return;
  if (p.type === 'Identifier') out.add(p.name);
  else if (p.type === 'ObjectPattern') for (const q of p.properties) patternNames(q.type === 'RestElement' ? q.argument : q.value, out);
  else if (p.type === 'ArrayPattern') for (const q of p.elements) patternNames(q, out);
  else if (p.type === 'RestElement') patternNames(p.argument, out);
  else if (p.type === 'AssignmentPattern') patternNames(p.left, out);
}

function walk(node, fn, parent = null, key = null) {
  if (!node || typeof node.type !== 'string') return;
  fn(node, parent, key);
  for (const [k, v] of Object.entries(node)) {
    if (k === 'loc') continue;
    if (Array.isArray(v)) for (const c of v) walk(c, fn, node, k);
    else if (v && typeof v === 'object') walk(v, fn, node, k);
  }
}

/** True when this Identifier is a name, not a read of a variable. */
function notAReference(parent, key) {
  if (!parent) return false;
  if (parent.type === 'MemberExpression' && key === 'property' && !parent.computed) return true;
  if ((parent.type === 'Property' || parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && key === 'key' && !parent.computed) return true;
  return ['LabeledStatement', 'BreakStatement', 'ContinueStatement', 'ImportSpecifier', 'ImportDefaultSpecifier',
    'ImportNamespaceSpecifier', 'ExportSpecifier'].includes(parent.type);
}

/** (file: absolute path, rel: path for the report) -> Fault[] */
export function puritySource(src, rel) {
  const fault = (line, message) => ({ file: rel, line, rule: 'purity', message });
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true }); }
  catch (e) { return [fault(e.loc?.line ?? 1, `cannot parse: ${e.message.replace(/\s*\(\d+:\d+\)$/, '')}`)]; }
  const declared = new Set();
  walk(ast, n => {
    if (n.type === 'VariableDeclarator') patternNames(n.id, declared);
    else if (/^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(n.type)) { if (n.id) declared.add(n.id.name); for (const p of n.params) patternNames(p, declared); }
    else if (/^Class(Declaration|Expression)$/.test(n.type) && n.id) declared.add(n.id.name);
    else if (n.type === 'CatchClause') patternNames(n.param, declared);
    else if (/^Import(Default|Namespace)?Specifier$/.test(n.type)) declared.add(n.local.name);
  });
  const out = [], seen = new Set();
  const add = (line, message) => { const k = `${line} ${message}`; if (!seen.has(k)) { seen.add(k); out.push(fault(line, message)); } };
  const free = n => n?.type === 'Identifier' && !declared.has(n.name);
  walk(ast, (n, parent, key) => {
    const line = n.loc.start.line;
    if (n.type === 'Identifier' && OUTSIDE.has(n.name) && !declared.has(n.name) && !notAReference(parent, key)) {
      add(line, `${n.name} is not allowed in a seam: it reaches outside the function (network, storage, page or globals)`);
    } else if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && !n.callee.computed && free(n.callee.object)
      && ((n.callee.object.name === 'Math' && n.callee.property.name === 'random') || (n.callee.object.name === 'Date' && n.callee.property.name === 'now'))) {
      add(line, `${n.callee.object.name}.${n.callee.property.name}() is not allowed in a seam: the result changes from run to run; take it as a parameter`);
    } else if (n.type === 'NewExpression' && free(n.callee) && n.callee.name === 'Date' && n.arguments.length === 0) {
      add(line, 'new Date() is not allowed in a seam: it reads the clock; take the date as a parameter');
    } else if (n.type === 'MemberExpression' && ((!n.computed && n.property.name === 'constructor') || (n.computed && n.property.type === 'Literal' && n.property.value === 'constructor'))) {
      add(line, '.constructor is not allowed in a seam: it can reach Function and run any code');
    } else if (n.type === 'CallExpression' && free(n.callee) && n.callee.name === 'Date') {
      add(line, 'Date() is not allowed in a seam: it reads the clock; take the date as a parameter');
    } else if (n.type === 'ImportExpression') {
      add(line, 'import() is not allowed in a seam: use a static import of another seam');
    } else if (/^(ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration)$/.test(n.type) && n.source) {
      const s = String(n.source.value);
      if (!importAllowed(s)) add(line, `${s} is not allowed in a seam: import only other seams, ../kit/dates.js or ../kit/gate.js`);
    }
  });
  return out.sort((a, b) => a.line - b.line);
}

/** (appDir) -> Fault[] (rule 'purity') over seams/*.js */
export function purity(appDir) {
  const dir = path.join(appDir, 'seams');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()
    .flatMap(f => puritySource(fs.readFileSync(path.join(dir, f), 'utf8'), `seams/${f}`));
}
