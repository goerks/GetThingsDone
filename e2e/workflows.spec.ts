import { expect, test, type Locator, type Page } from '@playwright/test';
import { pressUntilAnnounced } from './keyboardDrag';

/*
 * End-to-end tests of the workflow (#49) in a real browser, following the test cases the PO approved in the issue. Every test
 * starts from the demo data of a fresh browser on Tuesday 13 October 2026. The workflow is off, as it is until the team
 * switches it on; `setWorkflow` stores a workflow, as the page Settings › Workflows does. S-3 and S-6 are in "To do",
 * S-1 in "In progress", S-2 in "Review", S-5 in "Done".
 */

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
});

const story = (page: Page, code: string): Locator => page.getByRole('group', { name: new RegExp(`^${code}: `) });
const column = (page: Page, name: string): Locator => page.getByRole('region', { name, exact: true });
const toast = (page: Page, text: string | RegExp): Locator => page.locator('.toast').filter({ hasText: text });
const announcement = (page: Page, text: string | RegExp): Locator => page.getByRole('status').filter({ hasText: text });

async function open(page: Page, hash: string): Promise<void> {
  await page.goto(`/${hash}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

type Blocked = Record<string, string[]>;

/** Stores a workflow (switched on or off) and reloads, as Settings › Workflows does. */
async function setWorkflow(page: Page, hash: string, enabled: boolean, blocked: Blocked): Promise<void> {
  await open(page, hash);
  await page.evaluate(
    ({ enabled: on, blocked: rules }) => {
      const key = 'getitdone.snapshot.v1';
      const snapshot = JSON.parse(window.localStorage.getItem(key) ?? '{}');
      snapshot.settings.workflow = { enabled: on, story: { start: null, blocked: rules, free: { not_started: true, in_progress: true, done: true } } };
      window.localStorage.setItem(key, JSON.stringify(snapshot));
    },
    { enabled, blocked }
  );
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/** Picks a card up with the mouse and moves it over a target without letting go; `release` drops it. */
async function dragTo(page: Page, from: Locator, to: Locator, release: boolean): Promise<void> {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  if (!a || !b) throw new Error('drag source or target is not visible');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 });
  if (release) await page.mouse.up();
}

test('AC1.1 moves a story from "To do" straight to "Done" while nothing is set', async ({ page }) => {
  // Given the demo data with a workflow that was never touched
  await open(page, '#/board');
  // When I drag S-3 from "To do" into "Done"
  await dragTo(page, story(page, 'S-3'), column(page, 'Done').getByRole('list'), true);
  // Then S-3 is in "Done", also after a reload
  await expect(column(page, 'Done').getByRole('group', { name: /^S-3: / })).toBeVisible();
  await page.reload();
  await expect(column(page, 'Done').getByRole('group', { name: /^S-3: / })).toBeVisible();
});

test('AC11.2 offers no sign of a workflow and allows every move while the workflow is off, although rules are saved', async ({ page }) => {
  // Given a saved rule "To do" → "Done" is forbidden, but the workflow is off
  await setWorkflow(page, '#/board', false, { todo: ['done'] });
  // When I drag S-3 into "Done"
  await dragTo(page, story(page, 'S-3'), column(page, 'Done').getByRole('list'), true);
  // Then it moves, and there is no lock anywhere on the board
  await expect(column(page, 'Done').getByRole('group', { name: /^S-3: / })).toBeVisible();
  await expect(page.locator('[data-locked="true"]')).toHaveCount(0);
});

test('AC3.1 locks the columns a story may not go to while it is dragged', async ({ page }) => {
  // Given "To do" → "Done" is forbidden and the workflow is on
  await setWorkflow(page, '#/board', true, { todo: ['done'] });
  await expect(page.locator('[data-locked="true"]')).toHaveCount(0);
  // When I pick up S-3 and move over "Done" without letting go
  await dragTo(page, story(page, 'S-3'), column(page, 'Done').getByRole('list'), false);
  // Then "Done" is locked and the others are not
  await expect(column(page, 'Done')).toHaveAttribute('data-locked', 'true');
  await expect(column(page, 'In progress')).not.toHaveAttribute('data-locked', 'true');
  await expect(column(page, 'Review')).not.toHaveAttribute('data-locked', 'true');
  // And everything is as before once I let go
  await page.mouse.up();
  await expect(page.locator('[data-locked="true"]')).toHaveCount(0);
});

test('AC3.2 names the reason over a locked column', async ({ page }) => {
  // Given "To do" → "Done" is forbidden and the workflow is on
  await setWorkflow(page, '#/board', true, { todo: ['done'] });
  // When I pick up S-3 and move over "Done" without letting go
  await dragTo(page, story(page, 'S-3'), column(page, 'Done').getByRole('list'), false);
  // Then the reason shows over the locked column, and not over the others
  await expect(column(page, 'Done').getByRole('note')).toHaveText('To do → Done is not allowed');
  await expect(column(page, 'In progress').getByRole('note')).toHaveCount(0);
  await page.mouse.up();
});

test('AC3.3 keeps a story in place when it is dropped on a locked column, and says why', async ({ page }) => {
  // Given "To do" → "Done" is forbidden and the workflow is on
  await setWorkflow(page, '#/board', true, { todo: ['done'] });
  // When I drop S-3 on "Done"
  await dragTo(page, story(page, 'S-3'), column(page, 'Done').getByRole('list'), true);
  // Then S-3 stays in "To do" and a notice says that moving to "Done" is not allowed
  await expect(column(page, 'To do').getByRole('group', { name: /^S-3: / })).toBeVisible();
  await expect(column(page, 'Done').getByRole('group', { name: /^S-3: / })).toHaveCount(0);
  await expect(toast(page, 'S-3 stays in “To do”: moving to “Done” is not allowed.')).toBeVisible();
});

test('AC3.4 refuses a move with the keyboard to a locked column and announces the reason', async ({ page }) => {
  // Given "To do" → "In progress" is forbidden and the workflow is on
  await setWorkflow(page, '#/board', true, { todo: ['in_progress'] });
  // When I pick S-3 up with the space key, move it one column to the right and drop it
  await story(page, 'S-3').focus();
  await page.keyboard.press('Space');
  await expect(announcement(page, /is over To do/)).toHaveCount(1);
  await pressUntilAnnounced(page, 'ArrowRight', announcement(page, /is over In progress/));
  await page.keyboard.press('Space');
  // Then S-3 stays in "To do" and the notice, which screen readers read out, gives the reason
  await expect(toast(page, 'S-3 stays in “To do”: moving to “In progress” is not allowed.')).toBeVisible();
  await expect(column(page, 'To do').getByRole('group', { name: /^S-3: / })).toBeVisible();
});

test('AC2.3 shows the workflow page on a narrow screen with the rows one under the other and no sideways scrolling', async ({ page }) => {
  // Given a screen as narrow as a phone and the workflow on
  await page.setViewportSize({ width: 400, height: 800 });
  await setWorkflow(page, '#/settings/workflows', true, {});
  // When I look at the list (the page shows the diagram first)
  await page.getByRole('button', { name: 'List', exact: true }).click();
  const row = page.getByRole('group', { name: 'Where a story may move from Review' });
  await expect(row).toBeVisible();
  // Then the page does not scroll sideways and every button of the last row can be reached
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const last = row.getByRole('button', { name: 'From Review to the end (delete)' });
  await last.scrollIntoViewIfNeeded();
  const box = await last.boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 400).toBe(true);
});

test('AC15.2 draws the diagram upright on a narrow screen without sideways scrolling', async ({ page }) => {
  // Given a screen as narrow as a phone and the workflow on with one forbidden transition
  await page.setViewportSize({ width: 400, height: 800 });
  await setWorkflow(page, '#/settings/workflows', true, { todo: ['done'] });
  // When I look at the page (the diagram is the first view)
  const diagram = page.locator('.workflow-diagram');
  await expect(diagram).toBeVisible();
  // Then the diagram is drawn upright, the page does not scroll sideways, and the last status is reachable
  await expect(diagram).toHaveAttribute('data-orientation', 'vertical');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByRole('button', { name: 'Done', exact: true }).scrollIntoViewIfNeeded();
  const box = await page.getByRole('button', { name: 'Done', exact: true }).boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 400).toBe(true);
  // And on a wide screen it is drawn from left to right
  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(diagram).toHaveAttribute('data-orientation', 'horizontal');
});

test('AC13.1 shows the diagram with the start, the end and the frames on a wide screen', async ({ page }) => {
  // Given the workflow is on
  await setWorkflow(page, '#/settings/workflows', true, { todo: ['done'] });
  // When I open Settings › Workflows
  // Then the diagram shows the three frames and the four statuses
  await expect(page.locator('.wd-frame')).toHaveCount(3);
  for (const name of ['To do', 'In progress', 'Review', 'Done']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  await expect(page.locator('.wd-final')).toBeVisible();
});
