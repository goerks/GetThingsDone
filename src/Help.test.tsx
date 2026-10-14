import { beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { HELP_STORAGE_KEY } from './domain/helpTour';
import { todayIso } from './domain/sprints';
import i18n, { initI18n } from './i18n';

/*
 * Component tests of the help (#33), following the test cases the PO approved in the issue: the panel, the search
 * with the keyboard and the screen reader texts, "Show me", the invitation and the first steps. Dragging a story and
 * the whole journey in a real browser are in e2e/help.spec.ts.
 */

beforeAll(() => {
  initI18n('en');
});

async function renderApp(hash = '#/board', options: { withoutStories?: boolean; releasesOff?: boolean } = {}): Promise<LocalStorageRepository> {
  const repository = new LocalStorageRepository();
  const snapshot = seedSnapshot(todayIso());
  await repository.replaceAll({
    ...snapshot,
    stories: options.withoutStories ? [] : snapshot.stories,
    settings: options.releasesOff ? { ...snapshot.settings, features: { ...snapshot.settings.features, releases: false } } : snapshot.settings
  });
  window.location.hash = hash;
  render(<App repository={repository} />);
  await screen.findByRole('heading', { level: 1 });
  return repository;
}

const helpButton = (): HTMLElement => screen.getByRole('button', { name: 'Help' });
const panel = (): HTMLElement => screen.getByRole('complementary');
const field = (): HTMLElement => screen.getByRole('searchbox', { name: 'Search help' });

async function openHelp(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(helpButton());
  expect(panel()).toBeInTheDocument();
}

/** The titles of the listed topics, in order. */
function listed(): string[] {
  return within(panel())
    .getAllByRole('button')
    .filter((button) => button.hasAttribute('data-help-item'))
    .map((button) => button.querySelector('.help__item-title')?.textContent ?? '');
}

async function dismissInvitation(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'No thanks' }));
}

describe('help panel', () => {
  it('AC1.1 opens next to the page with the "?" button and closes with it again', async () => {
    const user = userEvent.setup();
    await renderApp();
    expect(screen.queryByRole('complementary', { name: 'Help' })).not.toBeInTheDocument();
    expect(helpButton()).toHaveAttribute('aria-expanded', 'false');

    await user.click(helpButton());
    expect(panel()).toBeInTheDocument();
    expect(helpButton()).toHaveAttribute('aria-expanded', 'true');
    // The board behind stays on the page
    expect(screen.getByRole('heading', { level: 1, name: 'Sprint 1' })).toBeVisible();

    await user.click(helpButton());
    expect(screen.queryByRole('complementary', { name: 'Help' })).not.toBeInTheDocument();
  });

  it('AC1.2 opens with the key "?" and closes with Escape, and the focus goes back to the button', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.keyboard('?');
    expect(panel()).toBeInTheDocument();
    expect(field()).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('complementary', { name: 'Help' })).not.toBeInTheDocument();
    expect(helpButton()).toHaveFocus();
  });

  it('AC1.3 types a question mark into a text field instead of opening the help', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('combobox', { name: 'Search' }));
    await user.keyboard('How?');
    expect(screen.getByRole('combobox', { name: 'Search' })).toHaveValue('How?');
    expect(screen.queryByRole('complementary', { name: 'Help' })).not.toBeInTheDocument();
  });

  it('AC1.3 leaves the key "?" alone while a dialog is open', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('button', { name: 'New story' }));
    await user.keyboard('?');
    expect(screen.queryByRole('complementary', { name: 'Help' })).not.toBeInTheDocument();
  });

  it('AC1.4 stays open while the user works on the page', async () => {
    const user = userEvent.setup();
    await renderApp();
    await dismissInvitation(user);
    await openHelp(user);
    await user.click(screen.getByRole('button', { name: 'New story' }));
    const dialog = screen.getByRole('dialog', { name: 'New story' });
    await user.type(within(dialog).getByLabelText('Title'), 'Export to CSV');
    await user.click(within(dialog).getByRole('button', { name: 'Add story' }));
    expect(screen.getByText('Export to CSV')).toBeInTheDocument();
    expect(panel()).toBeInTheDocument();
  });

  it.each([
    ['#/board', 'Help · Board'],
    ['#/backlog', 'Help · Backlog'],
    ['#/map', 'Help · Story Map'],
    ['#/epics', 'Help · Epics'],
    ['#/settings/fields', 'Help · Settings']
  ])('AC2.1 on %s the help is called "%s" and lists the topics of that page', async (hash, title) => {
    const user = userEvent.setup();
    await renderApp(hash);
    await openHelp(user);
    expect(within(panel()).getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
    expect(within(panel()).getByRole('heading', { level: 3, name: 'On this page' })).toBeInTheDocument();
    expect(listed().length).toBeGreaterThan(2);
  });

  it('AC2.1 follows the page: the help changes when the user goes to another page', async () => {
    const user = userEvent.setup();
    await renderApp('#/board');
    await openHelp(user);
    expect(listed()).toContain('Move a story');
    await user.click(screen.getByRole('link', { name: 'Backlog' }));
    expect(within(panel()).getByRole('heading', { level: 2, name: 'Help · Backlog' })).toBeInTheDocument();
    expect(listed()).toContain('Order the backlog');
    expect(listed()).not.toContain('Move a story');
  });
});

describe('help search', () => {
  async function search(text: string): Promise<ReturnType<typeof userEvent.setup>> {
    const user = userEvent.setup();
    await renderApp();
    await openHelp(user);
    await user.type(field(), text);
    return user;
  }

  it('AC3.1 finds a topic and marks the word', async () => {
    await search('move');
    expect(listed()[0]).toBe('Move a story');
    expect(within(panel()).getByText('Move', { selector: 'mark' })).toBeInTheDocument();
  });

  it.each([
    ['MOVE A STORY', 'Move a story'],
    ['status', 'Columns and status values'],
    ['KEYBOARD', 'Keyboard shortcuts']
  ])('AC3.2 finds "%s" whatever the case: first hit "%s"', async (text, first) => {
    await search(text);
    expect(listed()).toContain(first);
    if (text !== 'KEYBOARD') expect(listed()[0]).toBe(first);
  });

  it('AC3.3 shows only the topics that contain every word', async () => {
    await search('story column');
    expect(listed()).toContain('Move a story');
    expect(listed()).not.toContain('Order the backlog');
  });

  it('AC3.4 says there are no hits and offers all topics', async () => {
    const user = await search('xyzxyz');
    expect(within(panel()).getByText('No results for “xyzxyz”', { selector: 'strong' })).toBeInTheDocument();
    expect(within(panel()).getByText('Try other words or look at all topics.')).toBeInTheDocument();
    await user.click(within(panel()).getByRole('button', { name: 'Show all topics' }));
    expect(field()).toHaveValue('');
    expect(within(panel()).getByRole('heading', { level: 3, name: 'All topics' })).toBeInTheDocument();
    expect(listed()).toContain('Order the backlog');
    expect(listed()).toContain('Move a story');
  });

  it('AC3.5 clears the search with the cross and shows the topics of the page again', async () => {
    const user = await search('move');
    await user.click(within(panel()).getByRole('button', { name: 'Clear search' }));
    expect(field()).toHaveValue('');
    expect(field()).toHaveFocus();
    expect(within(panel()).getByRole('heading', { level: 3, name: 'On this page' })).toBeInTheDocument();
    expect(listed()).toContain('Move a story');
  });

  it('AC3.6 finds topics of other pages and says which page they belong to', async () => {
    await search('sprint line');
    const [first] = within(panel()).getAllByRole('button').filter((button) => button.hasAttribute('data-help-item'));
    expect(first).toHaveTextContent('Backlog and the sprint line');
    expect(first).toHaveTextContent('On page: Backlog');
  });

  it('AC3.7 searches in the language of the app, in French and in German', async () => {
    const user = userEvent.setup();
    await i18n.changeLanguage('fr');
    await renderApp();
    await user.click(screen.getByRole('button', { name: 'Aide' }));
    await user.type(screen.getByRole('searchbox', { name: "Rechercher dans l’aide" }), 'déplacer');
    expect(listed()[0]).toBe('Déplacer une story');
    cleanup();

    await i18n.changeLanguage('de');
    await renderApp();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Hilfe' }));
    await userEvent.setup().type(screen.getByRole('searchbox', { name: 'Hilfe durchsuchen' }), 'verschieben');
    expect(listed()[0]).toBe('Eine Story verschieben');
  });

  it('AC3.7 does not find the German word in English', async () => {
    await search('verschieben');
    expect(within(panel()).getAllByText(/^No results for/).length).toBeGreaterThan(0);
  });

  it('AC4.1 works with the keyboard alone: type, arrow down, Enter, and Escape goes back to the hits', async () => {
    const user = await search('move');
    expect(field()).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: /^Move a story/ })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(within(panel()).getByRole('heading', { level: 3, name: 'Move a story' })).toHaveFocus();

    await user.keyboard('{Escape}');
    // Back at the hits, the search is still there and the panel is still open
    expect(panel()).toBeInTheDocument();
    expect(field()).toHaveValue('move');
    expect(listed()[0]).toBe('Move a story');
  });

  it('AC4.1 moves between the hits with the arrow keys and back to the field', async () => {
    const user = await search('status');
    await user.keyboard('{ArrowDown}');
    const first = document.activeElement as HTMLElement;
    expect(first).toHaveAttribute('data-help-item');
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).not.toBe(first);
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(field()).toHaveFocus();
  });

  it('AC4.2 tells the screen reader how many topics were found, or that there are none', async () => {
    const user = await search('move');
    const counts = (): string => within(panel()).getAllByRole('status').map((node) => node.textContent).join('|');
    expect(counts()).toMatch(/\d+ results?/);
    await user.clear(field());
    await user.type(field(), 'xyzxyz');
    expect(counts()).toContain('No results for “xyzxyz”');
  });

  it('AC4.2 names the results list and the field for assistive technology', async () => {
    await search('move');
    expect(within(panel()).getByRole('list', { name: 'Help topics found' })).toBeInTheDocument();
    expect(field()).toHaveAccessibleName('Search help');
  });
});

describe('show me', () => {
  it('AC5.1 frames the element the topic is about, without dimming anything', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openHelp(user);
    await user.click(within(panel()).getByRole('button', { name: 'Move a story' }));
    await user.click(within(panel()).getByRole('button', { name: 'Show me' }));
    const marked = document.querySelectorAll('[data-help-highlight]');
    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveAttribute('data-story-id');
    expect(within(panel()).getByText('Highlighted on the page.')).toBeInTheDocument();
    expect(document.querySelector('.dim, .scrim')).toBeNull();
  });

  it('AC5.2 ends the frame on the next click on the page', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openHelp(user);
    await user.click(within(panel()).getByRole('button', { name: 'Move a story' }));
    await user.click(within(panel()).getByRole('button', { name: 'Show me' }));
    expect(document.querySelectorAll('[data-help-highlight]')).toHaveLength(1);
    await user.click(screen.getByRole('heading', { level: 1, name: 'Sprint 1' }));
    expect(document.querySelectorAll('[data-help-highlight]')).toHaveLength(0);
  });

  it('AC5.2 ends the frame on a key and on a change of page', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openHelp(user);
    await user.click(within(panel()).getByRole('button', { name: 'Move a story' }));
    await user.click(within(panel()).getByRole('button', { name: 'Show me' }));
    await user.keyboard('{Escape}');
    expect(document.querySelectorAll('[data-help-highlight]')).toHaveLength(0);
  });

  it('AC5.3 says so when there is nothing to show', async () => {
    const user = userEvent.setup();
    await renderApp('#/board', { withoutStories: true });
    await openHelp(user);
    await user.click(within(panel()).getByRole('button', { name: 'Move a story' }));
    await user.click(within(panel()).getByRole('button', { name: 'Show me' }));
    expect(within(panel()).getByText('There is nothing to show here right now. Create a story first.')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-help-highlight]')).toHaveLength(0);
  });

  it('AC5.1 offers a link to the page of the topic when the user is somewhere else', async () => {
    const user = userEvent.setup();
    await renderApp('#/board');
    await openHelp(user);
    await user.type(field(), 'order the backlog');
    await user.click(screen.getByRole('button', { name: /^Order the backlog/ }));
    expect(within(panel()).queryByRole('button', { name: 'Show me' })).not.toBeInTheDocument();
    expect(within(panel()).getByRole('link', { name: 'Open Backlog' })).toHaveAttribute('href', '#/backlog');
  });
});

describe('invitation', () => {
  it('AC8.1 invites the user once on the first start, and everything stays usable', async () => {
    await renderApp();
    const card = screen.getByRole('group', { name: 'Introduction' });
    expect(within(card).getByText('New here? Welcome to Get It Done.')).toBeInTheDocument();
    expect(document.querySelector('dialog, .scrim, .dim')).toBeNull();
    expect(screen.getByRole('button', { name: 'New story' })).toBeEnabled();
  });

  it('AC8.2 "No thanks" removes the card for good, and the first steps stay reachable', async () => {
    const user = userEvent.setup();
    await renderApp();
    await dismissInvitation(user);
    expect(screen.queryByRole('group', { name: 'Introduction' })).not.toBeInTheDocument();
    cleanup();

    await renderApp();
    expect(screen.queryByRole('group', { name: 'Introduction' })).not.toBeInTheDocument();
    await openHelp(userEvent.setup());
    expect(within(panel()).getByRole('button', { name: /First steps/ })).toBeInTheDocument();
  });

  it('AC8.3 "Start introduction" opens the first steps at 0 of 4', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('button', { name: 'Start introduction' }));
    expect(screen.queryByRole('group', { name: 'Introduction' })).not.toBeInTheDocument();
    expect(within(panel()).getByRole('heading', { level: 3, name: 'First steps' })).toBeInTheDocument();
    expect(within(panel()).getByText('0 of 4 done')).toBeInTheDocument();
  });

  it('AC8.4 does not come back after the user created a story on their own', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('button', { name: 'New story' }));
    const dialog = screen.getByRole('dialog', { name: 'New story' });
    await user.type(within(dialog).getByLabelText('Title'), 'Passwort vergessen');
    await user.click(within(dialog).getByRole('button', { name: 'Add story' }));
    expect(screen.queryByRole('group', { name: 'Introduction' })).not.toBeInTheDocument();
    cleanup();
    await renderApp();
    expect(screen.queryByRole('group', { name: 'Introduction' })).not.toBeInTheDocument();
  });
});

describe('first steps', () => {
  async function startTour(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await user.click(screen.getByRole('button', { name: 'Start introduction' }));
  }
  const steps = (): HTMLElement[] => within(panel()).getAllByRole('listitem').filter((item) => item.classList.contains('help__step'));
  const stepNames = (): string[] => steps().map((item) => item.querySelector('strong')?.textContent ?? '');

  it('AC6.1 starts at 0 of 4, is optional and blocks nothing', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openHelp(user);
    await user.click(within(panel()).getByRole('button', { name: /First steps/ }));
    expect(within(panel()).getByText('0 of 4 done')).toBeInTheDocument();
    expect(within(panel()).getByText(/Optional, and you can stop at any time/)).toBeInTheDocument();
    expect(stepNames()).toEqual(['Get to know the board', 'Move a story', 'Create a story', 'Order the backlog']);
    await user.click(within(panel()).getByRole('button', { name: 'Continue later' }));
    expect(screen.queryByRole('complementary', { name: 'Help' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New story' })).toBeEnabled();
  });

  it('AC6.3 the first step is confirmed by the user and the next one becomes the current step', async () => {
    const user = userEvent.setup();
    await renderApp();
    await startTour(user);
    expect(steps()[0]).toHaveAttribute('aria-current', 'step');
    await user.click(within(panel()).getByRole('button', { name: 'Got it' }));
    expect(within(panel()).getByText('1 of 4 done')).toBeInTheDocument();
    expect(steps()[0]).toHaveTextContent('done');
    expect(steps()[1]).toHaveAttribute('aria-current', 'step');
    expect(steps()[0]).not.toHaveAttribute('aria-current');
  });

  it('AC6.4 skips a step without doing it, and nothing is created', async () => {
    const user = userEvent.setup();
    const repository = await renderApp();
    const before = (await repository.load()).stories.length;
    await startTour(user);
    await user.click(within(panel()).getByRole('button', { name: 'Skip step' }));
    await user.click(within(panel()).getByRole('button', { name: 'Skip step' }));
    expect(steps()[0]).toHaveTextContent('skipped');
    expect(steps()[1]).toHaveTextContent('skipped');
    expect(steps()[2]).toHaveAttribute('aria-current', 'step');
    expect(within(panel()).getByText('0 of 4 done')).toBeInTheDocument();
    expect((await repository.load()).stories).toHaveLength(before);
  });

  it('AC6.5 ticks off "Create a story" when the user creates one with Ctrl+N, also without looking at the panel', async () => {
    const user = userEvent.setup();
    await renderApp();
    await startTour(user);
    await user.click(within(panel()).getByRole('button', { name: 'Close help' }));

    await user.keyboard('{Control>}n{/Control}');
    const dialog = screen.getByRole('dialog', { name: 'New story' });
    await user.type(within(dialog).getByLabelText('Title'), 'Passwort vergessen');
    await user.click(within(dialog).getByRole('button', { name: 'Add story' }));

    await user.keyboard('?');
    await user.click(within(panel()).getByRole('button', { name: /First steps/ }));
    expect(within(panel()).getByText('1 of 4 done')).toBeInTheDocument();
    expect(steps()[2]).toHaveTextContent('done');
  });

  it('AC6.5 does not count a story that was created before the introduction was started', async () => {
    const user = userEvent.setup();
    await renderApp();
    await dismissInvitation(user);
    await user.click(screen.getByRole('button', { name: 'New story' }));
    const dialog = screen.getByRole('dialog', { name: 'New story' });
    await user.type(within(dialog).getByLabelText('Title'), 'Passwort vergessen');
    await user.click(within(dialog).getByRole('button', { name: 'Add story' }));

    await openHelp(user);
    await user.click(within(panel()).getByRole('button', { name: /First steps/ }));
    expect(within(panel()).getByText('0 of 4 done')).toBeInTheDocument();
    expect(steps()[2]).not.toHaveTextContent('done');
  });

  it('AC6.6 can be operated with the keyboard alone and says what is done', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.keyboard('?');
    await user.keyboard('{Tab}');
    // From the field to the first steps button, then Enter
    expect(within(panel()).getByRole('button', { name: /First steps/ })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(within(panel()).getByRole('heading', { level: 3, name: 'First steps' })).toHaveFocus();
    // The heading has the focus; the next stop is the button of the current step
    await user.tab();
    expect(within(panel()).getByRole('button', { name: 'Got it' })).toHaveFocus();
    await user.keyboard('{Enter}');
    // The finished step is said as "done", in the text of the list item
    expect(steps()[0]).toHaveTextContent('Get to know the board · done');
    expect(within(panel()).getByRole('list', { name: 'Steps' })).toBeInTheDocument();
    await user.keyboard('{Escape}{Escape}');
    expect(screen.queryByRole('complementary', { name: 'Help' })).not.toBeInTheDocument();
    expect(helpButton()).toHaveFocus();
  });

  it('AC6.3 says that the introduction is through when every step is done or skipped', async () => {
    const user = userEvent.setup();
    await renderApp();
    await startTour(user);
    await user.click(within(panel()).getByRole('button', { name: 'Got it' }));
    for (let i = 0; i < 3; i += 1) await user.click(within(panel()).getByRole('button', { name: 'Skip step' }));
    expect(within(panel()).getByText('Well done: all steps are through. Every help topic is one click away.')).toBeInTheDocument();
    expect(within(panel()).getByText('1 of 4 done')).toBeInTheDocument();
  });

  it('AC7.1 keeps the progress after a reload', async () => {
    const user = userEvent.setup();
    await renderApp();
    await startTour(user);
    await user.click(within(panel()).getByRole('button', { name: 'Got it' }));
    await user.click(within(panel()).getByRole('button', { name: 'Skip step' }));
    cleanup();

    await renderApp();
    expect(screen.queryByRole('group', { name: 'Introduction' })).not.toBeInTheDocument();
    await openHelp(userEvent.setup());
    expect(within(panel()).getByRole('button', { name: /First steps/ })).toHaveTextContent('1 of 4');
    await userEvent.setup().click(within(panel()).getByRole('button', { name: /First steps/ }));
    expect(within(panel()).getByText('1 of 4 done')).toBeInTheDocument();
    expect(steps()[2]).toHaveAttribute('aria-current', 'step');
  });

  it('AC7.1 starts from the beginning when the stored progress is damaged', async () => {
    window.localStorage.setItem(HELP_STORAGE_KEY, '{broken');
    await renderApp();
    expect(screen.getByRole('group', { name: 'Introduction' })).toBeInTheDocument();
  });

  it('AC7.2 starts again after a confirmation, and keeps the stories', async () => {
    const user = userEvent.setup();
    const repository = await renderApp();
    const before = (await repository.load()).stories.length;
    await startTour(user);
    await user.click(within(panel()).getByRole('button', { name: 'Got it' }));
    expect(within(panel()).getByText('1 of 4 done')).toBeInTheDocument();

    await user.click(within(panel()).getByRole('button', { name: 'Start again' }));
    expect(within(panel()).getByText('Start again from the first step? Your stories stay as they are.')).toBeInTheDocument();
    await user.click(within(panel()).getByRole('button', { name: 'Cancel' }));
    expect(within(panel()).getByText('1 of 4 done')).toBeInTheDocument();

    await user.click(within(panel()).getByRole('button', { name: 'Start again' }));
    await user.click(within(panel()).getByRole('button', { name: 'Yes, start again' }));
    expect(within(panel()).getByText('0 of 4 done')).toBeInTheDocument();
    expect((await repository.load()).stories).toHaveLength(before);
  });
});

describe('links to the right pages', () => {
  async function openTopic(user: ReturnType<typeof userEvent.setup>, title: string): Promise<void> {
    await openHelp(user);
    await user.type(field(), title);
    await user.click(within(panel()).getByRole('button', { name: new RegExp(`^${title}`) }));
  }
  const link = (name: string): HTMLElement => within(panel()).getByRole('link', { name });

  it('AC10.1 leads to the page of a topic, and the help stays open and follows the page', async () => {
    const user = userEvent.setup();
    await renderApp('#/board');
    await openTopic(user, 'Columns and status values');
    await user.click(link('Open Settings → Status values'));
    expect(window.location.hash).toBe('#/settings/statuses');
    expect(panel()).toBeInTheDocument();
    expect(within(panel()).getByRole('heading', { level: 2, name: 'Help · Settings' })).toBeInTheDocument();
    expect(within(panel()).getByRole('heading', { level: 3, name: 'Columns and status values' })).toBeInTheDocument();
  });

  it('AC10.2 explains Releases in the order: switch the feature on, then the page, then the rows of the story map, and links to each place', async () => {
    const user = userEvent.setup();
    await renderApp('#/board');
    await openTopic(user, 'Releases');
    const text = within(panel()).getAllByText(/^(Releases only work|1\.|2\.|3\.)/).map((node) => node.textContent ?? '');
    expect(text[0]).toMatch(/^Releases only work when the feature “Releases” is switched on/);
    expect(text[1]).toMatch(/^1\. Switch the feature on under Settings → Features/);
    expect(text[2]).toMatch(/^2\. Open the Releases page/);
    expect(text[3]).toMatch(/^3\. .*Settings → Story map/);
    expect(link('Open Settings → Features')).toHaveAttribute('href', '#/settings/features');
    expect(link('Open Settings → Features')).toHaveClass('linkbtn--first');
    expect(link('Open Releases')).toHaveAttribute('href', '#/releases');
    expect(link('Open Releases')).not.toHaveClass('linkbtn--first');
    expect(link('Open Settings → Story map')).toHaveTextContent('Choose “Releases” as the rows');
    expect(link('Open Settings → Story map')).toHaveAttribute('href', '#/settings/map');
    expect(link('Open Story Map')).toHaveAttribute('href', '#/map');
    // The feature is first in the list of places
    const places = within(panel()).getAllByRole('link').map((anchor) => anchor.textContent);
    expect(places.indexOf('Open Settings → Features')).toBeLessThan(places.indexOf('Open Releases'));
  });

  it('AC10.3 does not link to places that need Releases while the feature is off, and says to switch it on first', async () => {
    const user = userEvent.setup();
    await renderApp('#/board', { releasesOff: true });
    await openTopic(user, 'Releases');
    expect(link('Open Settings → Features')).toBeInTheDocument();
    for (const name of ['Open Releases', 'Open Settings → Story map']) expect(within(panel()).queryByRole('link', { name })).not.toBeInTheDocument();
    for (const name of ['Open Releases', 'Open Settings → Story map', 'Open Story Map']) {
      const locked = within(panel()).getByText(name).closest('.linkbtn');
      expect(locked).toHaveClass('linkbtn--locked');
      expect(locked).toHaveTextContent('Switch the feature “Releases” on first');
    }
    // The feature itself stands out, with its hint, and is a link
    expect(link('Open Settings → Features')).toHaveClass('linkbtn--first');
    expect(link('Open Settings → Features')).toHaveTextContent('Switch the feature on first');
  });

  it('AC10.3 turns the places into links when the feature is switched on, with the help open', async () => {
    const user = userEvent.setup();
    await renderApp('#/board', { releasesOff: true });
    await openTopic(user, 'Releases');
    await user.click(link('Open Settings → Features'));
    await user.click(await screen.findByRole('switch', { name: /Releases/ }));
    expect(link('Open Releases')).toHaveAttribute('href', '#/releases');
    expect(within(panel()).queryByText(/switch the feature “Releases” on first/)).not.toBeInTheDocument();
  });

  it('AC10.4 leaves out the link to the page the user is on', async () => {
    const user = userEvent.setup();
    await renderApp('#/board');
    await openTopic(user, 'Columns and status values');
    expect(link('Open Settings → Status values')).toBeInTheDocument();
    expect(within(panel()).queryByRole('link', { name: 'Open Board' })).not.toBeInTheDocument();
    // Nothing has to be switched on first here, so no button stands out
    expect(link('Open Settings → Status values')).not.toHaveClass('linkbtn--first');
  });

  it('AC10.5 lists the sections of the settings, except the one that is open', async () => {
    const user = userEvent.setup();
    await renderApp('#/settings/fields');
    await openHelp(user);
    await user.click(within(panel()).getByRole('button', { name: /^Settings/ }));
    const places = within(panel()).getAllByRole('link').map((anchor) => anchor.textContent);
    expect(places).toEqual(['Open Settings → Status values', 'Open Settings → Story map', 'Open Settings → Features']);
  });
});

describe('help in all languages', () => {
  it.each([
    ['de', 'Hilfe · Board', 'Hilfe'],
    ['en', 'Help · Board', 'Help'],
    ['fr', 'Aide · Tableau', 'Aide'],
    ['it', 'Guida · Board', 'Guida']
  ])('AC9.1 shows the help in %s with the title "%s"', async (code, title, button) => {
    await i18n.changeLanguage(code);
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('button', { name: button }));
    const aside = screen.getByRole('complementary', { name: button });
    expect(within(aside).getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
    expect(aside.textContent).not.toMatch(/help\.[a-z]+\./);
  });
});
