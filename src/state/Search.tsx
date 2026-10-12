import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  EMPTY_QUERY,
  arrangeForPage,
  isActive,
  search,
  viewFor,
  whereShown,
  type PageItems,
  type SearchQuery,
  type SearchResult
} from '../domain/search';
import {
  EMPTY_HISTORY,
  forgetOpened as forgetOpenedIn,
  forgetSearch as forgetSearchIn,
  parseHistory,
  rememberOpened,
  rememberSearch,
  type RecentItem,
  type SearchHistory
} from '../domain/searchHistory';
import { todayIso } from '../domain/sprints';
import type { Snapshot } from '../domain/types';
import { hrefs, parseHash } from '../router';
import { useApp } from './AppState';
import { useDetails } from './Details';
import { useSearchLabels, type SearchLabels } from './searchLabels';

const HISTORY_KEY = 'getitdone.searchHistory';
const SCOPE_KEY = 'getitdone.searchScope';

/** Where results come from: everything, or only what the current page shows. */
export type SearchScope = 'all' | 'page';

function loadScope(): SearchScope {
  try {
    return window.localStorage.getItem(SCOPE_KEY) === 'page' ? 'page' : 'all';
  } catch {
    return 'all';
  }
}

function loadHistory(): SearchHistory {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? parseHistory(JSON.parse(raw)) : EMPTY_HISTORY;
  } catch {
    return EMPTY_HISTORY;
  }
}

function saveHistory(history: SearchHistory): void {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // the history just will not be remembered
  }
}

/** What the current page shows, registered by the page itself. */
export interface SearchPage {
  /** Name of the page, such as "Board". */
  label: string;
  items: PageItems;
}

/** The active search as seen by a page: which of its items match. */
export interface PageMatches {
  /** Matching items of every kind, by id. */
  ids: PageItems;
  label: string;
  clear: () => void;
}

interface SearchApi {
  snapshot: Snapshot;
  labels: SearchLabels;
  query: SearchQuery;
  setQuery(query: SearchQuery): void;
  results: SearchResult[];
  /** Whether the result dropdown is shown. */
  open: boolean;
  setOpen(open: boolean): void;
  inputRef: RefObject<HTMLInputElement | null>;
  /** Moves focus to the search field and opens the dropdown; `select` selects the text so typing replaces it. */
  focus(options?: { select?: boolean }): void;
  /** Result to mark when the dropdown opens again, as `kind:id`. */
  returnKey: string | null;
  /** Opens a result in its detail dialog, with a bar to step through all results. */
  openResult(index: number): void;
  /** Opens an item from the history. */
  openRecent(item: RecentItem): void;
  history: SearchHistory;
  forgetSearch(index: number): void;
  forgetOpened(item: RecentItem): void;
  clearHistory(): void;
  /** Results for every page; `results` is this list arranged for the current page and scope. */
  allResults: SearchResult[];
  scope: SearchScope;
  setScope(scope: SearchScope): void;
  /** The current page, or null when it shows nothing searchable. */
  page: SearchPage | null;
  setPage(page: SearchPage | null): void;
  /** Matches of the active query, highlighted on the page while the query is active; null without a query. */
  matches: PageMatches | null;
  /** Closes the list and scrolls to the first match on the page. */
  showOnPage(): void;
}

const SearchContext = createContext<SearchApi | null>(null);

const LOCATED = 'data-located';

/** The element of an item on the current page: card, row, epic or sprint header. */
function elementOf(kind: SearchResult['kind'], id: string): HTMLElement | null {
  const value = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id.replace(/"/g, '\\"');
  return document.querySelector<HTMLElement>(`main [data-${kind}-id="${value}"]`);
}

/** Removes the mark of the item a search result was last shown at. */
function clearLocated(): void {
  document.querySelectorAll(`[${LOCATED}]`).forEach((element) => element.removeAttribute(LOCATED));
}

/**
 * Marks an item on the page, scrolls it into view and focuses it, so the dialog opened next returns focus to it.
 * The page may still be rendering after a page change, so the element is looked for a few times.
 */
function locate(kind: SearchResult['kind'], id: string, then: () => void, tries = 20): void {
  const element = elementOf(kind, id);
  if (!element) {
    if (tries > 0) window.setTimeout(() => locate(kind, id, then, tries - 1), 25);
    else then();
    return;
  }
  clearLocated();
  element.setAttribute(LOCATED, 'true');
  element.scrollIntoView?.({ block: 'center', inline: 'center' });
  if (element.tabIndex >= 0) element.focus({ preventScroll: true });
  then();
}

export function useSearch(): SearchApi {
  const value = useContext(SearchContext);
  if (!value) throw new Error('useSearch must be used inside SearchProvider');
  return value;
}

/** Matches of the active search for a page; null without a search or outside the provider. */
export function usePageMatches(): PageMatches | null {
  return useContext(SearchContext)?.matches ?? null;
}

/**
 * A page tells the search what it shows, so results on the page come first and can be highlighted.
 * Pass ids that change only when the page content changes.
 */
export function useSearchPage(label: string, items: { story?: readonly string[]; epic?: readonly string[]; sprint?: readonly string[] }): void {
  const setPage = useContext(SearchContext)?.setPage;
  const key = JSON.stringify([label, items.story ?? [], items.epic ?? [], items.sprint ?? []]);
  useEffect(() => {
    if (!setPage) return;
    const [name, story, epic, sprint] = JSON.parse(key) as [string, string[], string[], string[]];
    setPage({ label: name, items: { story: new Set(story), epic: new Set(epic), sprint: new Set(sprint) } });
    return () => setPage(null);
  }, [key, setPage]);
}

/** Keeps the search: query, results, history and highlighting. Ctrl+F (Cmd+F) focuses the search field from anywhere. */
export function SearchProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const details = useDetails();
  const snapshot = useMemo<Snapshot>(
    () => ({ epics: app.epics, sprints: app.sprints, stories: app.stories, fields: app.fields, assignments: app.assignments }),
    [app.epics, app.sprints, app.stories, app.fields, app.assignments]
  );
  const labels = useSearchLabels(snapshot);
  const [query, setQuery] = useState<SearchQuery>(EMPTY_QUERY);
  const [open, setOpen] = useState(false);
  const [returnKey, setReturnKey] = useState<string | null>(null);
  const [history, setHistory] = useState<SearchHistory>(loadHistory);
  const [scope, setScopeState] = useState<SearchScope>(loadScope);
  const [page, setPage] = useState<SearchPage | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const allResults = useMemo(() => search(snapshot, query), [snapshot, query]);
  const results = useMemo(() => arrangeForPage(allResults, page?.items ?? null, scope === 'page'), [allResults, page, scope]);

  const setScope = useCallback((next: SearchScope) => {
    setScopeState(next);
    try {
      window.localStorage.setItem(SCOPE_KEY, next);
    } catch {
      // the choice just will not be remembered
    }
  }, []);

  const changeHistory = useCallback((change: (history: SearchHistory) => SearchHistory) => {
    setHistory((current) => {
      const next = change(current);
      if (next !== current) saveHistory(next);
      return next;
    });
  }, []);

  // Everything opened in a detail dialog counts as recently opened, also from the board or the map.
  const current = details.current;
  useEffect(() => {
    if (current) changeHistory((history) => rememberOpened(history, current));
  }, [current, changeHistory]);

  const focus = useCallback((options: { select?: boolean } = {}) => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (options.select) input.select();
    setOpen(true);
  }, []);

  const closeDetails = details.close;
  const hasDetail = current !== null;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'f') return;
      event.preventDefault();
      if (hasDetail) {
        // The page behind a modal dialog cannot take focus, so the dialog closes first.
        closeDetails();
        window.setTimeout(() => focus({ select: true }), 0);
      } else {
        focus({ select: true });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focus, hasDetail, closeDetails]);

  const openDetail = details.open;
  /** Shows an item where it is: on this page if it is here, else on the first page that shows it; then runs `then`. */
  const reveal = useCallback(
    (kind: SearchResult['kind'], id: string, then: () => void) => {
      const current = parseHash(window.location.hash).name;
      const view = viewFor(current, whereShown(snapshot, kind, id, todayIso()));
      if (view && view !== current) window.location.hash = hrefs[view];
      locate(kind, id, then);
    },
    [snapshot]
  );

  const openAt = useCallback(
    (list: SearchResult[], index: number, label: string) => {
      const result = list[index];
      if (!result) return;
      setReturnKey(`${result.kind}:${result.id}`);
      reveal(result.kind, result.id, () => openDetail(result.kind, result.id, {
        label,
        position: index + 1,
        total: list.length,
        previous: index > 0 ? () => openAt(list, index - 1, label) : null,
        next: index < list.length - 1 ? () => openAt(list, index + 1, label) : null,
        back: () => {
          closeDetails();
          window.setTimeout(() => focus(), 0);
        }
      }));
    },
    [reveal, openDetail, closeDetails, focus]
  );

  const openResult = useCallback(
    (index: number) => {
      changeHistory((history) => rememberSearch(history, query));
      setOpen(false);
      openAt(results, index, labels.query(query));
    },
    [changeHistory, query, results, openAt, labels]
  );

  const openRecent = useCallback(
    (item: RecentItem) => {
      setOpen(false);
      setReturnKey(null);
      reveal(item.kind, item.id, () => openDetail(item.kind, item.id));
    },
    [reveal, openDetail]
  );

  useEffect(() => {
    if (!isActive(query)) clearLocated();
  }, [query]);

  const matches = useMemo<PageMatches | null>(() => {
    if (!isActive(query)) return null;
    const ids = (kind: SearchResult['kind']): Set<string> =>
      new Set(allResults.filter((result) => result.kind === kind).map((result) => result.id));
    return {
      ids: { story: ids('story'), epic: ids('epic'), sprint: ids('sprint') },
      label: labels.query(query),
      clear: () => setQuery(EMPTY_QUERY)
    };
  }, [query, allResults, labels]);

  const showOnPage = useCallback(() => {
    changeHistory((history) => rememberSearch(history, query));
    setOpen(false);
    inputRef.current?.blur();
    window.setTimeout(() => document.querySelector('main [class*="--match"]')?.scrollIntoView?.({ block: 'center' }), 0);
  }, [changeHistory, query]);

  const api = useMemo<SearchApi>(
    () => ({
      snapshot,
      labels,
      query,
      setQuery,
      results,
      open,
      setOpen,
      inputRef,
      focus,
      returnKey,
      openResult,
      openRecent,
      history,
      forgetSearch: (index) => changeHistory((history) => forgetSearchIn(history, index)),
      forgetOpened: (item) => changeHistory((history) => forgetOpenedIn(history, item)),
      clearHistory: () => changeHistory(() => EMPTY_HISTORY),
      allResults,
      scope,
      setScope,
      page,
      setPage,
      matches,
      showOnPage
    }),
    [snapshot, labels, query, results, open, focus, returnKey, openResult, openRecent, history, changeHistory, allResults, scope, setScope, page, matches, showOnPage]
  );

  return <SearchContext.Provider value={api}>{children}</SearchContext.Provider>;
}
