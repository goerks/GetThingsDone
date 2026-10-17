import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next from 'i18next';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { EMPTY_DEFINITIONS } from './domain/definitions';
import { todayIso } from './domain/sprints';
import type { FeatureKey } from './domain/types';
import { initI18n } from './i18n';

/*
 * Component tests of the settings with one tab per feature (#61), following the test cases the PO approved in the issue.
 * The demo data have the team and releases on.
 */

vi.setConfig({ testTimeout: 30_000 });

beforeAll(() => {
  initI18n('en');
});

beforeEach(async () => {
  await i18next.changeLanguage('en');
});

async function open(hash: string, off: FeatureKey[] = [], mapRows: 'sprints' | 'releases' = 'sprints'): Promise<LocalStorageRepository> {
  const repository = new LocalStorageRepository();
  const seed = seedSnapshot(todayIso());
  const features = { ...seed.settings.features };
  for (const key of off) features[key] = false;
  await repository.replaceAll({ ...seed, settings: { ...seed.settings, mapRows, features, definitions: EMPTY_DEFINITIONS } });
  window.location.hash = hash;
  render(<App repository={repository} />);
  await screen.findByRole('heading', { level: 1 });
  return repository;
}

const nav = (): HTMLElement => screen.getByRole('navigation', { name: 'Settings sections' });
const names = (container: HTMLElement): string[] => within(container).getAllByRole('link').map((anchor) => anchor.textContent ?? '');

describe('settings with one tab per feature (#61)', () => {
  it('AC1.1 has no tab "Features" any more', async () => {
    // Given the settings are open
    await open('#/settings/fields');
    // Then there is no entry "Features" in the list
    expect(within(nav()).queryByRole('link', { name: 'Features' })).toBeNull();
  });

  it('AC1.2 leads the old address of the features to the tab "Releases"', async () => {
    // Given a bookmark on the old address
    await open('#/settings/features');
    // Then the tab "Releases" is open
    expect(await screen.findByRole('heading', { level: 2, name: 'Releases' })).toBeInTheDocument();
    expect(within(nav()).getByRole('link', { name: /^Releases/ })).toHaveAttribute('aria-current', 'page');
  });

  it('AC2.1 groups the list in "Workspace" and "Features"', async () => {
    // Given the settings are open
    await open('#/settings/fields');
    // Then the groups hold the sections in this order
    const workspace = within(nav()).getByRole('group', { name: 'Workspace' });
    const features = within(nav()).getByRole('group', { name: 'Features' });
    expect(names(workspace)).toEqual(['Fields', 'Status values', 'Story map', 'Definitions', 'Data']);
    expect(names(features)).toEqual(['Releases On', 'Team On']);
  });

  it('AC2.2 shows both features always, with their state', async () => {
    // Given the team is off and releases are on
    await open('#/settings/fields', ['team']);
    // Then both entries are there, labelled "On" and "Off"
    const features = within(nav()).getByRole('group', { name: 'Features' });
    expect(within(features).getByRole('link', { name: 'Releases On' })).toBeInTheDocument();
    expect(within(features).getByRole('link', { name: 'Team Off' })).toBeInTheDocument();
  });

  it('AC3.1 switches the team on in its tab, shows its settings and keeps the choice', async () => {
    // Given the team is off and the tab "Team" is open
    const user = userEvent.setup();
    const repository = await open('#/settings/team', ['team']);
    // When I switch the switch at the top on
    await user.click(await screen.findByRole('switch', { name: 'Team' }));
    // Then the list says "On", the members and "Add member" are there, and the choice is stored
    expect(await within(nav()).findByRole('link', { name: 'Team On' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Add member' })).toBeInTheDocument();
    expect(screen.getByText('Michael Burkard')).toBeInTheDocument();
    await waitFor(async () => expect((await repository.load()).settings.features.team).toBe(true));
  });

  it('AC3.2 switches the team off in its tab, shows the start page and keeps the members', async () => {
    // Given the team is on and the tab "Team" is open
    const user = userEvent.setup();
    const repository = await open('#/settings/team');
    // When I switch the switch at the top off
    await user.click(await screen.findByRole('switch', { name: 'Team' }));
    // Then the tab is the start page and the board has no person filter
    expect(await screen.findByRole('button', { name: 'Switch on Team' })).toBeInTheDocument();
    expect(screen.queryByText('Michael Burkard')).toBeNull();
    await waitFor(async () => expect((await repository.load()).settings.features.team).toBe(false));
    // And the members are still stored
    expect((await repository.load()).members.length).toBeGreaterThan(0);
    // And switching on again brings them back
    await user.click(screen.getByRole('switch', { name: 'Team' }));
    expect(await screen.findByText('Michael Burkard')).toBeInTheDocument();
  });

  it('AC3.3 switches releases off in their tab and hides the page Releases', async () => {
    // Given releases are on and the tab "Releases" is open
    const user = userEvent.setup();
    await open('#/settings/releases');
    const mainNav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(mainNav).getByRole('link', { name: 'Releases' })).toBeInTheDocument();
    // When I switch the switch at the top off
    await user.click(await screen.findByRole('switch', { name: 'Releases' }));
    // Then the tab is the start page and the page Releases is gone from the main navigation
    expect(await screen.findByRole('button', { name: 'Switch on Releases' })).toBeInTheDocument();
    expect(within(mainNav).queryByRole('link', { name: 'Releases' })).toBeNull();
  });

  it('AC4.1 shows a start page while the feature is off', async () => {
    // Given the team is off
    await open('#/settings/team', ['team']);
    // Then the tab explains the feature, says the data is kept and has no member list
    expect(await screen.findByRole('button', { name: 'Switch on Team' })).toBeInTheDocument();
    expect(screen.getByText(/Assign stories to people/)).toBeInTheDocument();
    expect(screen.getByText('Switched off. Members and assignments are kept and come back when you switch it on.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Team members' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add member' })).toBeNull();
  });

  it('AC4.2 switches the feature on with the button of the start page', async () => {
    // Given the team is off and its tab is open
    const user = userEvent.setup();
    await open('#/settings/team', ['team']);
    // When I click "Switch on Team"
    await user.click(await screen.findByRole('button', { name: 'Switch on Team' }));
    // Then the team is on and the members are visible
    expect(await screen.findByText('Michael Burkard')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Team' })).toBeChecked();
  });

  it('AC5.1 leads from the story map to the tab "Releases"', async () => {
    // Given releases are off and the story map shows the hint about the rows
    await open('#/map', ['releases'], 'releases');
    const note = await screen.findByRole('note');
    // When I follow the link of the hint
    expect(within(note).getByRole('link')).toHaveAttribute('href', '#/settings/releases');
  });

  it('AC5.2 leads from the help to the tab of the feature', async () => {
    // Given the team is off and the help topic "Team and assignment" is open
    const user = userEvent.setup();
    await open('#/board', ['team']);
    await user.click(screen.getByRole('button', { name: 'Help' }));
    const panel = screen.getByRole('complementary');
    await user.type(within(panel).getByRole('searchbox', { name: 'Search help' }), 'Team and assignment');
    await user.click(within(panel).getByRole('button', { name: /^Team and assignment/ }));
    // Then the link leads to the tab "Team", where the feature is switched on
    const link = within(panel).getByRole('link', { name: 'Open Settings → Team' });
    expect(link).toHaveAttribute('href', '#/settings/team');
    await user.click(link);
    expect(await screen.findByRole('button', { name: 'Switch on Team' })).toBeInTheDocument();
  });

  it('AC6.1 keeps the rows of the story map in the tab "Story map"', async () => {
    // Given releases are on
    await open('#/settings/map');
    // Then the choice of the rows is there as before
    expect(await screen.findByRole('radio', { name: /Sprints/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Releases/ })).toBeEnabled();
  });

  it('AC6.2 hides a switched-off team on the board and in the story dialog', async () => {
    // Given the team is off
    const user = userEvent.setup();
    await open('#/board', ['team']);
    // Then the board has no filter and the story dialog has no field "Assigned to"
    const card = await screen.findByRole('group', { name: /^S-3:/ });
    expect(screen.queryByRole('group', { name: 'Person' })).toBeNull();
    await user.dblClick(card);
    const dialog = await screen.findByRole('dialog', { name: /^S-3:/ });
    expect(within(dialog).queryByLabelText('Assigned to')).toBeNull();
  });

  it.each([
    ['de', 'Arbeitsbereich', 'Funktionen', 'Team einschalten'],
    ['fr', 'Espace de travail', 'Fonctions', 'Activer Équipe'],
    ['it', 'Area di lavoro', 'Funzioni', 'Attiva Team']
  ])('AC7.1 shows the groups, the start page and the button in %s', async (code, workspace, features, button) => {
    // Given the language is switched
    await i18next.changeLanguage(code);
    await open('#/settings/team', ['team']);
    // Then the groups and the button are translated
    expect(await screen.findByRole('button', { name: button })).toBeInTheDocument();
    const list = document.querySelector('.settings__nav') as HTMLElement;
    expect(within(list).getByRole('group', { name: workspace })).toBeInTheDocument();
    expect(within(list).getByRole('group', { name: features })).toBeInTheDocument();
  });

  it('AC7.2 operates the switch with the keyboard and names it', async () => {
    // Given the team is off and its tab is open
    const user = userEvent.setup();
    await open('#/settings/team', ['team']);
    const toggle = await screen.findByRole('switch', { name: 'Team' });
    // When I focus the switch and press the space key
    toggle.focus();
    await user.keyboard(' ');
    // Then the team is on
    expect(toggle).toBeChecked();
  });

  it('AC7.3 no help text names the tab "Features" any more, and every link leads to a tab', async () => {
    // Given the help of all languages
    const { TOPICS, LINK_TARGETS } = await import('./help/topics');
    const languages = await Promise.all([import('./i18n/en.json'), import('./i18n/de.json'), import('./i18n/fr.json'), import('./i18n/it.json')]);
    // Then no body mentions the old address of the settings and every link target is a known address
    for (const { default: texts } of languages) {
      for (const topic of Object.values(texts.help.topics)) expect(topic.body).not.toMatch(/Settings → Features|Einstellungen → Funktionen|Paramètres → Fonctions|Impostazioni → Funzioni/);
    }
    for (const topic of TOPICS) for (const link of topic.links ?? []) expect(LINK_TARGETS[link.id]).toMatch(/^#\//);
    expect(Object.values(LINK_TARGETS)).not.toContain('#/settings/features');
  });
});
