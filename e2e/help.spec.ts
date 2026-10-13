import { expect, test, type Locator, type Page } from '@playwright/test';
import { pressUntilAnnounced } from './keyboardDrag';

/*
 * End-to-end tests of the help (#33) in a real browser, following the test cases the PO approved in the issue:
 * the whole introduction ("first steps") from the invitation to the last step, and the help search.
 * Every test starts from the demo data of a fresh browser on Tuesday 13 October 2026: Sprint 1 is running;
 * "To do" has S-3 and S-6, "In progress" S-1 and S-4, "Review" S-2 and "Done" S-5.
 */

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
  await page.goto('/#/board');
  await expect(page.getByRole('heading', { name: 'Sprint 1', level: 1 })).toBeVisible();
});

const helpButton = (page: Page): Locator => page.getByRole('button', { name: 'Help', exact: true });
const panel = (page: Page): Locator => page.getByRole('complementary');
const column = (page: Page, name: string): Locator => page.getByRole('region', { name, exact: true });
const card = (page: Page, code: string): Locator => page.getByRole('group', { name: new RegExp(`^${code}: `) });
const announcement = (page: Page, text: string | RegExp): Locator => page.getByRole('status').filter({ hasText: text });
const progress = (page: Page, done: number): Locator => panel(page).getByText(`${done} of 4 done`);
const step = (page: Page, title: string): Locator => panel(page).getByRole('listitem').filter({ has: page.getByText(title, { exact: true }) });
const topics = (page: Page): Promise<string[]> => panel(page).locator('.help__item-title').allTextContents();

/** Picks a story card up with the space key and moves it one column to the right, like a screen reader user. */
async function moveRight(page: Page, code: string, from: string, to: string): Promise<void> {
  await card(page, code).focus();
  await page.keyboard.press('Space');
  await expect(announcement(page, new RegExp(`is over ${from}`))).toHaveCount(1);
  await pressUntilAnnounced(page, 'ArrowRight', announcement(page, new RegExp(`is over ${to}`)));
  await page.keyboard.press('Space');
  await expect(announcement(page, new RegExp(`dropped in ${to}\\.`))).toHaveCount(1);
}

test('AC8.1 invites to the first steps without blocking anything, and "No thanks" is remembered', async ({ page }) => {
  // Given a browser that opens the app for the first time
  // Then a small card invites to the introduction, and the board behind it can be used
  const invitation = page.getByRole('group', { name: 'Introduction' });
  await expect(invitation).toBeVisible();
  await expect(page.getByRole('button', { name: 'New story' })).toBeEnabled();
  await expect(card(page, 'S-3')).toBeVisible();

  // When I click "No thanks" and reload the app
  await invitation.getByRole('button', { name: 'No thanks' }).click();
  await expect(invitation).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sprint 1', level: 1 })).toBeVisible();

  // Then the card does not come back, and the first steps are still one click away from the help
  await expect(invitation).toHaveCount(0);
  await helpButton(page).click();
  await expect(panel(page).getByRole('button', { name: /First steps/ })).toBeVisible();
});

test('AC6.3 leads through all four first steps, ticks each one off by itself and keeps the progress over a reload', async ({ page }) => {
  // Given the invitation on the first start
  // When I start the introduction
  await page.getByRole('button', { name: 'Start introduction' }).click();

  // Then the help shows the first steps with 0 of 4 done, and the first step is the current one
  await expect(panel(page).getByRole('heading', { name: 'First steps', level: 3 })).toBeVisible();
  await expect(progress(page, 0)).toBeVisible();
  await expect(step(page, 'Get to know the board')).toHaveAttribute('aria-current', 'step');

  // When I confirm the first step
  await panel(page).getByRole('button', { name: 'Got it' }).click();

  // Then it is done and "Move a story" is the current step
  await expect(progress(page, 1)).toBeVisible();
  await expect(step(page, 'Get to know the board')).toContainText('done');
  await expect(step(page, 'Move a story')).toHaveAttribute('aria-current', 'step');

  // When I move S-3 from "To do" to "In progress" with the keyboard
  await moveRight(page, 'S-3', 'To do', 'In progress');

  // Then the step is ticked off by itself, the story is in the new column, and "Create a story" is current
  await expect(progress(page, 2)).toBeVisible();
  await expect(step(page, 'Move a story')).toContainText('done');
  await expect(column(page, 'In progress').getByRole('group', { name: /^S-3: / })).toBeVisible();
  await expect(step(page, 'Create a story')).toHaveAttribute('aria-current', 'step');

  // When I reload the app
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sprint 1', level: 1 })).toBeVisible();

  // Then the invitation is gone and the progress is still 2 of 4
  await expect(page.getByRole('group', { name: 'Introduction' })).toHaveCount(0);
  await helpButton(page).click();
  await expect(panel(page).getByRole('button', { name: /First steps/ })).toContainText('2 of 4');
  await panel(page).getByRole('button', { name: /First steps/ }).click();
  await expect(progress(page, 2)).toBeVisible();

  // When I create the story "Passwort vergessen" with the dialog
  await page.getByRole('button', { name: 'New story' }).click();
  await page.getByRole('dialog', { name: 'New story' }).getByLabel('Title').fill('Passwort vergessen');
  await page.getByRole('dialog', { name: 'New story' }).getByRole('button', { name: 'Add story' }).click();

  // Then the step is ticked off and the new story really exists
  await expect(progress(page, 3)).toBeVisible();
  await expect(step(page, 'Create a story')).toContainText('done');
  await expect(column(page, 'To do').getByRole('group', { name: /^S-8: Passwort vergessen/ })).toBeVisible();
  await expect(step(page, 'Order the backlog')).toHaveAttribute('aria-current', 'step');

  // When I go to the backlog and move S-2 one place down with the keyboard
  await page.getByRole('link', { name: 'Backlog', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Backlog', level: 1 })).toBeVisible();
  await expect(panel(page)).toBeVisible();
  const row = page.getByRole('group', { name: /^Rank \d+, S-2: / });
  const rank = Number(/^Rank (\d+)/.exec((await row.getAttribute('aria-label')) ?? '')?.[1]);
  await row.focus();
  await page.keyboard.press('Space');
  await expect(announcement(page, /^Picked up /)).toHaveCount(1);
  await pressUntilAnnounced(page, 'ArrowDown', announcement(page, new RegExp(`would become rank ${rank + 1} `)));
  await page.keyboard.press('Space');
  await expect(announcement(page, new RegExp(`is now rank ${rank + 1}\\.`))).toHaveCount(1);

  // Then the last step is ticked off and the help says that all steps are through
  await expect(progress(page, 4)).toBeVisible();
  await expect(step(page, 'Order the backlog')).toContainText('done');
  await expect(panel(page).getByText('Well done: all steps are through.')).toBeVisible();
  await expect(page.getByRole('group', { name: new RegExp(`^Rank ${rank + 1}, S-2: `) })).toBeVisible();
});

test('AC6.4 can be left, skipped and continued: nothing is forced, and a skipped step stays skipped over a reload', async ({ page }) => {
  // Given the introduction was started
  await page.getByRole('button', { name: 'Start introduction' }).click();
  await panel(page).getByRole('button', { name: 'Got it' }).click();

  // When I skip "Move a story" and close the help to carry on alone
  await panel(page).getByRole('button', { name: 'Skip step' }).click();
  await expect(step(page, 'Move a story')).toContainText('skipped');
  await expect(step(page, 'Create a story')).toHaveAttribute('aria-current', 'step');
  await panel(page).getByRole('button', { name: 'Continue later' }).click();
  await expect(panel(page)).toHaveCount(0);

  // Then I can work on the board as usual, and S-3 is not moved by the skip
  await expect(column(page, 'To do').getByRole('group', { name: /^S-3: / })).toBeVisible();
  await moveRight(page, 'S-3', 'To do', 'In progress');

  // And when I come back, the skipped step is done now, because I did what it asked
  await page.reload();
  await page.keyboard.press('?');
  await panel(page).getByRole('button', { name: /First steps/ }).click();
  await expect(step(page, 'Move a story')).toContainText('done');
  await expect(progress(page, 2)).toBeVisible();
});

test('AC7.2 starts the introduction again after a confirmation', async ({ page }) => {
  // Given two steps are done
  await page.getByRole('button', { name: 'Start introduction' }).click();
  await panel(page).getByRole('button', { name: 'Got it' }).click();
  await moveRight(page, 'S-3', 'To do', 'In progress');
  await expect(progress(page, 2)).toBeVisible();

  // When I ask to start again and confirm
  await panel(page).getByRole('button', { name: 'Start again' }).click();
  await panel(page).getByRole('button', { name: 'Yes, start again' }).click();

  // Then it is 0 of 4 again, and S-3 stays where I put it
  await expect(progress(page, 0)).toBeVisible();
  await expect(column(page, 'In progress').getByRole('group', { name: /^S-3: / })).toBeVisible();
});

test('AC3.1 finds help topics while I type, shows where they match and opens one with the keyboard', async ({ page }) => {
  // Given the help on the board
  await page.getByRole('button', { name: 'No thanks' }).click();
  await helpButton(page).click();
  const field = panel(page).getByRole('searchbox', { name: 'Search help' });
  await expect(field).toBeFocused();

  // When I type "status"
  await field.fill('status');

  // Then the topic with the word in its title is first and the other topics that mention it follow
  expect((await topics(page))[0]).toBe('Columns and status values');
  await expect(panel(page).locator('mark').first()).toHaveText(/status/i);
  await expect(panel(page).getByRole('list', { name: 'Help topics found' })).toBeVisible();

  // When I search "SPRINT LINE", which belongs to the Backlog, from the board
  await field.fill('SPRINT LINE');

  // Then the topic of the backlog is found and says to which page it belongs
  const hit = panel(page).getByRole('button', { name: /^Backlog and the sprint line/ });
  await expect(hit).toContainText('On page: Backlog');

  // When I go from the field into the hits with the arrow key and press Enter
  await field.focus();
  await page.keyboard.press('ArrowDown');
  await expect(hit).toBeFocused();
  await page.keyboard.press('Enter');

  // Then the topic is open with its text and a link to the backlog, and the search stays when I go back
  await expect(panel(page).getByRole('heading', { name: 'Backlog and the sprint line', level: 3 })).toBeFocused();
  await expect(panel(page).getByRole('link', { name: 'Open Backlog' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(field).toHaveValue('SPRINT LINE');
  await expect(panel(page)).toBeVisible();
});

test('AC3.4 says so when nothing is found, and AC3.5 clears the search', async ({ page }) => {
  await page.getByRole('button', { name: 'No thanks' }).click();
  await helpButton(page).click();
  const field = panel(page).getByRole('searchbox', { name: 'Search help' });

  // When I search for something that is not in the help
  await field.fill('xyzxyz');

  // Then it says so, and offers all topics
  await expect(panel(page).getByRole('strong').filter({ hasText: 'No results for “xyzxyz”' })).toBeVisible();
  await expect(announcement(page, 'No results for “xyzxyz”').first()).toBeAttached();
  await panel(page).getByRole('button', { name: 'Show all topics' }).click();
  await expect(field).toHaveValue('');
  expect(await topics(page)).toContain('Order the backlog');

  // When I search again and clear the search with the cross
  await field.fill('story');
  await panel(page).getByRole('button', { name: 'Clear search' }).click();

  // Then the field is empty and focused
  await expect(field).toHaveValue('');
  await expect(field).toBeFocused();
});

test('AC3.7 searches in the language of the app', async ({ page }) => {
  await page.getByRole('button', { name: 'No thanks' }).click();

  // When I switch the app to German and search "verschieben"
  await page.getByRole('combobox', { name: 'Language' }).selectOption('de');
  await page.getByRole('button', { name: 'Hilfe', exact: true }).click();
  const field = panel(page).getByRole('searchbox', { name: 'Hilfe durchsuchen' });
  await field.fill('verschieben');

  // Then "Eine Story verschieben" is the first hit
  await expect(panel(page).getByRole('heading', { name: 'Hilfe · Board', level: 2 })).toBeVisible();
  expect((await topics(page))[0]).toBe('Eine Story verschieben');

  // When I search "TASTENKURZEL" without the umlaut
  await field.fill('TASTENKURZEL');

  // Then "Tastenkürzel" is found
  expect(await topics(page)).toEqual(['Tastenkürzel']);

  // When I switch to French
  await page.getByRole('combobox', { name: 'Sprache' }).selectOption('fr');
  await page.getByRole('searchbox', { name: "Rechercher dans l’aide" }).fill('deplacer');

  // Then "Déplacer une story" is found by the word without the accent
  expect((await topics(page))[0]).toBe('Déplacer une story');
});

test('AC5.1 shows the card a topic is about with a frame, and the frame ends with the next click', async ({ page }) => {
  await page.getByRole('button', { name: 'No thanks' }).click();
  await helpButton(page).click();

  // When I open "Move a story" and click "Show me"
  await panel(page).getByRole('button', { name: 'Move a story' }).click();
  await panel(page).getByRole('button', { name: 'Show me' }).click();

  // Then exactly one card has the frame, and nothing is dimmed
  const framed = page.locator('[data-help-highlight]');
  await expect(framed).toHaveCount(1);
  await expect(framed).toHaveAttribute('data-story-id', /.+/);
  expect(await framed.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid');
  await expect(page.locator('dialog[open]')).toHaveCount(0);

  // When I click on the page
  await page.getByRole('heading', { name: 'Sprint 1', level: 1 }).click();

  // Then the frame is gone
  await expect(framed).toHaveCount(0);
});

test('AC1.4 the help stays open while I drag a story with the mouse, and makes room instead of covering the board', async ({ page }) => {
  await page.getByRole('button', { name: 'No thanks' }).click();
  await helpButton(page).click();
  await expect(panel(page)).toBeVisible();

  // Then the last column of the board ends before the help starts
  const help = await panel(page).boundingBox();
  const last = await column(page, 'Done').boundingBox();
  expect(last && help && last.x + last.width).toBeLessThanOrEqual((help?.x ?? 0) + 1);

  // When I drag S-3 into "In progress" with the mouse
  const source = await card(page, 'S-3').boundingBox();
  const target = await column(page, 'In progress').boundingBox();
  if (!source || !target) throw new Error('board not laid out');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 10, source.y + source.height / 2, { steps: 3 });
  await page.mouse.move(target.x + target.width / 2, target.y + target.height - 20, { steps: 15 });
  await page.mouse.up();

  // Then the story is in the new column and the help is still open
  await expect(column(page, 'In progress').getByRole('group', { name: /^S-3: / })).toBeVisible();
  await expect(panel(page)).toBeVisible();
});

test('AC1.2 opens with "?" and closes with Escape on every page, and the focus goes back to the button', async ({ page }) => {
  for (const [link, title] of [
    ['Board', 'Help · Board'],
    ['Backlog', 'Help · Backlog'],
    ['Story Map', 'Help · Story Map'],
    ['Epics', 'Help · Epics']
  ] as const) {
    // Given a page
    await page.getByRole('link', { name: link, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // When I press "?"
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('Shift+Slash');

    // Then the help of this page opens, and Escape closes it again
    await expect(panel(page).getByRole('heading', { name: title, level: 2 })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    await expect(helpButton(page)).toBeFocused();
  }
});

test('AC9.2 the help is a sheet over the whole page on a phone, and can be closed (manuell: look)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.getByRole('button', { name: 'No thanks' }).click();
  await helpButton(page).click();
  const box = await panel(page).boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(388);
  await panel(page).getByRole('button', { name: 'Close help' }).click();
  await expect(panel(page)).toHaveCount(0);
});
