import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next from 'i18next';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { EMPTY_DEFINITIONS } from './domain/definitions';
import { todayIso } from './domain/sprints';
import { statesOf, type ChangeVersion } from './domain/changeLog';
import type { Snapshot } from './domain/types';
import { initI18n } from './i18n';

/*
 * Component tests of the team and the assignment of stories (#18), following the test cases the PO approved in the issue.
 * The demo data hold the team Michael Burkard (MB), Anna Keller (AK) and Luca Rossi (LR). Anna has S-1 and S-3, Michael
 * has S-2 and S-5, Luca has no story; S-4, S-6 and S-7 are not assigned.
 */

// The tests open the whole app and click through it; on a busy build machine five seconds are not always enough.
vi.setConfig({ testTimeout: 30_000 });

beforeAll(() => {
  initI18n('en');
});

beforeEach(async () => {
  await i18next.changeLanguage('en');
});

async function open(hash: string, change: (snapshot: Snapshot) => Snapshot = (snapshot) => snapshot): Promise<LocalStorageRepository> {
  const repository = new LocalStorageRepository();
  const seed = seedSnapshot(todayIso());
  await repository.replaceAll(change({ ...seed, settings: { ...seed.settings, definitions: EMPTY_DEFINITIONS } }));
  window.location.hash = hash;
  render(<App repository={repository} />);
  return repository;
}

const cardNames = (): string[] => screen.queryAllByRole('group', { name: /^S-\d+:/ }).map((card) => card.getAttribute('aria-label') ?? '');

const storyOf = async (repository: LocalStorageRepository, code: string) => (await repository.load()).stories.find((story) => story.code === code);

async function openStory(user: ReturnType<typeof userEvent.setup>, code: string): Promise<HTMLElement> {
  await user.dblClick(await screen.findByRole('group', { name: new RegExp(`^${code}:`) }));
  return screen.findByRole('dialog', { name: new RegExp(`^${code}:`) });
}

describe('team in the settings (#18)', () => {
  it('AC1.1 adds a member who stays after a reload', async () => {
    // Given the settings, section "Team", with three members
    const user = userEvent.setup();
    const repository = await open('#/settings/team');
    const list = await screen.findByRole('list', { name: 'Team members' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    // When I click "Add member" and enter the name "Sara Meier"
    await user.click(screen.getByRole('button', { name: 'Add member' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Sara Meier');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    // Then "Sara Meier" is in the list with the initials "SM", and the data hold her after a reload
    expect(await within(await screen.findByRole('list', { name: 'Team members' })).findByText('Sara Meier')).toBeInTheDocument();
    expect(screen.getByText('Initials SM')).toBeInTheDocument();
    await waitFor(async () => expect((await repository.load()).members.map((member) => member.initials)).toContain('SM'));
  });

  it('AC1.2 changes the initials of a member', async () => {
    // Given the team of the demo
    const user = userEvent.setup();
    await open('#/settings/team');
    // When I change the initials of "Luca Rossi" to "LUC"
    await user.click(await screen.findByRole('button', { name: 'Change Luca Rossi' }));
    const initials = screen.getByRole('textbox', { name: 'Initials' });
    await user.clear(initials);
    await user.type(initials, 'LUC');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    // Then the list shows "LUC"
    expect(await screen.findByText('Initials LUC')).toBeInTheDocument();
  });

  it('AC1.3 renames a member and the initials follow the name', async () => {
    // Given "Anna Keller (AK)" with S-3
    const user = userEvent.setup();
    const repository = await open('#/settings/team');
    // When I rename her to "Anna Roth"
    await user.click(await screen.findByRole('button', { name: 'Change Anna Keller' }));
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Anna Roth');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    // Then the list shows "Anna Roth" with "AR", and S-3 is still hers
    expect(await screen.findByText('Anna Roth')).toBeInTheDocument();
    expect(screen.getByText('Initials AR')).toBeInTheDocument();
    expect((await storyOf(repository, 'S-3'))?.assigneeId).toBe('member-anna');
  });

  it.each([
    ['an empty name', '', 'Please enter a name.'],
    ['a name that exists', 'Anna Keller', 'The team already has this name.']
  ])('AC1.4 refuses %s', async (_label, name, hint) => {
    // Given the form for a new member
    const user = userEvent.setup();
    await open('#/settings/team');
    await user.click(await screen.findByRole('button', { name: 'Add member' }));
    // When I enter the input and save
    if (name) await user.type(screen.getByRole('textbox', { name: 'Name' }), name);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    // Then I see the hint and nothing is added
    expect(await screen.findByRole('alert')).toHaveTextContent(hint);
    expect(within(screen.getByRole('list', { name: 'Team members' })).getAllByRole('listitem')).toHaveLength(3);
  });

  it.each([
    ['initials with four characters', 'ANNA', 'The initials can have at most 3 characters.'],
    ['initials that are taken', 'AK', 'These initials are already taken.']
  ])('AC1.4 refuses %s', async (_label, initials, hint) => {
    // Given the form for a new member "Karl Adler"
    const user = userEvent.setup();
    await open('#/settings/team');
    await user.click(await screen.findByRole('button', { name: 'Add member' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Karl Adler');
    // When I type the initials and save
    const field = screen.getByRole('textbox', { name: 'Initials' });
    await user.clear(field);
    await user.type(field, initials);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    // Then I see the hint and nothing is added
    expect(await screen.findByRole('alert')).toHaveTextContent(hint);
    expect(within(screen.getByRole('list', { name: 'Team members' })).getAllByRole('listitem')).toHaveLength(3);
  });

  it('AC1.4 leaves the list unchanged when I cancel', async () => {
    // Given the form for a new member with a name
    const user = userEvent.setup();
    await open('#/settings/team');
    await user.click(await screen.findByRole('button', { name: 'Add member' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Karl Adler');
    // When I cancel
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    // Then the list has the three members and the form is gone
    expect(within(screen.getByRole('list', { name: 'Team members' })).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
  });

  it('AC1.5 adds a member with the keyboard only', async () => {
    // Given the settings, section "Team"
    const user = userEvent.setup();
    await open('#/settings/team');
    const add = await screen.findByRole('button', { name: 'Add member' });
    // When I focus "Add member", press Enter, type the name and press Enter
    add.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
    await user.keyboard('Sara Meier{Enter}');
    // Then she is in the list and the form is closed
    expect(await screen.findByText('Sara Meier')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
  });

  it('AC1.6 removes a member without stories at once', async () => {
    // Given "Luca Rossi" has no stories
    const user = userEvent.setup();
    await open('#/settings/team');
    // When I remove him
    await user.click(await screen.findByRole('button', { name: 'Remove Luca Rossi' }));
    // Then he is gone, without a question
    await waitFor(() => expect(screen.queryByText('Luca Rossi')).toBeNull());
    expect(screen.queryByRole('group', { name: /has \d+ stor/ })).toBeNull();
  });

  it('AC5.1 asks before it removes a member with stories and leaves the stories without assignee', async () => {
    // Given Anna has two stories
    const user = userEvent.setup();
    const repository = await open('#/settings/team');
    // When I remove her
    await user.click(await screen.findByRole('button', { name: 'Remove Anna Keller' }));
    // Then I am told that her 2 stories will not be assigned any more
    expect(screen.getByText('Anna Keller has 2 stories. They will not be assigned any more.')).toBeInTheDocument();
    // When I confirm
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    // Then she is gone and S-1 and S-3 exist without assignee
    await waitFor(() => expect(screen.queryByText('Anna Keller')).toBeNull());
    await waitFor(async () => expect((await storyOf(repository, 'S-3'))?.assigneeId ?? null).toBeNull());
    expect((await storyOf(repository, 'S-1'))?.title).toBeTruthy();
    expect((await storyOf(repository, 'S-1'))?.assigneeId ?? null).toBeNull();
  });

  it('AC5.2 keeps the member when I cancel the question, with the focus on "Cancel"', async () => {
    // Given the question about removing Anna is open
    const user = userEvent.setup();
    const repository = await open('#/settings/team');
    await user.click(await screen.findByRole('button', { name: 'Remove Anna Keller' }));
    // When I cancel
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel).toHaveFocus();
    await user.click(cancel);
    // Then Anna and her stories stay
    expect(screen.getByText('Anna Keller')).toBeInTheDocument();
    expect((await storyOf(repository, 'S-3'))?.assigneeId).toBe('member-anna');
  });
});

describe('assign a story (#18)', () => {
  it('AC2.1 assigns a story in the story dialog', async () => {
    // Given the story dialog of S-4, which nobody works on
    const user = userEvent.setup();
    const repository = await open('#/board');
    const dialog = await openStory(user, 'S-4');
    const field = within(dialog).getByLabelText('Assigned to');
    expect(field).toHaveValue('');
    // When I choose "Luca Rossi (LR)"
    await user.selectOptions(field, 'Luca Rossi (LR)');
    // Then S-4 is assigned to Luca, also in the stored data
    expect(field).toHaveValue('member-luca');
    await waitFor(async () => expect((await storyOf(repository, 'S-4'))?.assigneeId).toBe('member-luca'));
  });

  it('AC2.2 removes the assignment with "Nobody"', async () => {
    // Given S-3 is assigned to Anna
    const user = userEvent.setup();
    const repository = await open('#/board');
    const dialog = await openStory(user, 'S-3');
    // When I choose "Nobody"
    await user.selectOptions(within(dialog).getByLabelText('Assigned to'), 'Nobody');
    // Then S-3 is not assigned
    await waitFor(async () => expect((await storyOf(repository, 'S-3'))?.assigneeId ?? null).toBeNull());
  });

  it('AC2.3 assigns a new story when it is created', async () => {
    // Given the dialog "New story" with the title "Profile picture"
    const user = userEvent.setup();
    const repository = await open('#/board');
    await user.click(await screen.findByRole('button', { name: /^New story/ }));
    const dialog = await screen.findByRole('dialog', { name: 'New story' });
    await user.type(within(dialog).getByLabelText('Title'), 'Profile picture');
    // When I choose "Michael Burkard (MB)" and add the story
    await user.selectOptions(within(dialog).getByLabelText('Assigned to'), 'Michael Burkard (MB)');
    await user.click(within(dialog).getByRole('button', { name: 'Add story' }));
    // Then the new story is assigned to Michael
    await waitFor(async () => {
      const created = (await repository.load()).stories.find((story) => story.title === 'Profile picture');
      expect(created?.assigneeId).toBe('member-michael');
    });
  });

  it('AC2.4 leaves a new story without assignee when I choose nobody', async () => {
    // Given the dialog "New story" with a title
    const user = userEvent.setup();
    const repository = await open('#/board');
    await user.click(await screen.findByRole('button', { name: /^New story/ }));
    const dialog = await screen.findByRole('dialog', { name: 'New story' });
    await user.type(within(dialog).getByLabelText('Title'), 'No owner yet');
    // When I add the story without choosing a person
    await user.click(within(dialog).getByRole('button', { name: 'Add story' }));
    // Then it is not assigned
    await waitFor(async () => {
      const created = (await repository.load()).stories.find((story) => story.title === 'No owner yet');
      expect(created).toBeDefined();
      expect(created?.assigneeId ?? null).toBeNull();
    });
  });

  it('AC2.5 reaches the field "Assigned to" by name and assigns with the keyboard focus on it', async () => {
    // Given the story dialog of S-4
    const user = userEvent.setup();
    const repository = await open('#/board');
    const dialog = await openStory(user, 'S-4');
    // When I focus "Assigned to" and choose a person
    const field = within(dialog).getByLabelText('Assigned to');
    field.focus();
    expect(field).toHaveFocus();
    await user.selectOptions(field, 'Michael Burkard (MB)');
    // Then the field is named for the screen reader and S-4 is assigned (the arrow keys are tested in the browser)
    expect(field).toHaveAccessibleName('Assigned to');
    await waitFor(async () => expect((await storyOf(repository, 'S-4'))?.assigneeId).toBe('member-michael'));
  });
});

describe('initials on cards and lists (#18)', () => {
  it('AC3.1 shows the initials on a board card', async () => {
    // Given the board with S-3, assigned to Anna
    await open('#/board');
    // Then the card shows a badge with "AK"
    const card = await screen.findByRole('group', { name: /^S-3:/ });
    expect(within(card).getByRole('img', { name: 'Assigned to Anna Keller' })).toHaveTextContent('AK');
  });

  it('AC3.2 shows the initials in the backlog', async () => {
    // Given the backlog with S-3
    await open('#/backlog');
    // Then the row shows the badge with "AK"
    const row = await screen.findByRole('group', { name: /S-3:/ });
    expect(within(row).getByRole('img', { name: 'Assigned to Anna Keller' })).toHaveTextContent('AK');
  });

  it('AC3.3 shows the initials on the story map', async () => {
    // Given the story map with S-3
    await open('#/map');
    // Then the card shows the badge with "AK"
    const card = await screen.findByRole('group', { name: /^S-3:/ });
    expect(within(card).getByRole('img', { name: 'Assigned to Anna Keller' })).toHaveTextContent('AK');
  });

  it('AC3.4 shows an empty badge for a story without assignee', async () => {
    // Given S-4, which nobody works on
    await open('#/board');
    // Then its card shows the dashed badge "Unassigned"
    const card = await screen.findByRole('group', { name: /^S-4:/ });
    const badge = within(card).getByRole('img', { name: 'Unassigned' });
    expect(badge).toHaveClass('assignee--none');
  });

  it('AC3.5 gives the full name as tooltip and for the screen reader', async () => {
    // Given the board with S-3 and S-4
    await open('#/board');
    // Then the badge of S-3 has the full name as tooltip, and S-4 says "Unassigned"
    const assigned = within(await screen.findByRole('group', { name: /^S-3:/ })).getByRole('img', { name: 'Assigned to Anna Keller' });
    expect(assigned).toHaveAttribute('title', 'Anna Keller');
    const free = within(screen.getByRole('group', { name: /^S-4:/ })).getByRole('img', { name: 'Unassigned' });
    expect(free).toHaveAttribute('title', 'Unassigned');
  });

  it('AC3.1 shows no badge while the team is empty', async () => {
    // Given a project without team members
    await open('#/board', (snapshot) => ({ ...snapshot, members: [], stories: snapshot.stories.map((story) => ({ ...story, assigneeId: null })) }));
    // Then the cards show no badge and the board has no filter bar
    const card = await screen.findByRole('group', { name: /^S-3:/ });
    expect(within(card).queryByRole('img', { name: /Assigned|Unassigned/ })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Person' })).toBeNull();
  });
});

describe('filter on the board (#18)', () => {
  it('AC4.1 shows only the stories of one person', async () => {
    // Given the board with the stories of Sprint 1
    const user = userEvent.setup();
    await open('#/board');
    const bar = await screen.findByRole('group', { name: 'Person' });
    await waitFor(() => expect(cardNames().length).toBeGreaterThan(2));
    // When I click on "AK"
    await user.click(within(bar).getByRole('button', { name: 'Anna Keller' }));
    // Then only Anna's stories are shown and the filter is marked as active
    expect(cardNames().map((name) => name.slice(0, 3)).sort()).toEqual(['S-1', 'S-3']);
    expect(within(bar).getByRole('button', { name: 'Anna Keller' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('AC4.2 shows only the stories nobody works on', async () => {
    // Given the board
    const user = userEvent.setup();
    await open('#/board');
    const bar = await screen.findByRole('group', { name: 'Person' });
    // When I click "Unassigned"
    await user.click(within(bar).getByRole('button', { name: 'Unassigned' }));
    // Then only S-4 and S-6 are shown (S-7 is not in the sprint)
    expect(cardNames().map((name) => name.slice(0, 3)).sort()).toEqual(['S-4', 'S-6']);
  });

  it('AC4.3 shows all stories again with "All"', async () => {
    // Given the board filtered to Anna
    const user = userEvent.setup();
    await open('#/board');
    const bar = await screen.findByRole('group', { name: 'Person' });
    await user.click(within(bar).getByRole('button', { name: 'Anna Keller' }));
    expect(cardNames()).toHaveLength(2);
    // When I click "All"
    await user.click(within(bar).getByRole('button', { name: 'All' }));
    // Then all six stories of the sprint are shown
    expect(cardNames()).toHaveLength(6);
    expect(within(bar).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('AC4.4 says so when a person has no stories', async () => {
    // Given the board and Luca, who has no stories
    const user = userEvent.setup();
    await open('#/board');
    const bar = await screen.findByRole('group', { name: 'Person' });
    // When I click "LR"
    await user.click(within(bar).getByRole('button', { name: 'Luca Rossi' }));
    // Then no story is shown and a hint says so
    expect(cardNames()).toEqual([]);
    expect(screen.getByText('No stories for this person.')).toBeInTheDocument();
  });

  it('AC4.5 operates the filter with the keyboard', async () => {
    // Given the board
    const user = userEvent.setup();
    await open('#/board');
    const bar = await screen.findByRole('group', { name: 'Person' });
    // When I focus the button of Anna and press Enter
    within(bar).getByRole('button', { name: 'Anna Keller' }).focus();
    await user.keyboard('{Enter}');
    // Then the filter works and the screen reader hears the pressed state
    expect(within(bar).getByRole('button', { name: 'Anna Keller', pressed: true })).toBeInTheDocument();
    expect(cardNames()).toHaveLength(2);
  });
});

describe('history of the assignment (#18)', () => {
  it('AC7.2 shows the assignment in the history of the story', async () => {
    // Given the story dialog of S-4, which nobody works on
    const user = userEvent.setup();
    await open('#/board');
    const dialog = await openStory(user, 'S-4');
    // When I assign it to Luca and look at the history
    await user.selectOptions(within(dialog).getByLabelText('Assigned to'), 'Luca Rossi (LR)');
    const panel = within(dialog).getByRole('heading', { name: 'History' }).closest('section') as HTMLElement;
    // Then the history says "Assigned to: Nobody → Luca Rossi"
    await waitFor(() => expect(panel).toHaveTextContent('Assigned to: Nobody → Luca Rossi'));
  });
});

const teamOff = (snapshot: Snapshot): Snapshot => ({ ...snapshot, settings: { ...snapshot.settings, features: { ...snapshot.settings.features, team: false } } });

describe('the team as a feature (#18)', () => {
  it('AC8.1 switches the team on in Settings › Features and keeps the choice', async () => {
    // Given a project with the team switched off
    const user = userEvent.setup();
    const repository = await open('#/settings/features', teamOff);
    const nav = await screen.findByRole('navigation', { name: 'Settings sections' });
    expect(within(nav).queryByRole('link', { name: 'Team' })).toBeNull();
    // When I switch "Team" on
    await user.click(screen.getByRole('switch', { name: /^Team/ }));
    // Then the section "Team" appears in the settings and the choice is stored
    expect(await within(nav).findByRole('link', { name: 'Team' })).toBeInTheDocument();
    await waitFor(async () => expect((await repository.load()).settings.features.team).toBe(true));
  });

  it('AC8.2 shows nothing of the team on the board and in the dialogs while it is off', async () => {
    // Given the demo data with the team switched off
    const user = userEvent.setup();
    await open('#/board', teamOff);
    const card = await screen.findByRole('group', { name: /^S-3:/ });
    // Then the cards show no badge and the board has no filter bar
    expect(within(card).queryByRole('img', { name: /Assigned|Unassigned/ })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Person' })).toBeNull();
    // And the story dialog has no field "Assigned to"
    const dialog = await openStory(user, 'S-3');
    expect(within(dialog).queryByLabelText('Assigned to')).toBeNull();
    expect(within(dialog).getByLabelText('Status')).toBeInTheDocument();
  });

  it('AC8.2 leaves out the field "Assigned to" in "New story" while the team is off', async () => {
    // Given the demo data with the team switched off
    const user = userEvent.setup();
    await open('#/board', teamOff);
    // When I open "New story"
    await user.click(await screen.findByRole('button', { name: /^New story/ }));
    const dialog = await screen.findByRole('dialog', { name: 'New story' });
    // Then there is no field "Assigned to"
    expect(within(dialog).getByLabelText('Sprint')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Assigned to')).toBeNull();
  });

  it('AC8.2 leads the address of the team settings back to the features while the team is off', async () => {
    // Given the team is off
    await open('#/settings/team', teamOff);
    // Then the address leads to Settings › Features
    await waitFor(() => expect(window.location.hash).toBe('#/settings/features'));
  });

  it('AC8.3 brings the members and assignments back when the team is switched on again', async () => {
    // Given the team is on, with Anna and her stories
    const user = userEvent.setup();
    const repository = await open('#/settings/features');
    const toggle = await screen.findByRole('switch', { name: /^Team/ });
    // When I switch it off and on again
    await user.click(toggle);
    await waitFor(async () => expect((await repository.load()).settings.features.team).toBe(false));
    expect(screen.getByText('Switched off. Members and assignments are kept and come back when you switch it on.')).toBeInTheDocument();
    await user.click(toggle);
    await waitFor(async () => expect((await repository.load()).settings.features.team).toBe(true));
    // Then the three members and the assignment of S-3 are still there
    const snapshot = await repository.load();
    expect(snapshot.members.map((member) => member.initials)).toEqual(['MB', 'AK', 'LR']);
    expect(snapshot.stories.find((story) => story.code === 'S-3')?.assigneeId).toBe('member-anna');
  });

  it('AC8.5 keeps showing an assignment in the history while the team is off', async () => {
    // Given S-4 was assigned to Luca (two versions in its history) and the team is off
    const user = userEvent.setup();
    const at = (hour: number): string => `2026-10-12T0${hour}:00:00.000Z`;
    const base = { itemType: 'story', itemId: 'story-4' } as const;
    const title = 'Keep all data in a local database';
    await open('#/board', (snapshot) => {
      const state = statesOf(snapshot).get('story:story-4')!.state;
      const { assignee: _none, ...without } = state;
      const log: ChangeVersion[] = [
        { ...base, id: 'v-1', at: at(1), version: 1, origin: 'created', keys: [], state: { ...without, title } },
        { ...base, id: 'v-2', at: at(2), version: 2, origin: 'changed', keys: ['assignee'], state: { ...without, title, assignee: { id: 'member-luca', label: 'Luca Rossi' } } }
      ];
      return teamOff({ ...snapshot, stories: snapshot.stories.map((story) => (story.id === 'story-4' ? { ...story, assigneeId: 'member-luca' } : story)), changeLog: [...snapshot.changeLog, ...log] });
    });
    // When I open the history of S-4
    const dialog = await openStory(user, 'S-4');
    const panel = within(dialog).getByRole('heading', { name: 'History' }).closest('section') as HTMLElement;
    // Then it says who it was assigned to
    await waitFor(() => expect(panel).toHaveTextContent('Assigned to: Nobody → Luca Rossi'));
  });

  it('AC8.6 operates the switch with the space key and names it with its state', async () => {
    // Given Settings › Features with the team on
    const user = userEvent.setup();
    await open('#/settings/features');
    const toggle = await screen.findByRole('switch', { name: /^Team/ });
    expect(toggle).toBeChecked();
    // When I focus the switch and press the space key
    toggle.focus();
    await user.keyboard(' ');
    // Then it is off
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveAccessibleName(/Off$/);
  });
});

describe('help for the team (#18)', () => {
  it('AC8.7 starts with the switch and locks the link to the settings while the team is off', async () => {
    // Given the help topics
    const { TOPICS, LINK_TARGETS } = await import('./help/topics');
    const { default: en } = await import('./i18n/en.json');
    // Then the topic "Team and assignment" exists, sends the user to the features first and locks the team settings behind the feature
    const topic = TOPICS.find((item) => item.id === 'team.assign');
    expect(topic?.links?.[0]).toEqual({ id: 'settingsFeatures', hint: 'featureFirst' });
    expect(topic?.links?.[1]).toEqual({ id: 'settingsTeam', requires: 'team' });
    expect(LINK_TARGETS.settingsTeam).toBe('#/settings/team');
    expect(en.help.topics['team.assign'].title).toBe('Team and assignment');
    expect(en.help.topics['team.assign'].body.startsWith('First switch on "Team"')).toBe(true);
    expect(en.help.links.settingsTeam).toBe('Open Settings → Team');
  });
});
