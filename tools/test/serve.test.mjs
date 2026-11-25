import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromePath } from '../serve.mjs';

// `npx playwright install chromium` decides the folder name, and it changed between releases:
// 1.49 writes chromium-1148/chrome-linux/chrome, later ones chromium-NNNN/chrome-linux64/chrome.
// A fresh CI machine has only what the pinned Playwright installed, so both must be found.
function fakeHome(rel) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-home-'));
  const exe = path.join(home, '.cache', 'ms-playwright', rel);
  fs.mkdirSync(path.dirname(exe), { recursive: true });
  fs.writeFileSync(exe, '');
  return { home, exe };
}

function withHome(home, fn) {
  const saved = { HOME: process.env.HOME, CHROME_PATH: process.env.CHROME_PATH };
  process.env.HOME = home; delete process.env.CHROME_PATH;
  try { return fn(); } finally {
    process.env.HOME = saved.HOME;
    if (saved.CHROME_PATH === undefined) delete process.env.CHROME_PATH; else process.env.CHROME_PATH = saved.CHROME_PATH;
  }
}

test('chromePath finds the chrome-linux folder that Playwright 1.49 installs', () => {
  const { home, exe } = fakeHome('chromium-1148/chrome-linux/chrome');
  assert.equal(withHome(home, chromePath), exe);
});

test('chromePath finds the chrome-linux64 folder of later Playwright releases', () => {
  const { home, exe } = fakeHome('chromium-1248/chrome-linux64/chrome');
  assert.equal(withHome(home, chromePath), exe);
});
