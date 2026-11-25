#!/usr/bin/env node
// Smoke test: open an example app at phone size; fail on any console error, page error or empty #app.
// Usage: node tools/smoke.mjs <app> [query]   (query e.g. "today=2026-11-11&tab=board")
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve, chromePath } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function smoke(dir, query = '') {
  const srv = await serve(dir);
  const browser = await chromium.launch({ executablePath: chromePath() });
  const problems = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    page.on('console', m => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
    page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
    await page.goto(srv.url + (query ? `?${query}` : ''));
    await page.waitForFunction(() => document.querySelector('#app')?.textContent.trim().length > 0, null, { timeout: 5000 }).catch(() => problems.push('#app stayed empty'));
  } finally { await browser.close(); await srv.close(); }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) || process.argv[1]?.endsWith('smoke.mjs')) {
  const app = process.argv[2];
  if (!app) { console.error('usage: smoke.mjs <app> [query]'); process.exit(2); }
  const problems = await smoke(path.join(ROOT, 'fixtures', 'apps', app), process.argv[3] ?? '');
  if (problems.length) { console.log(`FAIL ${app}: ${problems.join('; ')}`); process.exit(1); }
  console.log(`ok ${app}`);
}
