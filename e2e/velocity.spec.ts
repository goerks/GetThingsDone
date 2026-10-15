import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * End-to-end tests of the velocity window at the board (#24) in a real browser, following the test cases the PO
 * approved in the issue. The clock is fixed to Tuesday 13 October 2026. Where a test case needs other figures than
 * the demo data, the demo data is changed as in the test cases: the completed sprints "Sprint 1" to "Sprint <n>" come
 * first with the planned and done points of the issue, the running sprint of the demo becomes "Sprint 7" with 24 points,
 * the planned one "Sprint 8" with 30 points.
 */

/** Planned at the start / done / points that joined, for the six sprints of the test cases. */
const SIX: Array<[number, number, number]> = [
  [18, 12, 0],
  [22, 19, 0],
  [25, 17, 0],
  [20, 22, 5],
  [24, 20, 0],
  [26, 22, 0]
];

/** Opens the app with the demo data as it is (`sprints` undefined) or with the completed sprints of the test cases. */
async function openWith(page: Page, sprints: Array<[number, number, number]> | undefined, hash = '#/board'): Promise<void> {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
  await page.goto('/#/board');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  if (sprints) {
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
        ...snapshot.sprints
          .filter((sprint: { state: string }) => sprint.state !== 'completed')
          .map((sprint: { id: string }) =>
            sprint.id === 'sprint-1'
              ? { ...sprint, name: 'Sprint 7', startItems: running.map((story: { id: string; code: string; points: number }) => ({ storyId: story.id, code: story.code, points: story.points })) }
              : sprint.id === 'sprint-2'
                ? { ...sprint, name: 'Sprint 8' }
                : sprint
          )
      ];
      window.localStorage.setItem(key, JSON.stringify(snapshot));
    }, sprints);
  }
  await page.goto(`/${hash}`);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

const button = (page: Page): Locator => page.getByRole('button', { name: /^Velocity/ });
const panel = (page: Page): Locator => page.getByRole('region', { name: 'Velocity' });
const sprintBars = (page: Page): Locator => panel(page).locator('[data-sprint-id]');
const tip = (page: Page): Locator => panel(page).getByRole('tooltip');
/** Opens the window of the Velocity button at the board. */
async function openVelocity(page: Page): Promise<void> {
  await button(page).click();
  await expect(panel(page)).toBeVisible();
}

test('AC1.1 shows one combined bar with numbers per sprint, in order, with a legend', async ({ page }) => {
  // Given six completed sprints
  await openWith(page, SIX);
  // When I open the Velocity window at the board
  await openVelocity(page);
  // Then it shows planned and done per sprint, Sprint 1 to 6, with a legend
  await expect(sprintBars(page)).toHaveCount(6);
  await expect(sprintBars(page).nth(0)).toHaveAttribute('aria-label', 'Sprint 1: 18 / 12');
  await expect(sprintBars(page).nth(5)).toHaveAttribute('aria-label', 'Sprint 6: 26 / 22');
  await expect(sprintBars(page).nth(0).locator('text.velocity-chart__value')).toHaveText(['18', '12']);
  await expect(panel(page).locator('.velocity__legend')).toHaveText(/Planned.*Done.*Average/);
  await expect(panel(page).locator('svg.velocity-chart')).toHaveScreenshot('velocity-chart.png', { maxDiffPixelRatio: 0.08 });
});

test('AC1.2 lets the done part of Sprint 4 reach above its planned frame', async ({ page }) => {
  // Given Sprint 4 planned 20 and completed 22
  await openWith(page, SIX);
  await openVelocity(page);
  // When I look at Sprint 4
  const sprint = panel(page).locator('[data-sprint-id="done-4"]');
  // Then the blue done part reaches above the frame of the planned points
  const planned = await sprint.locator('.velocity-chart__planned').boundingBox();
  const done = await sprint.locator('.velocity-chart__done').boundingBox();
  expect(done!.y).toBeLessThan(planned!.y);
});

test('AC1.3 shows the last 8 of 10 sprints and the older ones after "Older sprints"', async ({ page }) => {
  // Given 10 completed sprints
  await openWith(page, Array.from({ length: 10 }, () => [20, 20, 0] as [number, number, number]));
  await openVelocity(page);
  // Then Sprint 3 to 10 are shown
  await expect(sprintBars(page)).toHaveCount(8);
  await expect(sprintBars(page).first()).toHaveAttribute('aria-label', /^Sprint 3:/);
  // When I press "Older sprints"
  await panel(page).getByRole('button', { name: /Older sprints/ }).click();
  // Then Sprint 1 and 2 are there too
  await expect(sprintBars(page)).toHaveCount(10);
  await expect(sprintBars(page).first()).toHaveAttribute('aria-label', /^Sprint 1:/);
});

test('AC1.4 opens and closes with the button, Esc and a click next to the window, and the button shows the average', async ({ page }) => {
  // Given the board with six completed sprints: the button shows the average, the window is closed
  await openWith(page, SIX);
  await expect(button(page)).toHaveText('Velocity · Ø 21');
  await expect(panel(page)).toHaveCount(0);
  // When I open it, the head shows the average, and the button closes it again
  await openVelocity(page);
  await expect(panel(page)).toContainText('Ø 21 points · last 3 sprints');
  await button(page).click();
  await expect(panel(page)).toHaveCount(0);
  // And Esc and a click next to the window close it as well
  await openVelocity(page);
  await page.keyboard.press('Escape');
  await expect(panel(page)).toHaveCount(0);
  await expect(button(page)).toBeFocused();
  await openVelocity(page);
  await page.getByRole('heading', { level: 1 }).click();
  await expect(panel(page)).toHaveCount(0);
});

test('AC1.5 shows the details of Sprint 4 on hover and on keyboard focus', async ({ page }) => {
  // Given Sprint 4 got 2 stories with 5 points during the sprint
  await openWith(page, SIX);
  await openVelocity(page);
  const sprint = panel(page).locator('[data-sprint-id="done-4"]');
  // When I move the mouse over Sprint 4
  await sprint.hover();
  // Then the name, the dates, planned, done with share and the added points are shown
  await expect(tip(page)).toContainText('Sprint 4');
  await expect(tip(page)).toContainText('Planned at start 20 · Done 22 (110 %)');
  await expect(tip(page)).toContainText('+2 stories, +5 points added');
  // When I leave and go to Sprint 4 with the Tab key instead
  await panel(page).getByRole('heading', { name: 'Velocity' }).hover();
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
  await openWith(page, SIX);
  await expect(page.getByRole('heading', { name: 'Sprint 7', level: 1 })).toBeVisible();
  // When I complete Sprint 7
  await page.getByRole('button', { name: 'Complete sprint' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Complete sprint' }).click();
  // Then Sprint 7 is in the chart with the points of the start and the done ones
  await openVelocity(page);
  await expect(sprintBars(page)).toHaveCount(7);
  await expect(sprintBars(page).last()).toHaveAttribute('aria-label', 'Sprint 7: 24 / 3');
});

test('AC1.8 does not make the page scroll when the window opens, also in a low browser window', async ({ page }) => {
  // Given the board with ten completed sprints in a low browser window
  await page.setViewportSize({ width: 1400, height: 640 });
  await openWith(page, Array.from({ length: 10 }, () => [20, 20, 0] as [number, number, number]));
  const height = (): Promise<number> => page.evaluate(() => document.documentElement.scrollHeight);
  const before = await height();
  // When I open the Velocity window
  await openVelocity(page);
  // Then the page is not higher than before, and the window stays inside the browser window and scrolls inside itself
  expect(await height()).toBe(before);
  const box = (await panel(page).boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(640);
  await expect(panel(page).getByRole('table')).toBeAttached();
});

test('AC2.1 labels the dashed average line "Ø 21 (last 3)"', async ({ page }) => {
  await openWith(page, SIX);
  await openVelocity(page);
  await expect(panel(page).locator('.velocity-chart__average-label')).toHaveText('Ø 21 (last 3)');
  await expect(panel(page)).toContainText('Ø 21 points · last 3 sprints');
});

test('AC3.5 changes the planned points of Sprint 8 when I drag a story into it', async ({ page }) => {
  // Given Sprint 8 has 30 points and shows "30 planned · Ø 21" (the window is tall enough for the whole backlog)
  await page.setViewportSize({ width: 1600, height: 1600 });
  await openWith(page, SIX, '#/backlog');
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
  await expect(button(page)).toHaveText('Velocity');
  await openVelocity(page);
  await expect(panel(page)).toContainText('No sprint completed yet');
  await expect(panel(page)).toContainText('As soon as you complete a sprint on the board, you see here how many points were planned and done.');
  await expect(panel(page).locator('svg')).toHaveCount(0);
  await expect(panel(page)).not.toContainText('Ø');
});

test('AC5.1 shows the table together with the chart, newest sprint first, with the average below', async ({ page }) => {
  // Given the six sprints
  await openWith(page, SIX);
  // When I open the window
  await openVelocity(page);
  // Then the chart and the table are both visible, the table lists all six, newest first, with Sprint 4 as in the test case
  await expect(panel(page).locator('svg.velocity-chart')).toBeVisible();
  const table = panel(page).getByRole('table');
  await expect(table).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(6);
  await expect(table.locator('tbody tr').first().locator('th')).toHaveText('Sprint 6');
  await expect(table.locator('tbody tr').nth(2).locator('td').filter({ hasText: /^(20|\+5|22|110 %)$/ })).toHaveText(['20', '+5', '22', '110 %']);
  await expect(table.locator('tfoot')).toContainText('Ø of the last 3 sprints: 21');
  await expect(panel(page).getByRole('button', { name: 'Table' })).toHaveCount(0);
});

test('AC5.3 describes the chart for screen readers', async ({ page }) => {
  await openWith(page, SIX);
  await openVelocity(page);
  await expect(panel(page).getByRole('group', { name: /^Velocity chart:/ })).toBeVisible();
  await expect(panel(page).getByRole('table', { name: 'Velocity per completed sprint' }).locator('tbody tr')).toHaveCount(6);
});

test('AC6.1 shows the button and the window in German, French and Italian', async ({ page }) => {
  await openWith(page, SIX);
  for (const [language, label, older] of [
    ['de', 'Velocity · Ø 21', 'Schliessen'],
    ['fr', 'Vélocité · Ø 21', 'Fermer'],
    ['it', 'Velocity · Ø 21', 'Chiudi']
  ]) {
    await page.getByRole('combobox', { name: /^(Language|Sprache|Langue|Lingua)$/ }).selectOption(language);
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.getByRole('region', { name: /^(Velocity|Vélocité)$/ }).getByRole('button', { name: older })).toBeVisible();
    await page.keyboard.press('Escape');
  }
});

test('AC6.2 works with the keyboard only', async ({ page }) => {
  await openWith(page, SIX);
  // When I open the window with Enter
  await button(page).focus();
  await page.keyboard.press('Enter');
  await expect(panel(page)).toBeVisible();
  // Then the sprints can be reached with Tab and the focus is visible
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(sprintBars(page).first()).toBeFocused();
  await expect(sprintBars(page).first().locator('.velocity-chart__hit')).toHaveCSS('stroke', /rgb/);
  // And Esc closes it, with the focus back on the button
  await page.keyboard.press('Escape');
  await expect(panel(page)).toHaveCount(0);
  await expect(button(page)).toBeFocused();
});

test('AC7.1 loads the test data from the acceptance panel and keeps it after the reload', async ({ page }) => {
  // Given the demo data of the preview, in which no sprint is completed
  await openWith(page, undefined);
  await expect(button(page)).toHaveText('Velocity');
  // When I open the acceptance panel and load the test data of the first step (after the question)
  page.once('dialog', (dialog) => void dialog.accept());
  await page.goto('/?acceptance=1#/board');
  await page.locator('.acceptance__toggle').click();
  const acceptance = page.getByRole('complementary', { name: 'Abnahme' });
  await expect(acceptance.getByText('Sprint 1 bis 6 abgeschlossen')).toBeVisible();
  await acceptance.getByRole('button', { name: 'Diese Testdaten laden' }).click();
  // Then the page has loaded again with the panel open, and the window shows the six completed sprints
  await expect(page.getByRole('heading', { name: 'Sprint 7', level: 1 })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Abnahme' })).toBeVisible();
  await expect(button(page)).toHaveText('Velocity · Ø 21');
  await openVelocity(page);
  await expect(sprintBars(page)).toHaveCount(6);
  // And the data is still there after another reload, and the running Sprint 7 can be completed
  await page.reload();
  await expect(button(page)).toHaveText('Velocity · Ø 21');
  await page.getByRole('button', { name: 'Complete sprint' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Complete sprint' }).click();
  await openVelocity(page);
  await expect(sprintBars(page)).toHaveCount(7);
});
