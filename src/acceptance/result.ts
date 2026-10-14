import { PACKAGE_1 } from './package1';
import type { TestCase } from './types';

/*
 * What the product owner noted in the acceptance popup (#32): kept in this browser, and the text for the chat with the AI.
 * Kept apart from the popup so that the test builder (#37) can add it to its own text without importing the popup.
 */

export type State = 'ok' | 'bad';
export interface Note {
  state?: State;
  comment: string;
}
export type Notes = Record<string, Note>;

export const PACKAGE = PACKAGE_1;
export const STORAGE_KEY = `getitdone.acceptance.${PACKAGE.issue}.package1`;
export const CASES: TestCase[] = PACKAGE.criteria.flatMap((criterion) => criterion.cases);
/** The test cases only the product owner can check; the others are covered by automated tests. */
export const PO_CASES: TestCase[] = CASES.filter((testCase) => testCase.poCheck);

export function load(): Notes {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as Record<string, { state?: State; done?: boolean; comment?: string }>) : {};
    // The first version stored a tick (`done`); it counts as "In Ordnung".
    return Object.fromEntries(Object.entries(stored).map(([id, note]) => [id, { state: note.state ?? (note.done ? 'ok' : undefined), comment: note.comment ?? '' }]));
  } catch {
    return {};
  }
}

/**
 * The result as text for the chat with the AI: what the product owner pastes back into the conversation, so the AI
 * needs no lookup. A summary, then every problem with what was expected and the comment, then comments on other
 * test cases, then the ids that are in order and the ones not yet checked.
 */
export function resultAsText(notes: Notes): string {
  const state = (testCase: TestCase): State | undefined => notes[testCase.id]?.state;
  const mine = PO_CASES;
  const ok = mine.filter((testCase) => state(testCase) === 'ok');
  const bad = CASES.filter((testCase) => state(testCase) === 'bad');
  const open = mine.filter((testCase) => state(testCase) === undefined);
  const commentOf = (testCase: TestCase): string => notes[testCase.id]?.comment.trim() ?? '';
  const lines = [
    `Abnahme ${PACKAGE.title} (#${PACKAGE.issue}, Pull Request #${PACKAGE.pullRequest}): ${ok.length} von ${mine.length} Punkten für den PO in Ordnung, ${bad.length} ${bad.length === 1 ? 'Problem' : 'Probleme'}, ${open.length} offen`,
    `(${CASES.length - mine.length} weitere Punkte sind durch automatische Tests abgedeckt.)`,
    ''
  ];
  if (bad.length > 0) {
    lines.push('Probleme:');
    for (const testCase of bad) {
      lines.push(`- ${testCase.id} ${testCase.title}${commentOf(testCase) ? ` – ${commentOf(testCase)}` : ''}`, `  Erwartet: ${testCase.then}`);
    }
    lines.push('');
  }
  const remarks = CASES.filter((testCase) => state(testCase) !== 'bad' && commentOf(testCase));
  if (remarks.length > 0) {
    lines.push('Kommentare:');
    for (const testCase of remarks) lines.push(`- ${testCase.id} ${testCase.title} – ${commentOf(testCase)}`);
    lines.push('');
  }
  if (ok.length > 0) lines.push(`In Ordnung: ${ok.map((testCase) => testCase.id).join(', ')}`);
  if (open.length > 0) lines.push(`Noch offen: ${open.map((testCase) => testCase.id).join(', ')}`);
  return lines.join('\n');
}

/** The text of the notes in this browser, or nothing when none were made (no mark and no comment). */
export function storedResultText(): string {
  const notes = load();
  const touched = Object.values(notes).some((note) => note.state !== undefined || note.comment.trim() !== '');
  return touched ? resultAsText(notes) : '';
}
