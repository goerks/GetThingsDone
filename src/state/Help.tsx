import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  HELP_STORAGE_KEY,
  confirmStep as confirmStepIn,
  dismissInvitation,
  noteActivity,
  parseHelpState,
  restartTour as restartTourIn,
  skipStep as skipStepIn,
  startTour as startTourIn,
  type HelpState,
  type TourStepId
} from '../domain/helpTour';
import type { ShowSpec } from '../help/topics';
import { useApp } from './AppState';

export type HelpView = { name: 'home' } | { name: 'topic'; id: string } | { name: 'tour' };

export interface HelpApi {
  open: boolean;
  view: HelpView;
  query: string;
  /** The home view lists all topics instead of the ones of the current page. */
  listAll: boolean;
  state: HelpState;
  /** The "?" button, to give the focus back to it. */
  buttonRef: RefObject<HTMLButtonElement | null>;
  openHelp(view?: HelpView): void;
  closeHelp(): void;
  toggleHelp(): void;
  setView(view: HelpView): void;
  setQuery(query: string): void;
  setListAll(all: boolean): void;
  /** Opens the introduction. Nothing that happened before counts for its steps. */
  startTour(): void;
  declineInvitation(): void;
  confirmStep(id: TourStepId): void;
  skipStep(id: TourStepId): void;
  restartTour(): void;
  /** Highlights the first element that matches. Returns false when there is none. */
  show(spec: ShowSpec): boolean;
}

const HelpContext = createContext<HelpApi | null>(null);

export function useHelp(): HelpApi {
  const value = useContext(HelpContext);
  if (!value) throw new Error('useHelp must be used inside HelpProvider');
  return value;
}

const HOME: HelpView = { name: 'home' };

function readState(): HelpState {
  try {
    return parseHelpState(window.localStorage.getItem(HELP_STORAGE_KEY));
  } catch {
    return parseHelpState(null);
  }
}

/** Keys that are typed into the field, so "?" and other shortcuts must leave them alone. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

const MARK = 'data-help-highlight';

export function HelpProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const [state, setState] = useState<HelpState>(readState);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<HelpView>(HOME);
  const [query, setQuery] = useState('');
  const [listAll, setListAll] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const stopHighlight = useRef<(() => void) | null>(null);

  // What was done with the help is remembered per device, like the theme and the language.
  useEffect(() => {
    try {
      window.localStorage.setItem(HELP_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // the progress just will not be remembered
    }
  }, [state]);

  // What the user does in the app completes the steps of the introduction, and ends the invitation.
  const { onActivity } = app;
  useEffect(() => onActivity((activity) => setState((current) => noteActivity(current, activity))), [onActivity]);

  const clearHighlight = useCallback(() => {
    stopHighlight.current?.();
    stopHighlight.current = null;
  }, []);
  useEffect(() => clearHighlight, [clearHighlight]);

  const show = useCallback(
    (spec: ShowSpec): boolean => {
      clearHighlight();
      const element = document.querySelector<HTMLElement>(spec.selector);
      if (!element) return false;
      element.setAttribute(MARK, 'true');
      if (typeof element.scrollIntoView === 'function') element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const stop = (): void => {
        element.removeAttribute(MARK);
        document.removeEventListener('pointerdown', stop, true);
        document.removeEventListener('keydown', onKey, true);
        window.removeEventListener('hashchange', stop);
        stopHighlight.current = null;
      };
      // Any click, any key except those that only move the focus, or a change of page ends the highlight.
      const onKey = (event: KeyboardEvent): void => {
        if (!['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) stop();
      };
      document.addEventListener('pointerdown', stop, true);
      document.addEventListener('keydown', onKey, true);
      window.addEventListener('hashchange', stop);
      stopHighlight.current = stop;
      return true;
    },
    [clearHighlight]
  );

  const openHelp = useCallback((next?: HelpView) => {
    setOpen(true);
    if (next) setView(next);
  }, []);
  const closeHelp = useCallback(() => {
    setOpen(false);
    setView(HOME);
  }, []);
  const toggleHelp = useCallback(() => {
    setOpen((current) => {
      if (current) setView(HOME);
      return !current;
    });
  }, []);

  const startTour = useCallback(() => {
    setState((current) => startTourIn(current));
    setOpen(true);
    setView({ name: 'tour' });
  }, []);

  // "?" opens and closes the help, unless the user is typing or a dialog is open.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== '?' || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented || event.isComposing) return;
      if (isTyping(event.target) || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      toggleHelp();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleHelp]);

  // Escape closes the help, wherever the focus is. A field, the search or a drag that uses Escape itself comes first
  // (it calls preventDefault), and so does an open dialog.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      closeHelp();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, closeHelp]);

  const api = useMemo<HelpApi>(
    () => ({
      open,
      view,
      query,
      listAll,
      state,
      buttonRef,
      openHelp,
      closeHelp,
      toggleHelp,
      setView,
      setQuery,
      setListAll,
      startTour,
      declineInvitation: () => setState((current) => dismissInvitation(current)),
      confirmStep: (id) => setState((current) => confirmStepIn(current, id)),
      skipStep: (id) => setState((current) => skipStepIn(current, id)),
      restartTour: () => setState(restartTourIn()),
      show
    }),
    [open, view, query, listAll, state, openHelp, closeHelp, toggleHelp, startTour, show]
  );

  return <HelpContext.Provider value={api}>{children}</HelpContext.Provider>;
}
