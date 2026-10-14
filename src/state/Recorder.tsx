import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { isTauri } from '../data/createRepository';
import {
  RECORDER_STORAGE_KEY,
  addExpected,
  addStep,
  createTest,
  deleteEntry as deleteEntryIn,
  dropTrailingClicks,
  finishProblem,
  parseRecorderState,
  removeExpected,
  removeStep,
  renderExport,
  saveTest,
  updateExpected,
  updateStep,
  type FinishProblem,
  type RecordedTest,
  type RecorderState,
  type StartState,
  type TestStep
} from '../domain/testRecorder';
import { parseHash } from '../router';
import { HOVER_ATTR, describe, fieldName, inRecorder, isField, placeOf, textContent } from './recorderDom';

/** Where the demo data of the browser build are kept (see data/localStorageRepository.ts). */
const DEMO_DATA_KEY = 'getitdone.snapshot.v1';
/** Set before the app reloads on purpose, so the reload does not become a step of the test. */
const SKIP_RELOAD_KEY = 'getitdone.recorder.skipReload';

export type PanelState = 'hidden' | 'open' | 'rail';

/** What the user pointed at to say what is expected: the element and sentences to choose from. */
export interface Picked {
  target: string;
  suggestions: string[];
}

export interface RecorderApi {
  /** False in the desktop app: the recorder is a tool of the web preview. */
  enabled: boolean;
  panel: PanelState;
  state: RecorderState;
  /** The form for a new test is shown. */
  creating: boolean;
  picking: boolean;
  picked: Picked | null;
  /** The last thing that happened, for a screen reader and the status line. */
  notice: string;
  buttonRef: RefObject<HTMLButtonElement | null>;
  togglePanel(): void;
  collapse(): void;
  expand(): void;
  startCreating(): void;
  cancelCreating(): void;
  start(input: { name: string; requirement: string; startState: StartState }): void;
  setPaused(paused: boolean): void;
  changeTest(change: (test: RecordedTest) => RecordedTest): void;
  addManualStep(text: string): void;
  updateStepText(id: string, text: string): void;
  removeStepById(id: string): void;
  addExpectedText(text: string, target?: string): void;
  updateExpectedText(id: string, text: string): void;
  removeExpectedById(id: string): void;
  beginPick(): void;
  cancelPick(): void;
  /** Saves the test, or says what is missing. */
  finish(): FinishProblem | null;
  discardDraft(): void;
  editEntry(id: string): void;
  deleteEntry(id: string): void;
  /** The text for the AI, as it is copied. */
  exportText(): string;
  copyAll(): Promise<boolean>;
}

const RecorderContext = createContext<RecorderApi | null>(null);

export function useRecorder(): RecorderApi {
  const value = useContext(RecorderContext);
  if (!value) throw new Error('useRecorder must be used inside RecorderProvider');
  return value;
}

function readState(): RecorderState {
  try {
    return parseRecorderState(window.localStorage.getItem(RECORDER_STORAGE_KEY));
  } catch {
    return parseRecorderState(null);
  }
}

function writeState(state: RecorderState): void {
  try {
    window.localStorage.setItem(RECORDER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // the tests just will not be remembered
  }
}

/** Starts from the demo data of a fresh browser: the stored data are removed and the app loads again. */
export function resetDemoData(): void {
  try {
    window.localStorage.removeItem(DEMO_DATA_KEY);
    window.sessionStorage.setItem(SKIP_RELOAD_KEY, '1');
  } catch {
    // nothing to remove
  }
  window.location.reload();
}

const pad = (n: number): string => String(n).padStart(2, '0');
function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const PAGE_KEYS = { board: 'nav.board', backlog: 'nav.backlog', map: 'nav.storyMap', epics: 'nav.epics', releases: 'nav.releases', settings: 'nav.settings' } as const;

interface Props {
  children: ReactNode;
  /** Defaults to the web preview: everything except the desktop app. */
  enabled?: boolean;
  /** Resets the demo data. Replaced in tests, because a test cannot reload the page. */
  reset?: () => void;
}

export function RecorderProvider({ children, enabled = !isTauri(), reset = resetDemoData }: Props) {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<RecorderState>(readState);
  const [panel, setPanel] = useState<PanelState>(() => (readState().draft ? 'open' : 'hidden'));
  const [creating, setCreating] = useState(false);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [notice, setNotice] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    if (enabled) writeState(state);
  }, [state, enabled]);

  const draft = state.draft;
  const recording = enabled && draft !== null && !draft.paused && !draft.editing && !picking;

  const pageName = useCallback((): string => t(PAGE_KEYS[parseHash(window.location.hash).name]), [t]);

  const recordStep = useCallback((step: Omit<TestStep, 'id'>, note = true): void => {
    setState((current) => (current.draft ? { ...current, draft: { ...current.draft, test: addStep(current.draft.test, step) } } : current));
    if (note) setNotice(tRef.current('recorder.recorded', { step: step.text }));
  }, []);

  // A page that loads again while a test is recorded is a step of that test, unless the app reloaded on purpose.
  const reloadChecked = useRef(false);
  useEffect(() => {
    if (!enabled || reloadChecked.current) return;
    reloadChecked.current = true;
    let skip = false;
    try {
      skip = window.sessionStorage.getItem(SKIP_RELOAD_KEY) !== null;
      window.sessionStorage.removeItem(SKIP_RELOAD_KEY);
    } catch {
      // no storage: record the reload
    }
    const current = readState().draft;
    if (!skip && current && !current.paused && !current.editing && current.test.steps.length > 0) {
      recordStep({ kind: 'reload', text: t('recorder.step.reload'), tech: { action: 'reload' } });
    }
  }, [enabled, recordStep, t]);

  // Recording: what the user does in the app becomes steps.
  const lastRecorded = useRef({ text: '', at: -1000, clicked: false });
  useEffect(() => {
    if (!recording) return;
    const tr = (key: string, options?: Record<string, unknown>): string => tRef.current(key, options) as string;
    const note = (text: string, clicked = false): void => {
      lastRecorded.current = { text, at: performance.now(), clicked };
    };
    const push = (step: Omit<TestStep, 'id'>, clicked = false): void => {
      // The same sentence twice within a moment is one action (a label and its field both report a click).
      if (lastRecorded.current.text === step.text && performance.now() - lastRecorded.current.at < 300) return;
      note(step.text, clicked);
      recordStep(step);
    };

    let pending: { name: string; value: string } | null = null;
    const flush = (): void => {
      if (!pending) return;
      const { name, value } = pending;
      pending = null;
      push({ kind: 'type', text: tr('recorder.step.type', { value, field: name }), tech: { action: 'type', target: name, value } });
    };

    let down: { x: number; y: number; id: string | null; name: string } | null = null;
    let moved = false;
    const onPointerDown = (event: PointerEvent): void => {
      moved = false;
      if (inRecorder(event.target)) {
        down = null;
        return;
      }
      const card = event.target instanceof Element ? event.target.closest('[data-story-id]') : null;
      down = { x: event.clientX, y: event.clientY, id: card?.getAttribute('data-story-id') ?? null, name: card ? (describe(card)?.name ?? '') : '' };
    };
    const onPointerMove = (event: PointerEvent): void => {
      if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) moved = true;
    };
    const onPointerUp = (): void => {
      const start = down;
      down = null;
      if (!start || !moved || !start.id) return;
      flush();
      // The card has found its place once the drag library has put it down.
      window.setTimeout(() => {
        const card = document.querySelector(`[data-story-id="${CSS.escape(start.id as string)}"]`);
        const place = card ? placeOf(card) : '';
        const name = start.name;
        push(
          place
            ? { kind: 'drag', text: tr('recorder.step.drag', { name, place }), tech: { action: 'drag', target: name, value: place } }
            : { kind: 'drag', text: tr('recorder.step.dragNoPlace', { name }), tech: { action: 'drag', target: name } }
        );
      }, 300);
    };
    const onClick = (event: MouseEvent): void => {
      if (inRecorder(event.target)) return;
      if (moved) {
        moved = false;
        return;
      }
      flush();
      const what = describe(event.target);
      const name = what?.name ?? '';
      push(
        name
          ? { kind: 'click', text: tr('recorder.step.click', { name }), tech: { action: 'click', target: name } }
          : { kind: 'click', text: tr('recorder.step.clickElement'), tech: { action: 'click' } },
        true
      );
    };
    const onDoubleClick = (event: MouseEvent): void => {
      if (inRecorder(event.target)) return;
      const name = describe(event.target)?.name ?? '';
      if (!name) return;
      setState((current) => (current.draft ? { ...current, draft: { ...current.draft, test: dropTrailingClicks(current.draft.test, name) } } : current));
      note('');
      recordStep({ kind: 'click', text: tr('recorder.step.dblclick', { name }), tech: { action: 'dblclick', target: name } });
    };
    const onInput = (event: Event): void => {
      const target = event.target;
      if (inRecorder(target) || !(target instanceof Element) || !isField(target)) return;
      if (target instanceof HTMLSelectElement) return;
      if (target instanceof HTMLInputElement && ['checkbox', 'radio', 'range', 'file', 'button', 'submit', 'color'].includes(target.type)) return;
      const secret = target instanceof HTMLInputElement && target.type === 'password';
      pending = { name: fieldName(target), value: secret ? '••••' : target.value };
    };
    const onChange = (event: Event): void => {
      const target = event.target;
      if (inRecorder(target) || !(target instanceof HTMLSelectElement)) return;
      flush();
      const value = target.selectedOptions[0]?.text.trim() ?? target.value;
      const field = fieldName(target);
      push({ kind: 'type', text: tr('recorder.step.select', { value, field }), tech: { action: 'select', target: field, value } });
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (inRecorder(event.target) || event.isComposing) return;
      const key = event.key;
      if (key === 'Enter' && event.target instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit'].includes(event.target.type)) {
        flush();
        const field = fieldName(event.target);
        push({ kind: 'click', text: tr('recorder.step.enter', { field }), tech: { action: 'press', target: field, value: 'Enter' } });
      } else if (key === 'Escape' && !event.defaultPrevented) {
        flush();
        push({ kind: 'click', text: tr('recorder.step.escape'), tech: { action: 'press', value: 'Escape' } });
      }
    };
    const onFocusOut = (): void => flush();
    const onHashChange = (): void => {
      flush();
      // A link that was clicked has been recorded as the click; only a page change from elsewhere (back button, address) is a step.
      if (lastRecorded.current.clicked && performance.now() - lastRecorded.current.at < 800) return;
      const page = tr(PAGE_KEYS[parseHash(window.location.hash).name]);
      push({ kind: 'open', text: tr('recorder.step.open', { page }), tech: { action: 'open', page } });
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('dblclick', onDoubleClick, true);
    document.addEventListener('input', onInput, true);
    document.addEventListener('change', onChange, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusout', onFocusOut, true);
    window.addEventListener('hashchange', onHashChange);
    return () => {
      flush();
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('dblclick', onDoubleClick, true);
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('change', onChange, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusout', onFocusOut, true);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [recording, recordStep]);

  // Pointing at the result: the element under the pointer is framed, a click chooses it and does nothing else.
  useEffect(() => {
    if (!picking) return;
    let hovered: Element | null = null;
    const unframe = (): void => {
      hovered?.removeAttribute(HOVER_ATTR);
      hovered = null;
    };
    const onMove = (event: PointerEvent): void => {
      const target = event.target instanceof Element && !inRecorder(event.target) ? event.target : null;
      const next = target ? (describe(target)?.element ?? target) : null;
      if (next === hovered) return;
      unframe();
      hovered = next;
      hovered?.setAttribute(HOVER_ATTR, 'true');
    };
    const onClick = (event: MouseEvent): void => {
      if (inRecorder(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const what = describe(event.target);
      unframe();
      setPicking(false);
      if (!what) return;
      const name = what.name;
      const place = placeOf(what.element);
      // Only the text of a plain element is offered: a card or a column holds many texts, and its name says enough.
      const text = what.kind === 'field' || what.element.children.length > 0 ? '' : textContent(what.element);
      const suggestions: string[] = [];
      if (what.kind === 'field' && isField(what.element) && !(what.element instanceof HTMLSelectElement)) {
        suggestions.push(tRef.current('recorder.expect.fieldShows', { field: name, value: what.element.value }));
      }
      if (name) suggestions.push(tRef.current('recorder.expect.see', { name }));
      if (name && place && place !== name) suggestions.push(tRef.current('recorder.expect.seeIn', { name, place }));
      if (text && text !== name) suggestions.push(tRef.current('recorder.expect.seeText', { text }));
      if (suggestions.length === 0) suggestions.push(tRef.current('recorder.expect.seeElement'));
      setPicked({ target: name || text, suggestions });
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      unframe();
      setPicking(false);
    };
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      unframe();
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [picking]);

  const changeDraft = useCallback((change: (test: RecordedTest) => RecordedTest): void => {
    setState((current) => (current.draft ? { ...current, draft: { ...current.draft, test: change(current.draft.test) } } : current));
  }, []);

  const exportText = useCallback(
    (): string =>
      renderExport(state.collection, {
        address: `${window.location.origin}${window.location.pathname}`,
        date: formatDate(new Date()),
        language: i18n.resolvedLanguage ?? 'en',
        width: window.innerWidth
      }),
    [state.collection, i18n.resolvedLanguage]
  );

  const copyAll = useCallback(async (): Promise<boolean> => {
    const text = exportText();
    let done = false;
    try {
      await navigator.clipboard.writeText(text);
      done = true;
    } catch {
      // the clipboard may be blocked (no secure page, no permission): try the old way
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute(`data-recorder`, 'true');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        done = document.execCommand('copy');
      } catch {
        done = false;
      }
      area.remove();
    }
    setNotice(tRef.current(done ? 'recorder.copied' : 'recorder.copyFailed'));
    return done;
  }, [exportText]);

  const api = useMemo<RecorderApi>(
    () => ({
      enabled,
      panel,
      state,
      creating,
      picking,
      picked,
      notice,
      buttonRef,
      togglePanel: () => {
        setCreating(false);
        setPanel((current) => (current === 'hidden' ? 'open' : current === 'rail' ? 'open' : draft ? 'rail' : 'hidden'));
      },
      collapse: () => setPanel(draft ? 'rail' : 'hidden'),
      expand: () => setPanel('open'),
      startCreating: () => setCreating(true),
      cancelCreating: () => setCreating(false),
      start: ({ name, requirement, startState }) => {
        const page = pageName();
        const test = addStep(createTest({ name, requirement, startState, startPage: page, now: new Date().toISOString() }), {
          kind: 'open',
          text: t('recorder.step.open', { page }),
          tech: { action: 'open', page }
        });
        // Written at once: with fresh demo data the app loads again, and the test has to survive that.
        const next: RecorderState = { ...state, draft: { test, paused: false, editing: false } };
        writeState(next);
        setState(next);
        setCreating(false);
        setPanel('open');
        setNotice(t('recorder.started', { name: test.name }));
        if (startState === 'fresh') reset();
      },
      setPaused: (paused) => setState((current) => (current.draft ? { ...current, draft: { ...current.draft, paused } } : current)),
      changeTest: changeDraft,
      addManualStep: (text) => {
        if (text.trim() !== '') changeDraft((test) => addStep(test, { kind: 'manual', text: text.trim(), tech: { action: 'manual' } }));
      },
      updateStepText: (id, text) => changeDraft((test) => updateStep(test, id, text)),
      removeStepById: (id) => changeDraft((test) => removeStep(test, id)),
      addExpectedText: (text, target) => {
        changeDraft((test) => addExpected(test, text, target));
        setPicked(null);
      },
      updateExpectedText: (id, text) => changeDraft((test) => updateExpected(test, id, text)),
      removeExpectedById: (id) => changeDraft((test) => removeExpected(test, id)),
      beginPick: () => {
        setPicked(null);
        setPicking(true);
      },
      cancelPick: () => {
        setPicking(false);
        setPicked(null);
      },
      finish: () => {
        if (!state.draft) return null;
        const problem = finishProblem(state.draft.test);
        if (problem) return problem;
        setState({ collection: saveTest(state.collection, state.draft.test), draft: null });
        setPicked(null);
        setNotice(t('recorder.saved', { name: state.draft.test.name }));
        return null;
      },
      discardDraft: () => {
        setState((current) => ({ ...current, draft: null }));
        setPicking(false);
        setPicked(null);
      },
      editEntry: (id) => {
        const entry = state.collection.find((item) => item.id === id);
        if (entry) setState({ ...state, draft: { test: entry, paused: true, editing: true } });
      },
      deleteEntry: (id) => setState((current) => ({ ...current, collection: deleteEntryIn(current.collection, id) })),
      exportText,
      copyAll
    }),
    [enabled, panel, state, creating, picking, picked, notice, draft, changeDraft, exportText, copyAll, pageName, reset, t]
  );

  return <RecorderContext.Provider value={api}>{children}</RecorderContext.Provider>;
}
