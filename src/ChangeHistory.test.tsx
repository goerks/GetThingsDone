import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { EMPTY_DEFINITIONS } from './domain/definitions';
import { initI18n } from './i18n';
import { todayIso } from './domain/sprints';
import de from './i18n/de.json';
import en from './i18n/en.json';
import fr from './i18n/fr.json';
import italian from './i18n/it.json';
import type { Snapshot } from './domain/types';

/*
 * Component tests of the change history and the comparison of two versions (#23), following the test cases the PO approved
 * in the issue. The demo data hold a history for story S-3 ("Reorder the backlog by priority"): V1 created, V2 epic and
 * description, V3 sprint and a criterion, V4 title and a criterion, V5 description and priority, V6 points and business value.
 */

beforeAll(() => {
  initI18n('en');
});

async function openStory(code: string, change: (snapshot: Snapshot) => Snapshot = (snapshot) => snapshot): Promise<HTMLElement> {
  const user = userEvent.setup();
  const repository = new LocalStorageRepository();
  const seed = seedSnapshot(todayIso());
  await repository.replaceAll(change({ ...seed, settings: { ...seed.settings, definitions: EMPTY_DEFINITIONS } }));
  window.location.hash = '#/board';
  render(<App repository={repository} />);
  await user.dblClick(await screen.findByRole('group', { name: new RegExp(`${code}:`) }));
  return screen.findByRole('dialog', { name: new RegExp(`${code}:`) });
}

describe('history of an item', () => {
  it('AC1.1 shows the newest versions of a story with date and what changed', async () => {
    // Given the story S-3 with its demo history
    const user = userEvent.setup();
    // When I open it
    const dialog = await openStory('S-3');
    // Then the panel "History" is collapsed and shows only the current version
    const panel = within(dialog).getByRole('heading', { name: 'History' }).closest('section') as HTMLElement;
    expect(within(panel).getAllByRole('listitem').filter((item) => item.classList.contains('history-entry'))).toHaveLength(1);
    expect(within(panel).getByRole('button', { name: 'Show older versions' })).toHaveAttribute('aria-expanded', 'false');
    // When I show the older versions
    await user.click(within(panel).getByRole('button', { name: 'Show older versions' }));
    // Then the three newest versions are listed, newest first, each with its number, time and changes
    const entries = within(panel).getAllByRole('listitem').filter((item) => item.classList.contains('history-entry'));
    expect(entries).toHaveLength(3);
    expect(entries[0]).toHaveTextContent('V6');
    expect(entries[0]).toHaveTextContent('Current');
    expect(entries[0]).toHaveTextContent('Points: 3 → 5');
    expect(entries[0]).toHaveTextContent('Business value: 3 → 5');
    expect(entries[2]).toHaveTextContent('V4');
    expect(within(panel).getByText('6 versions')).toBeInTheDocument();
    expect(entries[0].querySelector('time')?.textContent).toMatch(/\d{4}/);
  });

  it('AC1.3 a save is one version: a change of the status adds V7 on top', async () => {
    // Given the story S-3 in "To do"
    const user = userEvent.setup();
    const dialog = await openStory('S-3');
    // When I move it to "Review" in the dialog
    await user.selectOptions(within(dialog).getByLabelText('Status'), 'review');
    // Then a new version V7 stands on top with the change, and V6 is no longer current
    const panel = within(dialog).getByRole('heading', { name: 'History' }).closest('section') as HTMLElement;
    await waitFor(() => expect(within(panel).getByText('7 versions')).toBeInTheDocument());
    const entries = within(panel).getAllByRole('listitem').filter((item) => item.classList.contains('history-entry'));
    expect(entries[0]).toHaveTextContent('V7');
    expect(entries[0]).toHaveTextContent(/Status: .* → Review/);
  });

  it('AC1.4 an item without changes says so', async () => {
    // Given a story that is older than the history
    const dialog = await openStory('S-1', (snapshot) => ({ ...snapshot, changeLog: [] }));
    // Then the panel says that there are no changes yet and offers no comparison
    const panel = within(dialog).getByRole('heading', { name: 'History' }).closest('section') as HTMLElement;
    expect(within(panel).getByText('No changes yet.')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Compare versions' })).toBeDisabled();
  });

  it('AC2.3 a story created now starts its history with "Story created"', async () => {
    // Given a story that has one version, made when it was created
    const dialog = await openStory('S-1');
    // Then its history says that it was created
    const panel = within(dialog).getByRole('heading', { name: 'History' }).closest('section') as HTMLElement;
    expect(within(panel).getByText('Story created')).toBeInTheDocument();
  });
});

describe('comparing two versions', () => {
  it('AC9.1 compares a version with the current one from its entry', async () => {
    // Given the history of S-3
    const user = userEvent.setup();
    const dialog = await openStory('S-3');
    // When I click "Compare with current" at V4
    await user.click(within(dialog).getByRole('button', { name: 'Show older versions' }));
    await user.click(within(dialog).getByRole('button', { name: 'Compare V4 with the current version' }));
    // Then V4 stands on the left and the current version on the right, with the changed fields marked
    const compare = await screen.findByRole('dialog', { name: /Compare versions of S-3/ });
    expect(within(compare).getByLabelText('From')).toHaveDisplayValue(/^V4/);
    expect(within(compare).getByLabelText('To')).toHaveDisplayValue(/^Current \(V6\)/);
    expect(within(compare).getByRole('status')).toHaveTextContent(/4 of \d+ fields changed/);
    const table = within(compare).getByRole('table');
    expect(within(table).getByRole('rowheader', { name: /Points/ })).toBeInTheDocument();
    expect(within(table).queryByRole('rowheader', { name: /^Title/ })).not.toBeInTheDocument();
  });

  it('AC8.3 swaps the sides', async () => {
    // Given the comparison of V4 with the current version
    const user = userEvent.setup();
    const dialog = await openStory('S-3');
    await user.click(within(dialog).getByRole('button', { name: 'Show older versions' }));
    await user.click(within(dialog).getByRole('button', { name: 'Compare V4 with the current version' }));
    const compare = await screen.findByRole('dialog', { name: /Compare versions of S-3/ });
    // When I swap the sides
    await user.click(within(compare).getByRole('button', { name: 'Swap the sides' }));
    // Then the current version is on the left and V4 on the right
    expect(within(compare).getByLabelText('From')).toHaveDisplayValue(/^Current \(V6\)/);
    expect(within(compare).getByLabelText('To')).toHaveDisplayValue(/^V4/);
  });

  it('AC8.4 says there are no differences for the same version on both sides', async () => {
    // Given the comparison dialog
    const user = userEvent.setup();
    const dialog = await openStory('S-3');
    await user.click(within(dialog).getByRole('button', { name: 'Compare versions' }));
    const compare = await screen.findByRole('dialog', { name: /Compare versions of S-3/ });
    // When both sides are the current version
    await user.selectOptions(within(compare).getByLabelText('From'), within(within(compare).getByLabelText('From')).getByRole('option', { name: /^Current \(V6\)/ }));
    // Then it says so
    expect(within(compare).getByRole('status')).toHaveTextContent('No differences');
    expect(within(compare).queryByRole('table')).not.toBeInTheDocument();
  });

  it('AC8.2 shows the description line by line, with words marked', async () => {
    // Given the comparison dialog of S-3
    const user = userEvent.setup();
    const dialog = await openStory('S-3');
    await user.click(within(dialog).getByRole('button', { name: 'Compare versions' }));
    const compare = await screen.findByRole('dialog', { name: /Compare versions of S-3/ });
    // When V1 (no description) is compared with the current version
    await user.selectOptions(within(compare).getByLabelText('From'), within(within(compare).getByLabelText('From')).getByRole('option', { name: /^V1 / }));
    // Then the description shows as lines, and the text is only on the right
    const lines = within(compare).getByRole('group', { name: /Text, \d+ changed line/ });
    expect(lines).toHaveTextContent('As a product owner, I want to change the priority of stories');
  });

  it('AC2.7 shows the description of both versions in full in the comparison', async () => {
    // Given the comparison dialog of S-3
    const user = userEvent.setup();
    const dialog = await openStory('S-3');
    await user.click(within(dialog).getByRole('button', { name: 'Compare versions' }));
    const compare = await screen.findByRole('dialog', { name: /Compare versions of S-3/ });
    // When V2 (a short description) is compared with the current version
    await user.selectOptions(within(compare).getByLabelText('From'), within(within(compare).getByLabelText('From')).getByRole('option', { name: /^V2 / }));
    // Then both texts are there in full: the short one on the left and the complete one on the right
    const lines = within(compare).getByRole('group', { name: /Text, \d+ changed line/ });
    expect(lines).toHaveTextContent('As a product owner, I want to change the priority of stories.');
    expect(lines).toHaveTextContent('so that the team works on the most valuable one first');
  });

  it('AC9.2 ticks two versions in the full list; a third tick replaces the oldest', async () => {
    // Given the full list of S-3
    const user = userEvent.setup();
    const dialog = await openStory('S-3');
    await user.click(within(dialog).getByRole('button', { name: 'Show older versions' }));
    await user.click(within(dialog).getByRole('button', { name: /Show all 5 changes/ }));
    const list = await screen.findByRole('dialog', { name: /History of S-3/ });
    expect(within(list).getByRole('button', { name: 'Compare' })).toBeDisabled();
    // When I tick V2, V5 and V6
    await user.click(within(list).getByRole('checkbox', { name: 'Choose V2' }));
    await user.click(within(list).getByRole('checkbox', { name: 'Choose V5' }));
    expect(within(list).getByRole('status')).toHaveTextContent('V2 and V5 chosen');
    await user.click(within(list).getByRole('checkbox', { name: 'Choose Current (V6)' }));
    // Then V2 is no longer ticked, and "Compare" opens V5 against V6
    expect(within(list).getByRole('checkbox', { name: 'Choose V2' })).not.toBeChecked();
    await user.click(within(list).getByRole('button', { name: 'Compare' }));
    const compare = await screen.findByRole('dialog', { name: /Compare versions of S-3/ });
    expect(within(compare).getByLabelText('From')).toHaveDisplayValue(/^V5/);
  });

  it('AC9.3 offers all versions in the picker, newest first, with number and time only', async () => {
    // Given the comparison dialog
    const user = userEvent.setup();
    const dialog = await openStory('S-3');
    await user.click(within(dialog).getByRole('button', { name: 'Compare versions' }));
    const compare = await screen.findByRole('dialog', { name: /Compare versions of S-3/ });
    // Then the picker lists every version with its number and time only
    const options = within(within(compare).getByLabelText('From')).getAllByRole('option');
    expect(options).toHaveLength(6);
    expect(options[0]).toHaveTextContent(/^Current \(V6\)/);
    expect(options[5]).toHaveTextContent(/^V1 · /);
    expect(options[5]).not.toHaveTextContent('Story created');
  });
});

describe('names, languages and reading only', () => {
  it('AC4.2 shows a status name the team entered as it was entered', async () => {
    // Given the team renamed "Review" to "Abnahme"
    const user = userEvent.setup();
    const dialog = await openStory('S-3', (snapshot) => ({
      ...snapshot,
      statuses: snapshot.statuses.map((status) => (status.id === 'review' ? { ...status, label: 'Abnahme' } : status))
    }));
    // When S-3 moves to it
    await user.selectOptions(within(dialog).getByLabelText('Status'), 'review');
    // Then the history names it as it was entered
    const panel = within(dialog).getByRole('heading', { name: 'History' }).closest('section') as HTMLElement;
    await waitFor(() => expect(within(panel).getByText(/Status: .* → Abnahme/)).toBeInTheDocument());
  });

  it('AC7.3 has every history text in German, English, French and Italian', () => {
    // Given the texts of the history in English
    const keys = Object.keys(en.history);
    // Then the other languages have the same groups of texts, and the tab of the release
    for (const file of [de, fr, italian]) {
      expect([...new Set(Object.keys(file.history).map((key) => key.replace(/_(one|many|other)$/, '')))].sort()).toEqual(
        [...new Set(keys.map((key) => key.replace(/_(one|many|other)$/, '')))].sort()
      );
      expect(file.releases.tabs.history).toBeTruthy();
    }
  });

  it('AC8.5 offers nothing to restore or change in the comparison', async () => {
    // Given the comparison of V4 with the current version
    const user = userEvent.setup();
    const dialog = await openStory('S-3');
    await user.click(within(dialog).getByRole('button', { name: 'Show older versions' }));
    await user.click(within(dialog).getByRole('button', { name: 'Compare V4 with the current version' }));
    const compare = await screen.findByRole('dialog', { name: /Compare versions of S-3/ });
    // Then there is no button to restore a version, and nothing is editable
    expect(within(compare).queryByRole('button', { name: /restore|revert|undo/i })).not.toBeInTheDocument();
    expect(within(compare).queryAllByRole('textbox')).toHaveLength(0);
    // And the history still has six versions after closing
    await user.click(within(compare).getByRole('button', { name: '← Back' }));
    const panel = within(dialog).getByRole('heading', { name: 'History' }).closest('section') as HTMLElement;
    expect(within(panel).getByText('6 versions')).toBeInTheDocument();
  });
});
