import { expect, test, type Locator, type Page } from '@playwright/test';
import { pressUntilAnnounced } from './keyboardDrag';

/*
 * End-to-end tests of starting and completing a sprint (#17) in a real browser, following the test cases the PO
 * approved in the issue. Every test starts from the demo data of a fresh browser on Tuesday 13 October 2026:
 * Sprint 1 runs from 6 to 19 October with 6 stories and 23 points (S-5, 3 points, is done); Sprint 2 is planned from
 * 20 October to 2 November and empty; S-7 is not planned.
 */

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
  await page.goto('/#/board');
  await expect(page.getByRole('heading', { name: 'Sprint 1', level: 1 })).toBeVisible();
});

const card = (page: Page, code: string): Locator => page.getByRole('group', { name: new RegExp(`^${code}: `) });
const column = (page: Page, name: string): Locator => page.getByRole('region', { name, exact: true });
const announcement = (page: Page, text: string | RegExp): Locator => page.getByRole('status').filter({ hasText: text });

async function completeSprint1(page: Page, options: { target?: RegExp; startNext?: boolean } = {}): Promise<void> {
  await page.getByRole('button', { name: 'Complete sprint' }).click();
  const dialog = page.getByRole('dialog', { name: 'Complete Sprint 1' });
  if (options.target) await dialog.getByRole('radio', { name: options.target }).check();
  if (options.startNext) await dialog.getByRole('checkbox', { name: /^Then start/ }).check();
  await dialog.getByRole('button', { name: 'Complete sprint' }).click();
}

test('AC7.1 completes Sprint 1 into Sprint 2 and starts it, with its stories, after a reload', async ({ page }) => {
  // Given Sprint 1 runs and Sprint 2 is planned
  // When I complete Sprint 1, move its unfinished stories to the next sprint and start Sprint 2 right away
  await completeSprint1(page, { startNext: true });
  const starting = page.getByRole('dialog', { name: 'Start sprint' });
  // Then the start dialog holds the 5 moved stories with 20 points, and asks about the date: Sprint 2 was planned for 20 October
  await expect(starting.getByText('Planned points').locator('xpath=following-sibling::*[1]')).toHaveText(/20/);
  const dates = starting.getByRole('group', { name: 'Start date' });
  await expect(dates.getByRole('radio', { name: /^Start today:/ })).toBeChecked();
  await starting.getByRole('button', { name: 'Start sprint' }).click();

  // Then Sprint 2 runs from today for 14 days with the 5 stories, and Sprint 1 is gone, also after a reload
  await expect(page.getByRole('heading', { name: 'Sprint 2', level: 1 })).toBeVisible();
  await expect(page.getByText('running', { exact: true })).toBeVisible();
  await expect(page.getByText(/Oct 13 – Oct 26 · 5 stories · 20 points$/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sprint 2', level: 1 })).toBeVisible();
  await expect(column(page, 'To do').getByRole('group', { name: /^S-3: / })).toBeVisible();
  await page.getByRole('link', { name: 'Backlog' }).click();
  await expect(page.getByRole('region', { name: 'Sprint 2' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Sprint 1' })).toHaveCount(0);
});

test('AC9.2 keeps the sprint of a done story, and AC9.3 does not offer a completed sprint to other stories', async ({ page }) => {
  // Given Sprint 1 is completed
  await completeSprint1(page);
  await expect(page.getByRole('status').filter({ hasText: /Sprint 1 completed:/ })).toBeVisible();

  // When I open the done story S-5 through the search
  const search = page.getByRole('combobox', { name: 'Search' });
  await search.fill('Switch the UI language');
  await page.getByRole('option', { name: /Switch the UI language/ }).first().click();
  const story = page.getByRole('dialog', { name: /^S-5:/ });
  // Then it still shows Sprint 1 as its sprint
  await expect(story.getByLabel('Sprint').locator('option:checked')).toHaveText(/^Sprint 1 .*completed$/);
  await page.keyboard.press('Escape');

  // And a story that is not in Sprint 1 does not offer it
  await search.fill('Plan releases on a story map');
  await page.getByRole('option', { name: /Plan releases on a story map/ }).first().click();
  const other = page.getByRole('dialog', { name: /^S-7:/ });
  await expect(other.getByLabel('Sprint').getByRole('option', { name: /^Sprint 1/ })).toHaveCount(0);
});

test('AC4.1 shows the next planned sprint when none runs, and its stories can be moved on the board', async ({ page }) => {
  // Given Sprint 1 is completed, with its unfinished stories moved to Sprint 2, which is now planned
  await completeSprint1(page);
  // Then the board shows Sprint 2 as planned with the button to start it
  await expect(page.getByRole('heading', { name: 'Sprint 2', level: 1 })).toBeVisible();
  await expect(page.getByText('Sprint 2 is planned and not running yet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start sprint' })).toBeVisible();

  // When I move S-3 from "To do" to "In progress" with the keyboard
  await card(page, 'S-3').focus();
  await page.keyboard.press('Space');
  await expect(announcement(page, /is over To do/)).toHaveCount(1);
  await pressUntilAnnounced(page, 'ArrowRight', announcement(page, /is over In progress/));
  await page.keyboard.press('Space');
  await expect(announcement(page, /dropped in In progress\./)).toHaveCount(1);

  // Then S-3 stays there after a reload
  await page.reload();
  await expect(column(page, 'In progress').getByRole('group', { name: /^S-3: / })).toBeVisible();
});

test('AC11.1 gives the sprints of an earlier version their state when the app opens', async ({ page }) => {
  // Given data stored by an earlier version: Sprint 0 is over, Sprint 1 includes today, Sprint 2 follows; no sprint has a state
  await page.evaluate(() => {
    const story = (id: string, code: string, sprintId: string, status: string, points: number, rank: number) => ({
      id, code, title: `Story ${code}`, description: '', epicId: null, points, status, sprintId, releaseId: null, rank, criteria: [], values: {}
    });
    window.localStorage.setItem(
      'getitdone.snapshot.v1',
      JSON.stringify({
        epics: [],
        sprints: [
          { id: 'sprint-0', name: 'Sprint 0', startDate: '2026-09-22', endDate: '2026-10-05' },
          { id: 'sprint-1', name: 'Sprint 1', startDate: '2026-10-06', endDate: '2026-10-19' },
          { id: 'sprint-2', name: 'Sprint 2', startDate: '2026-10-20', endDate: '2026-11-02' }
        ],
        stories: [
          story('a', 'S-1', 'sprint-0', 'done', 5, 0),
          story('b', 'S-2', 'sprint-0', 'in_progress', 8, 1),
          story('c', 'S-3', 'sprint-1', 'todo', 3, 2),
          story('d', 'S-4', 'sprint-2', 'todo', 2, 3)
        ]
      })
    );
  });

  // When I open the app
  await page.goto('/#/backlog');
  await page.reload();

  // Then Sprint 1 runs and Sprint 2 is planned; Sprint 0 is completed and not shown; its unfinished story is back in the backlog
  await expect(page.getByRole('region', { name: 'Sprint 1' }).getByText('running')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Sprint 2' }).getByText('planned', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Sprint 0' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Not planned' }).getByText('Story S-2')).toBeVisible();
  await expect(page.getByText('Story S-1')).toHaveCount(0);
});
