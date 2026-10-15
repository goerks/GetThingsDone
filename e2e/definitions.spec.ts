import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * End-to-end tests of the Definition of Ready and Done (#26) in a real browser, following the test cases the PO approved
 * in the issue. Every test starts from the demo data of a fresh browser on Tuesday 13 October 2026. The demo lists are
 * switched off, as every list is until the team switches it on; `switchOn` turns them on, as the team does in Settings › Definitions.
 * Ready: Functional (has a description, has acceptance criteria), Technical (Dependencies are clarified), Design (Design is
 * available, Texts are agreed). Done: Quality (all criteria accepted, Code is reviewed), Documentation (Documentation is updated).
 * S-6 ("Operate the board with the keyboard only") is in "To do" and meets 2 of the 5 Ready items.
 */

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
});

const story = (page: Page, code: string): Locator => page.getByRole('group', { name: new RegExp(`(^|, )${code}: `) });
const column = (page: Page, name: string): Locator => page.getByRole('region', { name, exact: true });
const dialog = (page: Page, name: string | RegExp): Locator => page.getByRole('dialog', { name });
const toast = (page: Page, text: string | RegExp): Locator => page.locator('.toast').filter({ hasText: text });

async function open(page: Page, hash: string): Promise<void> {
  await page.goto(`/${hash}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/** Switches checking on for both lists, as the switches in the settings do, and reloads. */
async function switchOn(page: Page, hash = '#/board'): Promise<void> {
  await open(page, hash);
  await page.evaluate(() => {
    const key = 'getitdone.snapshot.v1';
    const snapshot = JSON.parse(window.localStorage.getItem(key) ?? '{}');
    snapshot.settings.definitions.ready.enforce = true;
    snapshot.settings.definitions.done.enforce = true;
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  });
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

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

const ask = (page: Page): Locator => dialog(page, /cannot move to “/);

/** Overrides the gate on purpose: the link-like button and then the confirmation of the second step. */
async function overrideGate(page: Page): Promise<void> {
  await ask(page).getByRole('button', { name: 'Override the gate…' }).click();
  await ask(page).getByRole('button', { name: 'Override and move' }).click();
}

test('AC1.3 drags a block above another one, folded or open, with its items, and keeps the order after a reload', async ({ page }) => {
  // Given the Ready list with the blocks Functional, Technical and Design
  await open(page, '#/settings/definitions');
  const names = page.getByRole('textbox', { name: /^Name of group / });
  await expect(names).toHaveCount(3);
  // When I fold "Technical" and drag its handle above "Functional"
  await page.getByRole('button', { name: 'Fold group Technical' }).click();
  await drag(page, page.getByRole('button', { name: 'Move group Technical', exact: true }), page.getByRole('button', { name: 'Move group Functional', exact: true }));
  // Then "Technical" is first, and the order is the same after a reload
  await expect(names.first()).toHaveValue('Technical');
  await page.reload();
  await expect(page.getByRole('textbox', { name: /^Name of group / }).first()).toHaveValue('Technical');
  // And the items travelled with their blocks
  await expect(page.getByRole('textbox', { name: 'Text of item Dependencies are clarified' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove item Has a description' })).toBeVisible();
});

test('AC1.1 adds a group and an item directly in the list and takes a check from the library, also after a reload', async ({ page }) => {
  await open(page, '#/settings/definitions');
  // When I add the group "Security" with Enter and an item into it, and take "Must be attached to an epic" from the library
  await page.getByRole('textbox', { name: 'New group' }).fill('Security');
  await page.keyboard.press('Enter');
  await page.getByRole('textbox', { name: 'New item in group Security' }).fill('Threats are reviewed');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Add a check from the library to group Security' }).click();
  await page.getByRole('option', { name: /Must be attached to an epic/ }).click();
  // Then the block holds both, and the library shows the check as already in the list
  await expect(page.getByRole('textbox', { name: 'Text of item Threats are reviewed' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove item Must be attached to an epic' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Name of group Security' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove item Must be attached to an epic' })).toBeVisible();
  await page.getByRole('button', { name: 'Add a check from the library to group Security' }).click();
  await expect(page.getByRole('option', { name: /Must be attached to an epic/ })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('option', { name: /Must be estimated/ })).toHaveAttribute('aria-disabled', 'false');
});

test('AC4.1 dragging a card out of "To do" asks for the Ready list and keeps the card where it is', async ({ page }) => {
  // Given the lists are switched on and S-6 is in "To do"
  await switchOn(page);
  // When I drag S-6 to "In progress"
  await drag(page, story(page, 'S-6'), column(page, 'In progress').locator('.column__list'));
  // Then a dialog names the 3 open items and S-6 is still in "To do"
  await expect(ask(page)).toBeVisible();
  await expect(ask(page)).toHaveAccessibleName('S-6 cannot move to “In progress”: 3 items of the Definition of Ready are still open');
  await expect(ask(page).getByRole('checkbox')).toHaveCount(3);
  await expect(ask(page).getByRole('button', { name: 'Move', exact: true })).toBeDisabled();
  await expect(column(page, 'To do').getByRole('group', { name: /^S-6: / })).toBeVisible();
});

test('AC4.2 resolves the open items in the dialog, moves the card and keeps the answers after a reload', async ({ page }) => {
  await switchOn(page);
  await drag(page, story(page, 'S-6'), column(page, 'In progress').locator('.column__list'));
  const question = ask(page);
  // When I check one item, set the two others to not relevant and press "Move"
  await question.getByRole('checkbox', { name: /Dependencies are clarified/ }).check();
  await question.getByRole('button', { name: 'Set “Design is available” to not relevant' }).click();
  await question.getByRole('button', { name: 'Set “Texts are agreed” to not relevant' }).click();
  await question.getByRole('button', { name: 'Move', exact: true }).click();
  // Then S-6 is in "In progress", without a mark in the backlog, also after a reload
  await expect(column(page, 'In progress').getByRole('group', { name: /^S-6: / })).toBeVisible();
  await page.reload();
  await expect(column(page, 'In progress').getByRole('group', { name: /^S-6: / })).toBeVisible();
  await open(page, '#/backlog');
  await expect(story(page, 'S-6')).toBeVisible();
  await expect(story(page, 'S-6').getByText(/Not ready/)).toHaveCount(0);
});

test('AC4.9 asks the same when the status is changed with the keyboard through the menu of the card', async ({ page }) => {
  await switchOn(page);
  // When I focus S-6 and open its menu with Shift+F10, and choose Status > In progress with the keyboard
  await story(page, 'S-6').focus();
  await page.keyboard.press('Shift+F10');
  const status = page.getByRole('menuitem', { name: 'Status' });
  await expect(status).toBeVisible();
  await status.focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('menuitemradio', { name: 'In progress', exact: true }).focus();
  await page.keyboard.press('Enter');
  // Then the dialog asks for the Ready list, and Escape cancels it: S-6 stays in "To do"
  await expect(ask(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(ask(page)).toHaveCount(0);
  await expect(column(page, 'To do').getByRole('group', { name: /^S-6: / })).toBeVisible();
});

test('AC4.3 an override moves a card to "Done" with open items on purpose and tells so in a notice with a way to the story', async ({ page }) => {
  // Given S-1 in "In progress" (2 of its 4 criteria are accepted)
  // When I drag S-1 to "Done" and override the gate on purpose
  await switchOn(page);
  await drag(page, story(page, 'S-1'), column(page, 'Done').locator('.column__list'));
  await expect(ask(page)).toHaveAccessibleName('S-1 cannot move to “Done”: 3 items of the Definition of Done are still open');
  await overrideGate(page);
  // Then S-1 is in "Done" and a notice says its Definition of Done is not met, with a way to the story
  await expect(column(page, 'Done').getByRole('group', { name: /^S-1: / })).toBeVisible();
  await expect(toast(page, 'S-1 moved on with the Definition of Done overridden.')).toBeVisible();
  await toast(page, 'S-1 moved on').getByRole('button', { name: 'Open story' }).click();
  await expect(dialog(page, /^S-1: /)).toBeVisible();
});

test('AC5.3 the board marks a card in "Done" that does not meet its Done list, also after a reload', async ({ page }) => {
  // Given S-1 was moved to "Done" with an override
  await switchOn(page);
  await drag(page, story(page, 'S-1'), column(page, 'Done').locator('.column__list'));
  await overrideGate(page);
  // Then its card carries the mark, also after a reload, and the done S-5 and the cards of other columns do not
  await expect(story(page, 'S-1').getByText('Not done 0/3')).toBeVisible();
  await page.reload();
  await expect(story(page, 'S-1').getByText('Not done 0/3')).toBeVisible();
  await expect(story(page, 'S-5').getByText(/Not done/)).toHaveCount(0);
  await expect(story(page, 'S-3').getByText(/Not (done|ready)/)).toHaveCount(0);
});

test('AC5.1 the backlog marks the stories that are not ready with icon and text', async ({ page }) => {
  await switchOn(page, '#/backlog');
  await expect(story(page, 'S-6').getByText('Not ready 2/5')).toBeVisible();
  await expect(story(page, 'S-7').getByText('Not ready 1/5')).toBeVisible();
  await expect(story(page, 'S-5').getByText(/Not ready/)).toHaveCount(0);
});

test('AC1.5 both lists are off at first and nothing is asked; the switch in the settings turns the gate on', async ({ page }) => {
  // Given the demo data, in which both lists are off
  await open(page, '#/board');
  // When I drag S-6 to "In progress"
  await drag(page, story(page, 'S-6'), column(page, 'In progress').locator('.column__list'));
  // Then it moves without a question and carries no mark
  await expect(column(page, 'In progress').getByRole('group', { name: /^S-6: / })).toBeVisible();
  await expect(ask(page)).toHaveCount(0);
  // When I switch the Definition of Ready on in the settings and drag S-3 out of "To do"
  await open(page, '#/settings/definitions');
  await expect(page.getByRole('switch', { name: 'Activate the Definition of Ready' })).not.toBeChecked();
  await page.getByRole('switch', { name: 'Activate the Definition of Ready' }).check();
  await open(page, '#/board');
  await drag(page, story(page, 'S-3'), column(page, 'In progress').locator('.column__list'));
  // Then the gate asks and S-3 stays in "To do"
  await expect(ask(page)).toBeVisible();
  await expect(column(page, 'To do').getByRole('group', { name: /^S-3: / })).toBeVisible();
});
