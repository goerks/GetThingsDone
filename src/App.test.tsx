import { describe, expect, it, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { initI18n } from './i18n';
import { parseHash } from './router';

beforeAll(() => {
  initI18n('en');
});

async function renderApp(): Promise<LocalStorageRepository> {
  const repository = new LocalStorageRepository();
  render(<App repository={repository} />);
  await screen.findByRole('heading', { name: 'Sprint 1', level: 1 });
  return repository;
}

describe('board', () => {
  it('shows the demo stories in their columns', async () => {
    await renderApp();
    const inProgress = screen.getByRole('region', { name: 'In progress' });
    expect(within(inProgress).getByText('Create a story with title and description')).toBeInTheDocument();
    expect(within(inProgress).getByText('Keep all data in a local database')).toBeInTheDocument();
    const done = screen.getByRole('region', { name: 'Done' });
    expect(within(done).getByText('Switch the UI language (DE, EN, FR, IT)')).toBeInTheDocument();
  });

  it('does not show stories that are not in the sprint', async () => {
    await renderApp();
    expect(screen.queryByText('Plan releases on a story map')).not.toBeInTheDocument();
  });

  it('offers a keyboard accessible drag handle for every card', async () => {
    await renderApp();
    const handle = screen.getByRole('button', { name: 'Move Reorder the backlog by priority' });
    expect(handle).toBeInTheDocument();
  });

  it('summarises the sprint', async () => {
    await renderApp();
    expect(screen.getByText('6 stories · 23 points')).toBeInTheDocument();
  });

  it('creates a story in "To do"', async () => {
    const user = userEvent.setup();
    const repository = await renderApp();
    await user.click(screen.getByRole('button', { name: 'New story' }));
    await user.type(screen.getByLabelText('Title'), 'Export to CSV');
    await user.click(screen.getByRole('button', { name: 'Add story' }));

    const todo = screen.getByRole('region', { name: 'To do' });
    expect(within(todo).getByText('Export to CSV')).toBeInTheDocument();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    const saved = await repository.load();
    expect(saved.stories.some((s) => s.title === 'Export to CSV' && s.code === 'S-8')).toBe(true);
  });
});

describe('backlog', () => {
  it('moves a story up and stores the new order', async () => {
    const user = userEvent.setup();
    const repository = await renderApp();
    await user.click(screen.getByRole('link', { name: 'Backlog' }));
    await user.click(await screen.findByRole('button', { name: 'Move Tick off acceptance criteria up' }));

    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]).getByText('Tick off acceptance criteria')).toBeInTheDocument();
    const saved = await repository.load();
    expect(saved.stories.find((s) => s.id === 'story-2')?.rank).toBe(0);
  });

  it('adds a story to the sprint', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('link', { name: 'Backlog' }));
    const toggle = await screen.findByRole('button', { name: /Sprint 1 – Plan releases on a story map/ });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('story detail', () => {
  it('ticks a criterion and updates the progress', async () => {
    const user = userEvent.setup();
    const repository = await renderApp();
    await user.click(screen.getByRole('link', { name: 'Create a story with title and description' }));

    expect(await screen.findByText('2 of 4 accepted')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'A new story appears in "To do"' }));
    expect(screen.getByText('3 of 4 accepted')).toBeInTheDocument();
    const saved = await repository.load();
    expect(saved.stories.find((s) => s.id === 'story-1')?.criteria.find((c) => c.id === 'c-1-3')?.done).toBe(true);
  });

  it('announces when every criterion is accepted', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('link', { name: 'Tick off acceptance criteria' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('checkbox', { name: /marked as ready to merge/ }));
    expect(screen.getByRole('status')).toHaveTextContent('All criteria accepted');
  });

  it('adds a criterion', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('link', { name: 'Reorder the backlog by priority' }));
    await user.type(await screen.findByLabelText('New criterion'), 'Works with 500 stories');
    await user.click(screen.getByRole('button', { name: 'Add criterion' }));
    expect(screen.getByRole('checkbox', { name: 'Works with 500 stories' })).toBeInTheDocument();
  });

  it('shows a message for an unknown story', async () => {
    window.location.hash = '#/story/unknown';
    render(<App repository={new LocalStorageRepository()} />);
    expect(await screen.findByText('This story does not exist.')).toBeInTheDocument();
  });
});

describe('header', () => {
  it('switches the language and the document language', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.selectOptions(screen.getByLabelText('Language'), 'de');
    expect(screen.getByRole('region', { name: 'In Arbeit' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('de');
    await user.selectOptions(screen.getByLabelText('Sprache'), 'en');
  });

  it('switches the theme and remembers it', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('getitdone.theme')).toBe('dark');
    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('marks the current page', async () => {
    await renderApp();
    expect(screen.getByRole('link', { name: 'Board' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('router', () => {
  it('parses known routes and falls back to the board', () => {
    expect(parseHash('#/backlog')).toEqual({ name: 'backlog' });
    expect(parseHash('#/story/abc')).toEqual({ name: 'story', id: 'abc' });
    expect(parseHash('')).toEqual({ name: 'board' });
    expect(parseHash('#/nonsense')).toEqual({ name: 'board' });
  });
});
