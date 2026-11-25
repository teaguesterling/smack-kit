// Every screen each example app lists in app.json opens with no page errors and fits the screen:
// nothing wider than the viewport, and every control at least 44x44 px, at each project's width.
// kit check's layout step checks the same rules at 390 px only; this runs them at 360, 390, 768 and 1280.
import { test, expect, APP_NAMES, APPS, appJson, layoutFaults } from './_app.mjs';
import path from 'node:path';

for (const name of APP_NAMES) {
  const screens = appJson(path.join(APPS, name)).screens ?? [''];
  for (const query of screens) {
    test(`${name} ${query || '(start)'} fits the screen`, async ({ page, openApp }) => {
      await openApp(name, query);
      await expect(page.locator('main, #app canvas, #app').first()).toBeVisible();
      expect(await page.evaluate(layoutFaults)).toEqual([]);
    });
  }
}

test('the tab bar switches screens and marks the active tab', async ({ page, openApp }) => {
  await openApp('chore-chart', 'today=2026-11-11');
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(3);
  for (const label of ['Week', 'Board', 'Today']) {
    await page.getByRole('tab', { name: label }).click();
    await expect(page.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true');
  }
});
