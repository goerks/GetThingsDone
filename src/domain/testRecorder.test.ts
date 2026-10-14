import { describe, expect, it } from 'vitest';
import {
  addExpected,
  addStep,
  createTest,
  deleteEntry,
  dropTrailingClicks,
  finishProblem,
  parseRecorderState,
  removeExpected,
  removeStep,
  renderExport,
  saveTest,
  updateExpected,
  updateStep,
  type RecordedTest
} from './testRecorder';

const base = (): RecordedTest => createTest({ name: ' Story verschieben ', requirement: 'AC2.1', startState: 'fresh', startPage: 'Board', now: '2026-10-14T10:00:00Z' });
const context = { address: 'https://getthingsdone-pr-37.onrender.com/', date: '2026-10-14 10:00', language: 'de', width: 1280 };

describe('recorded tests', () => {
  it('AC1.1 starts with the trimmed name and requirement and no steps', () => {
    const test = base();
    expect(test).toMatchObject({ name: 'Story verschieben', requirement: 'AC2.1', startState: 'fresh', steps: [], expected: [] });
  });

  it('AC3.1 lists steps in the order they happen', () => {
    let test = base();
    test = addStep(test, { kind: 'open', text: 'Ich öffne das Board.' });
    test = addStep(test, { kind: 'click', text: 'Ich klicke auf «Backlog».' });
    expect(test.steps.map((step) => step.text)).toEqual(['Ich öffne das Board.', 'Ich klicke auf «Backlog».']);
  });

  it('AC3.3 keeps one step per field when the same field is typed into again', () => {
    let test = base();
    test = addStep(test, { kind: 'type', text: 'Ich schreibe «Pass» in das Feld «Titel».', tech: { action: 'type', target: 'Titel', value: 'Pass' } });
    test = addStep(test, { kind: 'type', text: 'Ich schreibe «Passwort vergessen» in das Feld «Titel».', tech: { action: 'type', target: 'Titel', value: 'Passwort vergessen' } });
    test = addStep(test, { kind: 'type', text: 'Ich schreibe «x» in das Feld «Beschreibung».', tech: { action: 'type', target: 'Beschreibung', value: 'x' } });
    expect(test.steps.map((step) => step.tech?.value)).toEqual(['Passwort vergessen', 'x']);
  });

  it('AC3.4 rewrites and removes a step', () => {
    let test = addStep(addStep(addStep(base(), { kind: 'manual', text: 'a' }), { kind: 'manual', text: 'b' }), { kind: 'manual', text: 'c' });
    test = updateStep(test, test.steps[1].id, 'B neu');
    test = removeStep(test, test.steps[2].id);
    expect(test.steps.map((step) => step.text)).toEqual(['a', 'B neu']);
  });

  it('AC3.1 takes the two clicks of a double click back, and nothing else', () => {
    const click = (target: string) => ({ kind: 'click' as const, text: `Click ${target}`, tech: { action: 'click', target } });
    let test = addStep(addStep(addStep(base(), click('Backlog')), click('S-3')), click('S-3'));
    test = dropTrailingClicks(test, 'S-3');
    expect(test.steps.map((step) => step.tech?.target)).toEqual(['Backlog']);
  });

  it('AC4.2 adds, rewrites and removes expected results and ignores empty ones', () => {
    let test = addExpected(base(), '  «S-3» steht in «Erledigt».  ', 'S-3');
    test = addExpected(test, '   ');
    expect(test.expected).toHaveLength(1);
    expect(test.expected[0]).toMatchObject({ text: '«S-3» steht in «Erledigt».', target: 'S-3' });
    test = updateExpected(test, test.expected[0].id, 'neu');
    expect(test.expected[0].text).toBe('neu');
    expect(removeExpected(test, test.expected[0].id).expected).toEqual([]);
  });

  it('AC4.3 asks for the expected result before a test can be saved, and for a name', () => {
    expect(finishProblem(addStep(base(), { kind: 'manual', text: 'x' }))).toBe('expected');
    expect(finishProblem(addExpected(base(), 'ok'))).toBeNull();
    expect(finishProblem({ ...addExpected(base(), 'ok'), name: ' ' })).toBe('name');
  });

  it('AC4.4 saves a new test at the end and replaces a changed one, without empty steps', () => {
    const first = addExpected(base(), 'ok');
    const second = addExpected({ ...base(), id: 'second', name: 'Zweiter' }, 'ok');
    let collection = saveTest([], first);
    collection = saveTest(collection, second);
    expect(collection.map((entry) => entry.name)).toEqual(['Story verschieben', 'Zweiter']);
    const changed = addStep({ ...first, name: 'Neu' }, { kind: 'manual', text: '  ' });
    collection = saveTest(collection, changed);
    expect(collection.map((entry) => entry.name)).toEqual(['Neu', 'Zweiter']);
    expect(collection[0].steps).toEqual([]);
  });

  it('AC7.3 deletes an entry', () => {
    const collection = saveTest(saveTest([], addExpected(base(), 'ok')), addExpected({ ...base(), id: 'b' }, 'ok'));
    expect(deleteEntry(collection, 'b')).toHaveLength(1);
  });
});

describe('what is remembered on the device', () => {
  it('AC7.1 gives the same collection back after storing it', () => {
    const test = addExpected(addStep(base(), { kind: 'click', text: 'Ich klicke.', tech: { action: 'click', target: 'Backlog' } }), 'ok', 'Karte');
    const state = parseRecorderState(JSON.stringify({ collection: [test], draft: { test, paused: true, editing: false } }));
    expect(state.collection).toEqual([test]);
    expect(state.draft).toEqual({ test, paused: true, editing: false });
  });

  it('AC7.1 starts empty from nothing, from broken text and from broken entries', () => {
    expect(parseRecorderState(null).collection).toEqual([]);
    expect(parseRecorderState('{nope').collection).toEqual([]);
    expect(parseRecorderState(JSON.stringify({ collection: [1, { kind: 'x' }, { kind: 'test' }], draft: 5 }))).toEqual({ collection: [], draft: null });
  });
});

describe('the text for the AI', () => {
  const test = addExpected(
    addStep(addStep(base(), { kind: 'open', text: 'Ich öffne das Board.', tech: { action: 'open', page: 'Board' } }), {
      kind: 'drag',
      text: 'Ich ziehe «S-3: Login» in «Erledigt».',
      tech: { action: 'drag', target: 'S-3: Login', value: 'Erledigt' }
    }),
    '«S-3» steht in «Erledigt».'
  );

  it('AC8.1 starts with the context and lists each test in the form of the test cases', () => {
    const text = renderExport([test], context);
    expect(text).toContain('# Feedback aus der Vorschau von Get It Done');
    expect(text).toContain('- Vorschau: https://getthingsdone-pr-37.onrender.com/');
    expect(text).toContain('- Sprache der Oberfläche: de');
    expect(text).toContain('## Neue Tests (1)');
    expect(text).toContain('### 1. Story verschieben');
    expect(text).toContain('- Anforderung: AC2.1');
    expect(text).toContain('- Ausgangslage: Frische Demo-Daten, Seite «Board»');
    expect(text).toContain('  1. Ich öffne das Board.\n  2. Ich ziehe «S-3: Login» in «Erledigt».');
    expect(text).toContain('- Erwartet:\n  - «S-3» steht in «Erledigt».');
  });

  it('AC8.1 adds the technical steps as JSON that can be parsed', () => {
    const text = renderExport([test], context);
    const json = /```json\n([\s\S]*?)\n```/.exec(text)?.[1] ?? '';
    const parsed = JSON.parse(json) as { steps: { action: string; target?: string }[]; expected: { text: string }[] };
    expect(parsed.steps.map((step) => step.action)).toEqual(['open', 'drag']);
    expect(parsed.steps[1].target).toBe('S-3: Login');
    expect(parsed.expected[0].text).toBe('«S-3» steht in «Erledigt».');
  });

  it('AC8.5 tells the AI what the text is and what to do with it', () => {
    expect(renderExport([test], context)).toContain('Hinweis für die KI:');
  });

  it('AC8.6 puts the result of the acceptance before the new tests, and leaves the section out without one', () => {
    const withAcceptance = renderExport([test], { ...context, acceptance: 'Abnahme Paket 1: 1 von 2 in Ordnung' });
    expect(withAcceptance.indexOf('## Abnahme\n\nAbnahme Paket 1: 1 von 2 in Ordnung')).toBeGreaterThan(0);
    expect(withAcceptance.indexOf('## Abnahme')).toBeLessThan(withAcceptance.indexOf('## Neue Tests (1)'));
    expect(renderExport([test], context)).not.toContain('## Abnahme');
    expect(renderExport([test], { ...context, acceptance: '  ' })).not.toContain('## Abnahme');
  });

  it('AC8.1 numbers several tests and leaves out the requirement when there is none', () => {
    const second = { ...test, id: 'b', name: 'Zweiter', requirement: '' };
    const text = renderExport([test, second], context);
    expect(text).toContain('## Neue Tests (2)');
    expect(text).toContain('### 2. Zweiter');
    expect(text.split('### 2. Zweiter')[1]).not.toContain('Anforderung');
  });
});
