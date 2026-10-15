import { beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { EMPTY_DEFINITIONS } from './domain/definitions';
import { todayIso } from './domain/sprints';
import type { Definitions, Snapshot } from './domain/types';
import i18n, { initI18n } from './i18n';

beforeAll(() => {
  initI18n('en');
});

type User = ReturnType<typeof userEvent.setup>;

/**
 * The demo lists, switched on. Ready: Functional (has a description, has acceptance criteria), Technical (Dependencies are
 * clarified, may be n/a), Design (Design is available, Texts are agreed, both may be n/a). Done: Quality (all criteria
 * accepted, Code is reviewed) and Documentation (Documentation is updated, may be n/a).
 */
function demoDefinitions(enforce = true): Definitions {
  const definitions = seedSnapshot(todayIso()).settings.definitions;
  return { ready: { ...definitions.ready, enforce }, done: { ...definitions.done, enforce } };
}

async function open(hash: string, definitions: Definitions = demoDefinitions(), change: (snapshot: Snapshot) => Snapshot = (snapshot) => snapshot): Promise<LocalStorageRepository> {
  const snapshot = seedSnapshot(todayIso());
  const repository = new LocalStorageRepository();
  await repository.replaceAll(change({ ...snapshot, settings: { ...snapshot.settings, definitions } }));
  window.location.hash = hash;
  render(<App repository={repository} />);
  await screen.findByRole('heading', { level: 1 });
  return repository;
}

const story = (code: string): HTMLElement => screen.getByRole('group', { name: new RegExp(`${code}: `) });

async function openStory(user: User, code: string): Promise<HTMLElement> {
  await user.click(story(code));
  return await screen.findByRole('dialog', { name: new RegExp(`^${code}: `) });
}

const panel = (dialog: HTMLElement): HTMLElement => within(dialog).getByRole('region', { name: 'Definitions of this story' });

/** The header button of the card of a list; it folds and unfolds the card. */
const list = (name: string): HTMLElement => screen.getByRole('region', { name });

const cardHead = (dialog: HTMLElement, list: 'Ready' | 'Done'): HTMLElement => within(panel(dialog)).getByRole('button', { name: new RegExp(`^Definition of ${list}`) });

async function moveTo(user: User, dialog: HTMLElement, status: string): Promise<void> {
  await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Status' }), status);
}

/** The control of an item, which goes through three click states: not set, done, ignored. */
const control = (scope: HTMLElement, name: RegExp): HTMLElement => within(scope).getByRole('checkbox', { name });

/** Two clicks: not set → done → ignored ("not relevant"), for an item that allows it. */
async function ignore(user: User, scope: HTMLElement, name: RegExp): Promise<void> {
  await user.click(control(scope, name));
  await user.click(control(scope, name));
}

const transition = (): HTMLElement => screen.getByRole('dialog', { name: /cannot move to “/ });

/** Overrides the gate on purpose: the link-like button and then the confirmation of the second step. */
async function overrideGate(user: User, ask: HTMLElement): Promise<void> {
  await user.click(within(ask).getByRole('button', { name: 'Override the gate…' }));
  await user.click(within(ask).getByRole('button', { name: 'Override and move' }));
}

describe('Settings › Definitions', () => {
  it('AC1.1 adds a group and a manual item directly in the list with Enter', async () => {
    // Given the settings with the demo lists, both on, one under the other
    const user = userEvent.setup();
    const repository = await open('#/settings/definitions');
    const ready = list('Definition of Ready');
    expect(within(ready).getAllByRole('textbox', { name: /^Name of group / })).toHaveLength(3);
    // When I write "Security" in the row "New group" and press Enter, and "Threats are reviewed" in the add row of the new block
    await user.type(within(ready).getByRole('textbox', { name: 'New group' }), 'Security{Enter}');
    await user.type(within(ready).getByRole('textbox', { name: 'New item in group Security' }), 'Threats are reviewed{Enter}');
    // Then block and item are in the list and saved, the rows are empty again, and the folded card counts 4 groups and 6 items
    expect(screen.getByRole('textbox', { name: 'Name of group Security' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Text of item Threats are reviewed' })).toBeInTheDocument();
    expect(within(ready).getByRole('textbox', { name: 'New group' })).toHaveValue('');
    await user.click(within(ready).getByRole('button', { name: 'Fold the Definition of Ready' }));
    expect(ready).toHaveTextContent('4 groups · 6 items');
    await waitFor(async () => {
      const group = (await repository.load()).settings.definitions.ready.groups.find((item) => item.name === 'Security');
      expect(group?.items.map((item) => item.text)).toEqual(['Threats are reviewed']);
    });
  });

  it('AC1.2 adds an automatic item from the library with the keyboard; it cannot be renamed or chosen twice', async () => {
    // Given the Definition of Done card, block "Quality"
    const user = userEvent.setup();
    await open('#/settings/definitions');
    // When I open "From library" of the block, choose "Must be estimated" with the arrow keys and press Enter
    await user.click(screen.getByRole('button', { name: 'Add a check from the library to group Quality' }));
    const library = screen.getByRole('listbox', { name: 'Library of automatic checks' });
    expect(within(library).getAllByRole('option').map((option) => option.querySelector('.library__name')?.textContent)).toEqual([
      'Has a description',
      'Has acceptance criteria',
      'Must be estimated',
      'Must be attached to an epic',
      'All criteria accepted',
      'Is planned in a sprint'
    ]);
    // "All criteria accepted" is in the list already
    expect(within(library).getByRole('option', { name: /All criteria accepted/ })).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    // Then it is in the block marked as automatic, without a text field, and is "already in this list" in the library
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Text of item Must be estimated' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove item Must be estimated' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add a check from the library to group Quality' }));
    expect(within(screen.getByRole('listbox')).getByRole('option', { name: /Must be estimated/ })).toHaveAttribute('aria-disabled', 'true');
    // And Escape closes the library and the focus returns to its button
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a check from the library to group Quality' })).toHaveFocus();
  });

  it('AC1.2 the library offers "Must be attached to an epic" and adds it with a click', async () => {
    const user = userEvent.setup();
    const repository = await open('#/settings/definitions');
    await user.click(screen.getByRole('button', { name: 'Add a check from the library to group Technical' }));
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: /Must be attached to an epic/ }));
    await waitFor(async () => {
      const technical = (await repository.load()).settings.definitions.ready.groups.find((group) => group.name === 'Technical');
      expect(technical?.items.map((item) => item.rule ?? item.text)).toEqual(['Dependencies are clarified', 'hasEpic']);
    });
  });

  it('AC1.3 folds a block to its head and unfolds it again', async () => {
    const user = userEvent.setup();
    await open('#/settings/definitions');
    await user.click(screen.getByRole('button', { name: 'Fold group Design' }));
    expect(screen.queryByRole('textbox', { name: 'Text of item Design is available' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name of group Design' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Unfold group Design' }));
    expect(screen.getByRole('textbox', { name: 'Text of item Design is available' })).toBeVisible();
  });

  it('AC1.3 renames a block, moves an item with the keyboard and removes an item', async () => {
    const user = userEvent.setup();
    const repository = await open('#/settings/definitions');
    // When I rename "Technical" to "Technique"
    const name = screen.getByRole('textbox', { name: 'Name of group Technical' });
    await user.clear(name);
    await user.type(name, 'Technique{Enter}');
    // And move "Design is available" up with Alt+ArrowUp into the group above
    await user.click(screen.getByRole('textbox', { name: 'Text of item Design is available' }));
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    // And remove "Texts are agreed"
    await user.click(screen.getByRole('button', { name: 'Remove item Texts are agreed' }));
    // Then everything is saved
    await waitFor(async () => {
      const { groups } = (await repository.load()).settings.definitions.ready;
      expect(groups.map((group) => [group.name, group.items.map((item) => item.text || item.rule)])).toEqual([
        ['Functional', ['hasDescription', 'hasCriteria']],
        ['Technique', ['Dependencies are clarified', 'Design is available']],
        ['Design', []]
      ]);
    });
  });

  it('AC1.4 an item allows "not relevant" in a story only when it is marked so', async () => {
    // Given "Dependencies are clarified" allows it and "Code is reviewed" does not
    const user = userEvent.setup();
    await open('#/settings/definitions');
    expect(screen.getByRole('checkbox', { name: 'Dependencies are clarified may be set to not relevant' })).toBeChecked();
    const review = screen.getByRole('checkbox', { name: 'Code is reviewed may be set to not relevant' });
    expect(review).not.toBeChecked();
    // When I allow it
    await user.click(review);
    // Then it is saved on the item
    expect(review).toBeChecked();
  });

  it('AC1.5 both lists are off in the demo data and say so, with nothing of their content shown', async () => {
    await open('#/settings/definitions', seedSnapshot(todayIso()).settings.definitions);
    for (const name of ['Definition of Ready', 'Definition of Done']) {
      expect(within(list(name)).getByRole('switch', { name: new RegExp(`Activate the ${name}`) })).not.toBeChecked();
      expect(within(list(name)).getByRole('note')).toHaveTextContent('The list is off: it is not shown in stories and nothing is checked or marked.');
      expect(within(list(name)).queryByRole('textbox')).not.toBeInTheDocument();
    }
  });

  it('AC1.6 an empty list that is off offers the example list or an empty start, and both switch it on', async () => {
    const user = userEvent.setup();
    const repository = await open('#/settings/definitions', EMPTY_DEFINITIONS);
    expect(within(list('Definition of Ready')).getByRole('note')).toHaveTextContent('This list is empty and off.');
    // When I insert the example list into Ready and start Done empty
    await user.click(within(list('Definition of Ready')).getByRole('button', { name: 'Insert example list' }));
    await user.click(within(list('Definition of Done')).getByRole('button', { name: 'Start empty' }));
    // Then Ready is on with the example groups, Done is on and empty, and both are saved
    expect(within(list('Definition of Ready')).getByRole('switch')).toBeChecked();
    expect(within(list('Definition of Ready')).getByRole('textbox', { name: 'Name of group Functional' })).toBeInTheDocument();
    expect(within(list('Definition of Done')).getByRole('switch')).toBeChecked();
    expect(within(list('Definition of Done')).getByText(/This list has no items yet/)).toBeInTheDocument();
    await waitFor(async () => {
      const { ready, done } = (await repository.load()).settings.definitions;
      expect([ready.enforce, ready.groups.length, done.enforce, done.groups.length]).toEqual([true, 3, true, 0]);
    });
  });

  it('AC1.7 an active list folds to a summary and unfolds again; the settings keep what it holds', async () => {
    const user = userEvent.setup();
    await open('#/settings/definitions');
    const ready = list('Definition of Ready');
    // When I fold the card
    await user.click(within(ready).getByRole('button', { name: 'Fold the Definition of Ready' }));
    // Then only the heading with the summary stays, and the content comes back on unfolding
    expect(ready).toHaveTextContent('3 groups · 5 items');
    expect(within(ready).queryByRole('textbox', { name: 'Name of group Technical' })).not.toBeInTheDocument();
    await user.click(within(ready).getByRole('button', { name: 'Unfold the Definition of Ready' }));
    expect(within(ready).getByRole('textbox', { name: 'Name of group Technical' })).toBeVisible();
  });

  it('AC1.5 a list is switched on and off with its own switch', async () => {
    const user = userEvent.setup();
    const repository = await open('#/settings/definitions');
    const readySwitch = screen.getByRole('switch', { name: /Activate the Definition of Ready/ });
    expect(readySwitch).toBeChecked();
    expect(screen.getByRole('switch', { name: /Activate the Definition of Done/ })).toBeChecked();
    await user.click(readySwitch);
    await waitFor(async () => expect((await repository.load()).settings.definitions.ready.enforce).toBe(false));
    expect((await repository.load()).settings.definitions.done.enforce).toBe(true);
  });
});

describe('Story dialog', () => {
  it('AC3.1 shows a card per list with counter and progress, the card of the status open, and the groups with their own counters', async () => {
    // Given S-6 in "To do" with a description and 4 open criteria
    const user = userEvent.setup();
    await open('#/board');
    const dialog = await openStory(user, 'S-6');
    // Then both cards show their counters, the Ready card is open and the Done card is closed
    const heads = within(panel(dialog)).getAllByRole('button', { name: /^Definition of/ });
    expect(heads.map((head) => head.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['▾Definition of Ready· 2/5⚠ 3 items open3', '▸Definition of Done· 0/3⚠ 3 items open3']);
    expect(cardHead(dialog, 'Ready')).toHaveAttribute('aria-expanded', 'true');
    expect(cardHead(dialog, 'Done')).toHaveAttribute('aria-expanded', 'false');
    expect(within(panel(dialog)).getByRole('button', { name: /Functional/ })).toHaveAttribute('aria-expanded', 'true');
    expect(within(panel(dialog)).getByText('2/2')).toBeInTheDocument();
    // And a group can be folded away, and the Done card opens with a click
    await user.click(within(panel(dialog)).getByRole('button', { name: /Functional/ }));
    expect(within(panel(dialog)).queryByRole('checkbox', { name: /Has a description/ })).not.toBeInTheDocument();
    await user.click(cardHead(dialog, 'Done'));
    expect(within(panel(dialog)).getByRole('checkbox', { name: /Code is reviewed/ })).toBeInTheDocument();
  });

  it('AC3.1 a story in "In progress" opens the Done card', async () => {
    const user = userEvent.setup();
    await open('#/board');
    const dialog = await openStory(user, 'S-1');
    expect(cardHead(dialog, 'Done')).toHaveAttribute('aria-expanded', 'true');
    expect(cardHead(dialog, 'Ready')).toHaveAttribute('aria-expanded', 'false');
  });

  it('AC3.1 a story in "Done" opens no card, and a card whose items are all met stays closed when the story opens', async () => {
    const user = userEvent.setup();
    await open('#/board');
    // Given S-5 in "Done"
    let dialog = await openStory(user, 'S-5');
    // Then neither card is open
    expect(cardHead(dialog, 'Ready')).toHaveAttribute('aria-expanded', 'false');
    expect(cardHead(dialog, 'Done')).toHaveAttribute('aria-expanded', 'false');
    // When I meet the last open Ready items of S-6 and open it again
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    dialog = await openStory(user, 'S-6');
    for (const item of [/Dependencies are clarified/, /Design is available/, /Texts are agreed/]) {
      await user.click(within(panel(dialog)).getByRole('checkbox', { name: item }));
    }
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    dialog = await openStory(user, 'S-6');
    // Then the Ready card stays closed, as nothing in it is open
    expect(cardHead(dialog, 'Ready')).toHaveAttribute('aria-expanded', 'false');
  }, 20000);

  it('AC3.4 hides the definitions in the story and shows them again, and remembers the choice in this browser', async () => {
    // Given S-6 with both cards
    const user = userEvent.setup();
    await open('#/board');
    let dialog = await openStory(user, 'S-6');
    // When I choose "Hide the definitions" in the menu of a card
    await user.click(within(panel(dialog)).getByRole('button', { name: 'Options of the Definition of Ready' }));
    await user.click(screen.getByRole('menuitem', { name: 'Hide the definitions' }));
    // Then only a line with "Show definitions" and the counters is left
    expect(within(panel(dialog)).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(panel(dialog)).toHaveTextContent('Definition of Ready 2/5 · Definition of Done 0/3 · hidden (in this browser only)');
    // And it stays hidden in another story, until I show it again
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    dialog = await openStory(user, 'S-3');
    expect(within(panel(dialog)).queryByRole('button', { name: /^Definition of Ready/ })).not.toBeInTheDocument();
    await user.click(within(panel(dialog)).getByRole('button', { name: 'Show definitions' }));
    expect(cardHead(dialog, 'Ready')).toBeInTheDocument();
    expect(window.localStorage.getItem('getitdone.definitions.hidden')).toBe('0');
  }, 20000);

  it('AC3.5 shows only the open items on request, and says so when all are met', async () => {
    const user = userEvent.setup();
    await open('#/board');
    const dialog = await openStory(user, 'S-6');
    expect(within(panel(dialog)).getByRole('checkbox', { name: /Has a description/ })).toBeInTheDocument();
    // When I choose "Show only open items"
    await user.click(within(panel(dialog)).getByRole('button', { name: 'Options of the Definition of Ready' }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: /Show only open items/ }));
    // Then the met items and the groups without open items are gone
    expect(within(panel(dialog)).queryByRole('checkbox', { name: /Has a description/ })).not.toBeInTheDocument();
    expect(within(panel(dialog)).queryByRole('button', { name: /Functional/ })).not.toBeInTheDocument();
    expect(within(panel(dialog)).getByRole('checkbox', { name: /Dependencies are clarified/ })).toBeInTheDocument();
    // And an item that is done leaves the view at once
    await user.click(control(panel(dialog), /Dependencies are clarified/));
    expect(within(panel(dialog)).queryByRole('checkbox', { name: /Dependencies are clarified/ })).not.toBeInTheDocument();
    // And once the other two are resolved too, the card says that all are met
    await user.click(control(panel(dialog), /Design is available/));
    await user.click(control(panel(dialog), /Texts are agreed/));
    expect(within(panel(dialog)).getByText('All items are met.')).toBeInTheDocument();
  });

  it('AC2.1 one control goes through the three click states: not set, done, ignored, and back', async () => {
    const user = userEvent.setup();
    const repository = await open('#/board');
    const dialog = await openStory(user, 'S-6');
    const ready = panel(dialog);
    const checks = async () => (await repository.load()).stories.find((item) => item.code === 'S-6')?.checks;
    // Given "Design is available" is not set
    expect(control(ready, /Design is available/)).toHaveAttribute('aria-checked', 'false');
    // When I click once, it is done
    await user.click(control(ready, /Design is available/));
    expect(control(ready, /Design is available/)).toHaveAttribute('aria-checked', 'true');
    await waitFor(async () => expect(await checks()).toEqual({ 'def-ready-design': 'checked' }));
    // When I click again, it is ignored: the counter names it and it is struck through
    await user.click(control(ready, /Design is available/));
    expect(control(ready, /Design is available/)).toHaveAttribute('aria-checked', 'mixed');
    expect(control(ready, /Design is available/)).toHaveAccessibleDescription('ignored (not relevant)');
    expect(within(ready).getByText('0/2 · 1 n/a')).toBeInTheDocument();
    await waitFor(async () => expect(await checks()).toEqual({ 'def-ready-design': 'na' }));
    // When I click a third time, it is not set again
    await user.click(control(ready, /Design is available/));
    expect(control(ready, /Design is available/)).toHaveAttribute('aria-checked', 'false');
    await waitFor(async () => expect(await checks()).toEqual({}));
  });

  it('AC2.2 an item that does not allow "not relevant" only goes between not set and done', async () => {
    const user = userEvent.setup();
    await open('#/board');
    const dialog = await openStory(user, 'S-6');
    await user.click(cardHead(dialog, 'Done'));
    const review = (): HTMLElement => control(panel(dialog), /Code is reviewed/);
    // When I click twice, it is done and then not set again; it is never ignored
    await user.click(review());
    expect(review()).toHaveAttribute('aria-checked', 'true');
    await user.click(review());
    expect(review()).toHaveAttribute('aria-checked', 'false');
    // And the key N does nothing there
    review().focus();
    await user.keyboard('n');
    expect(review()).toHaveAttribute('aria-checked', 'false');
    // While an item that allows it can be ignored
    await user.click(control(panel(dialog), /Documentation is updated/));
    await user.click(control(panel(dialog), /Documentation is updated/));
    expect(control(panel(dialog), /Documentation is updated/)).toHaveAttribute('aria-checked', 'mixed');
  });

  it('AC2.3 an automatic item cannot be ticked and follows the story', async () => {
    // Given S-3 with 3 criteria, none accepted
    const user = userEvent.setup();
    await open('#/board');
    const dialog = await openStory(user, 'S-3');
    await user.click(cardHead(dialog, 'Done'));
    const item = within(panel(dialog)).getByRole('checkbox', { name: /All criteria accepted/ });
    expect(item).toBeDisabled();
    expect(item).not.toBeChecked();
    // When I accept all criteria
    const criteria = within(dialog).getAllByRole('list')[0];
    for (const box of within(criteria).getAllByRole('checkbox')) await user.click(box);
    // Then the item is checked
    expect(within(panel(dialog)).getByRole('checkbox', { name: /All criteria accepted/ })).toBeChecked();
  });

  it('AC3.2 works with the keyboard only: Space ticks, N sets not relevant', async () => {
    const user = userEvent.setup();
    await open('#/board');
    const dialog = await openStory(user, 'S-6');
    const box = within(panel(dialog)).getByRole('checkbox', { name: /Dependencies are clarified/ });
    box.focus();
    await user.keyboard(' ');
    expect(box).toBeChecked();
    await user.keyboard('n');
    expect(within(panel(dialog)).getByRole('checkbox', { name: /Dependencies are clarified/ })).toHaveAttribute('aria-checked', 'mixed');
    expect(within(panel(dialog)).getByText('0/1 · 1 n/a')).toBeInTheDocument();
    // N on an item that does not allow it does nothing
    await user.click(cardHead(dialog, 'Done'));
    const review = within(panel(dialog)).getByRole('checkbox', { name: /Code is reviewed/ });
    review.focus();
    await user.keyboard('n');
    expect(review).not.toBeChecked();
    expect(review).toHaveAttribute('aria-checked', 'false');
  });

  it('AC3.2 the cards open and close with Enter and the menu works with the keyboard', async () => {
    const user = userEvent.setup();
    await open('#/board');
    const dialog = await openStory(user, 'S-6');
    cardHead(dialog, 'Done').focus();
    await user.keyboard('{Enter}');
    expect(cardHead(dialog, 'Done')).toHaveAttribute('aria-expanded', 'true');
    // The menu opens with Enter, Escape closes it and the focus returns to its button
    const menuButton = within(panel(dialog)).getByRole('button', { name: 'Options of the Definition of Ready' });
    menuButton.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menuitemcheckbox', { name: /Show only open items/ })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(menuButton).toHaveFocus();
  });

  it('AC3.3 a list that is empty or off has no card, and two lists that are off no panel', async () => {
    const user = userEvent.setup();
    // Given the Ready list is on and the Done list is empty
    await open('#/board', { ready: demoDefinitions().ready, done: EMPTY_DEFINITIONS.done });
    let dialog = await openStory(user, 'S-6');
    expect(within(panel(dialog)).getAllByRole('button', { name: /^Definition of/ })).toHaveLength(1);
    expect(within(panel(dialog)).queryByRole('button', { name: /^Definition of Done/ })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Given the Done list has items but is switched off
    cleanup();
    await open('#/board', { ready: demoDefinitions().ready, done: demoDefinitions(false).done });
    dialog = await openStory(user, 'S-6');
    expect(within(panel(dialog)).queryByRole('button', { name: /^Definition of Done/ })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Given both lists are switched off (the default)
    cleanup();
    await open('#/board', demoDefinitions(false));
    dialog = await openStory(user, 'S-6');
    expect(within(dialog).queryByRole('region', { name: 'Definitions of this story' })).not.toBeInTheDocument();
  });

});

describe('Change of status', () => {
  it('AC4.1 leaving "To do" asks for the Ready list and shows only the open items', async () => {
    // Given S-6 in "To do" with 3 open items of the Ready list
    const user = userEvent.setup();
    await open('#/board');
    const dialog = await openStory(user, 'S-6');
    // When I change its status to "In progress"
    await moveTo(user, dialog, 'In progress');
    // Then a dialog names the 3 open items by group, and the story is not moved yet
    const ask = transition();
    expect(ask).toHaveAccessibleName('S-6 cannot move to “In progress”: 3 items of the Definition of Ready are still open');
    expect(within(ask).getAllByRole('checkbox').map((box) => document.getElementById(box.getAttribute('aria-labelledby') ?? '')?.textContent)).toEqual(['Dependencies are clarified', 'Design is available', 'Texts are agreed']);
    expect(within(ask).queryByRole('checkbox', { name: /Has a description/ })).not.toBeInTheDocument();
    expect(within(ask).getByRole('button', { name: 'Move' })).toBeDisabled();
    expect(within(dialog).getByRole('combobox', { name: 'Status' })).toHaveValue('todo');
  });

  it('AC4.2 resolves the open items in the dialog and moves; the items stay resolved on the story', async () => {
    const user = userEvent.setup();
    const repository = await open('#/board');
    const dialog = await openStory(user, 'S-6');
    await moveTo(user, dialog, 'In progress');
    const ask = transition();
    // When I check one item and set the two others to not relevant
    await user.click(within(ask).getByRole('checkbox', { name: /Dependencies are clarified/ }));
    await ignore(user, ask, /Design is available/);
    expect(within(ask).getByRole('button', { name: 'Move' })).toBeDisabled();
    await ignore(user, ask, /Texts are agreed/);
    // Then the items stay in the dialog and "Move" works
    expect(within(ask).getAllByRole('checkbox')).toHaveLength(3);
    await user.click(within(ask).getByRole('button', { name: 'Move' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /cannot move to “/ })).not.toBeInTheDocument());
    // And the story is in "In progress" with its items, also after loading again
    expect(within(dialog).getByRole('combobox', { name: 'Status' })).toHaveValue('in_progress');
    await waitFor(async () => {
      const saved = (await repository.load()).stories.find((item) => item.code === 'S-6');
      expect(saved?.status).toBe('in_progress');
      expect(saved?.checks).toEqual({ 'def-ready-dependencies': 'checked', 'def-ready-design': 'na', 'def-ready-texts': 'na' });
    });
  });

  it('AC4.3 an override moves the story only after a second, deliberate step that names what stays open', async () => {
    const user = userEvent.setup();
    await open('#/board');
    const dialog = await openStory(user, 'S-6');
    await moveTo(user, dialog, 'In progress');
    const ask = transition();
    // When I ask to override, the story is still where it was, and the second step names the 3 items that stay open
    await user.click(within(ask).getByRole('button', { name: 'Override the gate…' }));
    expect(within(dialog).getByRole('combobox', { name: 'Status' })).toHaveValue('todo');
    expect(within(ask).getByRole('alert')).toHaveTextContent('Override the Definition of Ready for S-6?');
    expect(within(ask).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Dependencies are clarified', 'Design is available', 'Texts are agreed']);
    // And "Back to the items" returns to the list
    await user.click(within(ask).getByRole('button', { name: 'Back to the items' }));
    expect(within(ask).getByRole('button', { name: 'Move' })).toBeDisabled();
    // Then only "Override and move" moves it
    await overrideGate(user, ask);
    expect(within(dialog).getByRole('combobox', { name: 'Status' })).toHaveValue('in_progress');
    expect(cardHead(dialog, 'Ready')).toHaveTextContent('2/5');
  });

  it('AC4.4 "Cancel" keeps the story, "Open story" leads to its dialog', async () => {
    const user = userEvent.setup();
    await open('#/board');
    let dialog = await openStory(user, 'S-6');
    await moveTo(user, dialog, 'In progress');
    await user.click(within(transition()).getByRole('button', { name: 'Cancel' }));
    expect(within(dialog).getByRole('combobox', { name: 'Status' })).toHaveValue('todo');
    // When I ask again and choose "Open story"
    await moveTo(user, dialog, 'In progress');
    await user.click(within(transition()).getByRole('button', { name: 'Open story' }));
    dialog = await screen.findByRole('dialog', { name: /^S-6: / });
    expect(within(dialog).getByRole('combobox', { name: 'Status' })).toHaveValue('todo');
    expect(screen.queryByRole('dialog', { name: /cannot move to “/ })).not.toBeInTheDocument();
  });

  it('AC4.4 Escape cancels the question', async () => {
    const user = userEvent.setup();
    await open('#/board');
    const dialog = await openStory(user, 'S-6');
    await moveTo(user, dialog, 'In progress');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /cannot move to “/ })).not.toBeInTheDocument());
    expect(within(dialog).getByRole('combobox', { name: 'Status' })).toHaveValue('todo');
  });

  it('AC4.9 asks the same through the status field of the story dialog, and Escape leaves the story where it is', async () => {
    const user = userEvent.setup();
    await open('#/board');
    const dialog = await openStory(user, 'S-6');
    await moveTo(user, dialog, 'In progress');
    expect(transition()).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /cannot move to “/ })).not.toBeInTheDocument());
    expect(within(dialog).getByRole('combobox', { name: 'Status' })).toHaveValue('todo');
  });

  it('AC4.5 entering "Done" asks for the Done list, not the Ready list', async () => {
    // Given S-1 in "In progress"
    const user = userEvent.setup();
    await open('#/board');
    const dialog = await openStory(user, 'S-1');
    // When I change its status to "Done"
    await moveTo(user, dialog, 'Done');
    // Then the Done list is asked: the 3 open items of it ("All criteria accepted" is open, 2 of 4 criteria are accepted)
    const ask = transition();
    expect(ask).toHaveAccessibleName('S-1 cannot move to “Done”: 3 items of the Definition of Done are still open');
    expect(within(ask).getByText(/→ Done · Definition of Done/)).toBeInTheDocument();
    expect(within(ask).queryByText(/Dependencies are clarified/)).not.toBeInTheDocument();
    await overrideGate(user, ask);
    expect(within(dialog).getByRole('combobox', { name: 'Status' })).toHaveValue('done');
  });

  it('AC4.6 from "To do" straight to "Done" asks for both lists, one after the other', async () => {
    const user = userEvent.setup();
    await open('#/board');
    const dialog = await openStory(user, 'S-6');
    await moveTo(user, dialog, 'Done');
    // Then first the Ready list
    let ask = transition();
    expect(within(ask).getByText(/To do → Done · Definition of Ready/)).toBeInTheDocument();
    await user.click(within(ask).getByRole('checkbox', { name: /Dependencies are clarified/ }));
    await ignore(user, ask, /Design is available/);
    await ignore(user, ask, /Texts are agreed/);
    await user.click(within(ask).getByRole('button', { name: 'Next list' }));
    // Then the Done list
    ask = transition();
    expect(within(ask).getByText(/→ Done · Definition of Done/)).toBeInTheDocument();
    expect(within(ask).getByRole('checkbox', { name: /Code is reviewed/ })).toBeInTheDocument();
    await overrideGate(user, ask);
    expect(within(dialog).getByRole('combobox', { name: 'Status' })).toHaveValue('done');
    // And the notice names the open Done list, with a way to the story
    expect(await screen.findByText('S-6 moved on with the Definition of Done overridden.')).toBeInTheDocument();
  });

  it('AC4.7 inside a category and backwards nothing is asked', async () => {
    const user = userEvent.setup();
    await open('#/board');
    const dialog = await openStory(user, 'S-1');
    await moveTo(user, dialog, 'Review');
    expect(screen.queryByRole('dialog', { name: /cannot move to “/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('combobox', { name: 'Status' })).toHaveValue('review');
    await moveTo(user, dialog, 'To do');
    expect(screen.queryByRole('dialog', { name: /cannot move to “/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('combobox', { name: 'Status' })).toHaveValue('todo');
  });

  it('AC4.8 a story that meets the list moves without a question', async () => {
    // Given S-6 with all items of the Ready list resolved
    const user = userEvent.setup();
    await open('#/board', demoDefinitions(), (snapshot) => ({
      ...snapshot,
      stories: snapshot.stories.map((item) => (item.code === 'S-6' ? { ...item, checks: { 'def-ready-dependencies': 'checked', 'def-ready-design': 'na', 'def-ready-texts': 'checked' } } : item))
    }));
    const dialog = await openStory(user, 'S-6');
    await moveTo(user, dialog, 'In progress');
    expect(screen.queryByRole('dialog', { name: /cannot move to “/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('combobox', { name: 'Status' })).toHaveValue('in_progress');
  });

  it('AC1.5 a list that is switched off asks nothing', async () => {
    const user = userEvent.setup();
    await open('#/board', demoDefinitions(false));
    const dialog = await openStory(user, 'S-6');
    await moveTo(user, dialog, 'Done');
    expect(screen.queryByRole('dialog', { name: /cannot move to “/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('combobox', { name: 'Status' })).toHaveValue('done');
  });
});

describe('Marks', () => {
  it('AC5.1 the backlog marks stories that are not ready, with their counter', async () => {
    // Given the Ready list and the demo stories (S-6 meets 2 of 5, S-7 has no criteria and meets 1 of 5)
    await open('#/backlog');
    // Then both rows carry the mark with icon and text, done S-5 none
    expect(within(screen.getByRole('group', { name: /S-6:/ })).getByText(/Not ready 2\/5/)).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: /S-7:/ })).getByText(/Not ready 1\/5/)).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: /S-5:/ })).queryByText(/Not ready/)).not.toBeInTheDocument();
  });

  it('AC5.2 the mark goes when the story meets the list', async () => {
    const user = userEvent.setup();
    await open('#/backlog', demoDefinitions(), (snapshot) => ({
      ...snapshot,
      stories: snapshot.stories.map((item) => (item.code === 'S-6' ? { ...item, checks: { 'def-ready-dependencies': 'checked', 'def-ready-design': 'na', 'def-ready-texts': 'na' } } : item))
    }));
    expect(within(screen.getByRole('group', { name: /S-6:/ })).queryByText(/Not ready/)).not.toBeInTheDocument();
    // When the demo item is unchecked in the story, the mark returns
    const dialog = await openStory(user, 'S-6');
    // (the card is closed, as nothing in it is open; done → ignored → not set: two clicks)
    await user.click(cardHead(dialog, 'Ready'));
    await user.click(control(panel(dialog), /Dependencies are clarified/));
    await user.click(control(panel(dialog), /Dependencies are clarified/));
    expect(within(screen.getByRole('group', { name: /S-6:/, hidden: true })).getByText(/Not ready 2\/5 · 2 n\/a/)).toBeInTheDocument();
  });

  it('AC5.3 the board marks a done story that does not meet its Done list', async () => {
    // Given S-6 was moved to "Done" with an override
    const user = userEvent.setup();
    await open('#/board');
    const dialog = await openStory(user, 'S-6');
    await moveTo(user, dialog, 'Done');
    await overrideGate(user, transition());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Then its card shows "Not done 0/3"; cards of other columns show nothing
    expect(within(story('S-6')).getByText(/Not done 0\/3/)).toBeInTheDocument();
    expect(within(story('S-3')).queryByText(/Not (done|ready)/)).not.toBeInTheDocument();
  });

  it('AC5.4 a story that was done before the list changed is never marked', async () => {
    // Given S-5 is done and has no snapshot (it was done before the lists existed)
    await open('#/board');
    expect(within(story('S-5')).queryByText(/Not done/)).not.toBeInTheDocument();
  });

  it('AC5.4 a story that becomes done afterwards is held to the list as it is then', async () => {
    const user = userEvent.setup();
    const repository = await open('#/board');
    const dialog = await openStory(user, 'S-1');
    await moveTo(user, dialog, 'Done');
    await overrideGate(user, transition());
    await waitFor(async () => expect((await repository.load()).stories.find((item) => item.code === 'S-1')?.doneItems).toEqual(['def-done-accepted', 'def-done-review', 'def-done-docs']));
  });

  it('AC5.5 empty lists mark nothing and ask nothing', async () => {
    const user = userEvent.setup();
    await open('#/backlog', EMPTY_DEFINITIONS);
    expect(screen.queryByText(/Not ready/)).not.toBeInTheDocument();
    const dialog = await openStory(user, 'S-6');
    await moveTo(user, dialog, 'Done');
    expect(screen.queryByRole('dialog', { name: /cannot move to “/ })).not.toBeInTheDocument();
  });
});

describe('Languages', () => {
  it.each([
    ['de', 'Definition of Ready', 'Nicht bereit 2/5'],
    ['fr', 'Definition of Ready', 'Pas prête 2/5'],
    ['it', 'Definition of Ready', 'Non pronta 2/5']
  ])('AC6.1 shows the texts in %s', async (language, title, chip) => {
    await i18n.changeLanguage(language);
    try {
      await open('#/backlog');
      expect(within(screen.getByRole('group', { name: /S-6/ })).getByText(new RegExp(chip))).toBeInTheDocument();
      window.location.hash = '#/settings/definitions';
      expect(await screen.findByRole('region', { name: new RegExp(title) })).toBeInTheDocument();
    } finally {
      await i18n.changeLanguage('en');
    }
  });
});
