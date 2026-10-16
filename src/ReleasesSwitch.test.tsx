import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { initI18n } from './i18n';
import { todayIso } from './domain/sprints';
import { EMPTY_DEFINITIONS } from './domain/definitions';


beforeAll(() => {
  initI18n('en');
});

const mainNav = (): HTMLElement => screen.getByRole('navigation', { name: 'Main' });

async function renderApp(hash: string, releasesEnabled: boolean, mapRows: 'sprints' | 'releases' = 'sprints'): Promise<LocalStorageRepository> {
  const repository = new LocalStorageRepository();
  await repository.replaceAll({ ...seedSnapshot(todayIso()), settings: { mapRows, features: { releases: releasesEnabled }, definitions: EMPTY_DEFINITIONS } });
  await repository.replaceAll({ ...seedSnapshot(todayIso()), settings: { mapRows, features: { releases: releasesEnabled, github: false }, github: { repo: '', lastSyncAt: null } } });
  window.location.hash = hash;
  render(<App repository={repository} />);
  await screen.findByRole('heading', { level: 1 });
  return repository;
}

describe('the releases feature toggle', () => {
  it('hides the Releases page, its address and the release field of stories', async () => {
    const user = userEvent.setup();
    await renderApp('#/releases', false);
    await waitFor(() => expect(window.location.hash).toBe('#/board'));
    expect(within(mainNav()).queryByRole('link', { name: 'Releases' })).not.toBeInTheDocument();
    await user.dblClick(await screen.findByRole('group', { name: /S-1:/ }));
    const dialog = await screen.findByRole('dialog', { name: /S-1:/ });
    expect(within(dialog).queryByLabelText('Release')).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('Sprint')).toBeInTheDocument();
  });

  it('shows the story map by sprints even when releases were chosen before', async () => {
    await renderApp('#/map', false, 'releases');
    expect(screen.queryByText('No release')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Rows of the story map: Sprints/ })).toBeInTheDocument();
    // The team chose releases, so the map says why it shows sprints and where to change it.
    expect(screen.getByRole('note')).toHaveTextContent('Rows are sprints: releases are switched off.');
    expect(within(screen.getByRole('note')).getByRole('link')).toHaveAttribute('href', '#/settings/features');
  });

  it('says nothing on the map when the team never chose releases', async () => {
    await renderApp('#/map', false);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('marks the field as unavailable in the settings and keeps the choice of the map rows disabled', async () => {
    const user = userEvent.setup();
    await renderApp('#/settings/fields', false);
    expect(screen.getByRole('note')).toHaveTextContent('Not available: releases are switched off');
    expect(screen.getAllByText(/not available on .*releases are switched off/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('tab', { name: /Layout/ }));
    expect(screen.getByText(/Not available: releases are switched off/, { selector: '.layout-row__note' }).closest('li')).toHaveTextContent('Release');
    await user.click(screen.getByRole('link', { name: 'Story map' }));
    expect(screen.getByRole('radio', { name: /Releases/ })).toBeDisabled();
    expect(screen.getByRole('note')).toHaveTextContent('Releases are switched off, so they cannot be used as rows of the story map.');
    expect(screen.getByText('Not available')).toBeInTheDocument();
  });

  it('brings everything back when it is switched on again, and keeps the data', async () => {
    const user = userEvent.setup();
    const repository = await renderApp('#/settings/features', false);
    expect(within(mainNav()).queryByRole('link', { name: 'Releases' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: /Releases/ }));
    await waitFor(() => expect(within(mainNav()).getByRole('link', { name: 'Releases' })).toBeInTheDocument());
    await waitFor(async () => expect((await repository.load()).settings.features.releases).toBe(true));
    const saved = await repository.load();
    expect(saved.releases).toHaveLength(2);
    expect(saved.stories.some((story) => story.releaseId !== null)).toBe(true);

    await user.click(screen.getByRole('switch', { name: /Releases/ }));
    await waitFor(async () => expect((await repository.load()).settings.features.releases).toBe(false));
    expect((await repository.load()).releases).toHaveLength(2);
  });
});
