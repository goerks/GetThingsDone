import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * End-to-end tests of the test builder (#37) in a real browser, following the test cases in the issue: starting from
 * fresh demo data (the page loads again), dragging a card with the mouse, a reload during a recording, the layout next
 * to the bar, and the text that is copied for the AI. Every test starts from the demo data of a fresh browser on
 * Tuesday 13 October 2026: "To do" has S-3 and S-6, "In progress" S-1 and S-4, "Review" S-2 and "Done" S-5.
 */

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
  await page.goto('/?acceptance=1#/board');
  await expect(page.getByRole('heading', { name: 'Sprint 1', level: 1 })).toBeVisible();
});

const bar = (page: Page): Locator => page.getByRole('complementary', { name: 'Test builder' });
const card = (page: Page, code: string): Locator => page.getByRole('group', { name: new RegExp(`^${code}: `) });
const column = (page: Page, name: string): Locator => page.getByRole('region', { name, exact: true });
const steps = (page: Page): Locator => bar(page).getByRole('list', { name: 'Steps of the test' }).getByRole('listitem').filter({ hasText: /\S/ });

/** The way in is the round button of the acceptance and its tab "Neuer Test". */
async function openBuilder(page: Page): Promise<void> {
  if (await bar(page).isVisible()) return;
  const popup = page.getByRole('complementary', { name: 'Abnahme', exact: true });
  if (!(await popup.isVisible())) await page.locator('.acceptance__toggle').click();
  await popup.getByRole('tab', { name: /Neuer Test/ }).click();
  await expect(bar(page)).toBeVisible();
}

async function startTest(page: Page, name: string, requirement = 'AC2.1'): Promise<void> {
  await openBuilder(page);
  await bar(page).getByRole('button', { name: 'Build a new test' }).click();
  await bar(page).getByRole('textbox', { name: 'Name of the test' }).fill(name);
  await bar(page).getByRole('textbox', { name: 'Requirement (optional)' }).fill(requirement);
  await bar(page).getByRole('button', { name: 'Start recording' }).click();
  await expect(bar(page).getByRole('heading', { name })).toBeVisible();
}

/** Drags with the mouse in small steps, as a person would. */
async function drag(page: Page, from: Locator, to: Locator): Promise<void> {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  if (!a || !b) throw new Error('drag source or target is not visible');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height - 20, { steps: 15 });
  await page.mouse.up();
}

test('AC1.1 starts from fresh demo data: the page loads again and the recording goes on', async ({ page }) => {
  // Given I changed the demo data: S-3 is in "Done"
  await drag(page, card(page, 'S-3'), column(page, 'Done'));
  await expect(column(page, 'Done').getByRole('group', { name: /^S-3: / })).toBeVisible();
  // When I start a test with fresh demo data
  await startTest(page, 'Move a story');
  // Then the page was loaded again: S-3 is back in "To do", and the recording is still running with its first step
  await expect(column(page, 'To do').getByRole('group', { name: /^S-3: / })).toBeVisible();
  await expect(bar(page).getByRole('heading', { name: 'Move a story' })).toBeVisible();
  await expect(steps(page)).toHaveText([/I open the page “Board”\./]);
});

test('AC2.1 puts the bar at the right edge and makes the board narrower so that nothing is covered', async ({ page }) => {
  const before = await column(page, 'Done').boundingBox();
  await startTest(page, 'Layout');
  const barBox = await bar(page).boundingBox();
  const lastColumn = await column(page, 'Done').boundingBox();
  if (!before || !barBox || !lastColumn) throw new Error('missing box');
  // The bar sits at the right edge over the full height below the header
  expect(barBox.x + barBox.width).toBeGreaterThanOrEqual(1599);
  expect(barBox.width).toBeGreaterThan(280);
  // The last column ends before the bar begins, and the board is narrower than before
  expect(lastColumn.x + lastColumn.width).toBeLessThanOrEqual(barBox.x);
  expect(lastColumn.x + lastColumn.width).toBeLessThan(before.x + before.width);
  // The bar stays in place when the page scrolls
  await page.mouse.wheel(0, 2000);
  expect((await bar(page).boundingBox())?.y).toBe(barBox.y);
});

test('AC2.4 puts the bar at the bottom on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openBuilder(page);
  const box = await bar(page).boundingBox();
  if (!box) throw new Error('no bar');
  expect(box.x).toBe(0);
  expect(box.width).toBeGreaterThanOrEqual(389);
  expect(box.y).toBeGreaterThan(300);
  expect(box.y + box.height).toBeGreaterThanOrEqual(799);
});

test('AC3.2 records a card dragged with the mouse with the column it landed in', async ({ page }) => {
  await startTest(page, 'Move a story');
  // When I drag S-3 into "Done"
  await drag(page, card(page, 'S-3'), column(page, 'Done'));
  // Then the step names the card and the column, and the drag is the only step besides opening the page
  await expect(column(page, 'Done').getByRole('group', { name: /^S-3: / })).toBeVisible();
  await expect(steps(page)).toHaveCount(2);
  await expect(steps(page).nth(1)).toContainText(/I drag “S-3: .*” to “Done.*”\./);
});

test('AC4.1 to AC4.4 builds a test by clicking, points at the result and saves it', async ({ page }) => {
  // Given a running recording
  await startTest(page, 'Move a story');
  // When I drag S-3 into "Done", point at the card in "Done" and choose a sentence
  await drag(page, card(page, 'S-3'), column(page, 'Done'));
  await expect(steps(page)).toHaveCount(2);
  await bar(page).getByRole('button', { name: 'Point at the result' }).click();
  await column(page, 'Done').getByRole('group', { name: /^S-3: / }).click();
  const suggestion = bar(page).getByRole('button', { name: /^I see “S-3: .*” in “Done.*”\.$/ });
  await expect(suggestion).toBeVisible();
  await suggestion.click();
  // Then the story is still where it is, and no step was added by the pointing
  await expect(steps(page)).toHaveCount(2);
  await expect(bar(page).getByRole('list', { name: 'Expected results' })).toContainText('I see “S-3: ');
  // And when I finish, the test is in the list
  await bar(page).getByRole('button', { name: 'Finish test' }).click();
  await expect(bar(page).getByRole('heading', { name: 'My tests (1)' })).toBeVisible();
  await expect(bar(page).getByText('AC2.1 · 2 steps')).toBeVisible();
});

test('AC7.1 keeps the saved tests and writes a reload during a recording as a step', async ({ page }) => {
  // Given a saved test and a running recording
  await startTest(page, 'First');
  await bar(page).getByRole('textbox', { name: 'Or write your own sentence' }).fill('It works.');
  await bar(page).getByRole('button', { name: 'Add', exact: true }).click();
  await bar(page).getByRole('button', { name: 'Finish test' }).click();
  await startTest(page, 'Second', '');
  // When I reload the page
  await page.reload();
  // Then the recording is still there, the reload is a step, and the saved test is in the list
  await expect(bar(page).getByRole('heading', { name: 'Second' })).toBeVisible();
  await expect(steps(page)).toHaveText([/I open the page “Board”\./, /I reload the app\./]);
  await bar(page).getByRole('button', { name: 'Fold the bar away' }).click();
  await page.getByRole('button', { name: 'Open the test builder' }).click();
  await bar(page).getByRole('button', { name: 'Discard test' }).click();
  await bar(page).getByRole('button', { name: 'Yes, discard' }).click();
  await expect(bar(page).getByText('First', { exact: true })).toBeVisible();
});

test('AC8.1 copies everything as one text that starts with the note for the AI and lists the tests', async ({ page }) => {
  // Given two saved tests
  for (const name of ['Move a story', 'Create a story']) {
    await startTest(page, name);
    await bar(page).getByRole('textbox', { name: 'Or write your own sentence' }).fill(`${name}: it works.`);
    await bar(page).getByRole('button', { name: 'Add', exact: true }).click();
    await bar(page).getByRole('button', { name: 'Finish test' }).click();
  }
  // When I copy everything
  await bar(page).getByRole('button', { name: 'Copy result' }).click();
  await expect(bar(page).getByRole('status').filter({ hasText: 'Copied. Paste it to the AI.' })).toHaveCount(1);
  // Then the clipboard holds one text with the context and both tests
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.startsWith('# Feedback aus der Vorschau von Get It Done')).toBe(true);
  expect(text).toContain('Hinweis für die KI:');
  expect(text).toContain('- Fensterbreite: 1600 px');
  expect(text).toContain('- Datum: 2026-10-13 10:00');
  expect(text).toContain('## Neue Tests (2)');
  expect(text).toContain('### 1. Move a story');
  expect(text).toContain('### 2. Create a story');
  expect(text).toContain('- Ausgangslage: Frische Demo-Daten, Seite «Board»');
  expect(text).toContain('  - Move a story: it works.');
});

test('AC9.2 shows "Show me" for the round button in the help', async ({ page }) => {
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search help' }).fill('record');
  await page.getByRole('complementary', { name: 'Help' }).getByRole('button', { name: /Record a test/ }).click();
  await page.getByRole('button', { name: 'Show me' }).click();
  await expect(page.locator('.acceptance__toggle')).toHaveAttribute('data-help-highlight', 'true');
});

test('AC1.5 puts the way in at the round button at the bottom, not in the header', async ({ page }) => {
  // Given the preview with the acceptance button
  await expect(page.getByRole('banner').getByRole('button', { name: 'Record test' })).toHaveCount(0);
  // When I open the tab "Neuer Test" of the popup
  await openBuilder(page);
  // Then the builder is on the right edge, the popup and its round button stay at the bottom left
  const toggle = await page.locator('.acceptance__toggle').boundingBox();
  const barBox = await bar(page).boundingBox();
  if (!toggle || !barBox) throw new Error('missing box');
  expect(toggle.x).toBeLessThan(100);
  expect(toggle.y).toBeGreaterThan(800);
  expect(barBox.x).toBeGreaterThan(1200);
});

test('AC2.5 keeps the acceptance popup clear of the builder bar when it moves to the right', async ({ page }) => {
  // Given the builder is open
  await openBuilder(page);
  const popup = page.getByRole('complementary', { name: 'Abnahme', exact: true });
  await popup.getByRole('tab', { name: 'Abnahme' }).click();
  // When I jump to AC1.1 from the list: it lights up the card S-3 in the left column
  await popup.getByRole('button', { name: 'Alle Punkte anzeigen' }).click();
  await popup.locator('[data-case="AC1.1"] .acceptance__row').click();
  // Then the popup moves to the right side, next to the bar and not over it
  await expect(page.locator('.acceptance')).toHaveClass(/acceptance--right/);
  const popupBox = await popup.boundingBox();
  const barBox = await bar(page).boundingBox();
  if (!popupBox || !barBox) throw new Error('missing box');
  expect(popupBox.x + popupBox.width).toBeLessThanOrEqual(barBox.x);
});

test('AC8.6 copies the acceptance and the new tests as one text', async ({ page }) => {
  // Given a problem noted in the acceptance and a saved test
  const popup = page.getByRole('complementary', { name: 'Abnahme', exact: true });
  await page.locator('.acceptance__toggle').click();
  await popup.getByRole('button', { name: /Problem/ }).click();
  await popup.getByRole('textbox', { name: /^Kommentar zu / }).fill('Der Knopf fehlt');
  await startTest(page, 'Move a story');
  await bar(page).getByRole('textbox', { name: 'Or write your own sentence' }).fill('It works.');
  await bar(page).getByRole('button', { name: 'Add', exact: true }).click();
  await bar(page).getByRole('button', { name: 'Finish test' }).click();
  // When I copy from the popup (it closed when the page loaded again for the fresh demo data)
  await page.locator('.acceptance__toggle').click();
  await popup.getByRole('tab', { name: /Neuer Test/ }).click();
  await popup.getByRole('button', { name: 'Ergebnis kopieren' }).click();
  // Then the text has the result of the acceptance first and the new test after it
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.indexOf('## Abnahme')).toBeGreaterThan(0);
  expect(text.indexOf('## Abnahme')).toBeLessThan(text.indexOf('## Neue Tests (1)'));
  expect(text).toContain('Der Knopf fehlt');
  expect(text).toContain('### 1. Move a story');
});
