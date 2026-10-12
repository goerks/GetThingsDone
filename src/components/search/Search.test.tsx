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
    await user.type(field(), 'review');
    await user.keyboard('{Tab}');
    await user.type(field(), 'tick');
    await user.click(within(screen.getByRole('search')).getByRole('button', { name: 'Clear search' }));
    expect(field()).toHaveValue('');
    expect(screen.queryByRole('button', { name: /Change filter/ })).not.toBeInTheDocument();
    expect(field()).toHaveFocus();
  });
});

describe('filters', () => {
  it('offers matching free text as a filter and turns it into a chip with Tab', async () => {
    const user = await renderApp();
    await user.type(field(), 'review');
    const suggestions = within(listbox()).getByRole('group', { name: 'Use as filter' });
    expect(suggestions).toHaveTextContent('Status = Review');
    // Without text results, the suggestion is the marked entry.
    expect(selected()).toHaveTextContent('Status = Review');
    await user.keyboard('{Tab}');
    expect(field()).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Change filter Status: Review' })).toBeInTheDocument();
    expect(within(listbox()).getByRole('group', { name: 'Stories' })).toHaveTextContent('Tick off acceptance criteria');
    expect(field()).toHaveFocus();
  });

  it('removes the last chip with Backspace twice at the start of the field', async () => {
    const user = await renderApp();
    await user.type(field(), 'review');
    await user.keyboard('{Tab}');
    await user.keyboard('{Backspace}');
    expect(screen.getByRole('button', { name: 'Change filter Status: Review' }).parentElement).toHaveClass('search-chip--marked');
    await user.keyboard('{Backspace}');
    expect(screen.queryByRole('button', { name: 'Change filter Status: Review' })).not.toBeInTheDocument();
  });

  it('picks values in a menu with counts; values of one field are combined with or', async () => {
    const user = await renderApp();
    await user.click(field());
    await user.click(screen.getByRole('button', { name: /^Status/ }));
    const menu = screen.getByRole('dialog', { name: 'Filter: Status' });
    const review = within(menu).getByRole('checkbox', { name: /Review/ });
    expect(within(menu).getByRole('radio', { name: 'is' })).toHaveFocus();
    await user.click(review);
    await user.click(within(menu).getByRole('checkbox', { name: /Done/ }));
    expect(screen.getByRole('button', { name: 'Change filter Status: Review or Done' })).toBeInTheDocument();
    const stories = within(listbox()).getByRole('group', { name: /^Stories/ });
    expect(within(stories).getAllByRole('option').map((option) => option.textContent)).toEqual([
      expect.stringContaining('S-2'),
      expect.stringContaining('S-5')
    ]);
    await user.click(within(menu).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog', { name: 'Filter: Status' })).not.toBeInTheDocument();
    expect(field()).toHaveFocus();
  });

  it('excludes values with "is not" and combines fields with and', async () => {
    const user = await renderApp();
    await user.click(field());
    await user.click(screen.getByRole('button', { name: /^Epic/ }));
    await user.click(within(screen.getByRole('dialog', { name: 'Filter: Epic' })).getByRole('checkbox', { name: /Boards/ }));
    await user.click(screen.getByRole('button', { name: /^Status/ }));
    const menu = screen.getByRole('dialog', { name: 'Filter: Status' });
    await user.click(within(menu).getByRole('checkbox', { name: /Review/ }));
    await user.click(within(menu).getByRole('radio', { name: 'is not' }));
    expect(screen.getByRole('button', { name: 'Change filter Status is not Review' })).toBeInTheDocument();
    const stories = within(listbox()).getByRole('group', { name: /^Stories/ });
    expect(within(stories).getAllByRole('option')).toHaveLength(1);
    expect(stories).toHaveTextContent('S-1');
  });

  it('offers the other fields under "+ Filter"', async () => {
    const user = await renderApp();
    await user.click(field());
    await user.click(screen.getByRole('button', { name: '+ Filter' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Filter' })).getByRole('button', { name: 'Criteria' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Filter: Criteria' })).getByRole('checkbox', { name: /All accepted/ }));
    expect(screen.getByRole('button', { name: 'Change filter Criteria: All accepted' })).toBeInTheDocument();
    expect(within(listbox()).getByRole('group', { name: /^Stories/ })).toHaveTextContent('S-5');
  });

  it('suggests dropping a filter when nothing is found', async () => {
    const user = await renderApp();
    await user.type(field(), 'done');
    await user.keyboard('{Tab}');
    await user.type(field(), 'keyboard');
    const empty = within(listbox()).getByRole('group', { name: 'No results' });
    const relax = within(empty).getByRole('option', { name: /Search without Status: Done/ });
    expect(relax).toHaveTextContent('1 result');
    await user.click(relax);
    expect(within(listbox()).getByRole('group', { name: 'Stories' })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: /^Status/ })).toBeInTheDocument();
  });
});
