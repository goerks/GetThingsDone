import { expect, test, type Locator, type Page } from '@playwright/test';
import { PACKAGE_1 } from '../src/acceptance/package1';
import { seedSnapshot } from '../src/data/seed';

/*
 * End-to-end tests of usability package 1 (#32), one or more per test case of the PO (see src/acceptance/package1.ts).
 * Every test starts from the demo data of a fresh browser on Tuesday 13 October 2026: Sprint 1 runs, Sprint 2 follows.
 * The board shows Sprint 1: "S-3 Reorder the backlog by priority" (5 points, epic "Backlog") is in "To do".
 * New visual elements are also checked against screenshots (e2e/usability1.spec.ts-snapshots); they were taken in
 * the English UI, Chromium on Linux. The CI runner renders text a little differently from the container they were
 * taken in (3 to 5 % of the pixels of small elements), so the tolerance is 8 %: layout, colour and missing or moved
 * elements are caught, the exact wording is checked by the role and text assertions of each test.
 */

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
});

const SHOT = { maxDiffPixelRatio: 0.08, animations: 'disabled', caret: 'hide' } as const;

const open = async (page: Page, hash: string): Promise<void> => {
  await page.goto(`/${hash}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
};
/** A card on the board or the story map, or a row of the backlog. */
const story = (page: Page, code: string): Locator => page.getByRole('group', { name: new RegExp(`(^|, )${code}: `) });
const column = (page: Page, name: string): Locator => page.getByRole('region', { name: new RegExp(`^${name}`) });
const dialog = (page: Page, name: string | RegExp): Locator => page.getByRole('dialog', { name });
const toast = (page: Page, text: string | RegExp): Locator => page.locator('.toast').filter({ hasText: text });
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
/** Picks an entry of the context menu of a story, going through the submenu. */
async function chooseFromMenu(page: Page, code: string, submenu: string, entry: string): Promise<void> {
  await story(page, code).click({ button: 'right' });
  await page.getByRole('menuitem', { name: submenu }).click();
  await page.getByRole('menuitemradio', { name: entry, exact: true }).click();
}

/* ---------- AC1 One click opens everywhere ---------- */

test('AC1.1 opens a story on the board with one click on a free spot of the card', async ({ page }) => {
  // Given the board shows Sprint 1 with S-3 in "To do"
  await open(page, '#/board');
  const card = story(page, 'S-3');
  const box = await card.boundingBox();
  if (!box) throw new Error('card is not visible');

  // When I click on a free spot of the card, not on the title
  await card.click({ position: { x: box.width - 6, y: 6 } });

  // Then the details of S-3 open
  await expect(dialog(page, /^S-3: /)).toBeVisible();
});

test('AC1.2 opens a story with one click on a backlog row and on a story map card', async ({ page }) => {
  // Given I am in the backlog; S-3 is under Sprint 1
  await open(page, '#/backlog');
  // When I click once on the row of S-3
  await story(page, 'S-3').locator('.card__code').click();
  // Then its details open
  await expect(dialog(page, /^S-3: /)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page, /^S-3: /)).toBeHidden();

  // When I go to the story map and click once on the card of S-3
  await page.getByRole('link', { name: 'Story Map' }).click();
  await story(page, 'S-3').locator('.card__code').click();
  // Then its details open
  await expect(dialog(page, /^S-3: /)).toBeVisible();
});

test('AC1.3 does not open a story when it is dragged', async ({ page }) => {
  // Given the board shows S-3 in "To do"
  await open(page, '#/board');
  await expect(column(page, 'To do').getByRole('group', { name: /^S-3: / })).toBeVisible();

  // When I drag S-3 to "Done" and let go
  await drag(page, story(page, 'S-3'), column(page, 'Done').locator('.column__list'));

  // Then S-3 is in "Done" and no dialog opened
  await expect(column(page, 'Done').getByRole('group', { name: /^S-3: / })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('AC1.4 still opens with Enter and with a double click, exactly one dialog each', async ({ page }) => {
  // Given the board shows Sprint 1
  await open(page, '#/board');

  // When I focus S-3 with the keyboard and press Enter
  await story(page, 'S-3').focus();
  await page.keyboard.press('Enter');
  // Then one dialog for S-3 opens, and Escape closes it
  await expect(dialog(page, /^S-3: /)).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // When I double click the card
  await story(page, 'S-3').dblclick({ position: { x: 20, y: 6 } });
  // Then exactly one dialog is open, and it stays open
  await expect(dialog(page, /^S-3: /)).toHaveCount(1);
  await page.waitForTimeout(700);
  await expect(dialog(page, /^S-3: /)).toBeVisible();
});

/* ---------- AC2 All create dialogs work the same ---------- */

test('AC2.1 shows "Cancel" and the primary button at the foot of a create dialog, with the shortcut hint', async ({ page }) => {
  // Given I am on the board
  await open(page, '#/board');

  // When I click "New story"
  await page.getByRole('button', { name: 'New story' }).click();

  // Then the foot has "Cancel", and to its right the primary "Add story", and the hint for Ctrl+Enter
  const box = dialog(page, 'New story');
  const cancel = await box.getByRole('button', { name: 'Cancel' }).boundingBox();
  const primary = await box.getByRole('button', { name: 'Add story', exact: true }).boundingBox();
  expect(cancel && primary && cancel.x < primary.x).toBe(true);
  await expect(box.getByText('Ctrl+Enter saves · Esc cancels')).toBeVisible();
  await expect(box).toHaveScreenshot('create-dialog.png', SHOT);
});

test('AC2.2 saves a create dialog with Ctrl+Enter from any field: story, epic, sprint, release', async ({ page }) => {
  // Given I am on the board and open "New story"
  await open(page, '#/board');
  await page.getByRole('button', { name: 'New story' }).click();
  // When I enter a title, go to the description and press Ctrl+Enter
  await dialog(page, 'New story').getByLabel('Title').fill('Reset password');
  await dialog(page, 'New story').getByLabel('Description').fill('By e-mail');
  await page.keyboard.press('Control+Enter');
  // Then the dialog closes and the story is in "To do"
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(column(page, 'To do').getByRole('group', { name: /^S-8: Reset password/ })).toBeVisible();

  // The same for an epic
  await page.getByRole('link', { name: 'Epics' }).click();
  await page.getByRole('button', { name: 'New epic' }).click();
  await dialog(page, 'New epic').getByLabel('Name').fill('Payments');
  await page.keyboard.press('Control+Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Payments/ })).toBeVisible();

  // for a sprint
  await page.getByRole('link', { name: 'Story Map' }).click();
  await page.getByRole('button', { name: '+ Sprint' }).click();
  await page.keyboard.press('Control+Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Sprint 3, / })).toBeVisible();

  // and for a release
  await page.getByRole('link', { name: 'Releases' }).click();
  await page.getByRole('button', { name: '+ Release' }).click();
  await dialog(page, 'New release').getByLabel('Title').fill('Release 2.0');
  await page.keyboard.press('Control+Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Release 2.0/ })).toBeVisible();
});

test('AC2.3 closes a create dialog without a question when a click beside it finds nothing typed', async ({ page }) => {
  // Given "New story" is open and empty
  await open(page, '#/board');
  await page.getByRole('button', { name: 'New story' }).click();
  await expect(dialog(page, 'New story')).toBeVisible();
  await page.waitForTimeout(500);

  // When I click on the dark area beside the dialog
  await page.mouse.click(5, 5);

  // Then the dialog closes without a question
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('AC2.4 asks "Discard input?" when something was typed and a click beside the dialog or Escape follows', async ({ page }) => {
  // Given "New story" is open with the title "Reset password"
  await open(page, '#/board');
  await page.getByRole('button', { name: 'New story' }).click();
  const box = dialog(page, 'New story');
  await box.getByLabel('Title').fill('Reset password');
  await page.waitForTimeout(500);

  // When I click beside the dialog
  await page.mouse.click(5, 5);

  // Then the dialog stays open and asks "Discard input?"
  const ask = box.getByRole('alertdialog', { name: 'Discard input?' });
  await expect(ask).toBeVisible();
  await expect(ask.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  await expect(box).toHaveScreenshot('discard-ask.png', SHOT);

  // When I choose "Keep editing", the title is still there
  await ask.getByRole('button', { name: 'Keep editing' }).click();
  await expect(ask).toHaveCount(0);
  await expect(box.getByLabel('Title')).toHaveValue('Reset password');

  // When I press Escape, the question comes again; "Discard" closes the dialog without a new story
  await page.keyboard.press('Escape');
  await expect(ask).toBeVisible();
  await ask.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Reset password')).toHaveCount(0);
});

test('AC2.5 closes at once with "Cancel", even with input', async ({ page }) => {
  // Given "New story" is open with a title
  await open(page, '#/board');
  await page.getByRole('button', { name: 'New story' }).click();
  await dialog(page, 'New story').getByLabel('Title').fill('Reset password');

  // When I click "Cancel"
  await dialog(page, 'New story').getByRole('button', { name: 'Cancel' }).click();

  // Then it closes without a question and no story exists
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByText('Reset password')).toHaveCount(0);
});

test('AC2.6 reports a missing title or name in the words of the app under the field', async ({ page }) => {
  // Given "New story" is open and the title is empty
  await open(page, '#/board');
  await page.getByRole('button', { name: 'New story' }).click();
  const box = dialog(page, 'New story');
  await expect(box.locator('form')).toHaveAttribute('novalidate', '');

  // When I click "Add story"
  await box.getByRole('button', { name: 'Add story', exact: true }).click();

  // Then the message is under the field, the field is marked and has the focus, and the dialog stays
  await expect(box.getByRole('alert')).toHaveText('Please enter a title.');
  await expect(box.getByLabel('Title')).toHaveAttribute('aria-invalid', 'true');
  await expect(box.getByLabel('Title')).toBeFocused();
  // And typing takes the message away
  await box.getByLabel('Title').fill('Reset password');
  await expect(box.getByRole('alert')).toHaveCount(0);
  await box.getByRole('button', { name: 'Cancel' }).click();

  // The same for "New epic" with Ctrl+Enter
  await page.getByRole('link', { name: 'Epics' }).click();
  await page.getByRole('button', { name: 'New epic' }).click();
  await page.keyboard.press('Control+Enter');
  await expect(dialog(page, 'New epic').getByRole('alert')).toHaveText('Please enter a name.');
  await expect(dialog(page, 'New epic').getByLabel('Name')).toBeFocused();
});

/* ---------- AC3 "New" sits at the same place on every page ---------- */

test('AC3.1 puts the primary "New" button with its shortcut at the right of the page head of every page', async ({ page }) => {
  const pages = [
    ['#/board', 'New story', 'New story'],
    ['#/backlog', 'New story', 'New story'],
    ['#/map', 'New story', 'New story'],
    ['#/epics', 'New epic', 'New epic'],
    ['#/releases', '+ Release', 'New release']
  ] as const;
  for (const [hash, button, dialogName] of pages) {
    // Given I open the page
    await open(page, hash);
    // Then the button with Ctrl+N is at the right end of the page head, and a click opens the matching dialog
    const head = page.getByRole('heading', { level: 1 }).locator('..');
    const action = head.getByRole('button', { name: button, exact: true });
    await expect(action).toBeVisible();
    await expect(action).toContainText('Ctrl+N');
    const headBox = await head.boundingBox();
    const box = await action.boundingBox();
    if (!headBox || !box) throw new Error('page head is not visible');
    expect(box.x + box.width).toBeGreaterThan(headBox.x + headBox.width - 8);
    if (hash === '#/map') await expect(head).toHaveScreenshot('map-head.png', SHOT);
    await action.click();
    await expect(dialog(page, dialogName)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});

test('AC3.2 still opens "New epic" with Ctrl+N on the epics page', async ({ page }) => {
  // Given I am on the epics page
  await open(page, '#/epics');
  // When I press Ctrl+N
  await page.keyboard.press('Control+n');
  // Then "New epic" opens
  await expect(dialog(page, 'New epic')).toBeVisible();
});

/* ---------- AC4 Context menu on cards and rows ---------- */

test('AC4.1 opens a menu on the card with a right click, and does not open the story', async ({ page }) => {
  // Given the board shows Sprint 1
  await open(page, '#/board');

  // When I right click S-3
  await story(page, 'S-3').click({ button: 'right' });

  // Then a menu with Open, Status, Sprint, Epic and Points opens, and no dialog
  const menu = page.getByRole('menu', { name: 'Actions for S-3' });
  await expect(menu).toBeVisible();
  for (const name of ['Open', 'Status', 'Sprint', 'Epic', 'Points']) await expect(menu.getByRole('menuitem', { name, exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveCount(5);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('AC4.2 changes the status through the menu, also after a reload', async ({ page }) => {
  // Given S-3 is in "To do"
  await open(page, '#/board');
  // When I open its menu and choose Status > Done
  await story(page, 'S-3').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Status' }).click();
  await expect(page.getByRole('menu', { name: 'Status' })).toBeVisible();
  const top = await page.getByRole('menu', { name: 'Actions for S-3' }).boundingBox();
  const sub = await page.getByRole('menu', { name: 'Status' }).boundingBox();
  if (!top || !sub) throw new Error('menu is not visible');
  const x = Math.min(top.x, sub.x) - 6;
  const y = Math.min(top.y, sub.y) - 6;
  await expect(page).toHaveScreenshot('menu-status.png', {
    ...SHOT,
    clip: { x, y, width: Math.max(top.x + top.width, sub.x + sub.width) - x + 6, height: Math.max(top.y + top.height, sub.y + sub.height) - y + 6 }
  });
  await page.getByRole('menuitemradio', { name: 'Done', exact: true }).click();
  // Then S-3 is in "Done" and the menu is gone, also after a reload
  await expect(column(page, 'Done').getByRole('group', { name: /^S-3: / })).toBeVisible();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.reload();
  await expect(column(page, 'Done').getByRole('group', { name: /^S-3: / })).toBeVisible();
});

test('AC4.3 changes the sprint of a backlog row through the menu', async ({ page }) => {
  // Given S-3 is under Sprint 1 in the backlog
  await open(page, '#/backlog');
  await expect(page.getByRole('region', { name: 'Sprint 1' }).getByRole('group', { name: /S-3: / })).toBeVisible();
  // When I choose Sprint > Not planned in its menu
  await chooseFromMenu(page, 'S-3', 'Sprint', 'Not planned');
  // Then S-3 is under "Not planned"
  await expect(page.getByRole('region', { name: 'Not planned' }).getByRole('group', { name: /S-3: / })).toBeVisible();
});

test('AC4.4 changes the points and the epic through the menu', async ({ page }) => {
  // Given S-3 has 5 points and the epic "Backlog"
  await open(page, '#/board');
  await expect(story(page, 'S-3')).toContainText('Backlog');
  // When I choose Points > 8 and then Epic > Boards
  await chooseFromMenu(page, 'S-3', 'Points', '8');
  await chooseFromMenu(page, 'S-3', 'Epic', 'Boards');
  // Then the card shows 8 points and the epic "Boards"
  await expect(story(page, 'S-3').locator('.pill')).toHaveText('8');
  await expect(story(page, 'S-3')).toContainText('Boards');
});

test('AC4.5 works with the keyboard only: menu key, arrows, Enter, Escape, focus returns to the card', async ({ page }) => {
  // Given the focus is on the card S-3
  await open(page, '#/board');
  await story(page, 'S-3').focus();
  // When I press the menu key, Down to Status, Right, Down and Enter
  await page.keyboard.press('ContextMenu');
  await expect(page.getByRole('menuitem', { name: 'Open' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Status' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('menuitemradio', { name: 'To do', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  // Then the status changes to "In progress"
  await expect(column(page, 'In progress').getByRole('group', { name: /^S-3: / })).toBeVisible();
  await expect(page.getByRole('menu')).toHaveCount(0);

  // When I open the menu again with Shift+F10 and press Escape
  await expect(story(page, 'S-3')).toBeFocused();
  await page.keyboard.press('Shift+F10');
  await expect(page.getByRole('menu', { name: 'Actions for S-3' })).toBeVisible();
  await page.keyboard.press('Escape');
  // Then the menu is closed and the focus is on the card again
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(story(page, 'S-3')).toBeFocused();
});

test('AC4.6 offers the menu on the story map too', async ({ page }) => {
  // Given I am on the story map
  await open(page, '#/map');
  // When I right click S-3 and choose Sprint > Sprint 2
  await chooseFromMenu(page, 'S-3', 'Sprint', 'Sprint 2');
  // Then S-3 is in the row of Sprint 2
  await expect(page.getByRole('list', { name: 'Sprint 2 Backlog', exact: true }).getByRole('group', { name: /^S-3: / })).toBeVisible();
});

test('AC4.7 closes the menu with a click beside it and changes nothing', async ({ page }) => {
  // Given the menu of S-3 is open
  await open(page, '#/board');
  await story(page, 'S-3').click({ button: 'right' });
  await expect(page.getByRole('menu')).toBeVisible();
  // When I click on a free spot of the page, here on another card
  const other = await story(page, 'S-4').boundingBox();
  if (!other) throw new Error('card is not visible');
  await page.mouse.click(other.x + 20, other.y + 6);
  // Then the menu closes, that click opened nothing, and S-3 did not change
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(column(page, 'To do').getByRole('group', { name: /^S-3: / })).toBeVisible();
});

test('AC4.8 marks the story whose menu is open, on the board, in the backlog and on the story map', async ({ page }) => {
  for (const [hash, label] of [['#/board', 'board'], ['#/backlog', 'backlog'], ['#/map', 'story map']] as const) {
    // Given the page shows S-3 and S-4 next to each other
    await open(page, hash);
    const chosen = story(page, 'S-3');
    const other = story(page, 'S-4');

    // When I open the menu of S-3
    await chosen.click({ button: 'right' });
    await expect(page.getByRole('menu', { name: 'Actions for S-3' })).toBeVisible();

    // Then S-3 is clearly marked (a blue frame) and the other story is not
    await expect(chosen, label).toHaveClass(/ctx-target/);
    await expect(other, label).not.toHaveClass(/ctx-target/);
    expect(await chosen.evaluate((node) => getComputedStyle(node).outlineStyle), label).toBe('solid');
    if (hash === '#/board') {
      const box = await chosen.boundingBox();
      if (!box) throw new Error('card is not visible');
      await expect(page).toHaveScreenshot('menu-target.png', { ...SHOT, clip: { x: box.x - 14, y: box.y - 14, width: box.width + 28, height: box.height + 28 } });
    }

    // And when the menu is closed, the frame is gone
    await page.keyboard.press('Escape');
    await expect(chosen, label).not.toHaveClass(/ctx-target/);
  }
});

/* ---------- AC5 Quick add ---------- */

test('AC5.1 adds a story in a board column with the title only', async ({ page }) => {
  // Given the column "In progress" has 2 stories
  await open(page, '#/board');
  const inProgress = column(page, 'In progress');
  await expect(inProgress.getByRole('group')).toHaveCount(2);

  // When I click "+ Story" at its end, type a title and press Enter
  await inProgress.getByRole('button', { name: '+ Story in In progress' }).click();
  const field = inProgress.getByRole('textbox', { name: 'Title of the new story in In progress' });
  await expect(inProgress).toHaveScreenshot('quick-add-open.png', SHOT);
  await field.fill('Invoice as PDF');
  await field.press('Enter');

  // Then the story is in "In progress" (now 3), the field is empty and still open
  await expect(inProgress.getByRole('group')).toHaveCount(3);
  await expect(inProgress.getByRole('group', { name: /Invoice as PDF/ })).toBeVisible();
  await expect(field).toBeVisible();
  await expect(field).toHaveValue('');
  // And it belongs to Sprint 1 (it is on the board of the running sprint) and is there after a reload
  await page.reload();
  await expect(column(page, 'In progress').getByRole('group', { name: /Invoice as PDF/ })).toBeVisible();
});

test('AC5.2 adds several stories one after the other', async ({ page }) => {
  // Given the title field of the column is open
  await open(page, '#/board');
  const toDo = column(page, 'To do');
  await toDo.getByRole('button', { name: '+ Story in To do' }).click();
  const field = toDo.getByRole('textbox', { name: 'Title of the new story in To do' });
  // When I type "Send reminder", Enter, "Cancel reminder", Enter
  await field.fill('Send reminder');
  await field.press('Enter');
  await field.fill('Cancel reminder');
  await field.press('Enter');
  // Then both stories are in the column and the field is still open
  await expect(toDo.getByRole('group', { name: /Send reminder/ })).toBeVisible();
  await expect(toDo.getByRole('group', { name: /Cancel reminder/ })).toBeVisible();
  await expect(field).toBeVisible();
});

test('AC5.3 closes with Escape and does not add an empty title', async ({ page }) => {
  // Given the title field of the column is open
  await open(page, '#/board');
  const toDo = column(page, 'To do');
  const before = await toDo.getByRole('group').count();
  await toDo.getByRole('button', { name: '+ Story in To do' }).click();
  const field = toDo.getByRole('textbox', { name: 'Title of the new story in To do' });
  // When I press Enter without text, then type "Draft" and press Escape
  await field.press('Enter');
  await expect(toDo.getByRole('group')).toHaveCount(before);
  await field.fill('Draft');
  await field.press('Escape');
  // Then no story was added and the field is closed
  await expect(toDo.getByRole('group')).toHaveCount(before);
  await expect(field).toHaveCount(0);
  await expect(toDo.getByRole('button', { name: '+ Story in To do' })).toBeFocused();
});

test('AC5.4 adds a story in a backlog section: in the sprint and in "Not planned"', async ({ page }) => {
  // Given I am in the backlog
  await open(page, '#/backlog');
  // When I add "Pay by card" under Sprint 2 and "Pay by TWINT" under "Not planned"
  const sprint2 = page.getByRole('region', { name: 'Sprint 2' });
  await sprint2.getByRole('button', { name: '+ Story in Sprint 2' }).click();
  await sprint2.getByRole('textbox', { name: 'Title of the new story in Sprint 2' }).fill('Pay by card');
  await page.keyboard.press('Enter');
  const unplanned = page.getByRole('region', { name: 'Not planned' });
  await unplanned.getByRole('button', { name: '+ Story in Not planned' }).click();
  await unplanned.getByRole('textbox', { name: 'Title of the new story in Not planned' }).fill('Pay by TWINT');
  await page.keyboard.press('Enter');
  // Then each story is in its section
  await expect(sprint2.getByRole('group', { name: /Pay by card/ })).toBeVisible();
  await expect(unplanned.getByRole('group', { name: /Pay by TWINT/ })).toBeVisible();
});

test('AC5.5 adds a story in a cell of the story map with the epic and the sprint of that cell', async ({ page }) => {
  // Given I am on the story map
  await open(page, '#/map');
  // When I click "+" in the cell Sprint 2 / Boards, type a title and press Enter
  await page.getByRole('button', { name: 'New story in Boards, Sprint 2' }).click();
  await page.getByRole('textbox', { name: 'Title of the new story in Sprint 2, Boards' }).fill('Hide columns');
  await page.keyboard.press('Enter');
  // Then the story is in that cell
  await expect(page.getByRole('list', { name: 'Sprint 2 Boards', exact: true }).getByRole('group', { name: /Hide columns/ })).toBeVisible();
});

test('AC5.6 opens the full dialog with the title when a required field has no default, in the browser', async ({ page }) => {
  // Given a required field without a default value for stories
  const snapshot = seedSnapshot('2026-10-13');
  const data = { ...snapshot, assignments: snapshot.assignments.map((item) => (item.fieldId === 'field-demo-value' && item.itemType === 'story' ? { ...item, required: true } : item)) };
  await page.addInitScript((stored) => {
    if (!window.localStorage.getItem('getitdone.snapshot.v1')) window.localStorage.setItem('getitdone.snapshot.v1', JSON.stringify(stored));
  }, data);
  await open(page, '#/board');

  // When I add a story with "+ Story" in "To do" and a title
  await column(page, 'To do').getByRole('button', { name: '+ Story in To do' }).click();
  await column(page, 'To do').getByRole('textbox', { name: 'Title of the new story in To do' }).fill('Needs a value');
  await page.keyboard.press('Enter');

  // Then "New story" opens with the title filled in and marks the missing required field
  const box = dialog(page, 'New story');
  await expect(box.getByLabel('Title')).toHaveValue('Needs a value');
  await expect(box.getByRole('alert')).toHaveText('Please fill in: Business value');
  // And no story was created yet
  await box.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Needs a value')).toHaveCount(0);
});

/* ---------- AC6 Add and add another ---------- */

test('AC6.1 adds a story and keeps epic, sprint and points for the next one', async ({ page }) => {
  // Given "New story" is open with epic "Boards", Sprint 2 and 3 points
  await open(page, '#/board');
  await page.getByRole('button', { name: 'New story' }).click();
  const box = dialog(page, 'New story');
  await box.getByLabel('Epic').selectOption({ label: 'Boards' });
  const sprint2 = await box.getByLabel('Sprint').locator('option', { hasText: /^Sprint 2/ }).getAttribute('value');
  await box.getByLabel('Sprint').selectOption(sprint2 ?? '');
  await box.getByLabel('Points').selectOption('3');
  const sprintBefore = await box.getByLabel('Sprint').locator('option:checked').textContent();

  // When I type "Sort cards" and click "Add and add another"
  await box.getByLabel('Title').fill('Sort cards');
  await box.getByRole('button', { name: 'Add and add another' }).click();

  // Then the dialog stays open, the title is empty, epic, sprint and points stay, and a line says what was added
  await expect(box).toBeVisible();
  await expect(box.getByLabel('Title')).toHaveValue('');
  await expect(box.getByLabel('Title')).toBeFocused();
  await expect(box.getByLabel('Epic').locator('option:checked')).toHaveText('Boards');
  await expect(box.getByLabel('Sprint').locator('option:checked')).toHaveText(sprintBefore ?? '');
  await expect(box.getByLabel('Points')).toHaveValue('3');
  await expect(box.getByRole('status')).toHaveText('“Sort cards” added. Epic, sprint and points stay.');
  await expect(box).toHaveScreenshot('add-another.png', SHOT);
});

test('AC6.2 does the same with Ctrl+Shift+Enter', async ({ page }) => {
  // Given "New story" is open with a title
  await open(page, '#/board');
  await page.getByRole('button', { name: 'New story' }).click();
  const box = dialog(page, 'New story');
  await box.getByLabel('Title').fill('Sort cards');
  // When I press Ctrl+Shift+Enter
  await page.keyboard.press('Control+Shift+Enter');
  // Then the dialog stays open with an empty title and a line about the added story
  await expect(box.getByLabel('Title')).toHaveValue('');
  await expect(box.getByRole('status')).toContainText('“Sort cards” added');
  await box.getByRole('button', { name: 'Cancel' }).click();
  await expect(column(page, 'To do').getByRole('group', { name: /Sort cards/ })).toBeVisible();
});

test('AC6.3 still closes the dialog with the normal "Add story"', async ({ page }) => {
  // Given "New story" is open with a title
  await open(page, '#/board');
  await page.getByRole('button', { name: 'New story' }).click();
  await dialog(page, 'New story').getByLabel('Title').fill('Sort cards');
  // When I click "Add story"
  await dialog(page, 'New story').getByRole('button', { name: 'Add story', exact: true }).click();
  // Then the dialog closes and the story is on the board
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(column(page, 'To do').getByRole('group', { name: /Sort cards/ })).toBeVisible();
});

/* ---------- AC7 Shortcut overview ---------- */

test('AC7.1 opens the overview with Ctrl+/, the shortcuts of the page first', async ({ page }) => {
  // Given I am on the board
  await open(page, '#/board');
  // When I press Ctrl+/
  await page.keyboard.press('Control+/');
  // Then "Keyboard shortcuts" lists the shortcuts of the board first, then the general ones
  const box = dialog(page, 'Keyboard shortcuts');
  await expect(box).toBeVisible();
  await expect(box.getByRole('heading', { level: 3 })).toHaveText(['On the board', 'Everywhere']);
  await expect(box).toHaveScreenshot('shortcuts.png', SHOT);
});

test('AC7.2 opens from the keyboard button in the header and closes with Escape, the focus returns', async ({ page }) => {
  // Given I am in the backlog
  await open(page, '#/backlog');
  const button = page.getByRole('banner').getByRole('button', { name: 'Keyboard shortcuts' });
  // When I click the keyboard button and press Escape
  await button.click();
  await expect(dialog(page, 'Keyboard shortcuts')).toBeVisible();
  await page.keyboard.press('Escape');
  // Then the overview closed and the focus is on the button
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(button).toBeFocused();
});

test('AC7.3 lists only shortcuts that exist and only those that fit the page', async ({ page }) => {
  // Given the overview on the board
  await open(page, '#/board');
  await page.keyboard.press('Control+/');
  const board = await dialog(page, 'Keyboard shortcuts').textContent();
  await page.keyboard.press('Escape');
  // And on the epics page
  await open(page, '#/epics');
  await page.keyboard.press('Control+/');
  const epics = await dialog(page, 'Keyboard shortcuts').textContent();
  // Then the board lists the card shortcuts and the epics page does not; both name Ctrl+N, Ctrl+F and Ctrl+/
  expect(board).toContain('Open the focused card');
  expect(board).toContain('Menu of the focused card');
  expect(epics).not.toContain('focused card');
  expect(epics).toContain('New epic');
  for (const text of [board, epics]) {
    expect(text).toContain('Ctrl');
    expect(text).toContain('Search');
    expect(text).toContain('This overview');
  }
});

/* ---------- AC8 Notices after actions ---------- */

test('AC8.1 shows a notice after a story was added', async ({ page }) => {
  // Given I am on the board
  await open(page, '#/board');
  // When I add the story "Reset password"
  await page.getByRole('button', { name: 'New story' }).click();
  await dialog(page, 'New story').getByLabel('Title').fill('Reset password');
  await page.keyboard.press('Control+Enter');
  // Then a notice says "S-8 “Reset password” added"
  await expect(toast(page, 'S-8 “Reset password” added')).toBeVisible();
  await expect(page.locator('.toasts')).toHaveScreenshot('toast.png', SHOT);
});

test('AC8.2 shows a notice after a story was moved by dragging and through the menu', async ({ page }) => {
  // Given S-3 is in "To do" and S-6 is in "To do"
  await open(page, '#/board');
  // When I drag S-3 to "Done"
  await drag(page, story(page, 'S-3'), column(page, 'Done').locator('.column__list'));
  // Then a notice says "S-3 moved to Done"
  await expect(toast(page, 'S-3 moved to Done')).toBeVisible();
  // When I move S-6 to "In progress" through its menu
  await chooseFromMenu(page, 'S-6', 'Status', 'In progress');
  // Then a notice says "S-6 moved to In progress"
  await expect(toast(page, 'S-6 moved to In progress')).toBeVisible();
});

test('AC8.3 lets a notice go away by itself, but not while the pointer is on it', async ({ page }) => {
  // Given a notice is visible
  await open(page, '#/board');
  await chooseFromMenu(page, 'S-3', 'Status', 'Review');
  const first = toast(page, 'S-3 moved to Review');
  await expect(first).toBeVisible();
  // When I wait about 5 seconds, it goes away
  await expect(first).toBeHidden({ timeout: 8000 });

  // When the next notice comes and I hold the pointer on it
  await chooseFromMenu(page, 'S-3', 'Status', 'Done');
  const second = toast(page, 'S-3 moved to Done');
  await expect(second).toBeVisible();
  await second.hover();
  await page.waitForTimeout(6500);
  // Then it stays, and goes after I move the pointer away
  await expect(second).toBeVisible();
  await page.mouse.move(600, 500);
  await expect(second).toBeHidden({ timeout: 8000 });
});

test('AC8.4 puts notices into a polite live region for screen readers', async ({ page }) => {
  // Given the region for notices exists before any notice
  await open(page, '#/board');
  const region = page.locator('.toasts');
  await expect(region).toHaveAttribute('role', 'status');
  await expect(region).toHaveAttribute('aria-live', 'polite');
  // When a story is added
  await page.getByRole('button', { name: '+ Story in To do' }).click();
  await page.getByRole('textbox', { name: 'Title of the new story in To do' }).fill('Screen reader story');
  await page.keyboard.press('Enter');
  // Then the notice is inside that same region, so it is read out without moving the focus
  await expect(region.getByText('“Screen reader story” added')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Title of the new story in To do' })).toBeFocused();
});

/* ---------- AC9 New and moved stories are highlighted ---------- */

test('AC9.1 scrolls a new story into view and frames it in green for about two seconds', async ({ page }) => {
  // Given a low window, so that the end of "Not planned" is below the fold
  await page.setViewportSize({ width: 1400, height: 520 });
  await open(page, '#/backlog');
  // When I add a story with Ctrl+N (the backlog adds it to "Not planned")
  await page.keyboard.press('Control+n');
  await dialog(page, 'New story').getByLabel('Title').fill('Brand new');
  await page.keyboard.press('Control+Enter');
  // Then the page scrolls so the new row is visible and the row has the green frame
  const row = story(page, 'S-8');
  await expect(row).toBeInViewport({ ratio: 0.9 });
  await expect(row).toHaveClass(/flash/);
  // And the frame is gone after about two seconds
  await expect(row).not.toHaveClass(/flash/, { timeout: 4000 });
});

test('AC9.2 frames a moved story in green for about two seconds', async ({ page }) => {
  // Given S-3 is in "To do"
  await open(page, '#/board');
  // When I move it to "Review" through the menu
  await chooseFromMenu(page, 'S-3', 'Status', 'Review');
  // Then S-3 in "Review" has the green frame, and loses it after about two seconds
  const moved = column(page, 'Review').getByRole('group', { name: /^S-3: / });
  await expect(moved).toHaveClass(/flash/);
  await expect(moved).toHaveScreenshot('flash-card.png', SHOT);
  await expect(moved).not.toHaveClass(/flash/, { timeout: 4000 });
});

test('AC9.3 shows the frame without animation when "reduce motion" is set', async ({ page }) => {
  // Given the system asks for reduced motion
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, '#/board');
  // When I move S-3 through the menu
  await chooseFromMenu(page, 'S-3', 'Status', 'Review');
  // Then the frame is there and no animation runs
  const moved = column(page, 'Review').getByRole('group', { name: /^S-3: / });
  await expect(moved).toHaveClass(/flash/);
  expect(await moved.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  expect(await moved.evaluate((node) => getComputedStyle(node).borderColor)).not.toBe(await story(page, 'S-1').evaluate((node) => getComputedStyle(node).borderColor));
});

/* ---------- AC10 Empty states offer the next action ---------- */

test('AC10.1 offers "+ Story" in an empty board column', async ({ page }) => {
  // Given "Done" holds only S-5
  await open(page, '#/board');
  await expect(column(page, 'Done').getByRole('group')).toHaveCount(1);
  // When I move S-5 to "To do"
  await chooseFromMenu(page, 'S-5', 'Status', 'To do');
  // Then "Done" shows "Drop a story here" and "+ Story"
  const done = column(page, 'Done');
  await expect(done.getByText('Drop a story here')).toBeVisible();
  await expect(done.getByRole('button', { name: '+ Story in Done' })).toBeVisible();
  await expect(done).toHaveScreenshot('empty-column.png', SHOT);
});

test('AC10.2 offers "+ Story" in an empty sprint of the backlog', async ({ page }) => {
  // Given Sprint 2 has no stories
  await open(page, '#/backlog');
  const sprint2 = page.getByRole('region', { name: 'Sprint 2' });
  // Then it explains that stories can be dragged here and offers "+ Story"
  await expect(sprint2.getByText('Drag stories here to plan them into Sprint 2.')).toBeVisible();
  await expect(sprint2.getByRole('button', { name: '+ Story in Sprint 2' })).toBeVisible();
});

test('AC10.3 shows the text and the "New epic" button on an epics page without epics', async ({ page }) => {
  // Given there is no epic (one story without an epic)
  await page.addInitScript(() => {
    if (window.localStorage.getItem('getitdone.snapshot.v1')) return;
    const story = { id: 'story-x', code: 'S-1', title: 'Alone', description: '', epicId: null, points: 3, status: 'todo', sprintId: null, releaseId: null, rank: 0, criteria: [], values: {} };
    window.localStorage.setItem('getitdone.snapshot.v1', JSON.stringify({ epics: [], stories: [story], sprints: [] }));
  });
  // When I open the epics page
  await open(page, '#/epics');
  // Then it shows "No epics yet." and the button "New epic" with Ctrl+N
  await expect(page.getByText('No epics yet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New epic' })).toContainText('Ctrl+N');
});

/* ---------- AC11 Acceptance aid in the preview: step by step ---------- */

const CASES = PACKAGE_1.criteria.flatMap((criterion) => criterion.cases);
const panelOf = (page: Page): Locator => page.getByRole('complementary', { name: 'Abnahme' });
/** Opens the popup. By default it shows every test case, like the first versions did (`all`); the default view is tested apart (AC11.9). */
const openAcceptance = async (page: Page, hash = '#/board', all = true): Promise<void> => {
  await page.goto(`/?acceptance=1${hash}`);
  await page.locator('.acceptance__toggle').click();
  await expect(panelOf(page)).toBeVisible();
  if (all) {
    await panelOf(page).getByLabel('Auch automatisch geprüfte Punkte zeigen').check();
    // The popup stays at the step it was at; go to the first of all test cases.
    await panelOf(page).getByRole('group', { name: 'Alle Prüfpunkte' }).getByRole('button').first().click();
  }
};
const PO_CASES = CASES.filter((testCase) => testCase.poCheck);
const stepHeading = (page: Page, n: number): Locator => panelOf(page).getByRole('heading', { name: `Abnahme · Schritt ${n} von ${CASES.length}` });

test('AC11.1 shows one test case at a time with a strip of all of them', async ({ page }) => {
  // Given I open the preview (the panel shows with ?acceptance=1)
  await page.goto('/?acceptance=1#/board');
  // When I click the round button "Abnahme"
  const toggle = page.locator('.acceptance__toggle');
  await expect(toggle).toBeVisible();
  await toggle.click();
  await panelOf(page).getByLabel('Auch automatisch geprüfte Punkte zeigen').check();
  await panelOf(page).getByRole('group', { name: 'Alle Prüfpunkte' }).getByRole('button').first().click();
  // Then a popup shows "Step 1" with starting point, action and expectation, and a strip with one field per test case
  const panel = panelOf(page);
  await expect(stepHeading(page, 1)).toBeVisible();
  const current = panel.locator('[data-case="AC1.1"]');
  await expect(current).toContainText('Ausgangslage');
  await expect(current).toContainText('Ich mache');
  await expect(current).toContainText('Erwartet');
  await expect(panel.getByRole('group', { name: 'Alle Prüfpunkte' }).getByRole('button')).toHaveCount(CASES.length);
  // A fixed frame around the top of the popup: its height follows the text, which differs a little between machines.
  const box = await panel.boundingBox();
  if (!box) throw new Error('popup is not visible');
  await expect(page).toHaveScreenshot('acceptance-panel.png', { ...SHOT, clip: { x: box.x, y: box.y, width: 400, height: 330 } });
});

test('AC11.2 marks "In Ordnung", goes to the next test case and jumps to its page', async ({ page }) => {
  // Given the popup shows step 1 (AC1.1) on the board
  await openAcceptance(page);
  // When I click "In Ordnung"
  await panelOf(page).getByRole('button', { name: '✓ In Ordnung' }).click();
  // Then AC1.1 is green in the strip, step 2 (AC1.2) is shown, the backlog opens and the row of S-3 lights up
  await expect(panelOf(page).getByRole('button', { name: /^AC1\.1 .*, in Ordnung$/ })).toBeVisible();
  await expect(stepHeading(page, 2)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Backlog', level: 1 })).toBeVisible();
  await expect(page.locator('[data-story-id="story-3"]')).toHaveClass(/acceptance-glow/);
});

test('AC11.3 keeps a problem with its comment after a reload, at the same step', async ({ page }) => {
  // Given the popup shows a test case
  await openAcceptance(page);
  // When I click "Problem", write a comment and reload
  await panelOf(page).getByRole('button', { name: '✗ Problem' }).click();
  await panelOf(page).getByRole('textbox', { name: 'Kommentar zu AC1.1' }).fill('Karte reagiert nicht');
  await expect(panelOf(page).getByRole('status')).toHaveText(`0 von ${CASES.length} in Ordnung, 1 Problem`);
  await page.reload();
  await page.locator('.acceptance__toggle').click();
  await panelOf(page).getByLabel('Auch automatisch geprüfte Punkte zeigen').check();
  // Then the field in the strip is red, the comment is there, and the popup opens at the same step
  await expect(stepHeading(page, 1)).toBeVisible();
  await expect(panelOf(page).getByRole('button', { name: /^AC1\.1 .*, Problem$/ })).toBeVisible();
  await expect(panelOf(page).getByRole('textbox', { name: 'Kommentar zu AC1.1' })).toHaveValue('Karte reagiert nicht');
  await expect(panelOf(page).getByRole('status')).toHaveText(`0 von ${CASES.length} in Ordnung, 1 Problem`);
});

test('AC11.4 copies the result as text for the chat with the AI', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // Given AC1.1 is in order and AC1.2 has a problem with a comment
  await openAcceptance(page);
  await panelOf(page).getByRole('button', { name: '✓ In Ordnung' }).click();
  await expect(stepHeading(page, 2)).toBeVisible();
  await panelOf(page).getByRole('button', { name: '✗ Problem' }).click();
  await panelOf(page).getByRole('textbox', { name: 'Kommentar zu AC1.2' }).fill('Map nicht');
  // When I click "Ergebnis kopieren"
  await panelOf(page).getByRole('button', { name: 'Ergebnis kopieren' }).click();
  await expect(panelOf(page).getByText('Kopiert, jetzt im Chat einfügen')).toBeVisible();
  // Then the text starts with the state, lists the problem with expectation and comment, and names the open ones for the PO
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain(`Abnahme Usability, Paket 1 (#32, Pull Request #35): 0 von ${PO_CASES.length} Punkten für den PO in Ordnung, 1 Problem, ${PO_CASES.length} offen`);
  expect(text).toContain(`(${CASES.length - PO_CASES.length} weitere Punkte sind durch automatische Tests abgedeckt.)`);
  expect(text).toContain('Probleme:\n- AC1.2 Zeile im Backlog und Karte auf der Story Map öffnen – Map nicht\n  Erwartet: In beiden Fällen öffnen sich die Details von „S-3“.');
  expect(text).toContain(`Noch offen: ${PO_CASES.map((testCase) => testCase.id).join(', ')}`);
});

test('AC11.5 does not show the panel without the preview address', async ({ page }) => {
  // Given the app opened on an address that is no pull request preview (and not the dev server)
  await open(page, '#/board');
  // Then there is no "Abnahme" button
  await expect(page.getByRole('button', { name: /^Abnahme/ })).toHaveCount(0);
});

test('AC11.6 lights up what is to be tested and moves the popup to the other side', async ({ page }) => {
  // Given the popup shows AC1.1 and I am on the epics page
  await openAcceptance(page, '#/epics');
  // When I click "Zur Seite und markieren"
  await panelOf(page).getByRole('button', { name: 'Zur Seite und markieren' }).click();
  // Then the board opens, the card S-3 lights up and is in view, and the popup sits on the right, away from it
  const card = page.locator('[data-story-id="story-3"]');
  await expect(page.getByRole('heading', { name: 'Sprint 1', level: 1 })).toBeVisible();
  await expect(card).toHaveClass(/acceptance-glow/);
  await expect(card).toBeInViewport();
  await expect(page.locator('.acceptance')).toHaveClass(/acceptance--right/);
  const box = await card.boundingBox();
  if (!box) throw new Error('card is not visible');
  await expect(page).toHaveScreenshot('glow-card.png', { ...SHOT, clip: { x: box.x - 14, y: box.y - 14, width: box.width + 28, height: box.height + 28 } });
  // And the glow goes out after a few seconds
  await expect(card).not.toHaveClass(/acceptance-glow/, { timeout: 6000 });
});

test('AC11.7 shows a round button with a progress ring and the Preview tag; the popup does not move the page', async ({ page }) => {
  // Given the preview with the button
  await page.goto('/?acceptance=1#/board');
  const toggle = page.locator('.acceptance__toggle');
  const head = page.locator('.page-head');
  const before = await head.boundingBox();

  // Then the button is round, has a ring, a count and the tag "Preview"
  await expect(page.locator('.acceptance__fab')).toContainText('Preview');
  await expect(toggle.locator('.acceptance__ring')).toBeVisible();
  await expect(toggle.locator('.acceptance__count')).toHaveText(`0/${PO_CASES.length}`);
  expect(await toggle.evaluate((node) => getComputedStyle(node).borderRadius)).toBe('50%');

  // And its colour is none of the colours of the other buttons of the app
  const colour = (locator: Locator): Promise<string> => locator.evaluate((node) => getComputedStyle(node).backgroundColor);
  const own = await colour(toggle);
  for (const other of [page.getByRole('button', { name: 'New story' }), page.getByRole('button', { name: 'Keyboard shortcuts' }), page.getByRole('link', { name: 'Epics' })]) {
    expect(await colour(other)).not.toBe(own);
  }
  // A fixed frame around the button and its tag: the tag width follows the text.
  const box = await page.locator('.acceptance__fab').boundingBox();
  if (!box) throw new Error('button is not visible');
  await expect(page).toHaveScreenshot('acceptance-button.png', { ...SHOT, clip: { x: box.x - 8, y: box.y - 14, width: 190, height: 100 } });

  // When I open the popup, it floats above the page: the page did not move
  await toggle.click();
  await expect(panelOf(page)).toBeVisible();
  expect(await head.boundingBox()).toEqual(before);
  expect(await panelOf(page).evaluate((node) => getComputedStyle(node.parentElement as HTMLElement).position)).toBe('fixed');
  // And the button closes it again
  await toggle.click();
  await expect(panelOf(page)).toHaveCount(0);
});

test('AC11.8 shows all test cases and jumps to one, from the list and from the strip', async ({ page }) => {
  // Given the popup shows step 1
  await openAcceptance(page);
  // When I click "Alle Punkte anzeigen"
  await panelOf(page).getByRole('button', { name: 'Alle Punkte anzeigen', exact: true }).click();
  // Then the list shows every test case, ordered by criterion
  await expect(panelOf(page).locator('li[data-case]')).toHaveCount(CASES.length);
  await expect(panelOf(page).getByRole('heading', { level: 4 })).toHaveCount(PACKAGE_1.criteria.length);
  // When I click AC4.2, the popup shows that step and the board opens
  await panelOf(page).locator('li[data-case="AC4.2"]').getByRole('button').click();
  await expect(stepHeading(page, CASES.findIndex((testCase) => testCase.id === 'AC4.2') + 1)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sprint 1', level: 1 })).toBeVisible();
  // When I click the first field of the strip, I am at step 1 again
  await panelOf(page).getByRole('group', { name: 'Alle Prüfpunkte' }).getByRole('button').first().click();
  await expect(stepHeading(page, 1)).toBeVisible();
});

test('AC11.9 shows only the test cases for the PO by default and all of them on request', async ({ page }) => {
  // Given I open the acceptance for the first time
  await openAcceptance(page, '#/board', false);
  // Then it steps through the few test cases the PO has to check, each with the note "Das prüfst du:"
  await expect(panelOf(page).getByRole('heading', { name: `Abnahme · Schritt 1 von ${PO_CASES.length}` })).toBeVisible();
  await expect(panelOf(page).getByRole('group', { name: 'Alle Prüfpunkte' }).getByRole('button')).toHaveCount(PO_CASES.length);
  await expect(panelOf(page).locator(`[data-case="${PO_CASES[0].id}"]`)).toContainText('Das prüfst du:');

  // When I tick "Auch automatisch geprüfte Punkte zeigen"
  await panelOf(page).getByLabel('Auch automatisch geprüfte Punkte zeigen').check();
  // Then all test cases are there, and an automated one says so
  await expect(panelOf(page).getByRole('group', { name: 'Alle Prüfpunkte' }).getByRole('button')).toHaveCount(CASES.length);
  await panelOf(page).getByRole('button', { name: /^AC1\.1 / }).click();
  await expect(panelOf(page).locator('[data-case="AC1.1"]')).toContainText('Automatisch geprüft, du musst das nicht testen.');
});
