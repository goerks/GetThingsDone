import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * End-to-end tests of the change history and the comparison of two versions (#23) in a real browser, following the test
 * cases the PO approved in the issue. Every test starts from the demo data of a fresh browser on Tuesday 13 October 2026.
 * Story S-3 ("Reorder the backlog by priority") has a demo history of six versions; the other stories have their first version.
 */

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
});

const story = (page: Page, code: string): Locator => page.getByRole('group', { name: new RegExp(`(^|, )${code}: `) });
const column = (page: Page, name: string): Locator => page.getByRole('region', { name, exact: true });
const dialog = (page: Page, name: string | RegExp): Locator => page.getByRole('dialog', { name });

async function open(page: Page, hash: string): Promise<void> {
  await page.goto(`/${hash}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/** Mouse drag in small steps, as a person would. */
async function drag(page: Page, from: Locator, to: Locator): Promise<void> {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  if (!a || !b) throw new Error('drag source or target is not visible');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 });
  await page.mouse.up();
}

async function openStory(page: Page, code: string): Promise<Locator> {
  await story(page, code).dblclick();
  const opened = dialog(page, new RegExp(`${code}:`));
  await expect(opened).toBeVisible();
  return opened;
}

const panel = (opened: Locator): Locator => opened.locator('.history-panel');

test('AC3.1 moving a story on the board is a change of its status in the history', async ({ page }) => {
  // Given S-3 in "To do" with six versions
  await open(page, '#/board');
  // When I drag S-3 to "In progress"
  await drag(page, story(page, 'S-3'), column(page, 'In progress').locator('.column__list'));
  await expect(column(page, 'In progress').getByRole('group', { name: /^S-3: / })).toBeVisible();
  // Then the history of S-3 has a new version with the status change
  const opened = await openStory(page, 'S-3');
  await expect(panel(opened).locator('.history-entry').first()).toContainText('V7');
  await expect(panel(opened).locator('.history-entry').first()).toContainText(/Status: To do → In progress/);
});

test('AC3.3 changing only the order of two stories adds no version', async ({ page }) => {
  // Given S-3 and S-6 in "To do"; S-3 has six versions
  await open(page, '#/board');
  // When I drag S-6 above S-3 in the same column
  await drag(page, story(page, 'S-6'), story(page, 'S-3'));
  // Then the history of S-3 still has six versions
  const opened = await openStory(page, 'S-3');
  await expect(panel(opened)).toContainText('6 versions');
});

test('AC5.1 the history is still there after reloading the app', async ({ page }) => {
  // Given S-3 with a new version made by a move
  await open(page, '#/board');
  await drag(page, story(page, 'S-3'), column(page, 'In progress').locator('.column__list'));
  await expect(column(page, 'In progress').getByRole('group', { name: /^S-3: / })).toBeVisible();
  // When I reload
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // Then the history has seven versions
  const opened = await openStory(page, 'S-3');
  await expect(panel(opened)).toContainText('7 versions');
});

test('AC8.1 compares V4 with the current version side by side', async ({ page }) => {
  // Given S-3 with six versions
  await open(page, '#/board');
  const opened = await openStory(page, 'S-3');
  // When I compare V4 with the current version
  await opened.getByRole('button', { name: 'Show older versions' }).click();
  await opened.getByRole('button', { name: 'Compare V4 with the current version' }).click();
  const compare = dialog(page, /Compare versions of S-3/);
  // Then the changed fields show their old value on the left and the new one on the right, and the unchanged ones are folded
  await expect(compare.getByRole('status')).toContainText(/4 of \d+ fields changed/);
  const points = compare.getByRole('row').filter({ has: page.getByRole('rowheader', { name: /Points/ }) });
  await expect(points.getByRole('cell').first()).toContainText('3');
  await expect(points.getByRole('cell').last()).toContainText('5');
  await expect(compare.getByText(/unchanged fields? hidden/)).toBeVisible();
  // And "Only changes" off shows every field
  await compare.getByRole('checkbox', { name: 'Only changes' }).uncheck();
  await expect(compare.getByRole('rowheader', { name: /^Title/ })).toBeVisible();
});

test('AC8.2 shows the description line by line with line numbers', async ({ page }) => {
  // Given the comparison of S-3
  await open(page, '#/board');
  const opened = await openStory(page, 'S-3');
  await opened.getByRole('button', { name: 'Compare versions' }).click();
  const compare = dialog(page, /Compare versions of S-3/);
  // When V1 (no description) is on the left
  const from = compare.getByLabel('From');
  await from.selectOption({ index: (await from.locator('option').count()) - 1 });
  // Then the description is shown as lines with numbers, the text only on the right
  const lines = compare.getByRole('group', { name: /Text, \d+ changed line/ });
  await expect(lines).toBeVisible();
  await expect(lines.locator('.textdiff__no').first()).toHaveText('1');
});

test('AC4.1 the history follows a language switch', async ({ page }) => {
  // Given the history of S-3 in English
  await open(page, '#/board');
  let opened = await openStory(page, 'S-3');
  await expect(panel(opened)).toContainText('Points: 3 → 5');
  await page.keyboard.press('Escape');
  // When I switch to German
  await page.getByRole('combobox', { name: 'Language' }).selectOption('de');
  opened = await openStory(page, 'S-3');
  // Then field names and texts are German
  await expect(panel(opened).getByRole('heading', { name: 'Verlauf' })).toBeVisible();
  await expect(panel(opened)).toContainText('Punkte: 3 → 5');
  await expect(panel(opened)).toContainText('Aktuell');
});

test('AC7.1 the comparison is operable with the keyboard only', async ({ page }) => {
  // Given the history panel of S-3
  await open(page, '#/board');
  const opened = await openStory(page, 'S-3');
  // When I reach "Compare versions" with Tab and press Enter, swap the sides with the keyboard and close with Escape
  await opened.getByRole('button', { name: 'Compare versions' }).focus();
  await page.keyboard.press('Enter');
  const compare = dialog(page, /Compare versions of S-3/);
  await expect(compare).toBeVisible();
  const right = await compare.getByLabel('To').inputValue();
  await compare.getByRole('button', { name: 'Swap the sides' }).focus();
  await page.keyboard.press('Enter');
  await expect(compare.getByLabel('From')).toHaveValue(right);
  await page.keyboard.press('Escape');
  // Then the comparison is closed and the story dialog is still open
  await expect(compare).toBeHidden();
  await expect(opened).toBeVisible();
});
