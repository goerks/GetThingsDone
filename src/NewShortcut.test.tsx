import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { initI18n } from './i18n';

beforeAll(() => {
  initI18n('en');
});

async function openPage(hash: string): Promise<void> {
  window.location.hash = hash;
  render(<App repository={new LocalStorageRepository()} />);
  await screen.findByRole('heading', { level: 1 });
}

const ctrlN = async (): Promise<void> => userEvent.setup().keyboard('{Control>}n{/Control}');

describe('Ctrl+N creates what the page is about', () => {
  it.each([
    ['#/board', 'New story'],
    ['#/backlog', 'New story'],
    ['#/map', 'New story'],
    ['#/epics', 'New epic'],
    ['#/releases', 'New release']
  ])('on %s it opens "%s"', async (hash, dialog) => {
    await openPage(hash);
    await ctrlN();
    expect(screen.getByRole('dialog', { name: dialog })).toBeInTheDocument();
  });

  it('prefills the sprint of the board and leaves the backlog and the map unplanned', async () => {
    await openPage('#/board');
    await ctrlN();
    expect(within(screen.getByRole('dialog')).getByLabelText('Sprint')).toHaveDisplayValue(/^Sprint 1/);
  });

  it('opens a story that is not planned on the backlog and on the map', async () => {
    for (const hash of ['#/backlog', '#/map']) {
      await openPage(hash);
      await ctrlN();
      expect(within(screen.getByRole('dialog')).getByLabelText('Sprint')).toHaveDisplayValue('Not planned');
      await userEvent.setup().click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    }
  });

  it('does nothing in the settings', async () => {
    await openPage('#/settings/fields');
    await ctrlN();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not open a second dialog while one is open', async () => {
    await openPage('#/board');
    await ctrlN();
    await ctrlN();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('creates the story, so the shortcut is a real way to add one', async () => {
    const user = userEvent.setup();
    await openPage('#/board');
    await ctrlN();
    const dialog = screen.getByRole('dialog', { name: 'New story' });
    await user.type(within(dialog).getByLabelText('Title'), 'Made with the keyboard');
    await user.click(within(dialog).getByRole('button', { name: 'Add story' }));
    expect(within(screen.getByRole('region', { name: 'To do' })).getByText('Made with the keyboard')).toBeInTheDocument();
  });

  it('names the shortcut on the buttons that create something', async () => {
    await openPage('#/board');
    expect(screen.getByRole('button', { name: 'New story' })).toHaveAttribute('aria-keyshortcuts', 'Control+N Meta+N');
  });

  it('also reacts to Cmd+N on a Mac', async () => {
    await openPage('#/epics');
    await userEvent.setup().keyboard('{Meta>}n{/Meta}');
    expect(screen.getByRole('dialog', { name: 'New epic' })).toBeInTheDocument();
  });
});
