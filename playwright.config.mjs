// Browser tests for the kit's example apps and parts: `npx playwright test`.
// The apps target phones first (a Tiiny serves them to the household's phones), so every spec runs at
// two phone widths, a tablet and a desktop. Workers are set, not left to the CPU count: several Chromium
// launches at once is the suspected cause of the layout-step flake in tools/test (2 of 8 runs, 2026-11-18).
import { defineConfig, devices } from '@playwright/test';
import { chromePath } from './tools/serve.mjs';

let executablePath;
try { executablePath = chromePath(); } catch { /* none cached: use Playwright's own browser (npx playwright install chromium) */ }

const chromium = { ...devices['Desktop Chrome'], launchOptions: executablePath ? { executablePath } : {} };

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: /\.spec\.mjs$/,
  workers: Number(process.env.PW_WORKERS ?? 4),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 30_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'phone-360', use: { ...chromium, viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'phone-390', use: { ...chromium, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } },
    { name: 'tablet-768', use: { ...chromium, viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'desktop-1280', use: { ...chromium, viewport: { width: 1280, height: 800 } } },
  ],
});
