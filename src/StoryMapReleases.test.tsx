import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { addDays, todayIso } from './domain/sprints';
import { initI18n } from './i18n';
import { EMPTY_DEFINITIONS } from './domain/definitions';
import { DEFAULT_WORKFLOW } from './domain/workflow';


beforeAll(() => {
  initI18n('en');
});

async function renderMap(rows: 'sprints' | 'releases', tweak?: (seed: ReturnType<typeof seedSnapshot>) => ReturnType<typeof seedSnapshot>) {
  const repository = new LocalStorageRepository();
  const seed = seedSnapshot(todayIso());
  await repository.replaceAll({ ...(tweak ? tweak(seed) : seed), settings: { mapRows: rows, features: { releases: true }, definitions: EMPTY_DEFINITIONS, workflow: DEFAULT_WORKFLOW } });
  window.location.hash = '#/map';
  render(<App repository={repository} />);
  await screen.findByRole('heading', { name: 'Story Map', level: 1 });
  return repository;
}

describe('settings › story map', () => {
  async function openSetting(): Promise<LocalStorageRepository> {
    const repository = new LocalStorageRepository();
    window.location.hash = '#/settings/map';
    render(<App repository={repository} />);
    await screen.findByRole('heading', { name: 'Story map', level: 2 });
    return repository;
  }

  it('is a section of the settings next to the fields', async () => {
    await openSetting();
    const sections = screen.getByRole('navigation', { name: 'Settings sections' });
    expect(within(sections).getByRole('link', { name: 'Story map' })).toHaveAttribute('aria-current', 'page');
    expect(within(sections).getByRole('link', { name: 'Fields' })).not.toHaveAttribute('aria-current');
    expect(window.location.hash).toBe('#/settings/map');
  });

  it('offers sprints (the default) and releases as a radio group', async () => {
    await openSetting();
    const group = screen.getByRole('group', { name: 'Rows of the story map' });
    expect(within(group).getByRole('radio', { name: /Sprints/ })).toBeChecked();
    expect(within(group).getByRole('radio', { name: /Releases/ })).not.toBeChecked();
    expect(within(group).getByText('Default')).toBeInTheDocument();
  });

  it('saves the choice at once for the whole team', async () => {
    const user = userEvent.setup();
    const repository = await openSetting();
    await user.click(screen.getByRole('radio', { name: /Releases/ }));
    expect(screen.getByRole('radio', { name: /Releases/ })).toBeChecked();
    expect((await repository.load()).settings.mapRows).toBe('releases');
    await user.click(screen.getByRole('radio', { name: /Sprints/ }));
    expect((await new LocalStorageRepository().load()).settings.mapRows).toBe('sprints');
  });

  it('leads back to the story map', async () => {
    await openSetting();
    expect(screen.getByRole('link', { name: '← To the story map' })).toHaveAttribute('href', '#/map');
  });

  it('says that the map is empty of releases while there is none', async () => {
    const repository = new LocalStorageRepository();
    const seed = seedSnapshot(todayIso());
    await repository.replaceAll({ ...seed, releases: [], stories: seed.stories.map((story) => ({ ...story, releaseId: null })), settings: { mapRows: 'releases', features: { releases: true }, definitions: EMPTY_DEFINITIONS, workflow: DEFAULT_WORKFLOW } });
    window.location.hash = '#/settings/map';
    render(<App repository={repository} />);
    expect(await screen.findByRole('note')).toHaveTextContent('There is no release yet');
    expect(within(screen.getByRole('note')).getByRole('link', { name: 'Create a release' })).toHaveAttribute('href', '#/releases');
  });
});

describe('story map head', () => {
  it('shows the rows of the map as a link to the setting, also in sprint mode', async () => {
    await renderMap('sprints');
    const link = screen.getByRole('link', { name: 'Rows of the story map: Sprints. Change in the settings' });
    expect(link).toHaveAttribute('href', '#/settings/map');
    expect(link).toHaveTextContent('Rows: Sprints');
  });

  it('jumps to the setting and back', async () => {
    const user = userEvent.setup();
    await renderMap('releases');
    await user.click(screen.getByRole('link', { name: 'Rows of the story map: Releases. Change in the settings' }));
    expect(await screen.findByRole('heading', { name: 'Story map', level: 2 })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Sprints/ }));
    await user.click(screen.getByRole('link', { name: '← To the story map' }));
    expect(await screen.findByRole('link', { name: 'Rows of the story map: Sprints. Change in the settings' })).toBeInTheDocument();
    expect(screen.getByText('Sprint 1')).toBeInTheDocument();
  });
});

describe('story map with releases as rows', () => {
  it('shows one row per release and a row for stories without a release', async () => {
    await renderMap('releases');
    expect(screen.getByText('Release ↓ · Epic →')).toBeInTheDocument();
    expect(screen.getByText('Release 1.0 – Public Beta')).toBeInTheDocument();
    expect(screen.getByText('Release 1.1 – Story map')).toBeInTheDocument();
    expect(screen.getByText('No release')).toBeInTheDocument();
    expect(screen.queryByText('Not planned')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Sprint' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Release' })).toBeInTheDocument();
    expect(screen.getByText(/4 epics · 2 releases · 7 stories/)).toBeInTheDocument();
  });

  it('puts the stories in the cells of their release and epic', async () => {
    await renderMap('releases');
    const beta = document.querySelector('[data-cell="epic-boards::release-beta"]') as HTMLElement;
    expect(within(beta).getByRole('group', { name: /S-1:/ })).toBeInTheDocument();
    expect(within(beta).getByRole('group', { name: /S-2:/ })).toBeInTheDocument();
    const map = document.querySelector('[data-cell="epic-backlog::release-map"]') as HTMLElement;
    expect(within(map).getByRole('group', { name: /S-7:/ })).toBeInTheDocument();
  });

  it('does not offer to reorder sprints', async () => {
    await renderMap('releases');
    expect(screen.queryByText(/Click to edit, drag to reorder/)).not.toBeInTheDocument();
  });

  it('opens a release from its label', async () => {
    const user = userEvent.setup();
    await renderMap('releases');
    await user.click(screen.getByRole('button', { name: /^Release 1\.1 – Story map, No period, Planned/ }));
    expect(await screen.findByRole('dialog', { name: /Release 1\.1/ })).toBeInTheDocument();
  });

  it('creates a story in a release cell with that release and no sprint', async () => {
    const user = userEvent.setup();
    const repository = await renderMap('releases');
    await user.click(screen.getByRole('button', { name: 'New story in Local storage, Release 1.1 – Story map' }));
    await user.type(screen.getByRole('textbox', { name: 'Title of the new story in Release 1.1 – Story map, Local storage' }), 'Planned in a release{Enter}');
    const saved = (await repository.load()).stories.find((story) => story.title === 'Planned in a release');
    expect(saved).toMatchObject({ releaseId: 'release-map', epicId: 'epic-storage', sprintId: null });
  });

  it('creates a story without a release in the "no release" row', async () => {
    const user = userEvent.setup();
    const repository = await renderMap('releases');
    await user.click(screen.getByRole('button', { name: 'New story in Boards, No release' }));
    await user.type(screen.getByRole('textbox', { name: 'Title of the new story in No release, Boards' }), 'Loose{Enter}');
    expect((await repository.load()).stories.find((story) => story.title === 'Loose')?.releaseId).toBeNull();
  });

  it('creates a release from the map', async () => {
    const user = userEvent.setup();
    const repository = await renderMap('releases');
    await user.click(screen.getByRole('button', { name: '+ Release' }));
    const dialog = screen.getByRole('dialog', { name: 'New release' });
    await user.type(within(dialog).getByLabelText('Title'), 'Release 2.0');
    await user.click(within(dialog).getByRole('button', { name: 'Add release' }));
    expect(screen.getByText('Release 2.0')).toBeInTheDocument();
    expect((await repository.load()).releases.some((release) => release.title === 'Release 2.0')).toBe(true);
  });

  it('leaves out a release that is done, like a sprint that is over', async () => {
    await renderMap('releases', (seed) => ({
      ...seed,
      stories: seed.stories.map((story) => (story.releaseId === 'release-map' ? { ...story, status: 'done' as const } : story))
    }));
    expect(screen.queryByText('Release 1.1 – Story map')).not.toBeInTheDocument();
    expect(screen.getByText('Release 1.0 – Public Beta')).toBeInTheDocument();
  });

  it('warns on the row when stories are planned in sprints that end after the release', async () => {
    await renderMap('releases', (seed) => ({
      ...seed,
      releases: seed.releases.map((release) => (release.id === 'release-beta' ? { ...release, endDate: addDays(todayIso(), 3) } : release))
    }));
    expect(screen.getByText('6 stories after the end')).toBeInTheDocument();
  });

  it('keeps the sprint rows in sprint mode', async () => {
    await renderMap('sprints');
    expect(screen.getByText('Sprint ↓ · Epic →')).toBeInTheDocument();
    expect(screen.getByText('Not planned')).toBeInTheDocument();
    expect(screen.queryByText('No release')).not.toBeInTheDocument();
  });
});
