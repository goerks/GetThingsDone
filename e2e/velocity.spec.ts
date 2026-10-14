import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * End-to-end tests of the velocity chart (#24) in a real browser, following the test cases the PO approved in the
 * issue. The clock is fixed to Tuesday 13 October 2026. The demo data is changed as in the test cases: the completed
 * sprints "Sprint 1" to "Sprint <n>" come first with the planned and done points of the issue, the running sprint
 * of the demo becomes "Sprint 7" with 24 points, the planned one "Sprint 8" with 30 points.
 */

/** Planned at the start / done, with the points that joined, for the six sprints of the test cases. */
const SIX: Array<[number, number, number]> = [
  [18, 12, 0],
  [22, 19, 0],
  [25, 17, 0],
  [20, 22, 5],
  [24, 20, 0],
  [26, 22, 0]
];

async function openWith(page: Page, sprints: Array<[number, number, number]>, hash = '#/backlog'): Promise<void> {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
  await page.goto('/#/board');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate((done) => {
    const key = 'getitdone.snapshot.v1';
    const snapshot = JSON.parse(window.localStorage.getItem(key) ?? '{}');
    const day = (offset: number): string => new Date(Date.UTC(2026, 9, 13) + offset * 86400000).toISOString().slice(0, 10);
    const completed = done.map(([planned, finished, added], index) => ({
      id: `done-${index + 1}`,
      name: `Sprint ${index + 1}`,
      startDate: day(-14 * (done.length - index) - 14),
      endDate: day(-14 * (done.length - index) - 1),
      state: 'completed',
      startItems: [],
      result: {
        completedOn: day(-14 * (done.length - index) - 1),
        plannedPoints: planned,
        plannedStories: 3,
        donePoints: finished,
        doneStories: 3,
        notDonePoints: 0,
        notDoneStories: 0,
        addedStories: added > 0 ? 2 : 0,
        addedPoints: added,
        removedStories: 0,
        removedPoints: 0,
        changedPoints: 0
      }
    }));
    snapshot.stories = snapshot.stories.map((story: { id: string; points: number; sprintId: string | null }) =>
      story.id === 'story-1' ? { ...story, points: 4 } : story.id === 'story-7' ? { ...story, points: 30, sprintId: 'sprint-2' } : story
    );
    const running = snapshot.stories.filter((story: { sprintId: string | null }) => story.sprintId === 'sprint-1');
    snapshot.sprints = [
      ...completed,
      ...snapshot.sprints.map((sprint: { id: string }) =>
        sprint.id === 'sprint-1'
          ? { ...sprint, name: 'Sprint 7', startItems: running.map((story: { id: string; code: string; points: number }) => ({ storyId: story.id, code: story.code, points: story.points })) }
          : sprint.id === 'sprint-2'
            ? { ...sprint, name: 'Sprint 8' }
            : sprint
      )
    ];
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  }, sprints);
  await page.goto(`/${hash}`);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

const panel = (page: Page): Locator => page.getByRole('region', { name: 'Velocity' });
const sprintBars = (page: Page): Locator => panel(page).locator('[data-sprint-id]');
const tip = (page: Page): Locator => panel(page).getByRole('tooltip');

test('AC1.1 shows two bars with numbers per sprint, in order, with a legend', async ({ page }) => {
  // Given six completed sprints
  await openWith(page, SIX);
  // When I open the backlog
  // Then "Velocity" shows planned and done per sprint, Sprint 1 to 6, with a legend
  await expect(sprintBars(page)).toHaveCount(6);
  await expect(sprintBars(page).nth(0)).toHaveAttribute('aria-label', 'Sprint 1: 18 / 12');
  await expect(sprintBars(page).nth(5)).toHaveAttribute('aria-label', 'Sprint 6: 26 / 22');
  await expect(sprintBars(page).nth(0).locator('text.velocity-chart__value')).toHaveText(['18', '12']);
  await expect(panel(page).locator('.velocity__legend')).toHaveText(/Planned.*Done.*Average/);
  await expect(panel(page).locator('svg')).toHaveScreenshot('velocity-chart.png', { maxDiffPixelRatio: 0.08 });
});

test('AC1.2 draws the done bar of Sprint 4 higher than its planned bar', async ({ page }) => {
  // Given Sprint 4 planned 20 and completed 22
  await openWith(page, SIX);
  // When I look at Sprint 4
  const sprint = panel(page).locator('[data-sprint-id="done-4"]');
  // Then the done bar is higher than the planned bar
  const planned = await sprint.locator('.velocity-chart__planned').boundingBox();
  const done = await sprint.locator('.velocity-chart__done').boundingBox();
  expect(done!.height).toBeGreaterThan(planned!.height);
});

test('AC1.3 shows the last 8 of 10 sprints and the older ones after "Older sprints"', async ({ page }) => {
  // Given 10 completed sprints
  await openWith(page, Array.from({ length: 10 }, () => [20, 20, 0] as [number, number, number]));
  // Then Sprint 3 to 10 are shown
  await expect(sprintBars(page)).toHaveCount(8);
  await expect(sprintBars(page).first()).toHaveAttribute('aria-label', /^Sprint 3:/);
  // When I press "Older sprints"
  await panel(page).getByRole('button', { name: /Older sprints/ }).click();
  // Then Sprint 1 and 2 are there too
  await expect(sprintBars(page)).toHaveCount(10);
  await expect(sprintBars(page).first()).toHaveAttribute('aria-label', /^Sprint 1:/);
});

test('AC1.4 stays folded after a reload and shows the average in its head', async ({ page }) => {
  // Given the panel is open
  await openWith(page, SIX);
  const toggle = panel(page).getByRole('button', { name: 'Velocity' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  // When I fold it and reload the app
  await toggle.click();
  await expect(sprintBars(page).first()).toBeHidden();
  await page.reload();
  // Then it is still folded, the head shows the average, and I can open it again
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(sprintBars(page).first()).toBeHidden();
  await expect(panel(page)).toContainText('Ø 21 points · last 3 sprints');
  await toggle.click();
  await expect(sprintBars(page).first()).toBeVisible();
});

test('AC1.5 shows the details of Sprint 4 on hover and on keyboard focus', async ({ page }) => {
  // Given Sprint 4 got 2 stories with 5 points during the sprint
  await openWith(page, SIX);
  const sprint = panel(page).locator('[data-sprint-id="done-4"]');
  // When I move the mouse over Sprint 4
  await sprint.hover();
  // Then the name, the dates, planned, done with share and the added points are shown
  await expect(tip(page)).toContainText('Sprint 4');
  await expect(tip(page)).toContainText('Planned at start 20 · Done 22 (110 %)');
  await expect(tip(page)).toContainText('+2 stories, +5 points added');
  // When I leave and go to Sprint 4 with the Tab key instead
  await page.mouse.move(5, 5);
  await expect(tip(page)).toHaveCount(0);
  await panel(page).locator('[data-sprint-id="done-3"]').focus();
  await page.keyboard.press('Tab');
  // Then I see the same
  await expect(sprint).toBeFocused();
  await expect(tip(page)).toContainText('Planned at start 20 · Done 22 (110 %)');
  await expect(tip(page)).toContainText('+2 stories, +5 points added');
});

test('AC1.6 adds Sprint 7 to the chart after I complete it', async ({ page }) => {
  // Given Sprint 7 runs with 24 points and S-5 (3 points) is done
  await openWith(page, SIX, '#/board');
  await expect(page.getByRole('heading', { name: 'Sprint 7', level: 1 })).toBeVisible();
  // When I complete Sprint 7
  await page.getByRole('button', { name: 'Complete sprint' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Complete sprint' }).click();
  await page.getByRole('link', { name: 'Backlog' }).click();
  // Then Sprint 7 is in the chart with the points of the start and the done ones
  await expect(sprintBars(page)).toHaveCount(7);
  await expect(sprintBars(page).last()).toHaveAttribute('aria-label', 'Sprint 7: 24 / 3');
});

test('AC2.1 labels the dashed average line "Ø 21 (last 3)"', async ({ page }) => {
  await openWith(page, SIX);
  await expect(panel(page).locator('.velocity-chart__average-label')).toHaveText('Ø 21 (last 3)');
  await expect(panel(page)).toContainText('Ø 21 points · last 3 sprints');
});

test('AC3.5 changes the planned points of Sprint 8 when I drag a story into it', async ({ page }) => {
  // Given Sprint 8 has 30 points and shows "30 planned · Ø 21" (the window is tall enough for the whole backlog)
  await page.setViewportSize({ width: 1600, height: 1600 });
  await openWith(page, SIX);
  const sprint8 = page.getByRole('region', { name: 'Sprint 8' });
  await expect(sprint8.getByTestId('sprint-plan')).toHaveText('30 planned · Ø 21');
  // When I drag S-6 (5 points) from Sprint 7 into Sprint 8 with the mouse
  const row = page.getByRole('group', { name: /S-6: / });
  const target = sprint8.getByRole('group', { name: /S-7: / });
  const a = (await row.boundingBox())!;
  const b = (await target.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 });
  await page.mouse.up();
  // Then Sprint 8 shows "35 planned · Ø 21"
  await expect(sprint8.getByTestId('sprint-plan')).toHaveText('35 planned · Ø 21');
});

test('AC4.1 explains why there is no chart while no sprint is completed', async ({ page }) => {
  await openWith(page, []);
  await expect(panel(page)).toContainText('No sprint completed yet');
  await expect(panel(page)).toContainText('As soon as you complete a sprint on the board, you see here how many points were planned and done.');
  await expect(panel(page).locator('svg')).toHaveCount(0);
  await expect(panel(page)).not.toContainText('Ø');
});

test('AC5.1 switches to a table with the newest sprint first and the average below', async ({ page }) => {
  // Given the six sprints
  await openWith(page, SIX);
  // When I press "Table"
  await panel(page).getByRole('button', { name: 'Table' }).click();
  // Then the chart is gone and the table lists all six, newest first, with Sprint 4 as in the test case
  await expect(panel(page).locator('svg')).toHaveCount(0);
  const table = panel(page).getByRole('table');
  await expect(table.locator('tbody tr')).toHaveCount(6);
  await expect(table.locator('tbody tr').first().locator('th')).toHaveText('Sprint 6');
  await expect(table.locator('tbody tr').nth(2).locator('td').filter({ hasText: /^(20|\+5|22|110 %)$/ })).toHaveText(['20', '+5', '22', '110 %']);
  await expect(table.locator('tfoot')).toContainText('Ø of the last 3 sprints: 21');
  expect((await table.boundingBox())!.width).toBeGreaterThan(300);
});

test('AC5.3 keeps the table for screen readers while the chart is shown', async ({ page }) => {
  await openWith(page, SIX);
  await expect(panel(page).getByRole('group', { name: /^Velocity chart:/ })).toBeVisible();
  await expect(panel(page).getByRole('table', { name: 'Velocity per completed sprint' }).locator('tbody tr')).toHaveCount(6);
  await expect(panel(page).getByTestId('velocity-table')).toHaveClass(/sr-only/);
});

test('AC6.1 shows the panel in German, French and Italian', async ({ page }) => {
  await openWith(page, SIX);
  for (const [language, title, older] of [
    ['de', 'Velocity', 'Tabelle'],
    ['fr', 'Vélocité', 'Tableau'],
    ['it', 'Velocity', 'Tabella']
  ]) {
    await page.getByRole('combobox', { name: /^(Language|Sprache|Langue|Lingua)$/ }).selectOption(language);
    await expect(page.getByRole('region', { name: title, exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: title, exact: true }).getByRole('button', { name: older })).toBeVisible();
  }
});

test('AC6.2 works with the keyboard only', async ({ page }) => {
  await openWith(page, SIX);
  // When I fold and open the panel with Enter, switch to the table and back with the keyboard
  const toggle = panel(page).getByRole('button', { name: 'Velocity' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await panel(page).getByRole('button', { name: 'Table' }).focus();
  await page.keyboard.press('Enter');
  await expect(panel(page).getByRole('table').locator('tbody tr')).toHaveCount(6);
  await panel(page).getByRole('button', { name: 'Chart' }).focus();
  await page.keyboard.press('Space');
  // Then the sprints can be reached with Tab and the focus is visible
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(sprintBars(page).first()).toBeFocused();
  await expect(sprintBars(page).first().locator('.velocity-chart__hit')).toHaveCSS('stroke', /rgb/);
});
