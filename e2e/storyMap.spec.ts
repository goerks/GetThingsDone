import { expect, test, type Locator, type Page } from '@playwright/test';
import { pressUntilAnnounced } from './keyboardDrag';

/*
 * End-to-end tests of the story map in a real browser, approved by the PO as test cases in issue #12.
 * Every test starts from the demo data of a fresh browser on Tuesday 13 October 2026:
 * Sprint 1 runs from 6 to 19 October, Sprint 2 follows from 20 October to 2 November,
 * and S-3 "Reorder the backlog by priority" (5 points) is in epic "Backlog", Sprint 1.
 */

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
  await page.goto('/#/map');
  await expect(page.getByRole('heading', { name: 'Story Map', level: 1 })).toBeVisible();
});

const cell = (page: Page, row: string, epic: string): Locator => page.getByRole('list', { name: `${row} ${epic}`, exact: true });
const card = (page: Page, code: string): Locator => page.getByRole('group', { name: new RegExp(`^${code}: `) });
const sprintLabel = (page: Page, name: string): Locator => page.getByRole('button', { name: new RegExp(`^${name}, `) });
const S3 = 'S-3: Reorder the backlog by priority';
/** The sprint rows from top to bottom, as a screen reader names them. */
const sprintRows = (page: Page): Promise<string[]> =>
  page.locator('.map-sprint[data-sprint-id]').evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label') ?? ''));
/** What the drag and drop live region has said to screen readers. */
const announcement = (page: Page, text: string | RegExp): Locator => page.getByRole('status').filter({ hasText: text });

/** Drags with the mouse in small steps, as a person would; `during` runs while the pointer is over the target. */
async function drag(page: Page, from: Locator, to: Locator, during?: () => Promise<void>, toY: 'center' | 'top' = 'center'): Promise<void> {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  if (!a || !b) throw new Error('drag source or target is not visible');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, toY === 'top' ? b.y + 4 : b.y + b.height / 2, { steps: 15 });
  if (during) await during();
  await page.mouse.up();
}

test('FR-MAP-02.1 moves a story to another cell with the mouse, everywhere and after a reload', async ({ page }) => {
  // Given S-3 is in "Backlog" / Sprint 1
  await expect(cell(page, 'Sprint 1', 'Backlog').getByRole('group', { name: S3 })).toBeVisible();
  await expect(sprintLabel(page, 'Sprint 1')).toContainText('6 stories · 23 points');
  await expect(sprintLabel(page, 'Sprint 2')).toContainText('0 stories · 0 points');

  // When I drag S-3 with the mouse into "Accessibility" / Sprint 2
  // Then while dragging the target cell, the epic header and the sprint row are highlighted
  const target = cell(page, 'Sprint 2', 'Accessibility');
  await drag(page, card(page, 'S-3'), target, async () => {
    await expect(page.locator('.map-cell--target')).toHaveCount(1);
    await expect(page.locator('.map-cell--target').getByRole('list')).toHaveAccessibleName('Sprint 2 Accessibility');
    await expect(page.locator('.map-epic--target')).toContainText('Accessibility');
    await expect(page.locator('.map-sprint--target')).toContainText('Sprint 2');
  });

  // Then S-3 is in "Accessibility" / Sprint 2, and the sprint sums moved by 5 points
  await expect(target.getByRole('group', { name: S3 })).toBeVisible();
  await expect(cell(page, 'Sprint 1', 'Backlog').getByRole('group')).toHaveCount(0);
  await expect(sprintLabel(page, 'Sprint 1')).toContainText('5 stories · 18 points');
  await expect(sprintLabel(page, 'Sprint 2')).toContainText('1 story · 5 points');
  await expect(page.locator('.map-cell--target, .map-epic--target, .map-sprint--target')).toHaveCount(0);

  // And the backlog lists S-3 under Sprint 2
  await page.getByRole('link', { name: 'Backlog' }).click();
  await expect(page.getByRole('region', { name: 'Sprint 2' })).toContainText('S-3');
  await expect(page.getByRole('region', { name: 'Sprint 1' })).not.toContainText('S-3');

  // And the board, which shows the running Sprint 1, no longer shows S-3
  await page.getByRole('link', { name: 'Board' }).click();
  await expect(card(page, 'S-1')).toBeVisible();
  await expect(card(page, 'S-3')).toHaveCount(0);

  // And after reloading the app everything is still so
  await page.reload();
  await page.getByRole('link', { name: 'Story Map' }).click();
  await expect(cell(page, 'Sprint 2', 'Accessibility').getByRole('group', { name: S3 })).toBeVisible();
  await expect(sprintLabel(page, 'Sprint 2')).toContainText('1 story · 5 points');
});

test('FR-MAP-02.2 moves a story with the keyboard only, and Escape cancels', async ({ page }) => {
  // When I tab to S-3, press space, arrow right and space again
  await page.getByRole('button', { name: 'Compact' }).focus();
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press('Tab');
    if (await card(page, 'S-3').evaluate((element) => element === document.activeElement)) break;
  }
  await expect(card(page, 'S-3')).toBeFocused();
  // (Like a screen reader user, wait for each announcement before the next key.)
  await page.keyboard.press('Space');
  await expect(announcement(page, 'Picked up Reorder the backlog by priority.')).toHaveCount(1);
  await pressUntilAnnounced(page, 'ArrowRight', announcement(page, 'Reorder the backlog by priority goes to Sprint 1, Local storage'));
  await page.keyboard.press('Space');

  // Then S-3 is in "Local storage" / Sprint 1, and the screen reader says where it is now
  await expect(cell(page, 'Sprint 1', 'Local storage').getByRole('group', { name: S3 })).toBeVisible();
  await expect(announcement(page, 'Reorder the backlog by priority is now in Sprint 1, Local storage')).toHaveCount(1);

  // When I pick S-3 up again, press arrow down and Escape
  await card(page, 'S-3').focus();
  await page.keyboard.press('Space');
  await expect(announcement(page, 'Picked up Reorder the backlog by priority.')).toHaveCount(1);
  await pressUntilAnnounced(page, 'ArrowDown', announcement(page, /^Reorder the backlog by priority goes to /));
  await page.keyboard.press('Escape');

  // Then S-3 stays in "Local storage" / Sprint 1
  await expect(announcement(page, 'Moving Reorder the backlog by priority cancelled.')).toHaveCount(1);
  await expect(cell(page, 'Sprint 1', 'Local storage').getByRole('group', { name: S3 })).toBeVisible();
  await expect(cell(page, 'Sprint 2', 'Local storage').getByRole('group')).toHaveCount(0);
});

test('FR-MAP-04.1 moves an upcoming sprint forward and keeps the sprint lengths without gaps', async ({ page }) => {
  // Given Sprint 2 lasts two weeks, and I add Sprint 3 for one week
  await page.getByRole('button', { name: '+ Sprint' }).click();
  const dialog = page.getByRole('dialog', { name: 'New sprint' });
  await expect(dialog.getByLabel('Name')).toHaveValue('Sprint 3');
  await expect(dialog.getByLabel('Start')).toHaveValue('2026-11-03');
  await dialog.getByLabel('End').fill('2026-11-09');
  await dialog.getByRole('button', { name: 'Add sprint' }).click();
  await expect(sprintLabel(page, 'Sprint 3')).toHaveAccessibleName('Sprint 3, Nov 3 – Nov 9, planned');

  // When I drag Sprint 3 above Sprint 2
  await drag(page, sprintLabel(page, 'Sprint 3'), sprintLabel(page, 'Sprint 2'), undefined, 'top');

  // Then the order is Sprint 1, Sprint 3, Sprint 2; Sprint 3 starts right after Sprint 1 and still lasts one week,
  // and Sprint 2 follows without a gap and still lasts two weeks
  const expected = ['Sprint 1, Oct 6 – Oct 19, running', 'Sprint 3, Oct 20 – Oct 26, planned', 'Sprint 2, Oct 27 – Nov 9, planned'];
  await expect.poll(() => sprintRows(page)).toEqual(expected);

  // And the running Sprint 1 cannot be dragged
  await expect(sprintLabel(page, 'Sprint 1')).not.toHaveAttribute('aria-roledescription', 'sprint');
  await drag(page, sprintLabel(page, 'Sprint 1'), sprintLabel(page, 'Sprint 2'));
  await page.keyboard.press('Escape');

  // And Sprint 3 cannot be put in front of Sprint 1
  await drag(page, sprintLabel(page, 'Sprint 3'), sprintLabel(page, 'Sprint 1'), undefined, 'top');
  await page.keyboard.press('Escape');
  await expect.poll(() => sprintRows(page)).toEqual(expected);

  // And the new order is kept after a reload
  await page.reload();
  await expect.poll(() => sprintRows(page)).toEqual(expected);
});

test('FR-MAP-03.1 creates a story in a cell and finds it on the map, the board and the backlog', async ({ page }) => {
  // When I click "+" in "Local storage" / Sprint 1, type the title "Export data" and press Enter (quick add, #32)
  await page.getByRole('button', { name: 'New story in Local storage, Sprint 1' }).click();
  await page.getByRole('textbox', { name: 'Title of the new story in Sprint 1, Local storage' }).fill('Export data');
  await page.keyboard.press('Enter');

  // Then the card is in that cell (not estimated, #54) and Sprint 1 shows one more story and one without estimate
  await expect(cell(page, 'Sprint 1', 'Local storage').getByRole('group', { name: 'S-8: Export data' })).toBeVisible();
  await expect(sprintLabel(page, 'Sprint 1')).toContainText('7 stories · 23 points · 1 without estimate');

  // And the board shows it in "To do"
  await page.getByRole('link', { name: 'Board' }).click();
  await expect(page.getByRole('region', { name: /^To do/ }).getByRole('group', { name: /^S-8: Export data/ })).toBeVisible();

  // And the backlog lists it under Sprint 1
  await page.getByRole('link', { name: 'Backlog' }).click();
  await expect(page.getByRole('region', { name: 'Sprint 1' })).toContainText('Export data');

  // And it is still there after a reload
  await page.reload();
  await expect(page.getByRole('region', { name: 'Sprint 1' })).toContainText('Export data');
});
