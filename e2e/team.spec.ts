import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * End-to-end tests of the team and the assignment of stories (#18) in a real browser, following the test cases the PO
 * approved in the issue. Every test starts from the demo data of a fresh browser on Tuesday 13 October 2026. The team is
 * Michael Burkard (MB), Anna Keller (AK) and Luca Rossi (LR); Anna has S-1 and S-3, S-4 is not assigned.
 */

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
});

const story = (page: Page, code: string): Locator => page.getByRole('group', { name: new RegExp(`(^|, )${code}: `) });

async function open(page: Page, hash: string): Promise<void> {
  await page.goto(`/${hash}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

test('AC2.1 a story assigned in its dialog keeps its person after a reload', async ({ page }) => {
  // Given S-4, which nobody works on
  await open(page, '#/board');
  await expect(story(page, 'S-4').getByRole('img', { name: 'Unassigned' })).toBeVisible();
  // When I assign it to Luca in its dialog and reload the app
  await story(page, 'S-4').dblclick();
  const dialog = page.getByRole('dialog', { name: /S-4:/ });
  await dialog.getByLabel('Assigned to').selectOption({ label: 'Luca Rossi (LR)' });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.reload();
  // Then the card of S-4 shows "LR"
  await expect(story(page, 'S-4').getByRole('img', { name: 'Assigned to Luca Rossi' })).toHaveText('LR');
});

test('AC4.1 the filter bar shows only the stories of one person on the board', async ({ page }) => {
  // Given the board with the stories of Sprint 1
  await open(page, '#/board');
  await expect(story(page, 'S-2')).toBeVisible();
  // When I click "AK" in the filter bar
  await page.getByRole('group', { name: 'Person' }).getByRole('button', { name: 'Anna Keller' }).click();
  // Then only the stories of Anna are visible
  await expect(story(page, 'S-1')).toBeVisible();
  await expect(story(page, 'S-3')).toBeVisible();
  await expect(story(page, 'S-2')).toHaveCount(0);
  await expect(story(page, 'S-4')).toHaveCount(0);
});
