import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { initI18n } from './i18n';
import { todayIso } from './domain/sprints';

beforeAll(() => {
  initI18n('en');
});

async function renderApp(hash: string): Promise<LocalStorageRepository> {
  const repository = new LocalStorageRepository();
  await repository.replaceAll(seedSnapshot(todayIso()));
  window.location.hash = hash;
  render(<App repository={repository} />);
  await screen.findByRole('heading', { level: 1 });
  return repository;
}

const group = (name: string): HTMLElement => screen.getByRole('region', { name });
const nameField = (name: string): HTMLElement => screen.getByRole('textbox', { name: `Name of status ${name}` });

/** The column names of the board in order. */
function boardColumns(): string[] {
  return screen.getAllByRole('region').map((column) => column.getAttribute('data-status') ?? '');
}

async function toBoard(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('link', { name: 'Board' }));
  await screen.findByRole('heading', { level: 1, name: 'Sprint 1' });
}

describe('settings › status values', () => {
  it('lists the default status values in their categories and locks the last of "not started" and "done"', async () => {
    await renderApp('#/settings/statuses');
    expect(screen.getByRole('heading', { level: 2, name: 'Status values' })).toBeInTheDocument();
    expect(within(group('Not started')).getAllByRole('textbox').map((input) => (input as HTMLInputElement).value)).toEqual(['To do']);
    expect(within(group('In progress')).getAllByRole('textbox').map((input) => (input as HTMLInputElement).value)).toEqual(['In progress', 'Review']);
    expect(within(group('Done')).getAllByRole('textbox').map((input) => (input as HTMLInputElement).value)).toEqual(['Done']);
    expect(screen.queryByRole('button', { name: 'Remove status To do' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove status Done' })).not.toBeInTheDocument();
    expect(screen.getByText(/Done is the last status in "Done"/, { selector: '.sr-only' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove status Review' })).toBeInTheDocument();
  });

  it('adds a status that becomes a column of the board under its category', async () => {
    const user = userEvent.setup();
    const repository = await renderApp('#/settings/statuses');
    await user.click(screen.getByRole('button', { name: '+ Status in "In progress"' }));
    await user.type(screen.getByRole('textbox', { name: 'Name of the new status in "In progress"' }), 'Test{Enter}');
    expect(nameField('Test')).toHaveValue('Test');
    await waitFor(async () => expect((await repository.load()).statuses.map((status) => status.label ?? status.id)).toContain('Test'));

    await toBoard(user);
    const inProgress = screen.getByRole('group', { name: 'In progress' });
    expect(within(inProgress).getAllByRole('region').map((column) => column.querySelector('.column__name')?.textContent)).toEqual([
      'In progress',
      'Review',
      'Test'
    ]);
    expect(boardColumns()).toHaveLength(5);
  });

  it('renames a status for every language and brings back the translated default when the name is cleared', async () => {
    const user = userEvent.setup();
    await renderApp('#/settings/statuses');
    await user.clear(nameField('To do'));
    await user.type(screen.getByRole('textbox', { name: 'Name of status To do' }), 'Backlog{Enter}');
    expect(nameField('Backlog')).toHaveValue('Backlog');

    await toBoard(user);
    expect(screen.getByRole('region', { name: 'Backlog' })).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Language' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'de');
    expect(await screen.findByRole('region', { name: 'Backlog' })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sprache' }), 'en');

    await user.click(screen.getByRole('link', { name: 'Settings' }));
    await user.click(await screen.findByRole('link', { name: 'Status values' }));
    await user.clear(nameField('Backlog'));
    await user.tab();
    expect(nameField('To do')).toHaveValue('To do');
  });

  it('moves the stories of a removed status to the chosen status', async () => {
    const user = userEvent.setup();
    const repository = await renderApp('#/settings/statuses');
    await user.click(screen.getByRole('button', { name: 'Remove status Review' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove status "Review"?' });
    expect(dialog).toHaveTextContent('1 story has this status (S-2). It gets another status.');
    expect(within(dialog).getByRole('combobox', { name: 'Move to' })).toHaveValue('in_progress');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Move to' }), 'todo');
    await user.click(within(dialog).getByRole('button', { name: 'Move 1 story and remove' }));
    expect(screen.queryByRole('textbox', { name: 'Name of status Review' })).not.toBeInTheDocument();
    await waitFor(async () => {
      const stored = await repository.load();
      expect(stored.statuses.map((status) => status.id)).toEqual(['todo', 'in_progress', 'done']);
      expect(stored.stories.find((story) => story.code === 'S-2')?.status).toBe('todo');
    });

    await toBoard(user);
    expect(screen.queryByRole('region', { name: 'Review' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'To do' })).getByText('Tick off acceptance criteria')).toBeInTheDocument();
  });

  it('asks before a status with stories moves to "Done" and then counts its stories as done', async () => {
    const user = userEvent.setup();
    const repository = await renderApp('#/settings/statuses');
    nameField('Review').focus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    const dialog = screen.getByRole('dialog', { name: 'Move "Review" to "Done"?' });
    expect(dialog).toHaveTextContent('1 story has this status (S-2). It counts as done from today on');
    await user.click(within(dialog).getByRole('button', { name: 'Move' }));
    expect(within(group('Done')).getAllByRole('textbox').map((input) => (input as HTMLInputElement).value)).toEqual(['Review', 'Done']);
    await waitFor(async () => {
      const stored = await repository.load();
      expect(stored.statuses.find((status) => status.id === 'review')?.category).toBe('done');
    });

    await toBoard(user);
    const done = screen.getByRole('group', { name: 'Done' });
    expect(within(done).getAllByRole('region').map((column) => column.getAttribute('data-status'))).toEqual(['review', 'done']);
  });

  it('refuses to move the last status out of "Done" and moves an unused status without asking', async () => {
    const user = userEvent.setup();
    await renderApp('#/settings/statuses');
    nameField('Done').focus();
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(screen.getByText(/^(Not possible|Test is now)/, { selector: '.status-settings__message' })).toHaveTextContent('Not possible: "Not started" and "Done" each need at least one status.');
    expect(within(group('Done')).getAllByRole('textbox')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: '+ Status in "In progress"' }));
    await user.type(screen.getByRole('textbox', { name: 'Name of the new status in "In progress"' }), 'Test{Enter}');
    nameField('Test').focus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(group('Done')).getAllByRole('textbox').map((input) => (input as HTMLInputElement).value)).toEqual(['Test', 'Done']);
    expect(screen.getByText(/^(Not possible|Test is now)/, { selector: '.status-settings__message' })).toHaveTextContent('Test is now at position 1 in "Done".');
  });

  it('starts a new story in the first status of "not started"', async () => {
    const user = userEvent.setup();
    await renderApp('#/settings/statuses');
    await user.click(screen.getByRole('button', { name: '+ Status in "Not started"' }));
    await user.type(screen.getByRole('textbox', { name: 'Name of the new status in "Not started"' }), 'Idea{Enter}');
    nameField('Idea').focus();
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(within(group('Not started')).getAllByRole('textbox').map((input) => (input as HTMLInputElement).value)).toEqual(['Idea', 'To do']);

    await toBoard(user);
    await user.click(screen.getByRole('button', { name: 'New story' }));
    const dialog = await screen.findByRole('dialog', { name: 'New story' });
    await user.type(within(dialog).getByRole('textbox', { name: /Title/ }), 'Fresh idea');
    await user.click(within(dialog).getByRole('button', { name: /Create|Add/ }));
    expect(await within(screen.getByRole('region', { name: 'Idea' })).findByText('Fresh idea')).toBeInTheDocument();
  });
});
