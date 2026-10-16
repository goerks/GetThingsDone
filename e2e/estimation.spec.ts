import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * End-to-end tests of estimating with cards (#54), following the test cases the PO approved in the issue (see
 * src/acceptance/package54.ts). Every test starts from the demo data of a fresh browser on Tuesday 13 October 2026:
 * S-3 "Reorder the backlog by priority" has 5 points, S-1 is the reference of the card 3.
 */

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
});

const open = async (page: Page, hash: string): Promise<void> => {
  await page.goto(`/${hash}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
};
/** A card on the board or a row of the backlog. */
const story = (page: Page, code: string): Locator => page.getByRole('group', { name: new RegExp(`(^|, )${code}: `) });
const dialog = (page: Page, name: string | RegExp): Locator => page.getByRole('dialog', { name });
const notEstimated = (container: Locator): Locator => container.getByRole('img', { name: 'Not estimated' });

test('AC1.1 creates a story with "New story" without an estimate', async ({ page }) => {
  // Given I am in the backlog
  await open(page, '#/backlog');

  // When I create the story "Upload a profile picture" with "New story"
  await page.getByRole('button', { name: 'New story' }).click();
  const box = dialog(page, 'New story');
  await box.getByLabel('Title').fill('Upload a profile picture');
  await box.getByRole('button', { name: 'Add story' }).click();

  // Then the story shows the dashed pill with a dash and no number
  await expect(notEstimated(story(page, 'S-8'))).toHaveText('–');
});

test('AC1.2 adds a story with the quick add without an estimate', async ({ page }) => {
  // Given I am at the board
  await open(page, '#/board');

  // When I add "Password reset" in the column "To do"
  const todo = page.getByRole('region', { name: /^To do/ });
  await todo.getByRole('button', { name: '+ Story in To do' }).click();
  await todo.getByRole('textbox', { name: 'Title of the new story in To do' }).fill('Password reset');
  await page.keyboard.press('Enter');

  // Then the story shows the dashed pill with a dash
  await expect(notEstimated(story(page, 'S-8'))).toBeVisible();
});

test('AC1.3 keeps a new story not estimated after a reload', async ({ page }) => {
  // Given a story created with the quick add
  await open(page, '#/board');
  const todo = page.getByRole('region', { name: /^To do/ });
  await todo.getByRole('button', { name: '+ Story in To do' }).click();
  await todo.getByRole('textbox', { name: 'Title of the new story in To do' }).fill('Profile picture');
  await page.keyboard.press('Enter');
  await expect(story(page, 'S-8')).toBeVisible();

  // When I reload the app
  await page.reload();

  // Then the story is still not estimated
  await expect(notEstimated(story(page, 'S-8'))).toBeVisible();
});

test('AC2.1 estimates a story with the card 3 and keeps it after a reload', async ({ page }) => {
  // Given the dialog of S-3 shows the cards 1, 2, 3, 5, 8, 13, 21, "?" and the coffee cup
  await open(page, '#/backlog');
  await story(page, 'S-3').dblclick();
  const box = dialog(page, /^S-3: /);
  await expect(box.getByRole('radio')).toHaveCount(9);

  // When I choose the card 3
  await box.getByRole('radio', { name: /^3,/ }).click();

  // Then the card 3 is chosen, the backlog shows 3, and it stays after a reload
  await expect(box.getByRole('radio', { name: /^3,/ })).toHaveAttribute('aria-checked', 'true');
  await box.getByRole('button', { name: 'Close' }).click();
  await expect(story(page, 'S-3').getByText('3', { exact: true })).toBeVisible();
  await page.reload();
  await expect(story(page, 'S-3').getByText('3', { exact: true })).toBeVisible();
});

test('AC2.4 chooses a card with the keyboard only', async ({ page }) => {
  // Given the dialog of S-3 with the focus on the chosen card 5
  await open(page, '#/backlog');
  await story(page, 'S-3').dblclick();
  const box = dialog(page, /^S-3: /);
  await box.getByRole('radio', { name: '5' }).focus();

  // When I move to the card 8 with the arrow key and press Enter
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');

  // Then the card 8 is chosen
  await expect(box.getByRole('radio', { name: '8' })).toHaveAttribute('aria-checked', 'true');
  await expect(box.getByRole('radio', { name: '5' })).toHaveAttribute('aria-checked', 'false');
});

test('AC3.2 replaces the reference of a value with a notice', async ({ page }) => {
  // Given S-1 is the reference for 3 and S-5 is estimated with 3, too
  await open(page, '#/backlog');
  await story(page, 'S-5').dblclick();
  const box = dialog(page, /^S-5: /);
  await expect(box.getByRole('radio', { name: '3, reference story S-1' })).toBeVisible();

  // When I mark S-5 as the reference for 3
  await box.getByRole('checkbox', { name: 'This story is the reference for 3' }).check();

  // Then a notice says that S-5 replaces S-1, and the card 3 carries S-5
  await expect(page.getByText('S-5 is now the reference for 3; it replaces S-1.')).toBeVisible();
  await expect(box.getByRole('radio', { name: '3, reference story S-5' })).toBeVisible();
});

test('AC5.1 names the stories without estimate in the sum', async ({ page }) => {
  // Given the backlog shows Sprint 1 with 6 stories and 23 points
  await open(page, '#/backlog');
  await expect(page.getByText('6 stories · 23 points', { exact: true })).toBeVisible();

  // When I take the estimate of S-3 back
  await story(page, 'S-3').dblclick();
  await dialog(page, /^S-3: /).getByRole('radio', { name: '5' }).click();

  // Then the sum is 18 points and says "1 without estimate"
  await dialog(page, /^S-3: /).getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText('6 stories · 18 points · 1 without estimate', { exact: true })).toBeVisible();
});
