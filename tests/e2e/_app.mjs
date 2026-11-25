// Shared fixtures for the browser tests.
//   openApp(name or dir, query)  serves the app's folder, opens it, waits for the first screen.
// Every page error or console error fails the test that caused it, so a test cannot pass over a broken screen.
import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../../tools/serve.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const APPS = path.join(ROOT, 'fixtures', 'apps');
export const APP_NAMES = fs.readdirSync(APPS).filter(n => fs.existsSync(path.join(APPS, n, 'app.json'))).sort();
export const appJson = dir => JSON.parse(fs.readFileSync(path.join(dir, 'app.json'), 'utf8'));
export const appDir = nameOrDir => (path.isAbsolute(nameOrDir) ? nameOrDir : path.join(APPS, nameOrDir));

/** A copy of an app with a reference solution laid over it, as `fixture.mjs validate` builds it. */
export function solvedCopy(taskId) {
  const task = fs.readFileSync(path.join(ROOT, 'fixtures', 'tasks', `${taskId}.yaml`), 'utf8');
  const app = task.match(/^app:\s*(\S+)/m)[1];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `smack-${taskId}-`));
  fs.cpSync(path.join(APPS, app), dir, { recursive: true });
  const seed = path.join(ROOT, 'fixtures', 'seeds', taskId);
  if (/^seed:/m.test(task) && fs.existsSync(seed)) fs.cpSync(seed, dir, { recursive: true });
  fs.cpSync(path.join(ROOT, 'fixtures', 'solutions', taskId), dir, { recursive: true });
  return { dir, app };
}

export const test = base.extend({
  errors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    await use(errors);
    expect(errors, 'the page logged errors').toEqual([]);
  }, { auto: true }],

  openApp: async ({ page }, use) => {
    const servers = [];
    await use(async (nameOrDir, query = '') => {
      const srv = await serve(appDir(nameOrDir));
      servers.push(srv);
      await page.goto(srv.url + (query ? `?${query}` : ''));
      await expect(page.locator('#app')).not.toBeEmpty();
      return srv;
    });
    for (const s of servers) await s.close();
  },
});
export { expect };

/** Runs in the page: what kit check's layout step would call a fault, for the viewport the project sets. */
export function layoutFaults() {
  const faults = [];
  if (document.documentElement.scrollWidth > innerWidth) faults.push(`page is ${document.documentElement.scrollWidth}px wide on ${innerWidth}px`);
  const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  for (const el of document.querySelectorAll('button, a[href], select, input:not([type=hidden]), [role=tab]')) {
    if (!visible(el)) continue;
    const box = (el.tagName === 'INPUT' && el.closest('label')) || el;
    const r = box.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) faults.push(`tap target ${box.tagName.toLowerCase()} "${(box.textContent || box.name || '').trim().slice(0, 30)}" is ${Math.round(r.width)}x${Math.round(r.height)}`);
    if (r.right > innerWidth + 1 || r.left < -1) faults.push(`${box.tagName.toLowerCase()} "${(box.textContent || '').trim().slice(0, 30)}" is off screen`);
  }
  return faults;
}
