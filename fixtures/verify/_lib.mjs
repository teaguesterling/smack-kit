// Shared helpers for task verifiers. APP_DIR is the agent's workdir (set by fixture.mjs score).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { chromium } from 'playwright';
import { serve, chromePath } from '../../tools/serve.mjs';

export const APP = process.env.APP_DIR;
if (!APP) throw new Error('APP_DIR is not set (run through fixture.mjs score)');
export const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const readJson = rel => JSON.parse(fs.readFileSync(path.join(APP, rel), 'utf8'));
export const readYaml = rel => YAML.parse(fs.readFileSync(path.join(APP, rel), 'utf8'));
export const originalJson = (app, rel) => JSON.parse(fs.readFileSync(path.join(FIXTURES, 'apps', app, rel), 'utf8'));

/** Import a module from the app and require named exports; a missing one fails as `missing export <name>`. */
export async function need(rel, ...names) {
  const mod = await import(pathToFileURL(path.join(APP, rel)).href + `?t=${Date.now()}`);
  for (const n of names) if (typeof mod[n] !== 'function') throw new Error(`missing export ${n} in ${rel}`);
  return mod;
}

/** Serve the app, open one page, run fn(page), always clean up. Page errors fail the run. */
export async function withPage(query, viewport, fn, init) {
  const srv = await serve(APP);
  const browser = await chromium.launch({ executablePath: chromePath() });
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport });
    if (init) await ctx.addInitScript(init);
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(srv.url + (query ? `?${query}` : ''));
    await page.waitForFunction(() => document.querySelector('#app')?.textContent.trim().length > 0, null, { timeout: 5000 });
    const out = await fn(page, srv);
    if (errors.length) throw new Error(`page error: ${errors[0]}`);
    return out;
  } finally { await browser.close(); await srv.close(); }
}

/** Resolve any CSS colours ("green", "#0a0", "rgb(...)") to [r, g, b] the way a browser does. */
export async function rgbOf(...colours) {
  const browser = await chromium.launch({ executablePath: chromePath() });
  try {
    const page = await browser.newPage();
    return await page.evaluate(cs => cs.map(c => {
      const probe = document.createElement('i');
      probe.style.color = 'rgb(1, 2, 3)';
      probe.style.color = c;
      document.body.append(probe);
      const got = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
      probe.remove();
      if (probe.style.color === 'rgb(1, 2, 3)' && c.replace(/\s/g, '') !== 'rgb(1,2,3)') throw new Error(`not a CSS colour: ${c}`);
      return got;
    }), colours);
  } finally { await browser.close(); }
}
export function hue([r8, g8, b8]) {
  const [r, g, b] = [r8, g8, b8].map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
export function luminance(rgb) {
  const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/**
 * An init script that binds a fake model which answers in the shape the app asked for, with `line` as the
 * main text (a title, a sentence). Shape, in order: an answer schema that app.json models.<need> names
 * (any value ending .json); else the JSON keys the prompt shows, as one object or, when it asks for an
 * array or list, one object per reader named in the prompt; else plain text. A real model follows the format
 * it is given; a fixed fake would fail sound designs. `recordAs` names a window array for {need, text}.
 */
export function fakeModelInit(line, { recordAs = '__calls', readers = [] } = {}) {
  const schemas = {};
  try {
    for (const [need, spec] of Object.entries(readJson('app.json').models ?? {})) {
      const ref = Object.values(spec ?? {}).find(v => typeof v === 'string' && v.endsWith('.json'));
      if (ref && fs.existsSync(path.join(APP, ref))) schemas[need] = JSON.parse(fs.readFileSync(path.join(APP, ref), 'utf8'));
    }
  } catch { /* no manifest or no schema: fall back to the prompt */ }
  return `window.${recordAs} = [];
window.UPROMPT_FAKE = (need, messages) => {
  const LINE = ${JSON.stringify(line)}, READERS = ${JSON.stringify(readers)}, SCHEMAS = ${JSON.stringify(schemas)};
  const ask = messages.map(m => String(m.content)).join('\\n');
  window.${recordAs}.push({ need, text: ask });
  const named = READERS.filter(r => new RegExp('\\\\b' + r + '\\\\b').test(ask));
  const who = named[0] ?? READERS[0] ?? 'child';
  const str = (k, max, reader) => {
    const v = /title|book|suggest|next|message|text|line|cheer|sentence/i.test(k) ? LINE : /reader|child|name|who/i.test(k) ? reader : /kind|type/i.test(k) ? 'book' : 'A good next read.';
    return max ? v.slice(0, max) : v;
  };
  const gen = (s, k, reader) => {
    if (!s || typeof s !== 'object') return str(k, 0, reader);
    if (Array.isArray(s.enum)) return s.enum.includes('book') ? 'book' : s.enum[0];
    if (s.type === 'array') return (named.length ? named : [who]).map(r => gen(s.items, k, r));
    if (s.type === 'object') { const o = {}; for (const [p, ps] of Object.entries(s.properties ?? {})) o[p] = gen(ps, p, reader); return o; }
    if (s.type === 'integer' || s.type === 'number') return s.minimum ?? 1;
    if (s.type === 'boolean') return true;
    return str(k, s.maxLength, reader);
  };
  if (SCHEMAS[need]) return { text: JSON.stringify(gen(SCHEMAS[need], 'answer', who)), toolCalls: [] };
  if (/json/i.test(ask)) {
    const example = (ask.slice(ask.search(/json/i)).match(/\\{[^{}]*\\}/) ?? [''])[0]; // the format example, not the data
    const keys = [...new Set([...example.matchAll(/"(\\w+)"\\s*:/g)].map(m => m[1]))];
    if (keys.length) {
      const obj = r => Object.fromEntries(keys.map(k => [k, str(k, 0, r)]));
      const many = /json array|an array|a list|\\[\\s*\\{/i.test(ask);
      return { text: JSON.stringify(many ? (named.length ? named : READERS.length ? READERS : [who]).map(obj) : obj(who)), toolCalls: [] };
    }
  }
  return { text: LINE, toolCalls: [] };
};`;
}
