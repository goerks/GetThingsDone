import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * End-to-end tests of the major UI update (#55) in a real browser: layout, drag and drop in the compact view, reload,
 * inline points. The rest of the test cases is covered by src/UiUpdate.test.tsx. The demo data of a fresh browser on
 * Tuesday 13 October 2026: Sprint 1 runs with 6 stories and 23 points.
 */

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
});

const open = async (page: Page, hash: string): Promise<void> => {
  await page.goto(`/${hash}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
};
const story = (page: Page, code: string): Locator => page.getByRole('group', { name: new RegExp(`(^|, )${code}: `) });
const column = (page: Page, name: string): Locator => page.getByRole('region', { name: new RegExp(`^${name}`) });

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

test('AC1.3 a card reacts to the mouse and to the keyboard', async ({ page }) => {
  // Given the board is open
  await open(page, '#/board');
  const card = story(page, 'S-1');
  const rest = await card.evaluate((element) => getComputedStyle(element).boxShadow);
  // When I move the mouse over S-1
  await card.hover();
  // Then the shadow gets stronger
  // (the shadow fades in over a moment)
  await expect.poll(() => card.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe(rest);
  // When I reach S-1 with the Tab key
  await page.mouse.move(0, 0);
  await page.keyboard.press('Shift');
  await card.focus();
  // Then a frame is visible around it
  expect(await card.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');
});

test('AC3.2 keeps epic, labels and tasks on one line, also in a narrow column', async ({ page }) => {
  // Given the board is open in a narrow window
  await page.setViewportSize({ width: 900, height: 800 });
  await open(page, '#/board');
  // When I look at the meta line of S-6
  const meta = story(page, 'S-6').locator('.card__meta');
  // Then it is one line: its height is that of a single small line
  const box = await meta.boundingBox();
  expect(box?.height ?? 99).toBeLessThan(28);
});

test('AC4.4 drags a story in the compact view and keeps it there after a reload', async ({ page }) => {
  // Given the compact view is on
  await open(page, '#/board');
  await page.getByRole('button', { name: 'Compact' }).click();
  // When I drag S-3 into "In progress"
  await drag(page, story(page, 'S-3'), column(page, 'In progress').getByRole('list'));
  // Then S-3 is in "In progress", also after a reload
  await expect(column(page, 'In progress').getByText('Reorder the backlog by priority')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Compact' })).toHaveAttribute('aria-pressed', 'true');
  await expect(column(page, 'In progress').getByText('Reorder the backlog by priority')).toBeVisible();
});

test('AC4.5 never wraps a long title in the compact view', async ({ page }) => {
  // Given the compact view and a narrow column
  await page.setViewportSize({ width: 1000, height: 800 });
  await open(page, '#/board');
  await page.getByRole('button', { name: 'Compact' }).click();
  // When I look at the line of S-6
  const line = story(page, 'S-6');
  const title = line.locator('.card__title');
  // Then the line is a single line and the title is cut with an ellipsis
  expect((await line.boundingBox())?.height ?? 99).toBeLessThan(44);
  expect(await title.evaluate((element) => getComputedStyle(element).textOverflow)).toBe('ellipsis');
});

test('AC6.1 shows the number outside the white row, on its left', async ({ page }) => {
  // Given the backlog is open
  await open(page, '#/backlog');
  // When I look at the row of S-3
  const row = story(page, 'S-3');
  const code = row.locator('.backlog__code');
  // Then the number ends before the row begins
  const rowBox = await row.boundingBox();
  const codeBox = await code.boundingBox();
  expect(codeBox && rowBox && codeBox.x + codeBox.width <= rowBox.x + 1).toBe(true);
  // And all numbers are in one column
  const lefts = await page.locator('.backlog__row > .backlog__code').evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().left)));
  expect(new Set(lefts).size).toBe(1);
});

test('AC7.1 changes the points and keeps them after a reload', async ({ page }) => {
  // Given S-1 has 3 points and Sprint 1 has 23
  await open(page, '#/backlog');
  const sprint = page.getByRole('region', { name: /^Sprint 1/ });
  // When I click the points of S-1, type 8 and press Enter
  await story(page, 'S-1').getByRole('button', { name: /points of S-1/i }).click();
  await page.keyboard.type('8');
  await page.keyboard.press('Enter');
  // Then S-1 has 8 points and Sprint 1 has 28, also after a reload
  await expect(sprint.getByTestId('sprint-points')).toContainText('28');
  await page.reload();
  await expect(page.getByRole('region', { name: /^Sprint 1/ }).getByTestId('sprint-points')).toContainText('28');
  await expect(story(page, 'S-1').getByRole('button', { name: /points of S-1/i })).toContainText('8');
});

test('AC8.3 keeps the shortcuts working in a real browser', async ({ page }) => {
  // Given the board is open
  await open(page, '#/board');
  // When I press Ctrl+F
  await page.keyboard.press('Control+f');
  // Then the search field has the focus
  await expect(page.getByRole('combobox', { name: /search/i })).toBeFocused();
  // When I leave the field and press Ctrl+/
  await page.keyboard.press('Escape');
  await page.locator('h1').click();
  await page.keyboard.press('Control+/');
  // Then the shortcut overview opens
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('AC10.1 shows the priority as a small quiet mark, not as a box', async ({ page }) => {
  // Given the board is open and S-1 is "Must"
  await open(page, '#/board');
  // When I look at the priority of S-1
  const letter = story(page, 'S-1').locator('.card__letter');
  // Then it has no background and no border, only a muted letter and a small dot
  const style = await letter.evaluate((element) => {
    const css = getComputedStyle(element);
    return { background: css.backgroundColor, border: css.borderTopWidth, size: element.getBoundingClientRect().height };
  });
  expect(style.background).toBe('rgba(0, 0, 0, 0)');
  expect(style.border).toBe('0px');
  expect(style.size).toBeLessThan(16);
});
