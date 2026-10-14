/*
 * Tests assembled by clicking in the web preview (#37). Pure rules: the steps of a test, what is remembered on the
 * device, and the text that is copied for the AI. The page side (listening to clicks) lives in state/Recorder.tsx.
 */

export const RECORDER_STORAGE_KEY = 'getitdone.recorder';

export type StepKind = 'open' | 'click' | 'type' | 'drag' | 'reload' | 'manual';

/** What the AI needs to turn a step into an automated test: no sentence, just the action and what it was done to. */
export interface StepTech {
  action: string;
  target?: string;
  value?: string;
  page?: string;
}

export interface TestStep {
  id: string;
  kind: StepKind;
  text: string;
  tech?: StepTech;
}

export interface ExpectedResult {
  id: string;
  text: string;
  /** The element that was pointed at, if any. */
  target?: string;
}

/** "fresh": the demo data are reset before the test starts; "current": the data as they are now. */
export type StartState = 'fresh' | 'current';

export interface RecordedTest {
  id: string;
  /** The kind of entry. Only tests exist today; feedback and acceptance results can follow as further kinds. */
  kind: 'test';
  name: string;
  requirement: string;
  startState: StartState;
  /** The page the test starts on, as the user knows it ("Board"). */
  startPage: string;
  steps: TestStep[];
  expected: ExpectedResult[];
  createdAt: string;
}

export type CollectionEntry = RecordedTest;

/** The test that is being recorded or edited. `editing` tells a saved test (changed in place) from a new one. */
export interface Draft {
  test: RecordedTest;
  paused: boolean;
  editing: boolean;
}

export interface RecorderState {
  collection: CollectionEntry[];
  draft: Draft | null;
}

export const INITIAL_RECORDER_STATE: RecorderState = { collection: [], draft: null };

let counter = 0;
export function newId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createTest(input: { name: string; requirement: string; startState: StartState; startPage: string; now: string }): RecordedTest {
  return {
    id: newId(),
    kind: 'test',
    name: input.name.trim(),
    requirement: input.requirement.trim(),
    startState: input.startState,
    startPage: input.startPage,
    steps: [],
    expected: [],
    createdAt: input.now
  };
}

export function addStep(test: RecordedTest, step: Omit<TestStep, 'id'>): RecordedTest {
  const last = test.steps[test.steps.length - 1];
  // Typing into the same field again replaces the last entry instead of listing every correction.
  if (step.kind === 'type' && last?.kind === 'type' && last.tech?.target === step.tech?.target) {
    return { ...test, steps: [...test.steps.slice(0, -1), { ...step, id: last.id }] };
  }
  return { ...test, steps: [...test.steps, { ...step, id: newId() }] };
}

/** A double click arrives as two clicks first: they are taken back, so the double click is the only step. */
export function dropTrailingClicks(test: RecordedTest, target: string): RecordedTest {
  const steps = [...test.steps];
  for (let n = 0; n < 2; n += 1) {
    const last = steps[steps.length - 1];
    if (last?.tech?.action === 'click' && last.tech.target === target) steps.pop();
  }
  return { ...test, steps };
}

export function updateStep(test: RecordedTest, id: string, text: string): RecordedTest {
  return { ...test, steps: test.steps.map((step) => (step.id === id ? { ...step, text } : step)) };
}

export function removeStep(test: RecordedTest, id: string): RecordedTest {
  return { ...test, steps: test.steps.filter((step) => step.id !== id) };
}

export function addExpected(test: RecordedTest, text: string, target?: string): RecordedTest {
  const clean = text.trim();
  if (clean === '') return test;
  return { ...test, expected: [...test.expected, { id: newId(), text: clean, ...(target ? { target } : {}) }] };
}

export function updateExpected(test: RecordedTest, id: string, text: string): RecordedTest {
  return { ...test, expected: test.expected.map((item) => (item.id === id ? { ...item, text } : item)) };
}

export function removeExpected(test: RecordedTest, id: string): RecordedTest {
  return { ...test, expected: test.expected.filter((item) => item.id !== id) };
}

export type FinishProblem = 'name' | 'expected';

/** What is still missing before a test can be saved. */
export function finishProblem(test: RecordedTest): FinishProblem | null {
  if (test.name.trim() === '') return 'name';
  if (test.expected.every((item) => item.text.trim() === '')) return 'expected';
  return null;
}

/** Saves the test: a new one goes to the end of the collection, a changed one replaces itself. Steps without text are dropped. */
export function saveTest(collection: CollectionEntry[], test: RecordedTest): CollectionEntry[] {
  const clean: RecordedTest = {
    ...test,
    steps: test.steps.filter((step) => step.text.trim() !== ''),
    expected: test.expected.filter((item) => item.text.trim() !== '')
  };
  return collection.some((entry) => entry.id === clean.id) ? collection.map((entry) => (entry.id === clean.id ? clean : entry)) : [...collection, clean];
}

export function deleteEntry(collection: CollectionEntry[], id: string): CollectionEntry[] {
  return collection.filter((entry) => entry.id !== id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

function parseTest(value: unknown): RecordedTest | null {
  if (!isRecord(value) || value.kind !== 'test' || typeof value.id !== 'string') return null;
  const steps = Array.isArray(value.steps)
    ? value.steps.filter(isRecord).map((step): TestStep => {
        const tech = isRecord(step.tech)
          ? { action: text(step.tech.action), target: text(step.tech.target) || undefined, value: text(step.tech.value) || undefined, page: text(step.tech.page) || undefined }
          : undefined;
        const kind = (['open', 'click', 'type', 'drag', 'reload', 'manual'] as const).find((k) => k === step.kind) ?? 'manual';
        return { id: text(step.id) || newId(), kind, text: text(step.text), ...(tech ? { tech } : {}) };
      })
    : [];
  const expected = Array.isArray(value.expected)
    ? value.expected.filter(isRecord).map((item): ExpectedResult => ({ id: text(item.id) || newId(), text: text(item.text), ...(text(item.target) ? { target: text(item.target) } : {}) }))
    : [];
  return {
    id: value.id,
    kind: 'test',
    name: text(value.name),
    requirement: text(value.requirement),
    startState: value.startState === 'current' ? 'current' : 'fresh',
    startPage: text(value.startPage),
    steps,
    expected,
    createdAt: text(value.createdAt)
  };
}

/** The state from its stored text. Anything unreadable gives an empty state; broken entries are left out. */
export function parseRecorderState(raw: string | null | undefined): RecorderState {
  if (!raw) return INITIAL_RECORDER_STATE;
  try {
    const stored: unknown = JSON.parse(raw);
    if (!isRecord(stored)) return INITIAL_RECORDER_STATE;
    const collection = Array.isArray(stored.collection) ? stored.collection.map(parseTest).filter((entry): entry is RecordedTest => entry !== null) : [];
    let draft: Draft | null = null;
    if (isRecord(stored.draft)) {
      const test = parseTest(stored.draft.test);
      if (test) draft = { test, paused: stored.draft.paused === true, editing: stored.draft.editing === true };
    }
    return { collection, draft };
  } catch {
    return INITIAL_RECORDER_STATE;
  }
}

/** Where and when the text was made. */
export interface ExportContext {
  address: string;
  date: string;
  language: string;
  width: number;
  /** The result of the acceptance in the popup (#32), if there is one: it comes first, before the new tests. */
  acceptance?: string;
}

export interface ExportLabels {
  start: (state: StartState, page: string) => string;
}

const DEFAULT_LABELS: ExportLabels = {
  start: (state, page) => `${state === 'fresh' ? 'Frische Demo-Daten' : 'Daten so wie sie waren'}, Seite «${page}»`
};

/** The text that is copied and handed to the AI. Headings are German, like the test cases the PO reviews. */
export function renderExport(entries: readonly CollectionEntry[], context: ExportContext, labels: ExportLabels = DEFAULT_LABELS): string {
  const tests = entries.filter((entry): entry is RecordedTest => entry.kind === 'test');
  const lines: string[] = [
    '# Feedback aus der Vorschau von Get It Done',
    '',
    'Hinweis für die KI: Dieser Text stammt vom Product Owner aus der Web-Vorschau. Er enthält das Ergebnis der Abnahme (falls vorhanden) und neue Testfälle, die dort zusammengeklickt wurden. ' +
      'Prüfe jeden Testfall, lege fehlende Testfälle im passenden Issue an (deutsch, in einfacher Sprache, wie in CLAUDE.md beschrieben) ' +
      'und baue nach der Freigabe des Product Owners daraus automatisierte Tests. Die technischen Schritte am Ende jedes Tests zeigen, was angeklickt wurde.',
    '',
    `- Vorschau: ${context.address}`,
    `- Datum: ${context.date}`,
    `- Sprache der Oberfläche: ${context.language}`,
    `- Fensterbreite: ${context.width} px`,
    ''
  ];
  if (context.acceptance?.trim()) lines.push('## Abnahme', '', context.acceptance.trim(), '');
  if (tests.length > 0) {
    lines.push(`## Neue Tests (${tests.length})`, '');
    tests.forEach((test, index) => {
      lines.push(`### ${index + 1}. ${test.name}`);
      if (test.requirement) lines.push(`- Anforderung: ${test.requirement}`);
      lines.push(`- Ausgangslage: ${labels.start(test.startState, test.startPage)}`);
      lines.push('- Ich mache:');
      if (test.steps.length === 0) lines.push('  (keine Schritte aufgenommen)');
      test.steps.forEach((step, n) => lines.push(`  ${n + 1}. ${step.text}`));
      lines.push('- Erwartet:');
      test.expected.forEach((item) => lines.push(`  - ${item.text}`));
      lines.push('', 'Technische Schritte:', '', '```json');
      lines.push(
        JSON.stringify(
          {
            start: { state: test.startState, page: test.startPage },
            steps: test.steps.map((step) => ({ action: step.tech?.action ?? step.kind, ...(step.tech?.target ? { target: step.tech.target } : {}), ...(step.tech?.value ? { value: step.tech.value } : {}), ...(step.tech?.page ? { page: step.tech.page } : {}), text: step.text })),
            expected: test.expected.map((item) => ({ text: item.text, ...(item.target ? { target: item.target } : {}) }))
          },
          null,
          2
        )
      );
      lines.push('```', '');
    });
  }
  return lines.join('\n').trimEnd() + '\n';
}
