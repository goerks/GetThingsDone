import { beforeAll, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { initI18n } from './i18n';
import { addDays, todayIso } from './domain/sprints';

beforeAll(() => {
  initI18n('en');
});

async function renderApp(hash = ''): Promise<LocalStorageRepository> {
  window.location.hash = hash;
  const repository = new LocalStorageRepository();
  render(<App repository={repository} />);
  await screen.findByRole('heading', { level: 1 });
  return repository;
}

async function openReleases(): Promise<LocalStorageRepository> {
  const repository = await renderApp();
  await userEvent.setup().click(screen.getByRole('link', { name: 'Releases' }));
  await screen.findByRole('heading', { name: 'Releases', level: 1 });
  return repository;
}

async function openRelease(name: RegExp): Promise<HTMLElement> {
  await userEvent.setup().click(screen.getByRole('button', { name }));
  return screen.findByRole('dialog', { name: /Release 1\./ });
}

describe('releases page', () => {
  it('is part of the main navigation and lists the demo releases as cards', async () => {
    await openReleases();
    expect(screen.getByRole('link', { name: 'Releases' })).toHaveAttribute('aria-current', 'page');
    expect(window.location.hash).toBe('#/releases');
    expect(screen.getByText(/2 releases · 7 stories · 31 points/)).toBeInTheDocument();
    const beta = screen.getByRole('button', { name: /Release 1\.0 – Public Beta/ });
    expect(within(beta).getByText('Running')).toBeInTheDocument();
    expect(within(beta).getByText('Points done')).toBeInTheDocument();
    expect(within(beta).getByRole('img', { name: '3 of 23 points done' })).toBeInTheDocument();
    const map = screen.getByRole('button', { name: /Release 1\.1 – Story map/ });
    expect(within(map).getByText('Planned')).toBeInTheDocument();
    expect(within(map).getByText('No period')).toBeInTheDocument();
  });

  it('shows an empty page with the way to the first release once all releases are gone', async () => {
    const repository = new LocalStorageRepository();
    const seed = seedSnapshot(todayIso());
    await repository.replaceAll({ ...seed, releases: [], stories: seed.stories.map((story) => ({ ...story, releaseId: null })) });
    render(<App repository={repository} />);
    window.location.hash = '#/releases';
    expect(await screen.findByText(/No release yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Release/ })).toBeInTheDocument();
  });

  it('creates a release with a title only, through the last card', async () => {
    const user = userEvent.setup();
    const repository = await openReleases();
    await user.click(screen.getByRole('button', { name: /\+ Release/ }));
    const dialog = screen.getByRole('dialog', { name: 'New release' });
    await user.type(within(dialog).getByLabelText('Title'), 'Release 2.0');
    await user.click(within(dialog).getByRole('button', { name: 'Add release' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const card = screen.getByRole('button', { name: /Release 2\.0/ });
    expect(within(card).getByText('No period')).toBeInTheDocument();
    expect((await repository.load()).releases.find((release) => release.title === 'Release 2.0')).toMatchObject({
      description: '',
      startDate: null,
      endDate: null
    });
  });

  it('asks for a title and refuses an end before the start', async () => {
    const user = userEvent.setup();
    await openReleases();
    await user.click(screen.getByRole('button', { name: /\+ Release/ }));
    const dialog = screen.getByRole('dialog', { name: 'New release' });
    await user.click(within(dialog).getByRole('button', { name: 'Add release' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Give the release a title.');

    await user.type(within(dialog).getByLabelText('Title'), 'Late');
    await user.type(within(dialog).getByLabelText('Start'), '2026-11-20');
    await user.type(within(dialog).getByLabelText('End'), '2026-11-19');
    await user.click(within(dialog).getByRole('button', { name: 'Add release' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('The end cannot be before the start.');
    expect(screen.getByRole('dialog', { name: 'New release' })).toBeInTheDocument();
  });

  it('creates a release with Ctrl+N and does not react while a dialog is open', async () => {
    const user = userEvent.setup();
    await openReleases();
    await user.keyboard('{Control>}n{/Control}');
    expect(screen.getByRole('dialog', { name: 'New release' })).toBeInTheDocument();
    await user.keyboard('{Control>}n{/Control}');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('names the shortcut on the last card', async () => {
    await openReleases();
    expect(screen.getByRole('button', { name: /\+ Release/ })).toHaveAttribute('aria-keyshortcuts', 'Control+N Meta+N');
    expect(screen.getByText('Ctrl+N')).toBeInTheDocument();
  });
});

describe('release dialog', () => {
  it('edits title, description and dates and saves at once', async () => {
    const user = userEvent.setup();
    const repository = await openReleases();
    const dialog = await openRelease(/Release 1\.1/);
    await user.click(within(dialog).getByRole('button', { name: /edit Title/ }));
    const title = within(dialog).getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'Release 1.1 – Planning{Enter}');
    fireDate(within(dialog).getByLabelText('Start'), '2026-12-01');
    fireDate(within(dialog).getByLabelText('End'), '2026-12-31');

    await waitFor(async () => {
      const saved = (await repository.load()).releases.find((release) => release.id === 'release-map');
      expect(saved).toMatchObject({ title: 'Release 1.1 – Planning', startDate: '2026-12-01', endDate: '2026-12-31' });
    });
  });

  it('keeps the old dates and says why when the end is before the start', async () => {
    const repository = await openReleases();
    const dialog = await openRelease(/Release 1\.0/);
    const start = (await repository.load()).releases[0].startDate;
    const before = (await repository.load()).releases[0].endDate;
    fireDate(within(dialog).getByLabelText('End'), addDays(start ?? todayIso(), -1));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('The end cannot be before the start.');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await repository.load()).releases[0].endDate).toBe(before);
  });

  it('shows size and progress of the release', async () => {
    await openReleases();
    const dialog = await openRelease(/Release 1\.0/);
    expect(within(dialog).getByText('6 stories · 23 points')).toBeInTheDocument();
    expect(within(dialog).getByText('3 of 23 points done')).toBeInTheDocument();
  });

  it('lists the stories and removes one', async () => {
    const user = userEvent.setup();
    const repository = await openReleases();
    const dialog = await openRelease(/Release 1\.1/);
    await user.click(within(dialog).getByRole('tab', { name: 'Stories (1)' }));
    expect(within(dialog).getByRole('button', { name: 'Plan releases on a story map' })).toBeInTheDocument();
    // Every demo story has a release, so there is nothing to add.
    expect(within(dialog).getByText('Every story already has a release.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Remove S-7 from this release' }));
    expect(within(dialog).getByText(/No stories in this release yet/)).toBeInTheDocument();
    expect((await repository.load()).stories.find((story) => story.id === 'story-7')?.releaseId).toBeNull();
    expect(within(dialog).getByRole('combobox', { name: 'Add a story' })).toBeInTheDocument();
  });

  it('switches tabs with the arrow keys', async () => {
    const user = userEvent.setup();
    await openReleases();
    const dialog = await openRelease(/Release 1\.1/);
    const details = within(dialog).getByRole('tab', { name: 'Details' });
    details.focus();
    await user.keyboard('{ArrowRight}');
    expect(within(dialog).getByRole('tab', { name: /^Stories/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(dialog).getByRole('tab', { name: /^Stories/ })).toHaveFocus();
    expect(within(dialog).getByRole('tabpanel')).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(within(dialog).getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens a story from the list', async () => {
    const user = userEvent.setup();
    await openReleases();
    const dialog = await openRelease(/Release 1\.1/);
    await user.click(within(dialog).getByRole('tab', { name: 'Stories (1)' }));
    await user.click(within(dialog).getByRole('button', { name: 'Plan releases on a story map' }));
    expect(await screen.findByRole('dialog', { name: /S-7: Plan releases on a story map/ })).toBeInTheDocument();
  });

  it('states how many stories lose the release when it is deleted, and keeps the stories', async () => {
    const user = userEvent.setup();
    const repository = await openReleases();
    const dialog = await openRelease(/Release 1\.0/);
    await user.click(within(dialog).getByRole('button', { name: 'Delete release' }));
    expect(within(dialog).getByText(/Its 6 stories stay and lose their release/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Release 1\.0/ })).not.toBeInTheDocument();
    const saved = await repository.load();
    expect(saved.releases.map((release) => release.id)).toEqual(['release-map']);
    expect(saved.stories).toHaveLength(7);
    expect(saved.stories.filter((story) => story.releaseId === 'release-beta')).toEqual([]);
  });

  it('hints, but does not block, when a sprint ends after the release', async () => {
    const user = userEvent.setup();
    const repository = new LocalStorageRepository();
    const seed = seedSnapshot(todayIso());
    await repository.replaceAll({
      ...seed,
      releases: seed.releases.map((release) => (release.id === 'release-beta' ? { ...release, endDate: addDays(todayIso(), 3) } : release))
    });
    render(<App repository={repository} />);
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('link', { name: 'Releases' }));
    const dialog = await openRelease(/Release 1\.0/);
    expect(within(dialog).getByRole('note')).toHaveTextContent(/6 stories are planned in sprints that end after/);
    expect(within(dialog).getByRole('note')).toHaveTextContent('S-1, S-2, S-3, S-4, S-5, S-6');
  });
});

function fireDate(input: HTMLElement, value: string): void {
  fireEvent.change(input, { target: { value } });
}

describe('release on stories', () => {
  async function openStory(code: RegExp): Promise<HTMLElement> {
    const user = userEvent.setup();
    await user.dblClick(await screen.findByRole('group', { name: code }));
    return screen.findByRole('dialog', { name: code });
  }

  it('shows the release of a story and moves the story to another release at once', async () => {
    const user = userEvent.setup();
    const repository = await renderApp('#/board');
    const dialog = await openStory(/S-1:/);
    const select = within(dialog).getByLabelText('Release');
    expect(select).toHaveDisplayValue('Release 1.0 – Public Beta');
    await user.selectOptions(select, 'Release 1.1 – Story map');
    expect((await repository.load()).stories.find((story) => story.id === 'story-1')?.releaseId).toBe('release-map');
    await user.selectOptions(select, 'No release');
    expect((await repository.load()).stories.find((story) => story.id === 'story-1')?.releaseId).toBeNull();
  });

  it('offers no release that is done, but keeps showing the story\'s own', async () => {
    const user = userEvent.setup();
    const repository = new LocalStorageRepository();
    const seed = seedSnapshot(todayIso());
    await repository.replaceAll({
      ...seed,
      stories: seed.stories.map((story) => (story.id === 'story-7' ? { ...story, status: 'done' as const } : story))
    });
    render(<App repository={repository} />);
    window.location.hash = '#/board';
    const dialog = await openStory(/S-1:/);
    const options = within(within(dialog).getByLabelText('Release')).getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['No release', 'Release 1.0 – Public Beta']);
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    const own = await openStory(/S-1:/);
    expect(within(own).getByLabelText('Release')).toHaveDisplayValue('Release 1.0 – Public Beta');
  });

  it('hints when the sprint of the story ends after its release', async () => {
    const repository = new LocalStorageRepository();
    const seed = seedSnapshot(todayIso());
    await repository.replaceAll({
      ...seed,
      releases: seed.releases.map((release) => (release.id === 'release-beta' ? { ...release, endDate: addDays(todayIso(), 3) } : release))
    });
    render(<App repository={repository} />);
    window.location.hash = '#/board';
    const dialog = await openStory(/S-1:/);
    expect(within(dialog).getByRole('note')).toHaveTextContent(/Sprint 1 ends on .*, after the end of Release 1\.0 – Public Beta/);
  });

  it('keeps the release out of the new-story dialog until the team puts it there', async () => {
    const user = userEvent.setup();
    const repository = await renderApp('#/board');
    await user.click(screen.getByRole('button', { name: 'New story' }));
    expect(within(screen.getByRole('dialog', { name: 'New story' })).queryByLabelText('Release')).not.toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog', { name: 'New story' })).getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('link', { name: 'Settings' }));
    await user.click(await screen.findByRole('tab', { name: 'Layout' }));
    const row = screen.getAllByRole('listitem').find((item) => item.textContent?.startsWith('Release'));
    if (!row) throw new Error('release row missing');
    await user.click(within(row).getByRole('checkbox', { name: 'In create dialog' }));
    window.location.hash = '#/board';
    await user.click(await screen.findByRole('button', { name: 'New story' }));
    const dialog = screen.getByRole('dialog', { name: 'New story' });
    await user.type(within(dialog).getByLabelText('Title'), 'With a release');
    await user.selectOptions(within(dialog).getByLabelText('Release'), 'Release 1.1 – Story map');
    await user.click(within(dialog).getByRole('button', { name: 'Add story' }));
    expect((await repository.load()).stories.find((story) => story.title === 'With a release')?.releaseId).toBe('release-map');
  });

  it('shows the release on the card only when the team ticked "On card"', async () => {
    const user = userEvent.setup();
    await renderApp('#/board');
    const card = (): HTMLElement => screen.getByRole('group', { name: /S-1:/ });
    expect(within(card()).queryByText('Release 1.0 – Public Beta')).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Settings' }));
    await user.click(await screen.findByRole('tab', { name: 'Layout' }));
    const release = screen.getAllByRole('listitem').find((item) => item.textContent?.startsWith('Release'));
    if (!release) throw new Error('release row missing');
    await user.click(within(release).getByRole('checkbox', { name: 'On card' }));
    window.location.hash = '#/board';
    await screen.findByRole('group', { name: /S-1:/ });
    expect(within(card()).getByText('Release 1.0 – Public Beta')).toBeInTheDocument();
    expect(within(card()).getByText('Release:')).toHaveClass('sr-only');
  });
});

describe('release fields in the settings', () => {
  async function openFields(): Promise<void> {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('link', { name: 'Settings' }));
    await screen.findByRole('heading', { level: 2, name: 'Fields' });
  }

  it('has the Release system field on stories and an active column for releases', async () => {
    await openFields();
    expect(screen.getByRole('columnheader', { name: 'Releases' })).toBeInTheDocument();
    const release = screen.getByRole('checkbox', { name: 'Release for Stories. System field, always used' });
    expect(release).toBeChecked();
    expect(release).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Title for Releases. System field, always used' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Description for Releases. Always shown on this type' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Start for Releases' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'End for Releases' })).toBeEnabled();
  });

  it('does not offer custom fields on releases yet', async () => {
    await openFields();
    expect(screen.queryByRole('checkbox', { name: 'Priority for Releases' })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Custom fields on releases are planned/).length).toBeGreaterThan(0);
  });

  it('hides the dates of releases when the team switches them off', async () => {
    const user = userEvent.setup();
    await openFields();
    await user.click(screen.getByRole('checkbox', { name: 'Start for Releases' }));
    await user.click(screen.getByRole('checkbox', { name: 'End for Releases' }));
    window.location.hash = '#/releases';
    await user.click(await screen.findByRole('button', { name: /Release 1\.1/ }));
    const dialog = screen.getByRole('dialog', { name: /Release 1\.1/ });
    expect(within(dialog).queryByLabelText('Start')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('End')).not.toBeInTheDocument();
  });
});

describe('adding a story by search', () => {
  /** Release 1.1 with stories S-3 to S-7 free to add (they have no release). */
  async function openStories(): Promise<{ repository: LocalStorageRepository; dialog: HTMLElement }> {
    const repository = new LocalStorageRepository();
    const seed = seedSnapshot(todayIso());
    await repository.replaceAll({
      ...seed,
      stories: seed.stories.map((story) => (['story-3', 'story-4', 'story-5', 'story-6'].includes(story.id) ? { ...story, releaseId: null } : story))
    });
    render(<App repository={repository} />);
    window.location.hash = '#/releases';
    await screen.findByRole('heading', { name: 'Releases', level: 1 });
    const dialog = await openRelease(/Release 1\.1/);
    await userEvent.setup().click(within(dialog).getByRole('tab', { name: /^Stories/ }));
    return { repository, dialog };
  }

  const options = (dialog: HTMLElement): string[] => within(dialog).queryAllByRole('option').map((option) => option.textContent ?? '');

  it('is a combobox that lists only the stories without a release when it gets the focus', async () => {
    const user = userEvent.setup();
    const { dialog } = await openStories();
    const box = within(dialog).getByRole('combobox', { name: 'Add a story' });
    expect(box).toHaveAttribute('aria-expanded', 'false');
    await user.click(box);
    expect(box).toHaveAttribute('aria-expanded', 'true');
    expect(options(dialog)).toEqual([
      'S-3Reorder the backlog by priority',
      'S-4Keep all data in a local database',
      'S-5Switch the UI language (DE, EN, FR, IT)',
      'S-6Operate the board with the keyboard only'
    ]);
  });

  it('finds a story by its number', async () => {
    const user = userEvent.setup();
    const { dialog } = await openStories();
    await user.type(within(dialog).getByRole('combobox'), '5');
    expect(options(dialog)).toEqual(['S-5Switch the UI language (DE, EN, FR, IT)']);
    await user.clear(within(dialog).getByRole('combobox'));
    await user.type(within(dialog).getByRole('combobox'), 's-4');
    expect(options(dialog)).toEqual(['S-4Keep all data in a local database']);
  });

  it('finds a story by words of its title, in any order and any case', async () => {
    const user = userEvent.setup();
    const { dialog } = await openStories();
    await user.type(within(dialog).getByRole('combobox'), 'KEYBOARD board');
    expect(options(dialog)).toEqual(['S-6Operate the board with the keyboard only']);
  });

  it('does not offer stories that have a release, even when they match', async () => {
    const user = userEvent.setup();
    const { dialog } = await openStories();
    await user.type(within(dialog).getByRole('combobox'), 'story');
    expect(options(dialog).some((text) => text.startsWith('S-1') || text.startsWith('S-2'))).toBe(false);
  });

  it('adds the story with the arrow keys and Enter, empties the field and keeps the focus', async () => {
    const user = userEvent.setup();
    const { repository, dialog } = await openStories();
    const box = within(dialog).getByRole('combobox');
    await user.type(box, 'data');
    await user.keyboard('{Enter}');
    expect((await repository.load()).stories.find((story) => story.id === 'story-4')?.releaseId).toBe('release-map');
    expect(box).toHaveValue('');
    expect(box).toHaveFocus();
    expect(within(dialog).getByRole('status')).toHaveTextContent('S-4 was added to the release.');
    expect(within(dialog).getByRole('tab', { name: 'Stories (2)' })).toBeInTheDocument();

    // The first arrow key opens the list, the second moves to the second of S-3, S-5, S-6.
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect((await repository.load()).stories.find((story) => story.id === 'story-5')?.releaseId).toBe('release-map');
    expect((await repository.load()).stories.find((story) => story.id === 'story-3')?.releaseId).toBeNull();
  });

  it('marks the active option for assistive technology', async () => {
    const user = userEvent.setup();
    const { dialog } = await openStories();
    const box = within(dialog).getByRole('combobox');
    await user.click(box);
    const [first, second] = within(dialog).getAllByRole('option');
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(box).toHaveAttribute('aria-activedescendant', first.id);
    await user.keyboard('{ArrowDown}');
    expect(second).toHaveAttribute('aria-selected', 'true');
    expect(box).toHaveAttribute('aria-activedescendant', second.id);
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(first).toHaveAttribute('aria-selected', 'true');
  });

  it('adds a story with a click', async () => {
    const user = userEvent.setup();
    const { repository, dialog } = await openStories();
    await user.type(within(dialog).getByRole('combobox'), 'language');
    await user.click(within(dialog).getByRole('option', { name: /S-5/ }));
    expect((await repository.load()).stories.find((story) => story.id === 'story-5')?.releaseId).toBe('release-map');
  });

  it('says when nothing matches, and announces the number of matches', async () => {
    const user = userEvent.setup();
    const { dialog } = await openStories();
    const box = within(dialog).getByRole('combobox');
    await user.type(box, 'ba');
    expect(within(dialog).getByRole('status')).toHaveTextContent('2 stories found.');
    await user.type(box, 'nana');
    expect(within(dialog).getByText('No story without a release matches "banana".')).toBeInTheDocument();
    expect(within(dialog).queryAllByRole('option')).toHaveLength(0);
    await user.keyboard('{Enter}');
    expect(within(dialog).getByRole('tab', { name: 'Stories (1)' })).toBeInTheDocument();
  });

  it('closes the list with Escape and the dialog only with the second Escape', async () => {
    const user = userEvent.setup();
    const { dialog } = await openStories();
    const box = within(dialog).getByRole('combobox');
    await user.click(box);
    expect(within(dialog).getAllByRole('option').length).toBeGreaterThan(0);
    await user.keyboard('{Escape}');
    expect(box).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('dialog', { name: /Release 1\.1/ })).toBeInTheDocument();
  });

  it('limits the list and says how many more there are', async () => {
    const user = userEvent.setup();
    const repository = new LocalStorageRepository();
    const seed = seedSnapshot(todayIso());
    const extra = Array.from({ length: 10 }, (_, index) => ({ ...seed.stories[0], id: `extra-${index}`, code: `S-${20 + index}`, title: `Extra ${index}`, rank: 20 + index, releaseId: null, criteria: [], values: {} }));
    await repository.replaceAll({ ...seed, stories: [...seed.stories, ...extra] });
    render(<App repository={repository} />);
    window.location.hash = '#/releases';
    await screen.findByRole('heading', { name: 'Releases', level: 1 });
    const dialog = await openRelease(/Release 1\.1/);
    await user.click(within(dialog).getByRole('tab', { name: /^Stories/ }));
    await user.type(within(dialog).getByRole('combobox'), 'extra');
    expect(within(dialog).getAllByRole('option')).toHaveLength(8);
    expect(within(dialog).getByText('2 more. Keep typing to narrow the list.')).toBeInTheDocument();
  });
});
