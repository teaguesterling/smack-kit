// What a person does with each example app, end to end in a browser. These pin the behaviour a small
// model's edit must keep: if a task breaks ticking a chore or saving a reading, a test here fails.
import { test, expect, APPS } from './_app.mjs';
import fs from 'node:fs';
import path from 'node:path';

const DAY = 'today=2026-11-11';   // a Wednesday, so school-day chores are due

test.describe('chore-chart', () => {
  test('ticking a chore keeps it ticked after a reload, and scores on the board', async ({ page, openApp }) => {
    await openApp('chore-chart', `${DAY}&tab=today`);
    const boxes = page.getByRole('checkbox');
    expect(await boxes.count()).toBeGreaterThan(0);
    const first = boxes.first();
    const label = (await first.locator('xpath=..').textContent()).trim();   // "Ari: dishes"
    await first.check();
    await page.reload();
    await expect(page.getByRole('checkbox').first()).toBeChecked();
    await page.getByRole('tab', { name: 'Board' }).click();
    const who = label.split(':')[0];
    await expect(page.locator('.board-row', { hasText: who })).not.toContainText(/\b0\b/);
  });

  test('unticking takes the points away again', async ({ page, openApp }) => {
    await openApp('chore-chart', `${DAY}&tab=today`);
    const first = page.getByRole('checkbox').first();
    await first.check();
    await first.uncheck();
    await page.getByRole('tab', { name: 'Board' }).click();
    for (const row of await page.locator('.board-row').all()) await expect(row).toContainText(/\b0\b/);
  });

  test('the week lists seven days, Monday first, and every person gets a chore', async ({ page, openApp }) => {
    await openApp('chore-chart', `${DAY}&tab=week`);
    const days = page.locator('.kit-card').first().locator('strong');
    await expect(days).toHaveText(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    const plan = await page.locator('.kit-card').first().textContent();
    for (const who of ['Ari', 'Bo', 'Cy', 'Bartholomew']) expect(plan).toContain(who);
  });

  test('a chore added on the week screen shows in the plan and survives a reload', async ({ page, openApp }) => {
    await openApp('chore-chart', `${DAY}&tab=week`);
    await page.getByLabel('Chore').fill('water the plants');
    await page.getByLabel('How often').selectOption('daily');
    await page.getByRole('button', { name: 'Add chore' }).click();
    await expect(page.locator('.kit-card').first()).toContainText('water the plants');
    await page.reload();
    await expect(page.locator('.kit-card').first()).toContainText('water the plants');
  });

  test('the add form only offers the allowed values from definitions', async ({ page, openApp }) => {
    await openApp('chore-chart', `${DAY}&tab=week`);
    const every = await page.getByLabel('How often').locator('option').allTextContents();
    const allowed = JSON.parse(fs.readFileSync(path.join(APPS, 'chore-chart/data/schema/chores.json'), 'utf8')).items.properties.every.enum;
    expect(every).toEqual(allowed);
  });
});

test.describe('reading-log', () => {
  test('a saved reading shows its minutes on that day of the month, and survives a reload', async ({ page, openApp }) => {
    await openApp('reading-log', `${DAY}&tab=add`);
    await page.getByLabel('Title').fill('The Hobbit');
    await page.getByLabel('Minutes').fill('35');
    await page.getByRole('button', { name: 'Save' }).click();
    const cell = page.locator('button.day[data-date="2026-11-11"]');
    await expect(cell).toHaveClass(/\bread\b/);
    await expect(cell).toContainText('35m');
    await page.reload();   // the URL still says tab=add
    await page.getByRole('tab', { name: 'Month' }).click();
    await expect(page.locator('button.day[data-date="2026-11-11"]')).toContainText('35m');
  });

  test('two readings on one day add up', async ({ page, openApp }) => {
    await openApp('reading-log', `${DAY}&tab=add`);
    for (const m of ['20', '15']) {
      await page.getByLabel('Title').fill(`Book ${m}`);
      await page.getByLabel('Minutes').fill(m);
      await page.getByRole('button', { name: 'Save' }).click();
      await page.getByRole('tab', { name: 'Add reading' }).click();
    }
    await page.getByRole('tab', { name: 'Month' }).click();
    await expect(page.locator('button.day[data-date="2026-11-11"]')).toContainText('35m');
  });

  test('the month grid starts on Monday with November 1 under Sunday', async ({ page, openApp }) => {
    await openApp('reading-log', `${DAY}&tab=month`);
    await expect(page.locator('.month-grid .dow')).toHaveText(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    await expect(page.locator('button.day')).toHaveCount(30);
    // 2026-11-01 is a Sunday: six blank cells come before it after the seven day names.
    const lead = await page.locator('.month-grid > *').evaluateAll(cells => cells.slice(7).findIndex(c => c.matches('button.day')));
    expect(lead).toBe(6);
  });

  test('an empty title is refused by the form', async ({ page, openApp }) => {
    await openApp('reading-log', `${DAY}&tab=add`);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('#add-reading')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('kit:reading-log:entries'))).toBeNull();
  });
});

test.describe('letter-drop', () => {
  // Math.random is pinned so the first letter is the pool's first ("a"); the game itself is unchanged.
  const pinRandom = () => { Math.random = () => 0; };

  test('the menu lists each level and starts a game on a tap', async ({ page, openApp }) => {
    await openApp('letter-drop');
    const levels = page.locator('button.level');
    await expect(levels).toHaveCount(2);
    await levels.first().click();
    await expect(page.locator('canvas#board')).toBeVisible();
    await expect(page.locator('#score')).toHaveText('Score 0');
  });

  test('pressing the falling letter scores and builds a streak; a miss resets it', async ({ page, openApp }) => {
    await page.addInitScript(pinRandom);
    await openApp('letter-drop', 'level=0');
    await expect(page.locator('canvas#board')).toBeVisible();
    await page.waitForFunction(() => window.__game?.falling().length > 0);
    expect(await page.evaluate(() => window.__game.falling())).toEqual(['a']);
    await page.keyboard.press('a');
    await expect(page.locator('#streak')).toHaveText('Streak 1');
    const after = Number((await page.locator('#score').textContent()).replace(/\D/g, ''));
    expect(after).toBeGreaterThan(0);
    await page.keyboard.press('z');
    await expect(page.locator('#streak')).toHaveText('Streak 0');
  });

  test('ending a game shows the score, then the menu comes back', async ({ page, openApp }) => {
    await openApp('letter-drop', 'level=0');
    await page.waitForFunction(() => !!window.__game);
    await page.evaluate(() => window.__game.end());
    await expect(page.getByText(/You scored -?\d+\./)).toBeVisible();
    await expect(page.locator('button.level').first()).toBeVisible({ timeout: 5000 });
  });
});
