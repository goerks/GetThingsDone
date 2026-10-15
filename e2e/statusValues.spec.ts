import { expect, test, type Locator, type Page } from '@playwright/test';
import { pressUntilAnnounced } from './keyboardDrag';
import { switchDefinitionsOff } from './definitionsOff';

/*
 * End-to-end tests of the configurable status values in a real browser (#5), following the test cases the PO approved
 * in issue #5. Every test starts from the demo data of a fresh browser on Tuesday 13 October 2026:
 * Sprint 1 is running; "To do" has S-3 and S-6, "In progress" S-1 and S-4, "Review" S-2 and "Done" S-5.
 * Release 1.0 holds S-1 to S-6, so it starts with 3 points done (S-5).
 */

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
  await switchDefinitionsOff(page);
  await page.goto('/#/settings/statuses');
  await expect(page.getByRole('heading', { name: 'Status values', level: 2 })).toBeVisible();
});

const nameField = (page: Page, name: string): Locator => page.getByRole('textbox', { name: `Name of status ${name}`, exact: true });
const handle = (page: Page, name: string): Locator => page.getByRole('button', { name: `Move status ${name}`, exact: true });
const group = (page: Page, category: string): Locator => page.getByRole('region', { name: category, exact: true });
const column = (page: Page, name: string): Locator => page.getByRole('region', { name, exact: true });
const card = (page: Page, code: string): Locator => page.getByRole('group', { name: new RegExp(`^${code}: `) });
const announcement = (page: Page, text: string | RegExp): Locator => page.getByRole('status').filter({ hasText: text });

/** The names of the status values of one category in the settings, from top to bottom. */
async function namesIn(page: Page, category: string): Promise<string[]> {
  return group(page, category).getByRole('textbox').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
}

/** The columns of the board from left to right. */
const boardColumns = (page: Page): Promise<string[]> => page.locator('.column .column__name').allTextContents();

/** The number of stories a category band shows, as a screen reader says it. */
const bandCount = (page: Page, category: string): Locator =>
  page.getByRole('group', { name: category, exact: true }).getByLabel(/in this category$/);

async function toBoard(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Board' }).click();
  await expect(page.getByRole('heading', { name: 'Sprint 1', level: 1 })).toBeVisible();
}

async function addStatus(page: Page, category: string, name: string): Promise<void> {
  await page.getByRole('button', { name: `+ Status in "${category}"` }).click();
  await page.getByRole('textbox', { name: `Name of the new status in "${category}"` }).fill(name);
  await page.keyboard.press('Enter');
  await expect(nameField(page, name)).toBeVisible();
}

async function rename(page: Page, from: string, to: string): Promise<void> {
  await nameField(page, from).fill(to);
  await page.keyboard.press('Enter');
  await expect(nameField(page, to)).toBeVisible();
}

/** Waits until an element stands still, so a drag does not start in the middle of the animation of the last drop. */
async function standsStill(locator: Locator): Promise<void> {
  let previous = '';
  await expect
    .poll(async () => {
      const now = JSON.stringify(await locator.boundingBox());
      const still = now === previous;
      previous = now;
      return still;
    })
    .toBe(true);
}

/** Drags with the mouse in small steps, as a person would; `at` is where on the target it lands, from the top (0) to the bottom (1). */
async function drag(page: Page, from: Locator, to: Locator, at = 0.5): Promise<void> {
  await standsStill(from);
  await standsStill(to);
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  if (!a || !b) throw new Error('drag source or target is not visible');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height * at, { steps: 15 });
  await page.mouse.up();
}

/** The setup of AC2.6: "To do" is "Backlog", "In progress" has a new "Test" after "Review", "Done" is "Fertig". */
async function customize(page: Page): Promise<void> {
  await rename(page, 'To do', 'Backlog');
  await addStatus(page, 'In progress', 'Test');
  await rename(page, 'Done', 'Fertig');
}

test('AC1.1 adds a status that becomes a column of the board, also after a reload', async ({ page }) => {
  // Given "In progress" holds "In progress" and "Review"
  expect(await namesIn(page, 'In progress')).toEqual(['In progress', 'Review']);

  // When I add the status "Test" to "In progress"
  await addStatus(page, 'In progress', 'Test');

  // Then "Test" is the third status of "In progress"
  expect(await namesIn(page, 'In progress')).toEqual(['In progress', 'Review', 'Test']);

  // And the board has an empty column "Test" after "Review", also after a reload
  await page.reload();
  await toBoard(page);
  expect(await boardColumns(page)).toEqual(['To do', 'In progress', 'Review', 'Test', 'Done']);
  await expect(column(page, 'Test').getByRole('group')).toHaveCount(0);
});

test('AC1.1 adds nothing without a name, or when Escape is pressed', async ({ page }) => {
  // When I open the field for a new status and leave the name empty
  await page.getByRole('button', { name: '+ Status in "In progress"' }).click();
  const input = page.getByRole('textbox', { name: 'Name of the new status in "In progress"' });

  // Then adding is not possible
  await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeDisabled();

  // When I type a name and press Escape
  await input.fill('Test');
  await page.keyboard.press('Escape');

  // Then nothing is added
  expect(await namesIn(page, 'In progress')).toEqual(['In progress', 'Review']);
});

test('AC1.3 changes the order inside a category with the mouse and with the keyboard', async ({ page }) => {
  // When I drag "Review" by its handle onto the upper half of "In progress"
  await drag(page, handle(page, 'Review'), nameField(page, 'In progress'), 0.2);

  // Then "Review" is first, and so it is on the board, also after a reload
  expect(await namesIn(page, 'In progress')).toEqual(['Review', 'In progress']);
  await page.reload();
  await toBoard(page);
  expect(await boardColumns(page)).toEqual(['To do', 'Review', 'In progress', 'Done']);

  // When I press Alt + arrow down in the name of "Review", and Alt + arrow up again
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('link', { name: 'Status values' }).click();
  await nameField(page, 'Review').focus();
  await page.keyboard.press('Alt+ArrowDown');

  // Then "Review" is behind "In progress", and in front of it after the second key
  expect(await namesIn(page, 'In progress')).toEqual(['In progress', 'Review']);
  await nameField(page, 'Review').focus();
  await page.keyboard.press('Alt+ArrowUp');
  expect(await namesIn(page, 'In progress')).toEqual(['Review', 'In progress']);
});

test('AC1.4 removes a status without stories', async ({ page }) => {
  // Given the status "Test" has no stories
  await addStatus(page, 'In progress', 'Test');

  // When I click its trash can
  await page.getByRole('button', { name: 'Remove status Test' }).click();

  // Then a dialog says that no story has this status
  const dialog = page.getByRole('dialog', { name: 'Remove status "Test"?' });
  await expect(dialog).toContainText('No story has this status.');

  // And after "Remove" the status and its column on the board are gone
  await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(nameField(page, 'Test')).toHaveCount(0);
  await toBoard(page);
  expect(await boardColumns(page)).toEqual(['To do', 'In progress', 'Review', 'Done']);
});

test('AC2.1 shows the board with a band per category and the number of stories', async ({ page }) => {
  // When I open the board
  await toBoard(page);

  // Then three bands name the categories, each over its columns, with the number of its stories
  const notStarted = page.getByRole('group', { name: 'Not started', exact: true });
  const inProgress = page.getByRole('group', { name: 'In progress', exact: true });
  const done = page.getByRole('group', { name: 'Done', exact: true });
  await expect(notStarted.getByRole('region')).toHaveCount(1);
  await expect(notStarted.getByRole('region', { name: 'To do' })).toBeVisible();
  await expect(inProgress.getByRole('region')).toHaveCount(2);
  await expect(done.getByRole('region', { name: 'Done' })).toBeVisible();
  await expect(bandCount(page, 'Not started')).toHaveText('2');
  await expect(bandCount(page, 'In progress')).toHaveText('3');
  await expect(bandCount(page, 'Done')).toHaveText('1');

  // And every column shows its name and number
  await expect(column(page, 'To do').locator('.column__count')).toHaveText('2');
  await expect(column(page, 'In progress').locator('.column__count')).toHaveText('2');
  await expect(column(page, 'Review').locator('.column__count')).toHaveText('1');
  await expect(column(page, 'Done').locator('.column__count')).toHaveText('1');
});

test('AC2.3 moves a story into an own column with the mouse, also after a reload', async ({ page }) => {
  // Given the column "Test" exists
  await addStatus(page, 'In progress', 'Test');
  await toBoard(page);

  // When I drag S-1 into "Test"
  await drag(page, card(page, 'S-1'), column(page, 'Test'));

  // Then S-1 is in "Test" and the numbers fit
  await expect(column(page, 'Test').getByRole('group', { name: /^S-1: / })).toBeVisible();
  await expect(column(page, 'Test').locator('.column__count')).toHaveText('1');
  await expect(column(page, 'In progress').locator('.column__count')).toHaveText('1');

  // And after a reload it is still there
  await page.reload();
  await expect(column(page, 'Test').getByRole('group', { name: /^S-1: / })).toBeVisible();
});

test('AC2.4 keeps the columns readable when there are many, and scrolls the board sideways', async ({ page }) => {
  // Given so many statuses that the columns do not fit into the window
  for (const name of ['Test', 'Abnahme', 'Staging']) await addStatus(page, 'In progress', name);
  await toBoard(page);

  // When I look at the board
  const board = page.getByRole('group', { name: 'Board columns' });
  const widths = await page.locator('.column').evaluateAll((columns) => columns.map((element) => element.getBoundingClientRect().width));

  // Then the columns keep their width, the board is wider than the window and scrolls sideways
  expect(widths).toHaveLength(7);
  for (const width of widths) expect(width).toBeGreaterThanOrEqual(239);
  expect(await board.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await expect(column(page, 'Done')).not.toBeInViewport({ ratio: 1 });
  await board.evaluate((element) => element.scrollTo({ left: element.scrollWidth }));
  await expect(column(page, 'Done')).toBeInViewport({ ratio: 1 });

  // And the header stays visible
  await expect(page.getByRole('banner')).toBeInViewport();
});

test('AC2.6 pulls a story through own statuses from left to right with the mouse, and back', async ({ page }) => {
  // Given the statuses Backlog, In progress, Review, Test and Fertig, and S-3 in "Backlog"
  await customize(page);
  await toBoard(page);
  expect(await boardColumns(page)).toEqual(['Backlog', 'In progress', 'Review', 'Test', 'Fertig']);
  await expect(column(page, 'Backlog').getByRole('group', { name: /^S-3: / })).toBeVisible();
  await expect(bandCount(page, 'Done')).toHaveText('1');

  // When I drag S-3 from column to column to the right
  for (const [from, to] of [
    ['Backlog', 'In progress'],
    ['In progress', 'Review'],
    ['Review', 'Test'],
    ['Test', 'Fertig']
  ]) {
    await drag(page, column(page, from).getByRole('group', { name: /^S-3: / }), column(page, to));

    // Then S-3 is in the new column after every move
    await expect(column(page, to).getByRole('group', { name: /^S-3: / })).toBeVisible();
    await expect(column(page, from).getByRole('group', { name: /^S-3: / })).toHaveCount(0);
  }

  // And in "Fertig" S-3 counts as done, also after a reload
  await expect(bandCount(page, 'Done')).toHaveText('2');
  await expect(column(page, 'Fertig').locator('.column__count')).toHaveText('2');
  await page.reload();
  await expect(column(page, 'Fertig').getByRole('group', { name: /^S-3: / })).toBeVisible();

  // When I drag S-3 back to "Backlog"
  await drag(page, column(page, 'Fertig').getByRole('group', { name: /^S-3: / }), column(page, 'Backlog'));

  // Then it no longer counts as done
  await expect(column(page, 'Backlog').getByRole('group', { name: /^S-3: / })).toBeVisible();
  await expect(bandCount(page, 'Done')).toHaveText('1');
});

test('AC2.6 pulls a story through own statuses from left to right with the keyboard', async ({ page }) => {
  // Given the same statuses as above
  await customize(page);
  await toBoard(page);

  // When I pick S-3 up with the space key and move it to the next column, four times
  // (like a screen reader user, wait for each announcement before the next key: the first one names the column it is in)
  let from = 'Backlog';
  for (const to of ['In progress', 'Review', 'Test', 'Fertig']) {
    await card(page, 'S-3').focus();
    await page.keyboard.press('Space');
    await expect(announcement(page, new RegExp(`^Reorder the backlog by priority is over ${from}`))).toHaveCount(1);
    await pressUntilAnnounced(page, 'ArrowRight', announcement(page, new RegExp(`^Reorder the backlog by priority is over ${to}`)));
    await page.keyboard.press('Space');

    // Then S-3 is in that column, and the screen reader says so (which also ends this move, before the next one starts)
    await expect(announcement(page, `Reorder the backlog by priority dropped in ${to}.`)).toHaveCount(1);
    await expect(column(page, to).getByRole('group', { name: /^S-3: / })).toBeVisible();
    from = to;
  }

  // And it counts as done
  await expect(bandCount(page, 'Done')).toHaveText('2');
});

test('AC3.1 keeps the categories in their order: a status crosses a category edge only into its neighbour', async ({ page }) => {
  // When I press Alt + arrow up in "In progress", the first status of "In progress"
  await nameField(page, 'In progress').focus();
  await page.keyboard.press('Alt+ArrowUp');

  // Then it moves to the end of "Not started"
  expect(await namesIn(page, 'Not started')).toEqual(['To do', 'In progress']);
  expect(await namesIn(page, 'In progress')).toEqual(['Review']);

  // When I press Alt + arrow up in the topmost status
  await nameField(page, 'To do').focus();
  await page.keyboard.press('Alt+ArrowUp');

  // Then nothing happens
  expect(await namesIn(page, 'Not started')).toEqual(['To do', 'In progress']);

  // And the groups keep their order on the page and on the board
  const order = await page.locator('.status-group').evaluateAll((groups) => groups.map((element) => element.getAttribute('data-category')));
  expect(order).toEqual(['not_started', 'in_progress', 'done']);
  await toBoard(page);
  expect(await boardColumns(page)).toEqual(['To do', 'In progress', 'Review', 'Done']);
});

test('AC3.5 moves a status into another category exactly where I drop it and changes nothing else', async ({ page }) => {
  // Given "In progress" holds "In progress", "Review" and the new status "Test"
  await addStatus(page, 'In progress', 'Test');

  // When I drag "Test" onto the upper half of "Done" in "Done"
  await drag(page, handle(page, 'Test'), nameField(page, 'Done'), 0.2);

  // Then "Test" is now in front of "Done", and no other status changed its category
  expect(await namesIn(page, 'Done')).toEqual(['Test', 'Done']);
  expect(await namesIn(page, 'In progress')).toEqual(['In progress', 'Review']);
  expect(await namesIn(page, 'Not started')).toEqual(['To do']);

  // When I drag "Test" onto the lower half of "Done"
  await drag(page, handle(page, 'Test'), nameField(page, 'Done'), 0.8);

  // Then it is behind "Done", still in "Done"
  expect(await namesIn(page, 'Done')).toEqual(['Done', 'Test']);
  expect(await namesIn(page, 'In progress')).toEqual(['In progress', 'Review']);

  // When I drag "Test" onto the upper half of "To do"
  await drag(page, handle(page, 'Test'), nameField(page, 'To do'), 0.2);

  // Then it is the first status of "Not started", and the board shows the columns in this order
  expect(await namesIn(page, 'Not started')).toEqual(['Test', 'To do']);
  expect(await namesIn(page, 'Done')).toEqual(['Done']);
  await toBoard(page);
  expect(await boardColumns(page)).toEqual(['Test', 'To do', 'In progress', 'Review', 'Done']);
});

/** The top of every status row and the group each row is shown in, as they are on the screen right now. */
async function rowLayout(page: Page): Promise<string[]> {
  return page.locator('.status-group').evaluateAll((groups) =>
    groups.flatMap((group) => {
      const box = group.getBoundingClientRect();
      return [...group.querySelectorAll('input.status-row__name')].map((input) => {
        const top = Math.round(input.getBoundingClientRect().top);
        const inside = top >= box.top && top <= box.bottom;
        return `${(input as HTMLInputElement).value} @${top} ${inside ? 'in' : 'outside'} ${group.getAttribute('data-category')}`;
      });
    })
  );
}

/** Holds the status behind `from` over `to` (at `at` from its top to its bottom), without letting go. */
async function holdOver(page: Page, from: Locator, to: Locator, at: number): Promise<void> {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  if (!a || !b) throw new Error('drag source or target is not visible');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height * at, { steps: 15 });
}

test('AC3.5 keeps every other status in its own category and at its place while I drag one into another category', async ({ page }) => {
  // Given "Test" at the end of "In progress", and the place of every status on the screen
  await addStatus(page, 'In progress', 'Test');
  const before = await rowLayout(page);
  expect(before).toHaveLength(5);

  // When I hold "Test" over the upper half of "Done" (in "Done"), without letting go
  await holdOver(page, handle(page, 'Test'), nameField(page, 'Done'), 0.2);

  // Then no other status moved or switched to another category: the others look exactly as before
  const during = (await rowLayout(page)).filter((row) => !row.startsWith('Test @'));
  expect(during).toEqual(before.filter((row) => !row.startsWith('Test @')));

  // When I let go
  await page.mouse.up();

  // Then only "Test" is in "Done" now, in front of "Done"; all others are in their categories as before
  expect(await namesIn(page, 'Not started')).toEqual(['To do']);
  expect(await namesIn(page, 'In progress')).toEqual(['In progress', 'Review']);
  expect(await namesIn(page, 'Done')).toEqual(['Test', 'Done']);
});

test('AC3.5 shows a line where the status will land', async ({ page }) => {
  // Given the status "Test" at the end of "In progress"
  await addStatus(page, 'In progress', 'Test');

  // When I hold "Test" over the upper half of "Done"
  await holdOver(page, handle(page, 'Test'), nameField(page, 'Done'), 0.2);

  // Then a line shows the place in front of "Done", and "Done" is highlighted as the target category
  await expect(page.locator('[data-status="done"].drop-before')).toHaveCount(1);
  await expect(page.locator('.status-group--over')).toHaveAttribute('data-category', 'done');

  // When I hold it over the lower half of "Done"
  await page.mouse.move((await nameField(page, 'Done').boundingBox())!.x + 100, (await nameField(page, 'Done').boundingBox())!.y + 36, { steps: 5 });

  // Then the line is at the end of "Done"
  await expect(page.locator('.status-group[data-category="done"] .drop-line')).toHaveCount(1);

  // When I let go
  await page.mouse.up();

  // Then the line is gone and "Test" is behind "Done"
  await expect(page.locator('.drop-before, .drop-line')).toHaveCount(0);
  expect(await namesIn(page, 'Done')).toEqual(['Done', 'Test']);
});

test('AC3.5 puts a status with stories at the end of a category after the confirmation, and nothing else changes', async ({ page }) => {
  // When I drag "In progress", which has stories, onto the lower half of "Done", the last status of "Done"
  await drag(page, handle(page, 'In progress'), nameField(page, 'Done'), 0.85);

  // Then I am asked first, and nothing has changed yet
  const dialog = page.getByRole('dialog', { name: 'Move "In progress" to "Done"?' });
  await expect(dialog).toContainText('2 stories have this status (S-1, S-4)');
  expect(await namesIn(page, 'In progress')).toEqual(['In progress', 'Review']);

  // When I confirm
  await dialog.getByRole('button', { name: 'Move', exact: true }).click();

  // Then "In progress" is the last status of "Done", and "Review" and "To do" stay where they were
  expect(await namesIn(page, 'Done')).toEqual(['Done', 'In progress']);
  expect(await namesIn(page, 'In progress')).toEqual(['Review']);
  expect(await namesIn(page, 'Not started')).toEqual(['To do']);
});

test('AC3.5 lets me drop a status into an empty category', async ({ page }) => {
  // Given "In progress" is empty because I removed its statuses
  await addStatus(page, 'Not started', 'Idea');
  for (const name of ['Review', 'In progress']) {
    await page.getByRole('button', { name: `Remove status ${name}` }).click();
    await page.getByRole('dialog').getByRole('combobox', { name: 'Move to' }).selectOption('todo');
    await page.getByRole('dialog').getByRole('button', { name: /and remove$/ }).click();
    await expect(nameField(page, name)).toHaveCount(0);
  }
  await expect(group(page, 'In progress').getByText('Drag a status here')).toBeVisible();

  // When I drag "Idea" onto the hint of "In progress"
  await drag(page, handle(page, 'Idea'), group(page, 'In progress').getByText('Drag a status here'));

  // Then "Idea" is in "In progress", and "To do" stays in "Not started"
  expect(await namesIn(page, 'In progress')).toEqual(['Idea']);
  expect(await namesIn(page, 'Not started')).toEqual(['To do']);
  await expect(group(page, 'In progress').getByText('Drag a status here')).toHaveCount(0);
});

test('AC3.4 counts the stories of a status that moves to "Done" as done in the releases, from today on', async ({ page }) => {
  // Given Release 1.0 holds S-2 in "Review", so only S-5 (3 points) is done
  await page.getByRole('link', { name: 'Releases' }).click();
  const beta = page.locator('.release-card').filter({ hasText: 'Release 1.0 – Public Beta' });
  await expect(beta).toContainText('3 Points done');

  // When I move "Review" into "Done" and confirm
  await page.goto('/#/settings/statuses');
  await nameField(page, 'Review').focus();
  await page.keyboard.press('Alt+ArrowDown');
  const dialog = page.getByRole('dialog', { name: 'Move "Review" to "Done"?' });
  await expect(dialog).toContainText('1 story has this status (S-2)');
  await dialog.getByRole('button', { name: 'Move', exact: true }).click();
  expect(await namesIn(page, 'Done')).toEqual(['Review', 'Done']);

  // Then S-2 counts as done in the release (3 + 2 points)
  await page.getByRole('link', { name: 'Releases' }).click();
  await expect(beta).toContainText('5 Points done');
});

test('AC4.1 moves the stories of a removed status to the suggested status, also after a reload', async ({ page }) => {
  // When I click the trash can of "Review", which holds S-2
  await page.getByRole('button', { name: 'Remove status Review' }).click();

  // Then the dialog names the story and suggests "In progress"
  const dialog = page.getByRole('dialog', { name: 'Remove status "Review"?' });
  await expect(dialog).toContainText('1 story has this status (S-2). It gets another status.');
  await expect(dialog.getByRole('combobox', { name: 'Move to' })).toHaveValue('in_progress');

  // And after "Move 1 story and remove" S-2 is in "In progress" and "Review" is gone, also after a reload
  await dialog.getByRole('button', { name: 'Move 1 story and remove' }).click();
  await expect(nameField(page, 'Review')).toHaveCount(0);
  await page.reload();
  await toBoard(page);
  expect(await boardColumns(page)).toEqual(['To do', 'In progress', 'Done']);
  await expect(column(page, 'In progress').getByRole('group', { name: /^S-2: / })).toBeVisible();
});

test('AC4.1 lets me choose another target, and cancel changes nothing', async ({ page }) => {
  // When I open the dialog and cancel
  await page.getByRole('button', { name: 'Remove status Review' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

  // Then "Review" is still there
  await expect(nameField(page, 'Review')).toBeVisible();

  // When I open it again and choose "To do" as the target
  await page.getByRole('button', { name: 'Remove status Review' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Move to' }).selectOption('todo');
  await dialog.getByRole('button', { name: 'Move 1 story and remove' }).click();

  // Then S-2 is in "To do"
  await toBoard(page);
  await expect(column(page, 'To do').getByRole('group', { name: /^S-2: / })).toBeVisible();
});

test('AC5.1 keeps the data of an earlier version that had no status values', async ({ browser }) => {
  // Given the browser holds data of an earlier version: no status values, S-2 in "Review"
  const context = await browser.newContext({ locale: 'en-US', timezoneId: 'Europe/Zurich' });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
  await page.addInitScript(() => {
    if (window.localStorage.getItem('getitdone.snapshot.v1')) return;
    const story = (n: number, status: string) => ({
      id: `s${n}`,
      code: `S-${n}`,
      title: `Story ${n}`,
      description: '',
      epicId: 'e1',
      points: 2,
      status,
      sprintId: 'sprint-1',
      rank: n,
      criteria: [],
      values: {}
    });
    window.localStorage.setItem(
      'getitdone.snapshot.v1',
      JSON.stringify({
        epics: [{ id: 'e1', name: 'Boards', colorKey: 'blue', position: 0, values: {} }],
        sprints: [{ id: 'sprint-1', name: 'Sprint 1', startDate: '2026-10-06', endDate: '2026-10-19' }],
        stories: [story(1, 'todo'), story(2, 'review'), story(3, 'in_progress'), story(4, 'done')]
      })
    );
  });

  // When I open the app
  await page.goto('/#/board');
  await expect(page.getByRole('heading', { name: 'Sprint 1', level: 1 })).toBeVisible();

  // Then every story is there, S-2 is still in "Review", and the four former statuses are the default values
  expect(await boardColumns(page)).toEqual(['To do', 'In progress', 'Review', 'Done']);
  await expect(column(page, 'Review').getByRole('group', { name: /^S-2: / })).toBeVisible();
  await expect(page.getByRole('group', { name: /^S-\d: / })).toHaveCount(4);
  await page.goto('/#/settings/statuses');
  expect(await namesIn(page, 'Not started')).toEqual(['To do']);
  expect(await namesIn(page, 'In progress')).toEqual(['In progress', 'Review']);
  expect(await namesIn(page, 'Done')).toEqual(['Done']);
  await context.close();
});

test('AC5.3 keeps renamed, added and removed statuses after a restart', async ({ page }) => {
  // When I rename one status, add one and remove one, and reload the app
  await rename(page, 'To do', 'Backlog');
  await addStatus(page, 'In progress', 'Test');
  await page.getByRole('button', { name: 'Remove status Review' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Move 1 story and remove' }).click();
  await page.reload();

  // Then everything is still so
  expect(await namesIn(page, 'Not started')).toEqual(['Backlog']);
  expect(await namesIn(page, 'In progress')).toEqual(['In progress', 'Test']);
  await toBoard(page);
  expect(await boardColumns(page)).toEqual(['Backlog', 'In progress', 'Test', 'Done']);
});

test('AC6.1 shows the status values in German, French and Italian', async ({ page }) => {
  await addStatus(page, 'In progress', 'Test');
  const language = page.getByRole('banner').locator('select');

  const expected = [
    ['de', 'Status-Werte', ['Nicht begonnen', 'In Arbeit', 'Erledigt'], ['Offen', 'In Arbeit', 'Review', 'Test', 'Erledigt']],
    ['fr', 'Valeurs de statut', ['Pas commencé', 'En cours', 'Terminé'], ['À faire', 'En cours', 'Revue', 'Test', 'Terminé']],
    ['it', 'Valori di stato', ['Non iniziato', 'In corso', 'Completato'], ['Da fare', 'In corso', 'Revisione', 'Test', 'Completato']]
  ] as const;
  for (const [code, title, categories, statuses] of expected) {
    // When I switch the language
    await language.selectOption(code);

    // Then the page, the categories and the default statuses are translated, and my own status "Test" is not
    await expect(page.getByRole('heading', { name: title, level: 2 })).toBeVisible();
    for (const category of categories) await expect(group(page, category)).toBeVisible();
    const names = [...(await namesIn(page, categories[0])), ...(await namesIn(page, categories[1])), ...(await namesIn(page, categories[2]))];
    expect(names).toEqual(statuses);

    // And the board shows the same names in its columns and bands
    await page.goto('/#/board');
    await expect(page.getByRole('heading', { name: 'Sprint 1', level: 1 })).toBeVisible();
    expect(await boardColumns(page)).toEqual(statuses);
    for (const category of categories) await expect(page.getByRole('group', { name: category, exact: true })).toBeVisible();
    await page.goto('/#/settings/statuses');
  }
});

test('AC6.2 works with the keyboard only: add, reorder, change the category and remove', async ({ page }) => {
  // When I add a status with the keyboard
  await page.getByRole('button', { name: '+ Status in "In progress"' }).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Test');
  await page.keyboard.press('Enter');
  await expect(nameField(page, 'Test')).toBeVisible();

  // And reorder it and change its category with Alt + arrow keys
  await nameField(page, 'Test').focus();
  await page.keyboard.press('Alt+ArrowUp');
  expect(await namesIn(page, 'In progress')).toEqual(['In progress', 'Test', 'Review']);
  await page.keyboard.press('Alt+ArrowUp');
  await page.keyboard.press('Alt+ArrowUp');
  expect(await namesIn(page, 'Not started')).toEqual(['To do', 'Test']);

  // And open the removal dialog and leave it with Escape
  await page.getByRole('button', { name: 'Remove status Test' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Remove status "Test"?' })).toBeVisible();
  await page.keyboard.press('Escape');

  // Then nothing was removed and the focus is visible again on the page
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(nameField(page, 'Test')).toBeVisible();

  // When I open it again and confirm with the keyboard
  await page.getByRole('button', { name: 'Remove status Test' }).focus();
  await page.keyboard.press('Enter');
  const confirm = page.getByRole('button', { name: 'Remove', exact: true });
  for (let i = 0; i < 3 && !(await confirm.evaluate((element) => element === document.activeElement)); i += 1) await page.keyboard.press('Tab');
  await expect(confirm).toBeFocused();
  await page.keyboard.press('Enter');

  // Then the status is gone
  await expect(nameField(page, 'Test')).toHaveCount(0);
});

test('AC6.3 announces moving a status to screen readers', async ({ page }) => {
  // When I pick "Review" up with the space key, move it up and drop it (like a screen reader user, wait for each announcement)
  await handle(page, 'Review').focus();
  await page.keyboard.press('Space');
  await expect(announcement(page, 'Picked up Review.')).toHaveCount(1);
  await pressUntilAnnounced(page, 'ArrowUp', announcement(page, /^Review is over /));
  await page.keyboard.press('Space');

  // Then the screen reader says that it was dropped and where it is now
  await expect(announcement(page, 'Review was dropped.')).toHaveCount(1);
  await expect(announcement(page, 'Review is now at position 1 in "In progress".')).toHaveCount(1);
  expect(await namesIn(page, 'In progress')).toEqual(['Review', 'In progress']);

  // And the lock of a status that cannot be removed explains why
  await expect(page.getByText('To do is the last status in "Not started" and cannot be removed or moved to another category.', { exact: false }).first()).toBeAttached();
});
