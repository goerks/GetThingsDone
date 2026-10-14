import { beforeAll, describe, expect, it } from 'vitest';
import { act, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { RECORDER_STORAGE_KEY, parseRecorderState } from './domain/testRecorder';
import { todayIso } from './domain/sprints';
import i18n, { initI18n } from './i18n';

/*
 * Component tests of the test builder (#37), following the test cases in the issue. Dragging a card with the mouse
 * and the journey with a reload are in e2e/testRecorder.spec.ts. The tests start with "The data as they are now",
 * because starting from fresh demo data reloads the page, which a component test cannot do.
 */

beforeAll(() => {
  initI18n('en');
});

type User = ReturnType<typeof userEvent.setup>;

async function renderApp(hash = '#/board'): Promise<void> {
  const repository = new LocalStorageRepository();
  await repository.replaceAll(seedSnapshot(todayIso()));
  window.location.hash = hash;
  render(<App repository={repository} />);
  await screen.findByRole('heading', { level: 1 });
}

const bar = (): HTMLElement => screen.getByRole('complementary', { name: 'Test builder' });
const recordButton = (): HTMLElement => screen.getByRole('button', { name: 'Record test' });
const steps = (): string[] => within(within(bar()).getByRole('list', { name: 'Steps of the test' })).getAllByRole('listitem').map((item) => item.textContent ?? '').filter((text) => text !== '');
const stepTexts = (): string[] => steps().map((text) => text.replace(/[✎✕]/g, '').trim());

async function openBuilder(user: User): Promise<void> {
  if (!screen.queryByRole('complementary', { name: 'Test builder' })) await user.click(recordButton());
  expect(bar()).toBeInTheDocument();
}

async function startTest(user: User, name = 'Move a story', requirement = 'AC2.1'): Promise<void> {
  await openBuilder(user);
  await user.click(within(bar()).getByRole('button', { name: 'Build a new test' }));
  await user.type(within(bar()).getByRole('textbox', { name: 'Name of the test' }), name);
  if (requirement) await user.type(within(bar()).getByRole('textbox', { name: 'Requirement (optional)' }), requirement);
  await user.click(within(bar()).getByRole('radio', { name: 'The data as they are now' }));
  await user.click(within(bar()).getByRole('button', { name: 'Start recording' }));
  await within(bar()).findByRole('heading', { name });
}

async function pointAtResult(user: User, element: HTMLElement): Promise<void> {
  await user.click(within(bar()).getByRole('button', { name: /Point at the result/ }));
  await user.click(element);
}

describe('starting a recording', () => {
  it('AC1.1 opens the builder on the right and starts a recording with the name and the requirement', async () => {
    // Given the preview with the board
    const user = userEvent.setup();
    await renderApp();
    expect(screen.queryByRole('complementary', { name: 'Test builder' })).not.toBeInTheDocument();
    // When I open the builder, build a new test, name it and start
    await startTest(user);
    // Then the bar shows the test with its requirement, and the board is still there
    expect(within(bar()).getByText(/Recording · AC2\.1 · The data as they are now/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Sprint 1' })).toBeVisible();
    expect(stepTexts()).toEqual(['I open the page “Board”.']);
  });

  it('AC1.2 leaves without a test when the form is cancelled', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openBuilder(user);
    await user.click(within(bar()).getByRole('button', { name: 'Build a new test' }));
    await user.type(within(bar()).getByRole('textbox', { name: 'Name of the test' }), 'Half');
    await user.click(within(bar()).getByRole('button', { name: 'Cancel' }));
    expect(within(bar()).getByText('No tests yet.')).toBeInTheDocument();
    expect(within(bar()).getByRole('heading', { name: 'My tests (0)' })).toBeInTheDocument();
  });

  it('AC1.3 asks for a name and does not start without one', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openBuilder(user);
    await user.click(within(bar()).getByRole('button', { name: 'Build a new test' }));
    await user.click(within(bar()).getByRole('button', { name: 'Start recording' }));
    expect(within(bar()).getByRole('alert')).toHaveTextContent('Please enter a name.');
    expect(within(bar()).getByRole('textbox', { name: 'Name of the test' })).toBeInvalid();
    expect(parseRecorderState(window.localStorage.getItem(RECORDER_STORAGE_KEY)).draft).toBeNull();
  });
});

describe('the bar', () => {
  it('AC2.1 makes room for the bar instead of covering the page', async () => {
    const user = userEvent.setup();
    await renderApp();
    await startTest(user);
    expect(document.querySelector('.app')).toHaveClass('app--recorder');
    expect(document.querySelector('.app')).not.toHaveClass('app--recorder-rail');
  });

  it('AC2.2 folds away to a narrow strip with the number of steps and opens again', async () => {
    const user = userEvent.setup();
    await renderApp();
    await startTest(user);
    await user.click(screen.getByRole('button', { name: 'Fold the bar away' }));
    expect(document.querySelector('.app')).toHaveClass('app--recorder-rail');
    expect(within(bar()).getByText('1 steps')).toBeInTheDocument();
    // The recording goes on while the bar is folded away
    await user.click(screen.getByRole('link', { name: 'Backlog' }));
    await user.click(screen.getByRole('button', { name: 'Open the test builder' }));
    expect(document.querySelector('.app')).not.toHaveClass('app--recorder-rail');
    expect(stepTexts()).toEqual(['I open the page “Board”.', 'I click on “Backlog”.']);
  });

  it('AC2.3 stays open and goes on recording when the page changes', async () => {
    const user = userEvent.setup();
    await renderApp();
    await startTest(user);
    await user.click(screen.getByRole('link', { name: 'Backlog' }));
    await user.click(screen.getByRole('link', { name: 'Board' }));
    expect(bar()).toBeInTheDocument();
    expect(stepTexts()).toEqual(['I open the page “Board”.', 'I click on “Backlog”.', 'I click on “Board”.']);
  });

  it('AC2.3 records a change of the page that did not come from a click as opening the page', async () => {
    const user = userEvent.setup();
    await renderApp();
    await startTest(user);
    window.location.hash = '#/epics';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await waitFor(() => expect(stepTexts()).toContain('I open the page “Epics”.'));
  });
});

describe('recording steps', () => {
  it('AC3.1 records a click on a button with its name', async () => {
    const user = userEvent.setup();
    await renderApp();
    await startTest(user);
    await user.click(screen.getByRole('button', { name: /New story/ }));
    expect(stepTexts().at(-1)).toMatch(/^I click on “.*New story.*”\.$/);
  });

  it('AC3.1 records a double click as one step', async () => {
    const user = userEvent.setup();
    await renderApp();
    await startTest(user);
    const card = screen.getAllByRole('group', { name: /^S-\d+: / })[0];
    const name = card.getAttribute('aria-label') ?? '';
    await user.dblClick(card);
    expect(stepTexts().filter((text) => text.includes(name))).toEqual([`I double-click on “${name}”.`]);
  });

  it('AC3.3 records what is typed into a field as one step', async () => {
    const user = userEvent.setup();
    await renderApp();
    await startTest(user);
    await user.click(screen.getByRole('button', { name: /New story/ }));
    const title = await screen.findByRole('textbox', { name: /Title/ });
    await user.type(title, 'Forgot password');
    await user.tab();
    const typed = stepTexts().filter((text) => text.includes('Forgot password'));
    expect(typed).toHaveLength(1);
    expect(typed[0]).toMatch(/^I write “Forgot password” in the field “Title.*”\.$/);
  });

  it('AC3.4 rewrites a step and removes a step', async () => {
    const user = userEvent.setup();
    await renderApp();
    await startTest(user);
    await user.click(screen.getByRole('link', { name: 'Backlog' }));
    await user.click(screen.getByRole('link', { name: 'Epics' }));
    expect(stepTexts()).toHaveLength(3);

    const list = within(bar()).getByRole('list', { name: 'Steps of the test' });
    await user.click(within(list).getAllByRole('button', { name: 'Rewrite the step' })[1]);
    const field = within(list).getByRole('textbox', { name: 'Sentence of the step' });
    await user.clear(field);
    await user.type(field, 'I open the backlog.{Enter}');
    await user.click(within(list).getAllByRole('button', { name: 'Remove the step' })[2]);

    expect(stepTexts()).toEqual(['I open the page “Board”.', 'I open the backlog.']);
  });

  it('AC3.5 adds a step by hand at the end', async () => {
    const user = userEvent.setup();
    await renderApp();
    await startTest(user);
    await user.click(within(bar()).getByRole('button', { name: /Add a step/ }));
    await user.type(within(bar()).getByRole('textbox', { name: 'Sentence of the step' }), 'I reload the app.{Enter}');
    expect(stepTexts().at(-1)).toBe('I reload the app.');
  });

  it('AC3.6 records nothing during a pause and goes on after it', async () => {
    const user = userEvent.setup();
    await renderApp();
    await startTest(user);
    await user.click(within(bar()).getByRole('button', { name: 'Pause' }));
    expect(within(bar()).getByText(/Paused/)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Backlog' }));
    expect(stepTexts()).toEqual(['I open the page “Board”.']);
    await user.click(within(bar()).getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('link', { name: 'Epics' }));
    expect(stepTexts()).toEqual(['I open the page “Board”.', 'I click on “Epics”.']);
  });

  it('AC3.7 does not record what is done in the builder itself', async () => {
    const user = userEvent.setup();
    await renderApp();
    await startTest(user);
    await user.click(within(bar()).getByRole('button', { name: /Add a step/ }));
    await user.click(within(bar()).getByRole('button', { name: 'Cancel' }));
    expect(stepTexts()).toEqual(['I open the page “Board”.']);
    // Folding the bar away and opening it again is no step either
    await user.click(recordButton());
    await user.click(recordButton());
    expect(stepTexts()).toEqual(['I open the page “Board”.']);
  });
});

describe('expected result', () => {
  it('AC4.1 offers sentences for the element that was pointed at, and nothing else happens', async () => {
    const user = userEvent.setup();
    await renderApp();
    await startTest(user);
    const card = screen.getAllByRole('group', { name: /^S-\d+: / })[0];
    const name = card.getAttribute('aria-label') ?? '';
    await pointAtResult(user, card);
    // The click only chose the element: no story was opened and no step was recorded
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(stepTexts()).toEqual(['I open the page “Board”.']);
    await user.click(within(bar()).getByRole('button', { name: new RegExp(`^I see “${name}”\\.$`) }));
    const results = within(bar()).getByRole('list', { name: 'Expected results' });
    expect(within(results).getAllByRole('listitem')[0]).toHaveTextContent(`I see “${name}”.`);
  });

  it('AC4.1 stops pointing with Escape', async () => {
    const user = userEvent.setup();
    await renderApp();
    await startTest(user);
    await user.click(within(bar()).getByRole('button', { name: /Point at the result/ }));
    expect(within(bar()).getByText(/Click the element that shows the result/)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(within(bar()).getByRole('button', { name: /Point at the result/ })).toBeInTheDocument();
    expect(within(bar()).queryByText(/Click the element that shows the result/)).not.toBeInTheDocument();
  });

  it('AC4.2 takes a sentence of my own and lets me rewrite it', async () => {
    const user = userEvent.setup();
    await renderApp();
    await startTest(user);
    await user.type(within(bar()).getByRole('textbox', { name: 'Or write your own sentence' }), 'S-3 is in Done, also after a reload.{Enter}');
    const results = within(bar()).getByRole('list', { name: 'Expected results' });
    expect(results).toHaveTextContent('S-3 is in Done, also after a reload.');
    await user.click(within(results).getByRole('button', { name: 'Rewrite the expected result' }));
    const field = within(results).getByRole('textbox', { name: 'Sentence of the expected result' });
    await user.clear(field);
    await user.type(field, 'S-3 is in Done.{Enter}');
    expect(results).toHaveTextContent('S-3 is in Done.');
    expect(results).not.toHaveTextContent('also after a reload');
  });

  it('AC4.3 does not save a test without an expected result and keeps recording', async () => {
    const user = userEvent.setup();
    await renderApp();
    await startTest(user);
    await user.click(within(bar()).getByRole('button', { name: 'Finish test' }));
    expect(within(bar()).getByRole('alert')).toHaveTextContent('Please record the expected result first.');
    expect(within(bar()).getByText(/^Recording ·/)).toBeInTheDocument();
    expect(parseRecorderState(window.localStorage.getItem(RECORDER_STORAGE_KEY)).collection).toEqual([]);
  });

  it('AC4.4 saves the finished test into the list', async () => {
    const user = userEvent.setup();
    await renderApp();
    await startTest(user);
    await user.type(within(bar()).getByRole('textbox', { name: 'Or write your own sentence' }), 'It works.{Enter}');
    await user.click(within(bar()).getByRole('button', { name: 'Finish test' }));
    expect(within(bar()).getByRole('heading', { name: 'My tests (1)' })).toBeInTheDocument();
    expect(within(bar()).getByText('Move a story')).toBeInTheDocument();
    expect(within(bar()).getByText('AC2.1 · 1 step')).toBeInTheDocument();
    // Nothing is recorded any more
    await user.click(screen.getByRole('link', { name: 'Backlog' }));
    expect(parseRecorderState(window.localStorage.getItem(RECORDER_STORAGE_KEY)).collection[0].steps).toHaveLength(1);
  });

  it('AC4.5 discards a test only after a confirmation', async () => {
    const user = userEvent.setup();
    await renderApp();
    await startTest(user);
    await user.click(within(bar()).getByRole('button', { name: 'Discard test' }));
    await user.click(within(bar()).getByRole('button', { name: 'Cancel' }));
    expect(within(bar()).getByRole('heading', { name: 'Move a story' })).toBeInTheDocument();
    await user.click(within(bar()).getByRole('button', { name: 'Discard test' }));
    await user.click(within(bar()).getByRole('button', { name: 'Yes, discard' }));
    expect(within(bar()).getByRole('heading', { name: 'My tests (0)' })).toBeInTheDocument();
  });
});

async function saveTest(user: User, name: string): Promise<void> {
  await startTest(user, name, '');
  await user.type(within(bar()).getByRole('textbox', { name: 'Or write your own sentence' }), `${name} works.{Enter}`);
  await user.click(within(bar()).getByRole('button', { name: 'Finish test' }));
}

describe('my tests', () => {
  it('AC7.1 keeps the tests and a running recording when the app loads again', async () => {
    const user = userEvent.setup();
    await renderApp();
    await saveTest(user, 'First');
    await startTest(user, 'Second', '');
    // When the app is opened again (the stored state is read from the device)
    document.body.innerHTML = '';
    await renderApp();
    // Then the running recording is still there and the saved test is kept
    expect(within(bar()).getByRole('heading', { name: 'Second' })).toBeInTheDocument();
    await user.click(within(bar()).getByRole('button', { name: 'Discard test' }));
    await user.click(within(bar()).getByRole('button', { name: 'Yes, discard' }));
    expect(within(bar()).getByText('First')).toBeInTheDocument();
  });

  it('AC7.2 changes the name of a saved test', async () => {
    const user = userEvent.setup();
    await renderApp();
    await saveTest(user, 'Move a story');
    await user.click(within(bar()).getByRole('button', { name: 'Edit “Move a story”' }));
    const name = within(bar()).getByRole('textbox', { name: 'Name of the test' });
    await user.clear(name);
    await user.type(name, 'Drag a story');
    await user.click(within(bar()).getByRole('button', { name: 'Save changes' }));
    expect(within(bar()).getByText('Drag a story')).toBeInTheDocument();
    expect(within(bar()).queryByText('Move a story')).not.toBeInTheDocument();
  });

  it('AC7.3 deletes a test only after a confirmation', async () => {
    const user = userEvent.setup();
    await renderApp();
    await saveTest(user, 'One');
    await saveTest(user, 'Two');
    expect(within(bar()).getByRole('heading', { name: 'My tests (2)' })).toBeInTheDocument();
    await user.click(within(bar()).getByRole('button', { name: 'Delete “One”' }));
    await user.click(within(bar()).getByRole('button', { name: 'Cancel' }));
    expect(within(bar()).getByRole('heading', { name: 'My tests (2)' })).toBeInTheDocument();
    await user.click(within(bar()).getByRole('button', { name: 'Delete “One”' }));
    await user.click(within(bar()).getByRole('button', { name: 'Yes, delete' }));
    expect(within(bar()).getByRole('heading', { name: 'My tests (1)' })).toBeInTheDocument();
    expect(within(bar()).queryByText('One')).not.toBeInTheDocument();
  });
});

describe('handing over to the AI', () => {
  it('AC8.1 copies all tests in one text with the context and the technical steps', async () => {
    const user = userEvent.setup();
    await renderApp();
    await saveTest(user, 'First');
    await saveTest(user, 'Second');
    await user.click(within(bar()).getByRole('button', { name: 'Copy everything' }));
    const text = await navigator.clipboard.readText();
    expect(text).toContain('# Feedback aus der Vorschau von Get It Done');
    expect(text).toContain('Hinweis für die KI:');
    expect(text).toContain('- Sprache der Oberfläche: en');
    expect(text).toContain('## Neue Tests (2)');
    expect(text).toContain('### 1. First');
    expect(text).toContain('### 2. Second');
    expect(text).toContain('  - First works.');
    expect(text).toContain('```json');
    expect(within(bar()).getAllByRole('status').some((item) => item.textContent === 'Copied. Paste it to the AI.')).toBe(true);
  });

  it('AC8.2 shows the same text before it is copied', async () => {
    const user = userEvent.setup();
    await renderApp();
    await saveTest(user, 'First');
    await user.click(within(bar()).getByRole('button', { name: 'Show the text' }));
    const shown = (within(bar()).getByRole('textbox', { name: 'Text for the AI' }) as HTMLTextAreaElement).value;
    await user.click(within(bar()).getByRole('button', { name: 'Copy everything' }));
    expect(await navigator.clipboard.readText()).toBe(shown);
  });

  it('AC8.4 has nothing to copy while there are no tests', async () => {
    const user = userEvent.setup();
    await renderApp();
    await openBuilder(user);
    expect(within(bar()).getByRole('button', { name: 'Copy everything' })).toBeDisabled();
    expect(within(bar()).getByText('Nothing to copy yet.')).toBeInTheDocument();
  });
});

describe('languages and help', () => {
  it('AC9.1 shows the builder and the new sentences in German', async () => {
    const user = userEvent.setup();
    await renderApp();
    await act(async () => {
      await i18n.changeLanguage('de');
    });
    await user.click(screen.getByRole('button', { name: 'Test aufnehmen' }));
    expect(screen.getByRole('complementary', { name: 'Test-Builder' })).toBeInTheDocument();
    const german = screen.getByRole('complementary', { name: 'Test-Builder' });
    await user.click(within(german).getByRole('button', { name: 'Neuen Test aufbauen' }));
    await user.type(within(german).getByRole('textbox', { name: 'Name des Tests' }), 'Story verschieben');
    await user.click(within(german).getByRole('radio', { name: 'Die Daten, wie sie jetzt sind' }));
    await user.click(within(german).getByRole('button', { name: 'Aufnahme starten' }));
    await user.click(screen.getByRole('link', { name: 'Backlog' }));
    const list = within(german).getByRole('list', { name: 'Schritte des Tests' });
    expect(list).toHaveTextContent('Ich öffne die Seite «Board».');
    expect(list).toHaveTextContent('Ich klicke auf «Backlog».');
    // The name stays as it was typed
    expect(within(german).getByRole('heading', { name: 'Story verschieben' })).toBeInTheDocument();
  });

  it('AC9.2 explains the builder in the help and finds it by searching for "record"', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('button', { name: 'Help' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search help' }), 'record');
    const help = screen.getByRole('complementary', { name: 'Help' });
    await user.click(within(help).getByRole('button', { name: /Record a test/ }));
    expect(within(help).getByText(/Choose “Point at the result”/)).toBeInTheDocument();
    await user.click(within(help).getByRole('button', { name: 'Show me' }));
    expect(recordButton()).toHaveAttribute('data-help-highlight', 'true');
  });
});
