import { expect, test } from '@playwright/test';

/*
 * The app on the design system (#70): every page still renders and works in both themes and in all languages.
 */

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
});

const PAGES = [
  ['Backlog', '/#/backlog'],
  ['Board', '/#/board'],
  ['Story map', '/#/map'],
  ['Epics', '/#/epics'],
  ['Settings', '/#/settings/fields']
] as const;

for (const theme of ['light', 'dark'] as const) {
  for (const [name, address] of PAGES) {
    test(`AC3.1 shows the ${name} page in the ${theme} theme without errors and with the tokens applied`, async ({ page }) => {
      // Given the theme is set and a console that is watched
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
      await page.addInitScript((value) => window.localStorage.setItem('getitdone.theme', value), theme);

      // When I open the page
      await page.goto(address);

      // Then the header and a heading show, the theme is applied and the tokens resolve
      await expect(page.getByRole('banner')).toBeVisible();
      await expect(page.locator('h1').first()).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const style = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const body = getComputedStyle(document.body);
        return { surface: root.getPropertyValue('--surface').trim(), font: body.fontSize, color: body.color, background: body.backgroundColor };
      });
      expect(['#ffffff', '#fff', '#171c23']).toContain(style.surface);
      expect(style.surface === '#171c23').toBe(theme === 'dark');
      expect(style.font).toBe('15px');
      expect(style.color).not.toBe(style.background);
      expect(errors).toEqual([]);
    });
  }
}

test('AC3.1 moves a story to Done by drag and drop, as before', async ({ page }) => {
  // Given the board with S-3 in "To do"
  await page.goto('/#/board');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const card = page.getByRole('group', { name: /(^|, )S-3: / });
  const done = page.getByRole('region', { name: /^Done/ });
  await expect(card).toBeVisible();
  const a = await card.boundingBox();
  const b = await done.boundingBox();
  if (!a || !b) throw new Error('card or column is not visible');

  // When I drag it into the column "Done"
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 });
  await page.mouse.up();

  // Then S-3 stands in "Done", also after a reload
  await expect(done.getByRole('group', { name: /(^|, )S-3: / })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: /^Done/ }).getByRole('group', { name: /(^|, )S-3: / })).toBeVisible();
});

test('AC3.3 opens and closes a dialog with the keyboard only and follows a language switch', async ({ page }) => {
  // Given the board
  await page.goto('/#/board');

  // When I open "New story" with the keyboard
  await page.getByRole('button', { name: 'New story' }).focus();
  await page.keyboard.press('Enter');
  // Then the dialog is open, and Escape closes it
  await expect(page.getByRole('dialog', { name: 'New story' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // When I switch the language
  for (const language of ['de', 'fr', 'it']) {
    await page.getByRole('combobox', { name: /Language|Sprache|Langue|Lingua/ }).selectOption(language);
    // Then the button is no longer English
    await expect(page.getByRole('button', { name: 'New story' })).toHaveCount(0);
  }
});
