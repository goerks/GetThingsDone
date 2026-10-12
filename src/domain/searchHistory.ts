import { isActive, sameQuery, type ResultKind, type SearchQuery } from './search';

/** How many recent searches and recently opened items are kept. */
export const HISTORY_LIMIT = 5;

export interface RecentItem {
  kind: ResultKind;
  id: string;
}

export interface SearchHistory {
  searches: SearchQuery[];
  opened: RecentItem[];
}

export const EMPTY_HISTORY: SearchHistory = { searches: [], opened: [] };

/** Puts a search first; an equal older search is dropped. Empty searches are not kept. */
export function rememberSearch(history: SearchHistory, query: SearchQuery): SearchHistory {
  if (!isActive(query)) return history;
  const entry: SearchQuery = { text: query.text.trim(), filters: [...query.filters] };
  const rest = history.searches.filter((item) => !sameQuery(item, entry));
  return { ...history, searches: [entry, ...rest].slice(0, HISTORY_LIMIT) };
}

/** Puts an opened item first; the same item further down is dropped. */
export function rememberOpened(history: SearchHistory, item: RecentItem): SearchHistory {
  if (history.opened[0]?.kind === item.kind && history.opened[0]?.id === item.id) return history;
  const rest = history.opened.filter((entry) => !(entry.kind === item.kind && entry.id === item.id));
  return { ...history, opened: [item, ...rest].slice(0, HISTORY_LIMIT) };
}

export function forgetSearch(history: SearchHistory, index: number): SearchHistory {
  return { ...history, searches: history.searches.filter((_, i) => i !== index) };
}

export function forgetOpened(history: SearchHistory, item: RecentItem): SearchHistory {
  return { ...history, opened: history.opened.filter((entry) => !(entry.kind === item.kind && entry.id === item.id)) };
}

/** Reads a stored history and drops anything that does not have the expected shape. */
export function parseHistory(raw: unknown): SearchHistory {
  if (!raw || typeof raw !== 'object') return EMPTY_HISTORY;
  const value = raw as Partial<Record<keyof SearchHistory, unknown>>;
  const searches = Array.isArray(value.searches)
    ? value.searches.filter(
        (item): item is SearchQuery =>
          !!item &&
          typeof item === 'object' &&
          typeof (item as SearchQuery).text === 'string' &&
          Array.isArray((item as SearchQuery).filters) &&
          (item as SearchQuery).filters.every(
            (filter) => !!filter && typeof filter.field === 'string' && typeof filter.value === 'string'
          )
      )
    : [];
  const opened = Array.isArray(value.opened)
    ? value.opened.filter(
        (item): item is RecentItem =>
          !!item &&
          typeof item === 'object' &&
          ['story', 'epic', 'sprint'].includes((item as RecentItem).kind) &&
          typeof (item as RecentItem).id === 'string'
      )
    : [];
  return { searches: searches.slice(0, HISTORY_LIMIT), opened: opened.slice(0, HISTORY_LIMIT) };
}
