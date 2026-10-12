import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { LocalStorageRepository } from '../../data/localStorageRepository';
import i18n, { initI18n } from '../../i18n';

beforeAll(() => {
  initI18n('en');
});

async function renderApp() {
  const user = userEvent.setup();
  render(<App repository={new LocalStorageRepository()} />);
  await screen.findByRole('heading', { name: 'Sprint 1', level: 1 });
  return user;
}

const field = (): HTMLInputElement => screen.getByRole('combobox', { name: 'Search' });
const listbox = (): HTMLElement => screen.getByRole('listbox', { name: 'Search results' });
const options = (): HTMLElement[] => within(listbox()).queryAllByRole('option');
const selected = (): HTMLElement | undefined => options().find((option) => option.getAttribute('aria-selected') === 'true');

describe('search field', () => {
  it('is in the header and Ctrl+F focuses it from anywhere', async () => {
    const user = await renderApp();
    expect(field()).not.toHaveFocus();
    await user.keyboard('{Control>}f{/Control}');
    expect(field()).toHaveFocus();
    expect(field()).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes the dialog of an open story when Ctrl+F is pressed', async () => {
    const user = await renderApp();
    await user.dblClick(screen.getByRole('group', { name: 'S-4: Keep all data in a local database' }));
    expect(screen.getByRole('dialog', { name: 'S-4: Keep all data in a local database' })).toBeInTheDocument();
    await user.keyboard('{Control>}f{/Control}');
    expect(screen.queryByRole('dialog', { name: /S-4/ })).not.toBeInTheDocument();
    await screen.findByRole('listbox', { name: 'Search results' });
    expect(field()).toHaveFocus();
  });

  it('shows results while typing, grouped, with the match marked and where it was found', async () => {
    const user = await renderApp();
    await user.click(field());
    await user.type(field(), 'offline');
    const group = within(listbox()).getByRole('group', { name: 'Stories' });
    const [option] = within(group).getAllByRole('option');
    expect(option).toHaveTextContent('S-4 Keep all data in a local database');
    expect(option).toHaveTextContent('Description:');
    expect(option.querySelector('mark')).toHaveTextContent('offline');
    expect(screen.getByText('1 result')).toBeInTheDocument();
  });

  it('finds epics and sprints by name', async () => {
    const user = await renderApp();
    await user.type(field(), 'sprint 2');
    expect(within(listbox()).getByRole('group', { name: 'Sprints' })).toHaveTextContent('Sprint 2');
    await user.clear(field());
    await user.type(field(), 'accessib');
    expect(within(listbox()).getByRole('group', { name: 'Epics' })).toHaveTextContent('Accessibility');
  });

  it('shows at most five results per group and the rest on request', async () => {
    const user = await renderApp();
    await user.type(field(), 'a');
    const group = within(listbox()).getByRole('group', { name: 'Stories' });
    const before = within(group).getAllByRole('option');
    expect(before).toHaveLength(6);
    expect(before[5]).toHaveTextContent('+ 2 more stories');
    await user.click(before[5]);
    expect(within(within(listbox()).getByRole('group', { name: /^Stories/ })).queryByText(/more stor/)).not.toBeInTheDocument();
    expect(field()).toHaveFocus();
  });

  it('moves with the arrow keys while focus stays in the field, and Escape closes the list', async () => {
    const user = await renderApp();
    await user.type(field(), 'story');
    const first = selected();
    expect(first).toBeDefined();
    await user.keyboard('{ArrowDown}');
    expect(selected()).not.toBe(first);
    expect(field()).toHaveAttribute('aria-activedescendant', selected()!.id);
    expect(field()).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(field()).toHaveValue('story');
  });

  it('opens a result with Enter and steps through the results in the dialog', async () => {
    const user = await renderApp();
    await user.type(field(), 'key');
    await user.keyboard('{Enter}');
    const dialog = screen.getByRole('dialog', { name: 'S-6: Operate the board with the keyboard only' });
    const bar = within(dialog).getByRole('navigation', { name: 'Search results' });
    expect(bar).toHaveTextContent('«key»');
    expect(bar).toHaveTextContent('Result 1 of 2');
    expect(within(bar).getByRole('button', { name: 'Previous result' })).toBeDisabled();
    await user.click(within(bar).getByRole('button', { name: 'Next result' }));
    const next = screen.getByRole('dialog', { name: 'S-1: Create a story with title and description' });
    expect(within(next).getByRole('navigation', { name: 'Search results' })).toHaveTextContent('Result 2 of 2');
    await user.click(within(next).getByRole('button', { name: 'Back to search' }));
    expect(screen.queryByRole('dialog', { name: /^S-\d+:/ })).not.toBeInTheDocument();
    await screen.findByRole('listbox', { name: 'Search results' });
    expect(field()).toHaveFocus();
    expect(selected()).toHaveTextContent('S-1 Create a story');
  });

  it('does not show the result bar when a story is opened from the board', async () => {
    const user = await renderApp();
    await user.dblClick(screen.getByRole('group', { name: 'S-4: Keep all data in a local database' }));
    expect(screen.queryByRole('navigation', { name: 'Search results' })).not.toBeInTheDocument();
  });

  it('clears text and filters with one click', async () => {
    const user = await renderApp();
    await user.type(field(), 'status:review tick');
    await user.click(within(screen.getByRole('search')).getByRole('button', { name: 'Clear search' }));
    expect(field()).toHaveValue('');
    expect(screen.getByRole('search').querySelector('.search-chip')).toBeNull();
    expect(field()).toHaveFocus();
  });
});

describe('field filters typed in the search', () => {
  const badge = (name: string): HTMLElement | null =>
    within(screen.getByRole('search'))
      .queryAllByText((_, element) => element?.classList.contains('search-chip') === true && element.textContent?.startsWith(name) === true)[0] ?? null;

  it('suggests fields while typing; Tab takes the field and lists its values; choosing one makes a badge', async () => {
    const user = await renderApp();
    await user.type(field(), 'poi');
    expect(within(listbox()).getByRole('group', { name: 'Fields' })).toHaveTextContent('Points');
    await user.keyboard('{Tab}');
    expect(field()).toHaveValue('points:');
    const values = within(listbox()).getByRole('group', { name: 'Points' });
    expect(within(values).getAllByRole('option').map((option) => option.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('5')])
    );
    await user.type(field(), '5');
    await user.keyboard('{Enter}');
    expect(field()).toHaveValue('');
    expect(badge('Points')).toHaveTextContent('Points=5');
    const stories = within(listbox()).getByRole('group', { name: 'Stories' });
    expect(within(stories).getAllByRole('option').length).toBeGreaterThan(0);
    expect(field()).toHaveFocus();
  });

  it('lists all fields with @ and Ctrl+Space; a field that is set cannot be chosen again', async () => {
    const user = await renderApp();
    await user.type(field(), 'status:review ');
    expect(badge('Status')).toHaveTextContent('Status=Review');
    await user.type(field(), '@');
    const fields = within(listbox()).getByRole('group', { name: 'Fields' });
    expect(fields).toHaveTextContent('Epic');
    expect(fields).toHaveTextContent('Sprint');
    expect(within(fields).getByRole('option', { name: /Status/ })).toHaveAttribute('aria-disabled', 'true');
    await user.clear(field());
    await user.keyboard('{Control>} {/Control}');
    expect(within(listbox()).getByRole('group', { name: 'Fields' })).toHaveTextContent('Points');
  });

  it('turns a typed field:value into a badge when the next word starts, and combines fields with AND', async () => {
    const user = await renderApp();
    await user.type(field(), 'status:in epic:"local storage" ');
    expect(field()).toHaveValue('');
    expect(badge('Status')).toHaveTextContent('Status=In progress');
    expect(badge('Epic')).toHaveTextContent('Epic=Local storage');
    const stories = within(listbox()).getByRole('group', { name: 'Stories' });
    expect(within(stories).getAllByRole('option')).toHaveLength(1);
    expect(stories).toHaveTextContent('S-4');
  });

  it('removes the last badge completely with one Backspace at the start of the field', async () => {
    const user = await renderApp();
    await user.type(field(), 'status:review points:2 ');
    expect(badge('Points')).not.toBeNull();
    await user.keyboard('{Backspace}');
    expect(badge('Points')).toBeNull();
    expect(badge('Status')).not.toBeNull();
  });

  it('replaces the value when a field is typed again', async () => {
    const user = await renderApp();
    await user.type(field(), 'status:review status:done ');
    expect(screen.getByRole('search').querySelectorAll('.search-chip')).toHaveLength(1);
    expect(badge('Status')).toHaveTextContent('Status=Done');
  });

  it('reports an unknown field or value and leaves it out of the search', async () => {
    const user = await renderApp();
    await user.type(field(), 'colour:red offline');
    expect(screen.getByRole('note')).toHaveTextContent('There is no field “colour”');
    expect(within(listbox()).getByRole('group', { name: 'Stories' })).toHaveTextContent('S-4');
    await user.clear(field());
    await user.type(field(), 'status:maybe');
    expect(screen.getByRole('note')).toHaveTextContent('“maybe” is not a value of Status');
  });

  it('suggests dropping a filter when nothing is found', async () => {
    const user = await renderApp();
    await user.type(field(), 'status:done keyboard');
    const empty = within(listbox()).getByRole('group', { name: 'No results' });
    const relax = within(empty).getByRole('option', { name: /Search without Status = Done/ });
    expect(relax).toHaveTextContent('1 result');
    await user.click(relax);
    expect(field()).toHaveValue('keyboard');
    expect(within(listbox()).getByRole('group', { name: 'Stories' })).toHaveTextContent('S-6');
  });

  it('has no filter buttons any more', async () => {
    const user = await renderApp();
    await user.click(field());
    expect(screen.queryByRole('button', { name: /^Status/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Filter' })).not.toBeInTheDocument();
  });
});

describe('history', () => {
  it('remembers searches and opened items and shows them in an empty field', async () => {
    const user = await renderApp();
    await user.type(field(), 'offline');
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'Back to search' }));
    await user.click(within(screen.getByRole('search')).getByRole('button', { name: 'Clear search' }));
    const searches = within(listbox()).getByRole('group', { name: 'Recent searches' });
    expect(searches).toHaveTextContent('offline');
    const opened = within(listbox()).getByRole('group', { name: 'Recently opened' });
    expect(opened).toHaveTextContent('S-4 Keep all data in a local database');
    await user.click(within(searches).getByRole('option'));
    expect(field()).toHaveValue('offline');
    expect(JSON.parse(window.localStorage.getItem('getitdone.searchHistory')!).searches[0].text).toBe('offline');
  });

  it('removes an entry with Delete and everything with "Clear history"', async () => {
    const user = await renderApp();
    await user.type(field(), 'offline');
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'Back to search' }));
    await user.click(within(screen.getByRole('search')).getByRole('button', { name: 'Clear search' }));
    expect(selected()).toHaveTextContent('offline');
    await user.keyboard('{Delete}');
    expect(within(listbox()).queryByRole('group', { name: 'Recent searches' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear history' }));
    expect(within(listbox()).queryByRole('group', { name: 'Recently opened' })).not.toBeInTheDocument();
    expect(screen.getByText(/Type to search stories/)).toBeInTheDocument();
  });

  it('counts items opened from the board as recently opened', async () => {
    const user = await renderApp();
    await user.dblClick(screen.getByRole('group', { name: 'S-3: Reorder the backlog by priority' }));
    await user.keyboard('{Escape}');
    await user.click(field());
    expect(within(listbox()).getByRole('group', { name: 'Recently opened' })).toHaveTextContent('S-3');
  });
});

describe('the current page', () => {
  const bar = (): HTMLElement => screen.getByText(/stories here match|story here matches/).closest('.highlight-bar') as HTMLElement;

  it('highlights matching stories on the board while typing and dims the others', async () => {
    const user = await renderApp();
    await user.type(field(), 'offline');
    expect(screen.getByRole('button', { name: /Show on Board/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'S-4: Keep all data in a local database' })).toHaveClass('card--match');
    expect(screen.getByRole('group', { name: 'S-1: Create a story with title and description' })).toHaveClass('card--dimmed');
    expect(bar()).toHaveTextContent('1 of 6 stories here match');
    await user.click(within(bar()).getByRole('button', { name: 'Clear search' }));
    expect(screen.getByRole('group', { name: 'S-1: Create a story with title and description' })).not.toHaveClass('card--dimmed');
    expect(field()).toHaveValue('');
  });

  it('closes the list with Ctrl+Enter and keeps the highlighting, also on other pages', async () => {
    const user = await renderApp();
    await user.type(field(), 'story map');
    // Nothing on the board matches, so there is nothing to show there.
    expect(screen.queryByRole('button', { name: /Show on Board/ })).not.toBeInTheDocument();
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(bar()).toHaveTextContent('0 of 6 stories here match');
    await user.click(screen.getByRole('link', { name: 'Backlog' }));
    expect(await screen.findByText('1 of 7 stories here match')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /S-7: Plan releases on a story map/ })).toHaveClass('backlog__row--match');
  });

  it('lists results on the page first and marks them', async () => {
    const user = await renderApp();
    await user.type(field(), 'story');
    const stories = within(listbox()).getAllByRole('option');
    expect(stories[0]).toHaveTextContent('On this page');
    const last = stories[stories.length - 1];
    expect(last).toHaveTextContent('S-7');
    expect(last).not.toHaveTextContent('On this page');
  });

  it('searches only the page when switched, and offers to search everywhere again', async () => {
    const user = await renderApp();
    await user.type(field(), 'releases');
    await user.click(screen.getByRole('radio', { name: 'Only Board' }));
    const empty = within(listbox()).getByRole('group', { name: 'No results' });
    const widen = within(empty).getByRole('option', { name: /Show results from everywhere/ });
    expect(widen).toHaveTextContent('1 result');
    await user.click(widen);
    expect(screen.getByRole('radio', { name: 'Everywhere' })).toBeChecked();
    expect(within(listbox()).getByRole('group', { name: 'Stories' })).toHaveTextContent('S-7');
    expect(window.localStorage.getItem('getitdone.searchScope')).toBe('all');
  });

  it('marks matching epics on the epics page', async () => {
    const user = await renderApp();
    await user.click(screen.getByRole('link', { name: 'Epics' }));
    await user.type(field(), 'storage');
    expect(screen.getByRole('button', { name: /^Local storage/ })).toHaveClass('epic-row--match');
    expect(screen.getByRole('button', { name: /^Boards/ })).toHaveClass('epic-row--dimmed');
  });
});

describe('languages', () => {
  it('shows the search in German', async () => {
    const user = await renderApp();
    await i18n.changeLanguage('de');
    await user.type(screen.getByRole('combobox', { name: 'Suche' }), 'offline');
    expect(screen.getByRole('listbox', { name: 'Suchergebnisse' })).toHaveTextContent('Beschreibung:');
    await user.clear(screen.getByRole('combobox', { name: 'Suche' }));
    await user.type(screen.getByRole('combobox', { name: 'Suche' }), 'Punk');
    expect(within(screen.getByRole('listbox', { name: 'Suchergebnisse' })).getByRole('group', { name: 'Felder' })).toHaveTextContent('Punkte');
  });
});

describe('opening a result where it is shown', () => {
  it('opens a story on the current page there and marks and focuses its card', async () => {
    const user = await renderApp();
    await user.type(field(), 'offline');
    await user.keyboard('{Enter}');
    expect(window.location.hash).not.toBe('#/backlog');
    const card = screen.getByRole('group', { name: 'S-4: Keep all data in a local database' });
    expect(card).toHaveAttribute('data-located', 'true');
    expect(screen.getByRole('dialog', { name: /S-4/ })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(card).toHaveFocus();
  });

  it('switches to another page that shows the story when it is not on the current one', async () => {
    const user = await renderApp();
    await user.type(field(), 'releases');
    await user.keyboard('{Enter}');
    expect(window.location.hash).toBe('#/backlog');
    expect(await screen.findByRole('dialog', { name: /S-7/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /S-7: Plan releases on a story map/ })).toHaveAttribute('data-located', 'true');
  });

  it('goes from the epics page to the board for a story of the running sprint', async () => {
    const user = await renderApp();
    await user.click(screen.getByRole('link', { name: 'Epics' }));
    await user.type(field(), 'offline');
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog', { name: /S-4/ })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/board');
  });

  it('shows an epic on the epics page', async () => {
    const user = await renderApp();
    await user.type(field(), 'accessib');
    // The first result is a story with the label "Accessibility"; the epic follows.
    await user.keyboard('{ArrowDown}');
    expect(selected()).toHaveTextContent('Epic');
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog', { name: 'Accessibility' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/epics');
  });

  it('removes the mark when the search is cleared', async () => {
    const user = await renderApp();
    await user.type(field(), 'offline');
    await user.keyboard('{Enter}');
    await user.keyboard('{Escape}');
    await user.click(within(screen.getByRole('search')).getByRole('button', { name: 'Clear search' }));
    expect(document.querySelector('[data-located]')).toBeNull();
  });
});

describe('keyboard in the dialog and on the page', () => {
  it('steps through results with the arrow keys and closes the dialog with Escape', async () => {
    const user = await renderApp();
    await user.type(field(), 'key');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: /S-6/ })).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(await screen.findByRole('dialog', { name: /S-1/ })).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(await screen.findByRole('dialog', { name: /S-6/ })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /S-6/ })).not.toBeInTheDocument();
    // The search is still there after closing the dialog …
    expect(field()).toHaveValue('key');
    // … and a second Escape on the page resets it.
    await user.keyboard('{Escape}');
    expect(field()).toHaveValue('');
    expect(screen.queryByText(/stories here match/)).not.toBeInTheDocument();
  });

  it('resets the search with Escape in the field once the list is closed', async () => {
    const user = await renderApp();
    await user.type(field(), 'status:review data');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(field()).toHaveValue('');
    expect(screen.getByRole('search').querySelector('.search-chip')).toBeNull();
  });

  it('filters by description and leaves key and title to the free text', async () => {
    const user = await renderApp();
    await user.type(field(), '@');
    const fields = within(listbox()).getByRole('group', { name: 'Fields' });
    expect(fields).toHaveTextContent('Description');
    expect(within(fields).queryByRole('option', { name: /^Key/ })).not.toBeInTheDocument();
    expect(within(fields).queryByRole('option', { name: /^Title/ })).not.toBeInTheDocument();
    await user.clear(field());
    await user.type(field(), 'key:s-4');
    expect(screen.getByRole('note')).toHaveTextContent('key');
  });
});
