import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next from 'i18next';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { downloadTextFile } from './data/files';
import { backupFileName, serializeBackup } from './domain/backup';
import { searchHelp } from './domain/helpSearch';
import { todayIso } from './domain/sprints';
import type { Snapshot, Story } from './domain/types';
import de from './i18n/de.json';
import en from './i18n/en.json';
import fr from './i18n/fr.json';
import it_ from './i18n/it.json';
import { initI18n } from './i18n';
import { LINK_TARGETS, TOPICS } from './help/topics';

vi.mock('./data/files', () => ({ downloadTextFile: vi.fn() }));

beforeAll(() => {
  initI18n('en');
});

beforeEach(async () => {
  await i18next.changeLanguage('en');
});

afterEach(() => {
  vi.mocked(downloadTextFile).mockClear();
});

const NOW = '2026-10-12T08:00:00.000Z';

/** The demo data with `extra` more stories, so a file differs from what the app holds. */
function withStories(snapshot: Snapshot, extra: number): Snapshot {
  const more: Story[] = Array.from({ length: extra }, (_, index) => ({
    ...snapshot.stories[0],
    id: `extra-${index}`,
    code: `S-${100 + index}`,
    title: `Extra story ${index + 1}`,
    criteria: [],
    values: {}
  }));
  return { ...snapshot, stories: [...snapshot.stories, ...more] };
}

async function renderData(snapshot: Snapshot = seedSnapshot(todayIso())): Promise<LocalStorageRepository> {
  const repository = new LocalStorageRepository();
  await repository.replaceAll(snapshot);
  window.location.hash = '#/settings/data';
  render(<App repository={repository} />);
  await waitFor(() => expect(document.querySelector('.data-settings')).not.toBeNull());
  return repository;
}

const fileInput = (): HTMLInputElement => document.querySelector<HTMLInputElement>('.data-settings input[type="file"]')!;
const jsonFile = (text: string, name = 'getitdone-2026-10-12.json', type = 'application/json'): File => new File([text], name, { type });
const setup = () => userEvent.setup({ applyAccept: false });

/** Chooses a file and waits for the confirmation. */
async function chooseValid(user: ReturnType<typeof setup>, snapshot: Snapshot): Promise<HTMLElement> {
  await user.upload(fileInput(), jsonFile(serializeBackup(snapshot, NOW)));
  return screen.findByRole('dialog', { name: 'Import data?' });
}

describe('Settings › Data: export (#16)', () => {
  it('AC1.1 finds the section "Data" in the settings with the two cards', async () => {
    // Given the app is open on the board
    window.location.hash = '#/board';
    const repository = new LocalStorageRepository();
    await repository.replaceAll(seedSnapshot(todayIso()));
    render(<App repository={repository} />);
    await screen.findByRole('heading', { level: 1 });
    const user = setup();
    // When I open the settings and click "Data"
    await user.click(screen.getByRole('link', { name: 'Settings' }));
    await user.click(await screen.findByRole('link', { name: 'Data' }));
    // Then I see the cards "Export data" and "Import data"
    expect(await screen.findByRole('heading', { level: 3, name: 'Export data' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Import data' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/settings/data');
  });

  it('AC1.2 exports all data with one click and says what was saved', async () => {
    // Given the demo data
    const snapshot = seedSnapshot(todayIso());
    const user = setup();
    await renderData(snapshot);
    // When I click "Export all data"
    await user.click(screen.getByRole('button', { name: 'Export all data' }));
    // Then a file named after today is saved with all data
    const name = backupFileName(todayIso());
    expect(downloadTextFile).toHaveBeenCalledTimes(1);
    const [savedName, text] = vi.mocked(downloadTextFile).mock.calls[0];
    expect(savedName).toBe(name);
    const file = JSON.parse(text);
    expect(file.format).toBe('getitdone-backup');
    expect(file.data.stories).toHaveLength(snapshot.stories.length);
    // And the card says what was exported
    expect(screen.getByText(new RegExp(`Exported: ${name} \\(${snapshot.stories.length} stories, ${snapshot.epics.length} epics`))).toBeInTheDocument();
  });
});

describe('Settings › Data: import (#16)', () => {
  it('AC2.1 asks before replacing: shows the file next to the current data and warns', async () => {
    // Given a file with 3 more stories than the app holds
    const current = seedSnapshot(todayIso());
    const user = setup();
    const repository = await renderData(current);
    // When I choose the file
    const dialog = await chooseValid(user, withStories(current, 3));
    // Then a dialog shows the file name and the counts in the file and today
    expect(within(dialog).getByText(/getitdone-2026-10-12\.json/)).toBeInTheDocument();
    const row = within(dialog).getByRole('row', { name: /Stories/ });
    expect(within(row).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([String(current.stories.length + 3), String(current.stories.length)]);
    // And it warns that everything is replaced
    expect(within(dialog).getByRole('note')).toHaveTextContent('All your current data will be replaced');
    // And nothing has changed yet
    expect((await repository.load()).stories).toHaveLength(current.stories.length);
  });

  it('AC2.2 changes nothing on Cancel and on Escape', async () => {
    // Given the confirmation is open
    const current = seedSnapshot(todayIso());
    const user = setup();
    const repository = await renderData(current);
    let dialog = await chooseValid(user, withStories(current, 3));
    // When I click Cancel
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    // Then the dialog closes and the data are the same
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect((await repository.load()).stories).toHaveLength(current.stories.length);
    // And the same with Escape
    dialog = await chooseValid(user, withStories(current, 3));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await repository.load()).stories).toHaveLength(current.stories.length);
  });

  it('AC2.3 replaces the data after the confirmation and says what was imported', async () => {
    // Given a file with 3 more stories
    const current = seedSnapshot(todayIso());
    const user = setup();
    const repository = await renderData(current);
    const dialog = await chooseValid(user, withStories(current, 3));
    // When I click "Replace data"
    await user.click(within(dialog).getByRole('button', { name: 'Replace data' }));
    // Then the data are replaced, also in the storage
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await repository.load()).stories).toHaveLength(current.stories.length + 3);
    // And the card says what was imported
    expect(screen.getByText(new RegExp(`Imported: ${current.stories.length + 3} stories`))).toBeInTheDocument();
  });

  it('AC2.4 exports the current data first and keeps the dialog open', async () => {
    // Given the confirmation is open
    const current = seedSnapshot(todayIso());
    const user = setup();
    await renderData(current);
    const dialog = await chooseValid(user, withStories(current, 3));
    // When I click "Export current data first"
    await user.click(within(dialog).getByRole('button', { name: 'Export current data first' }));
    // Then my current data are saved (not those of the file) and the dialog stays
    expect(downloadTextFile).toHaveBeenCalledTimes(1);
    expect(JSON.parse(vi.mocked(downloadTextFile).mock.calls[0][1]).data.stories).toHaveLength(current.stories.length);
    expect(screen.getByRole('dialog', { name: 'Import data?' })).toBeInTheDocument();
  });

  it('AC2.5 works with the keyboard only: focus starts on Cancel, Tab reaches all three buttons, Escape closes', async () => {
    // Given the confirmation is open
    const current = seedSnapshot(todayIso());
    const user = setup();
    await renderData(current);
    await chooseValid(user, withStories(current, 3));
    // Then the focus is on "Cancel"
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    // When I press Tab
    await user.tab();
    expect(screen.getByRole('button', { name: 'Export current data first' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Replace data' })).toHaveFocus();
    // And Escape
    await user.keyboard('{Escape}');
    // Then the dialog closes
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Settings › Data: round trip and refused files (#16)', () => {
  it('AC3.1 gives back the same data after export and import', async () => {
    // Given an export of the demo data, and then other data in the app (the demo data with 3 more stories)
    const original = seedSnapshot(todayIso());
    const user = setup();
    const repository = await renderData(original);
    const baseline = await repository.load();
    await user.click(screen.getByRole('button', { name: 'Export all data' }));
    const exportedText = vi.mocked(downloadTextFile).mock.calls[0][1];
    const dialog = await chooseValid(user, withStories(original, 3));
    await user.click(within(dialog).getByRole('button', { name: 'Replace data' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await repository.load()).stories).toHaveLength(original.stories.length + 3);
    // When I import the exported file
    await user.upload(fileInput(), jsonFile(exportedText));
    await user.click(within(await screen.findByRole('dialog', { name: 'Import data?' })).getByRole('button', { name: 'Replace data' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Then the data are the same as at the export
    expect(await repository.load()).toEqual(baseline);
  });

  /** Chooses a file that cannot be imported and checks the message, that there is no confirmation and that the data are the same. */
  async function expectRefused(content: string, reason: string): Promise<void> {
    // Given the demo data
    const current = seedSnapshot(todayIso());
    const user = setup();
    const repository = await renderData(current);
    const baseline = await repository.load();
    // When I choose the file
    await user.upload(fileInput(), jsonFile(content, 'notes.txt', 'text/plain'));
    // Then a message gives the reason and says the data are unchanged
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This file cannot be imported:');
    expect(alert).toHaveTextContent(reason);
    expect(alert).toHaveTextContent('Your data are unchanged.');
    // And there is no confirmation, and the data are the same
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await repository.load()).toEqual(baseline);
  }

  it('AC4.1 refuses a plain text file and leaves the data unchanged', () => expectRefused('Hallo', 'It is not a Get It Done export file.'));

  it('AC4.2 refuses JSON of another program and leaves the data unchanged', () => expectRefused('{"a": 1}', 'It is not a Get It Done export file.'));

  it('AC4.3 refuses a file of a newer format and leaves the data unchanged', () =>
    expectRefused(
      JSON.stringify({ format: 'getitdone-backup', version: 99, exportedAt: NOW, data: {} }),
      'newer version of Get It Done (format 99; this app knows up to format 1)'
    ));

  it('AC4.4 refuses an empty file and leaves the data unchanged', () => expectRefused('', 'It is empty.'));

  it('AC4.4 refuses a file that is cut off and leaves the data unchanged', () =>
    expectRefused(serializeBackup(seedSnapshot('2026-10-12'), NOW).slice(0, 500), 'It is damaged or incomplete.'));

  it('AC5.3 says in the browser build that the import only replaces the demo data of this browser', async () => {
    // Given the browser build (not the desktop app)
    // When I look at the card "Import data"
    await renderData();
    // Then it says that this is a demo
    expect(screen.getByText('This is a demo. The import replaces the demo data only in this browser.')).toBeInTheDocument();
  });
});

describe('Settings › Data: languages, keyboard and help (#16)', () => {
  /** Checks the cards, a refusal and the confirmation in one language. */
  async function expectTranslated(code: 'de' | 'en' | 'fr' | 'it', texts: typeof en): Promise<void> {
    // Given the language is set
    await i18next.changeLanguage(code);
    const user = setup();
    await renderData();
    // Then the cards and, after choosing a file, a refusal and the dialog use the texts of that language
    expect(screen.getByRole('button', { name: texts.settings.data.export.button })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: texts.settings.data.import.button })).toBeInTheDocument();
    await user.upload(fileInput(), jsonFile('Hallo', 'notes.txt', 'text/plain'));
    expect(await screen.findByRole('alert')).toHaveTextContent(texts.settings.data.problem.notBackup);
    await user.upload(fileInput(), jsonFile(serializeBackup(seedSnapshot(todayIso()), NOW)));
    const dialog = await screen.findByRole('dialog', { name: texts.settings.data.confirm.title });
    expect(within(dialog).getByRole('button', { name: texts.settings.data.confirm.replace })).toBeInTheDocument();
  }

  it('AC6.1 has all texts in de', () => expectTranslated('de', de as typeof en));
  it('AC6.1 has all texts in en', () => expectTranslated('en', en));
  it('AC6.1 has all texts in fr', () => expectTranslated('fr', fr as typeof en));
  it('AC6.1 has all texts in it', () => expectTranslated('it', it_ as typeof en));

  it('AC6.2 exports and opens the file choice with the keyboard only', async () => {
    // Given the section "Data"
    const user = setup();
    await renderData();
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');
    // When I reach the buttons with Tab and press Enter
    const exportButton = screen.getByRole('button', { name: 'Export all data' });
    await act(async () => exportButton.focus());
    await user.keyboard('{Enter}');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Choose file …' })).toHaveFocus();
    await user.keyboard('{Enter}');
    // Then the export is saved and the file choice opens
    expect(downloadTextFile).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it('AC6.3 finds the help topic "Back up and export data" by "backup" and links to Settings › Data', () => {
    // Given the help texts
    const entries = TOPICS.map((topic) => {
      const text = (en.help.topics as Record<string, { title: string; keywords: string; body: string }>)[topic.id];
      return { id: topic.id, ...text };
    });
    // When I search for "Backup"
    const hits = searchHelp(entries, 'Backup').map((hit) => hit.id);
    // Then the topic is found, and it links to Settings › Data
    expect(hits).toContain('data.backup');
    expect(TOPICS.find((topic) => topic.id === 'data.backup')?.links).toEqual([{ id: 'settingsData' }]);
    expect(LINK_TARGETS.settingsData).toBe('#/settings/data');
    expect(en.help.topics['data.backup'].title).toBe('Back up and export data');
  });
});
