import { useEffect, useMemo, useState } from 'react';
import { selectPackage } from './packages';
import { applyPreset, PRESETS, takeReopen } from './presets';
import type { Intro, TestCase } from './types';

/*
 * The acceptance aid of the pull request preview (#32), variant B "step through": a round button with a progress ring
 * opens a popup that shows one test case at a time. "In Ordnung" marks it and goes to the next one, opening its page and
 * lighting up what is to be tested; "Problem" asks for a comment. A strip shows all steps as traffic lights.
 * It is a tool for the preview only, in German like the test cases it shows, and keeps its notes in this browser
 * only (nothing is sent anywhere).
 */

type State = 'ok' | 'bad';
interface Note {
  state?: State;
  comment: string;
}
type Notes = Record<string, Note>;

const PACKAGE = selectPackage(typeof window === 'undefined' ? '' : window.location.search);
const STORAGE_KEY = `getitdone.acceptance.${PACKAGE.issue}.package${PACKAGE.issue === 32 ? 1 : PACKAGE.issue}`;
const STEP_KEY = `${STORAGE_KEY}.step`;
/** The introduction of the package, where it has one. */
const INTRO: Intro | undefined = PACKAGE.intro;
const CASES: TestCase[] = PACKAGE.criteria.flatMap((criterion) => criterion.cases);
/** The test cases only the product owner can check; the others are covered by automated tests. */
const PO_CASES: TestCase[] = CASES.filter((testCase) => testCase.poCheck);
const CRITERION_OF = new Map(PACKAGE.criteria.flatMap((criterion) => criterion.cases.map((testCase) => [testCase.id, criterion] as const)));

function load(): Notes {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as Record<string, { state?: State; done?: boolean; comment?: string }>) : {};
    // The first version stored a tick (`done`); it counts as "In Ordnung".
    return Object.fromEntries(Object.entries(stored).map(([id, note]) => [id, { state: note.state ?? (note.done ? 'ok' : undefined), comment: note.comment ?? '' }]));
  } catch {
    return {};
  }
}

function loadStep(notes: Notes): string {
  try {
    const stored = window.localStorage.getItem(STEP_KEY);
    if (stored && CASES.some((testCase) => testCase.id === stored)) return stored;
  } catch {
    // start at the first open test case
  }
  return (PO_CASES.find((testCase) => notes[testCase.id]?.state !== 'ok') ?? PO_CASES[0] ?? CASES[0]).id;
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

/** How long the element under test lights up, in milliseconds. */
export const GLOW_MS = 3000;

/**
 * Lights up the element a test case is about: waits for it to appear (the page may still be changing), scrolls it into
 * view and hands it to `onFound`, so the popup can move to the side of the window that does not hold it.
 */
export function lightUp(selector: string, onFound?: (element: HTMLElement) => void, waitMs = 3000): void {
  const started = performance.now();
  const look = (): void => {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) {
      if (performance.now() - started < waitMs) setTimeout(look, 100);
      return;
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    element.classList.remove('acceptance-glow');
    // Restarts the animation when the same element lights up again.
    void element.offsetWidth;
    element.classList.add('acceptance-glow');
    setTimeout(() => element.classList.remove('acceptance-glow'), GLOW_MS);
    onFound?.(element);
  };
  look();
}

/** Opens the page of a test case and lights up what is to be tested there. */
function goTo(testCase: TestCase, onFound: (element: HTMLElement) => void): void {
  const { target } = testCase;
  if (window.location.hash === testCase.link) {
    if (target) lightUp(target, onFound);
    return;
  }
  // The old page is still shown until the route has changed; look for the element only after that.
  if (target) {
    window.addEventListener('hashchange', () => requestAnimationFrame(() => requestAnimationFrame(() => lightUp(target, onFound))), { once: true });
  }
  window.location.hash = testCase.link;
}

function ClipboardIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4h6v3H9zM9 12l2 2 4-4" />
    </svg>
  );
}

const RING = 2 * Math.PI * 35;

export function AcceptancePanel() {
  const [open, setOpen] = useState(takeReopen);
  const [notes, setNotes] = useState<Notes>(load);
  const [stepId, setStepId] = useState(() => loadStep(load()));
  // By default only the test cases the product owner has to check; the others are covered by automated tests.
  const [showAll, setShowAll] = useState(false);
  const [side, setSide] = useState<'left' | 'right'>('left');
  const [list, setList] = useState(false);
  const [copied, setCopied] = useState(false);
  const cases = showAll ? CASES : PO_CASES;
  const total = cases.length;
  const step = Math.max(0, cases.findIndex((testCase) => testCase.id === stepId));
  const done = useMemo(() => cases.filter((testCase) => notes[testCase.id]?.state === 'ok').length, [notes, cases]);
  const problems = useMemo(() => cases.filter((testCase) => notes[testCase.id]?.state === 'bad').length, [notes, cases]);
  const current = cases[step];
  const note = notes[current.id] ?? { comment: '' };
  const criterion = CRITERION_OF.get(current.id);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
      window.localStorage.setItem(STEP_KEY, stepId);
    } catch {
      // the notes just will not be remembered
    }
  }, [notes, stepId]);

  /** The popup sits on the side of the window that does not hold the element under test. */
  const awayFrom = (element: HTMLElement): void => {
    const box = element.getBoundingClientRect();
    setSide(box.left + box.width / 2 < window.innerWidth / 2 ? 'right' : 'left');
  };

  /** Goes to a step: opens its page and lights up the element under test. */
  const go = (index: number): void => {
    const next = Math.max(0, Math.min(total - 1, index));
    setStepId(cases[next].id);
    goTo(cases[next], awayFrom);
  };

  /** Jumps to a test case from the list; an automated one switches to the full list first. */
  const jump = (testCase: TestCase): void => {
    const index = cases.indexOf(testCase);
    if (index >= 0) {
      go(index);
      return;
    }
    setShowAll(true);
    setStepId(testCase.id);
    goTo(testCase, awayFrom);
  };

  const mark = (id: string, state: State): void =>
    setNotes((current) => ({ ...current, [id]: { comment: current[id]?.comment ?? '', state: current[id]?.state === state ? undefined : state } }));
  const comment = (id: string, text: string): void => setNotes((current) => ({ ...current, [id]: { state: current[id]?.state, comment: text } }));

  const copy = async (): Promise<void> => {
    const text = resultAsText(notes);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  /** Replaces the data of this browser with test data, after asking; the page reloads. */
  const loadPreset = (id: string): void => {
    const title = PRESETS.find((item) => item.id === id)?.title ?? id;
    if (window.confirm(`Testdaten „${title}“ laden? Deine Daten in diesem Browser werden dabei ersetzt.`)) void applyPreset(id);
  };

  const accepted = (): void => {
    const wasOk = note.state === 'ok';
    mark(current.id, 'ok');
    // Marking moves on to the next test case; taking the mark back stays.
    if (!wasOk && step + 1 < total) go(step + 1);
  };

  return (
    <div className={`acceptance${side === 'right' ? ' acceptance--right' : ''}`}>
      {open && (
        <aside className="acceptance__panel" aria-label="Abnahme">
          <header className="acceptance__head">
            <h2>
              Abnahme · Schritt {step + 1} von {total}
            </h2>
            <button type="button" className="icon-btn icon-btn--quiet" aria-label="Abnahme schliessen" onClick={() => setOpen(false)}>
              ×
            </button>
          </header>
          <div className="acceptance__body">
            {INTRO && (
              <details className="acceptance__intro" open>
                <summary>Worum geht es und was wird von dir erwartet?</summary>
                <p>{INTRO.about}</p>
                <ol>
                  {INTRO.todo.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </details>
            )}
            <div className="acceptance__strip" role="group" aria-label="Alle Prüfpunkte">
              {cases.map((testCase, index) => (
                <button
                  key={testCase.id}
                  type="button"
                  className={`acceptance__seg${notes[testCase.id]?.state ? ` acceptance__seg--${notes[testCase.id]?.state}` : ''}${index === step ? ' acceptance__seg--now' : ''}`}
                  aria-label={`${testCase.id} ${testCase.title}${notes[testCase.id]?.state === 'ok' ? ', in Ordnung' : notes[testCase.id]?.state === 'bad' ? ', Problem' : ''}`}
                  aria-current={index === step ? 'step' : undefined}
                  title={testCase.id}
                  onClick={() => go(index)}
                />
              ))}
            </div>
            <p className="acceptance__status" role="status">
              {done} von {total} in Ordnung{problems > 0 ? `, ${problems} Problem${problems === 1 ? '' : 'e'}` : ''}
            </p>

            <section className="acceptance__case" data-case={current.id} aria-labelledby="acceptance-title">
              <h3 id="acceptance-title">
                <span className="acceptance__id">{current.id}</span> {current.title}
                {current.manual && <em className="acceptance__manual"> (manuell)</em>}
              </h3>
              {criterion && (
                <p className="acceptance__criterion">
                  {criterion.id} {criterion.title}
                </p>
              )}
              <dl className="acceptance__steps">
                <dt>Ausgangslage</dt>
                <dd>{current.given}</dd>
                <dt>Ich mache</dt>
                <dd>{current.when}</dd>
                <dt>Erwartet</dt>
                <dd>{current.then}</dd>
              </dl>
              {current.poCheck ? (
                <p className="acceptance__mine">
                  <strong>Das prüfst du:</strong> {current.poCheck}
                </p>
              ) : (
                <p className="acceptance__auto">Automatisch geprüft, du musst das nicht testen.</p>
              )}
              <div className="acceptance__tests">
                <strong>Automatischer Test:</strong>
                {current.tests.length === 0 && <p>Keiner (nur von Hand zu prüfen).</p>}
                <ul>
                  {current.tests.map((test) => (
                    <li key={test}>
                      <code>{test}</code>
                    </li>
                  ))}
                </ul>
                {current.manual && (
                  <p>
                    <strong>Zusätzlich von Hand:</strong> {current.manual}
                  </p>
                )}
              </div>
              {current.preset && (
                <div className="acceptance__preset">
                  <strong>Testdaten:</strong> {PRESETS.find((item) => item.id === current.preset)?.description}
                  <button type="button" className="btn btn--small" onClick={() => loadPreset(current.preset as string)}>
                    Diese Testdaten laden
                  </button>
                </div>
              )}
              <button type="button" className="btn btn--primary acceptance__go" onClick={() => go(step)}>
                Zur Seite und markieren
              </button>
              <div className="acceptance__marks">
                <button type="button" className={`btn acceptance__ok${note.state === 'ok' ? ' is-on' : ''}`} aria-pressed={note.state === 'ok'} onClick={accepted}>
                  ✓ In Ordnung
                </button>
                <button type="button" className={`btn acceptance__bad${note.state === 'bad' ? ' is-on' : ''}`} aria-pressed={note.state === 'bad'} onClick={() => mark(current.id, 'bad')}>
                  ✗ Problem
                </button>
                <button type="button" className="btn" aria-label="Zurück" title="Zurück" disabled={step === 0} onClick={() => go(step - 1)}>
                  ‹
                </button>
                <button type="button" className="btn" aria-label="Weiter" title="Weiter" disabled={step === total - 1} onClick={() => go(step + 1)}>
                  ›
                </button>
              </div>
              <textarea
                className="input acceptance__comment"
                rows={2}
                aria-label={`Kommentar zu ${current.id}`}
                placeholder={note.state === 'bad' ? 'Was ist dir aufgefallen?' : 'Kommentar (optional)'}
                value={note.comment}
                onChange={(event) => comment(current.id, event.target.value)}
              />
            </section>

            <div className="acceptance__tools">
              <label className="acceptance__all">
                <input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />
                Auch automatisch geprüfte Punkte zeigen
              </label>
              <button type="button" className="btn btn--small" aria-expanded={list} onClick={() => setList(!list)}>
                {list ? 'Liste ausblenden' : 'Alle Punkte anzeigen'}
              </button>
              <button type="button" className="btn btn--small" onClick={copy}>
                Ergebnis kopieren
              </button>
              <button type="button" className="btn btn--small" onClick={() => window.confirm('Alle Markierungen und Kommentare löschen?') && setNotes({})}>
                Zurücksetzen
              </button>
              <label className="acceptance__presets">
                Testdaten
                <select
                  className="select"
                  value=""
                  onChange={(event) => {
                    if (event.target.value) loadPreset(event.target.value);
                  }}
                >
                  <option value="">wählen …</option>
                  {PRESETS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              {copied ? <span className="acceptance__copied">Kopiert, jetzt im Chat einfügen</span> : <span className="acceptance__hint">Kopiert den Stand als Text für den Chat mit Claude.</span>}
            </div>

            {list && (
              <div className="acceptance__list">
                {PACKAGE.criteria.map((group) => (
                  <section key={group.id} aria-labelledby={`acc-${group.id}`}>
                    <h4 id={`acc-${group.id}`}>
                      {group.id} {group.title} <span className="muted">({group.story})</span>
                    </h4>
                    <ul>
                      {group.cases.map((testCase) => {
                        const state = notes[testCase.id]?.state;
                        return (
                          <li key={testCase.id} data-case={testCase.id}>
                            <button type="button" className="acceptance__row" aria-current={testCase.id === current.id ? 'step' : undefined} onClick={() => jump(testCase)}>
                              <span className={`acceptance__dot${state ? ` acceptance__dot--${state}` : ''}`} aria-hidden="true" />
                              <span className="acceptance__id">{testCase.id}</span> {testCase.title}
                              {!testCase.poCheck && <span className="acceptance__autotag">automatisch</span>}
                              <span className="sr-only">{state === 'ok' ? ', in Ordnung' : state === 'bad' ? ', Problem' : ', offen'}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        </aside>
      )}
      <div className="acceptance__fab">
        <button
          type="button"
          className="acceptance__toggle"
          aria-expanded={open}
          aria-label={`Abnahme, ${done} von ${total} in Ordnung${problems > 0 ? `, ${problems} Probleme` : ''}, Preview`}
          onClick={() => setOpen(!open)}
        >
          <svg className="acceptance__ring" viewBox="0 0 78 78" aria-hidden="true">
            <circle cx="39" cy="39" r="35" className="acceptance__ring-track" />
            <circle cx="39" cy="39" r="35" className="acceptance__ring-done" strokeDasharray={RING} strokeDashoffset={RING * (1 - done / total)} />
          </svg>
          <ClipboardIcon />
          <span className="acceptance__count" aria-hidden="true">
            {done}/{total}
          </span>
        </button>
        <span className="acceptance__tag" aria-hidden="true">
          Preview
        </span>
      </div>
    </div>
  );
}
