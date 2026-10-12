import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EMPTY_QUERY,
  fieldToken,
  groupResults,
  isActive,
  isOnPage,
  matchFields,
  matchValues,
  relaxations,
  removeFilter,
  resolveField,
  setFilter,
  splitFieldToken,
  tokenize,
  type FieldEntry,
  type Filter,
  type FilterField,
  type ResultKind,
  type Token
} from '../../domain/search';
import type { RecentItem } from '../../domain/searchHistory';
import { useSearch } from '../../state/Search';
import { ResultRow } from './ResultRow';

/** Results shown per group before "+ n more". */
export const GROUP_LIMIT = 5;

type Entry =
  | { key: string; type: 'field'; entry: FieldEntry; used: boolean }
  | { key: string; type: 'value'; entry: FieldEntry; value: string; label: string }
  | { key: string; type: 'result'; index: number }
  | { key: string; type: 'more'; kind: ResultKind; hidden: number }
  | { key: string; type: 'history'; index: number }
  | { key: string; type: 'recent'; item: RecentItem }
  | { key: string; type: 'relax'; field: FilterField; count: number }
  | { key: string; type: 'reset' }
  | { key: string; type: 'widen'; count: number };

interface Section {
  id: string;
  label: string;
  count?: number;
  entries: Entry[];
}

/** What the word at the cursor can be completed to: a field name, or a value of a field. */
type Completion =
  | { mode: 'fields'; token: Token | null; options: FieldEntry[]; explicit: boolean }
  | { mode: 'values'; token: Token; entry: FieldEntry; options: FieldEntry['values'] }
  | null;

/** The word the cursor is in or right after. */
function tokenAt(text: string, caret: number): Token | null {
  return tokenize(text).find((token) => token.start <= caret && caret <= token.end) ?? null;
}

/** Text without the given range, with the spaces around it tidied up. */
function cut(text: string, start: number, end: number): { text: string; caret: number } {
  const before = text.slice(0, start).replace(/\s+$/, '');
  const after = text.slice(end).replace(/^\s+/, '');
  const joined = before && after ? `${before} ${after}` : `${before}${after}`;
  return { text: joined, caret: before.length + (before && after ? 1 : 0) };
}

const isMac = (): boolean => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * The search in the header: free text and filter chips in one field, results in a dropdown.
 * Focus stays in the field; arrow keys move through the results, Enter opens one.
 */
export function SearchBox() {
  const { t } = useTranslation();
  const search = useSearch();
  const uid = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<ResultKind>>(new Set());
  const [caret, setCaret] = useState(0);
  // Ctrl+Space asks for the field list for the word at the cursor.
  const [forceFields, setForceFields] = useState(false);
  const pendingCaret = useRef<number | null>(null);
  // The field stays on one line: badges that do not fit are cut off and counted.
  const badgesRef = useRef<HTMLDivElement>(null);
  const [hiddenBadges, setHiddenBadges] = useState(0);
  const { query, results, history, snapshot, labels, open, page, scope, effective, parsed } = search;
  const searching = isActive(effective) || query.text.trim() !== '';
  const usedFields = new Set(effective.filters.map((filter) => filter.field));

  const completion = useMemo<Completion>(() => {
    const token = tokenAt(query.text, caret);
    if (token?.raw.startsWith('@')) {
      const typed = token.raw.slice(1);
      return { mode: 'fields', token, options: typed ? matchFields(typed, labels.catalog) : labels.catalog, explicit: true };
    }
    const parts = token ? splitFieldToken(token.raw) : null;
    if (token && parts) {
      const entry = resolveField(parts.name, labels.catalog);
      return entry ? { mode: 'values', token, entry, options: matchValues(parts.value, entry) } : null;
    }
    if (forceFields)
      return { mode: 'fields', token, options: token ? matchFields(token.raw, labels.catalog) : labels.catalog, explicit: true };
    if (token && token.raw.length >= 2) {
      const options = matchFields(token.raw, labels.catalog);
      if (options.length > 0) return { mode: 'fields', token, options, explicit: false };
    }
    return null;
  }, [query.text, caret, forceFields, labels.catalog]);
  const listboxId = `${uid}-listbox`;
  const optionId = (key: string): string => `${uid}-option-${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  const recent = history.opened.filter((item) =>
    item.kind === 'story'
      ? snapshot.stories.some((story) => story.id === item.id)
      : item.kind === 'epic'
        ? snapshot.epics.some((epic) => epic.id === item.id)
        : snapshot.sprints.some((sprint) => sprint.id === item.id)
  );

  const sections = useMemo<Section[]>(() => {
    if (!searching && !completion) {
      const list: Section[] = [];
      if (history.searches.length > 0)
        list.push({
          id: 'history',
          label: t('search.recentSearches'),
          entries: history.searches.map((_, index) => ({ key: `history:${index}`, type: 'history', index }))
        });
      if (recent.length > 0)
        list.push({
          id: 'recent',
          label: t('search.recentlyOpened'),
          entries: recent.map((item) => ({ key: `recent:${item.kind}:${item.id}`, type: 'recent', item }))
        });
      return list;
    }
    const list: Section[] = [];
    if (completion?.mode === 'fields' && completion.options.length > 0)
      list.push({
        id: 'fields',
        label: t('search.fieldsGroup'),
        entries: completion.options.map((entry) => ({
          key: `field:${entry.key}`,
          type: 'field',
          entry,
          used: usedFields.has(entry.key) && !(completion.token && splitFieldToken(completion.token.raw))
        }))
      });
    if (completion?.mode === 'values' && completion.options.length > 0)
      list.push({
        id: 'values',
        label: completion.entry.label,
        entries: completion.options.map((option) => ({
          key: `value:${completion.entry.key}:${option.value}`,
          type: 'value',
          entry: completion.entry,
          value: option.value,
          label: option.label
        }))
      });
    for (const group of groupResults(results)) {
      const limit = expanded.has(group.kind) ? group.results.length : GROUP_LIMIT;
      const entries: Entry[] = group.results.slice(0, limit).map((result) => ({
        key: `${result.kind}:${result.id}`,
        type: 'result',
        index: results.indexOf(result)
      }));
      if (group.results.length > limit)
        entries.push({ key: `more:${group.kind}`, type: 'more', kind: group.kind, hidden: group.results.length - limit });
      list.push({ id: group.kind, label: t(`search.group.${group.kind}`), count: group.results.length, entries });
    }
    if (results.length === 0 && isActive(effective)) {
      const elsewhere = search.allResults.length;
      const entries: Entry[] = elsewhere > 0 ? [{ key: 'widen', type: 'widen', count: elsewhere }] : [];
      entries.push(...relaxations(snapshot, effective).map((item) => ({
        key: `relax:${item.field}`,
        type: 'relax',
        field: item.field,
        count: item.count
      } as Entry)));
      entries.push({ key: 'reset', type: 'reset' });
      list.push({ id: 'empty', label: t('search.noResults'), entries });
    }
    return list;
    // `recent` is derived from history and snapshot, which are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching, completion, history, snapshot, query, effective, results, search.allResults, expanded, labels, t]);

  const entries = useMemo(() => sections.flatMap((section) => section.entries), [sections]);
  const activeEntry = entries.find((entry) => entry.key === active) ?? null;

  // Keep a valid marked entry: the result last opened when coming back, otherwise the first result.
  useEffect(() => {
    if (active && entries.some((entry) => entry.key === active)) return;
    const back = search.returnKey && entries.find((entry) => entry.key === search.returnKey);
    // Asked for fields (@, Ctrl+Space) or typing a value: the first suggestion. Otherwise results come first.
    const explicit = completion?.mode === 'values' || (completion?.mode === 'fields' && completion.explicit);
    const suggestion = entries.find((entry) => entry.type === 'value' || (entry.type === 'field' && !entry.used));
    const first =
      (explicit ? suggestion : undefined) ??
      entries.find((entry) => entry.type === 'result' || entry.type === 'history' || entry.type === 'recent') ??
      entries[0];
    setActive((back || first)?.key ?? null);
    // Only a change of the entries needs a new choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  // Coming back from a result that was opened (also after stepping through results): mark that result.
  useEffect(() => {
    if (search.returnKey && entries.some((entry) => entry.key === search.returnKey)) setActive(search.returnKey);
    // Only a new return target matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.returnKey]);

  // Close when a click lands outside the search.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (!wrapper.current?.contains(event.target as Node)) {
        search.setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, search]);

  useEffect(() => {
    if (!active || !open) return;
    document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
    // optionId only depends on uid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  useLayoutEffect(() => {
    const box = badgesRef.current;
    if (!box) {
      if (hiddenBadges !== 0) setHiddenBadges(0);
      return;
    }
    const right = box.getBoundingClientRect().right;
    const hidden = Array.from(box.children).filter((child) => child.getBoundingClientRect().right > right + 1).length;
    if (hidden !== hiddenBadges) setHiddenBadges(hidden);
  });

  // Put the cursor where an edit of the text wants it, once the new text is rendered.
  useEffect(() => {
    const input = search.inputRef.current;
    if (pendingCaret.current === null || !input) return;
    input.setSelectionRange(pendingCaret.current, pendingCaret.current);
    setCaret(pendingCaret.current);
    pendingCaret.current = null;
  });

  const setQuery = (next: typeof query, nextCaret?: number): void => {
    search.setQuery(next);
    setExpanded(new Set());
    setForceFields(false);
    if (nextCaret !== undefined) pendingCaret.current = nextCaret;
    search.setOpen(true);
  };

  /** Replaces the word at the cursor (or inserts at the cursor) and puts the cursor behind the new text. */
  const replaceToken = (token: Token | null, insert: string): void => {
    const start = token ? token.start : caret;
    const end = token ? token.end : caret;
    const text = query.text.slice(0, start) + insert + query.text.slice(end);
    setQuery({ ...query, text }, start + insert.length);
  };

  /** Turns a typed filter into a badge: the word leaves the text, the badge replaces one of the same field. */
  const toBadge = (token: Token, filter: Filter): void => {
    const rest = cut(query.text, token.start, token.end);
    setQuery({ text: rest.text, filters: setFilter(query.filters, filter) }, rest.caret);
  };

  /** Removes a filter, as badge and as typed text. */
  const dropFilter = (field: FilterField): void => {
    let text = query.text;
    for (const item of [...parsed.resolved].reverse()) {
      if (item.filter.field === field) text = cut(text, item.token.start, item.token.end).text;
    }
    setQuery({ text, filters: removeFilter(query.filters, field) }, text.length);
  };

  const focusInput = (): void => {
    search.inputRef.current?.focus();
  };

  const pageMatches = page ? results.filter((result) => isOnPage(result, page.items)).length : 0;

  const activate = (entry: Entry): void => {
    switch (entry.type) {
      case 'field':
        if (entry.used) return;
        replaceToken(completion?.token ?? null, fieldToken(entry.entry));
        focusInput();
        return;
      case 'value':
        if (completion?.mode === 'values') toBadge(completion.token, { field: entry.entry.key, value: entry.value });
        focusInput();
        return;
      case 'result':
        search.openResult(entry.index);
        return;
      case 'more': {
        const next = new Set(expanded);
        next.add(entry.kind);
        setExpanded(next);
        // Mark the first result that was hidden.
        const group = results.filter((result) => result.kind === entry.kind);
        const firstHidden = group[GROUP_LIMIT];
        if (firstHidden) setActive(`${firstHidden.kind}:${firstHidden.id}`);
        focusInput();
        return;
      }
      case 'history':
        setQuery(history.searches[entry.index]);
        focusInput();
        return;
      case 'recent':
        search.openRecent(entry.item);
        return;
      case 'relax':
        dropFilter(entry.field);
        focusInput();
        return;
      case 'reset':
        setQuery(EMPTY_QUERY);
        focusInput();
        return;
      case 'widen':
        search.setScope('all');
        focusInput();
        return;
    }
  };

  const move = (step: number): void => {
    if (entries.length === 0) return;
    const index = entries.findIndex((entry) => entry.key === active);
    const next = index === -1 ? (step > 0 ? 0 : entries.length - 1) : (index + step + entries.length) % entries.length;
    setActive(entries[next].key);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const input = event.currentTarget;
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) search.setOpen(true);
      else move(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        if (searching) search.showOnPage();
        return;
      }
      if (open && activeEntry) activate(activeEntry);
      return;
    }
    if (event.key === ' ' && event.ctrlKey) {
      event.preventDefault();
      setForceFields(true);
      search.setOpen(true);
      return;
    }
    if (event.key === 'Tab' && !event.shiftKey && open && completion) {
      const suggestion =
        activeEntry?.type === 'field' || activeEntry?.type === 'value'
          ? activeEntry
          : entries.find((entry) => entry.type === 'value' || (entry.type === 'field' && !entry.used));
      if (suggestion) {
        event.preventDefault();
        activate(suggestion);
      }
      return;
    }
    if (event.key === ' ' && !event.ctrlKey) {
      // A finished field:value becomes a badge when the next word starts.
      const token = tokenAt(query.text, input.selectionStart ?? caret);
      const done = token && (token.raw.match(/"/g)?.length ?? 0) % 2 === 0 && parsed.resolved.find((item) => item.token.start === token.start);
      if (token && done && input.selectionStart === token.end) {
        event.preventDefault();
        toBadge(token, done.filter);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (forceFields) setForceFields(false);
      else if (open) search.setOpen(false);
      else if (query.text || query.filters.length > 0) search.setQuery(EMPTY_QUERY);
      else input.blur();
      return;
    }
    if (event.key === 'Delete' && open && activeEntry) {
      if (activeEntry.type === 'history') {
        event.preventDefault();
        search.forgetSearch(activeEntry.index);
      } else if (activeEntry.type === 'recent') {
        event.preventDefault();
        search.forgetOpened(activeEntry.item);
      }
      return;
    }
    if (event.key === 'Backspace' && atStart && query.filters.length > 0) {
      // One Backspace right after the badges removes the last badge completely.
      event.preventDefault();
      setQuery({ ...query, filters: query.filters.slice(0, -1) }, 0);
    }
  };

  const renderEntry = (entry: Entry): ReactNode => {
    const common = {
      id: optionId(entry.key),
      role: 'option' as const,
      'aria-selected': entry.key === active,
      className: `search-option search-option--${entry.type}${entry.key === active ? ' search-option--active' : ''}`,
      onMouseDown: (event: React.MouseEvent) => event.preventDefault(),
      onMouseMove: () => entry.key !== active && setActive(entry.key),
      onClick: () => activate(entry)
    };
    switch (entry.type) {
      case 'field':
        return (
          <li key={entry.key} {...common} aria-disabled={entry.used || undefined}>
            <span className="result__icon result__icon--accent" aria-hidden="true">
              @
            </span>
            <span className="result__main">
              <span className="result__title">{entry.entry.label}</span>
            </span>
            {entry.used ? (
              <span className="result__kind">{t('search.fieldUsed')}</span>
            ) : (
              <span className="search-option__syntax">{fieldToken(entry.entry)}</span>
            )}
          </li>
        );
      case 'value':
        return (
          <li key={entry.key} {...common}>
            <span className="result__icon result__icon--accent" aria-hidden="true">
              =
            </span>
            <span className="result__main">
              <span className="result__title">{entry.label}</span>
            </span>
            <kbd aria-hidden="true">Tab</kbd>
          </li>
        );
      case 'result': {
        const result = results[entry.index];
        return (
          <li key={entry.key} {...common}>
            <ResultRow result={result} snapshot={snapshot} onPage={scope === 'all' && page ? isOnPage(result, page.items) : false} />
          </li>
        );
      }
      case 'more':
        return (
          <li key={entry.key} {...common}>
            <span className="search-option__more">{t(`search.more.${entry.kind}`, { count: entry.hidden })}</span>
          </li>
        );
      case 'history': {
        const item = history.searches[entry.index];
        return (
          <li key={entry.key} {...common}>
            <span className="result__icon result__icon--outline" aria-hidden="true">
              ↺
            </span>
            <span className="result__main">
              <span className="result__title search-option__history">
                {item.text.trim() && <span>{item.text.trim()}</span>}
                {item.filters.map((filter) => (
                  <span key={filter.field} className="search-chip search-chip--static">
                    {labels.badge(filter)}
                  </span>
                ))}
              </span>
            </span>
            <span
              className="search-option__forget"
              aria-hidden="true"
              title={t('search.forget')}
              onClick={(event) => {
                event.stopPropagation();
                search.forgetSearch(entry.index);
              }}
            >
              ✕
            </span>
          </li>
        );
      }
      case 'recent': {
        const { item } = entry;
        const result =
          item.kind === 'story'
            ? { kind: 'story' as const, id: item.id, story: snapshot.stories.find((s) => s.id === item.id)!, codeRanges: [], titleRanges: [], snippet: null }
            : item.kind === 'epic'
              ? { kind: 'epic' as const, id: item.id, epic: snapshot.epics.find((e) => e.id === item.id)!, nameRanges: [] }
              : { kind: 'sprint' as const, id: item.id, sprint: snapshot.sprints.find((s) => s.id === item.id)!, nameRanges: [] };
        return (
          <li key={entry.key} {...common}>
            <ResultRow result={result} snapshot={snapshot} />
            <span
              className="search-option__forget"
              aria-hidden="true"
              title={t('search.forget')}
              onClick={(event) => {
                event.stopPropagation();
                search.forgetOpened(item);
              }}
            >
              ✕
            </span>
          </li>
        );
      }
      case 'relax': {
        const filter = effective.filters.find((item) => item.field === entry.field);
        return (
          <li key={entry.key} {...common}>
            <span className="search-option__action">
              {t('search.withoutFilter', { filter: filter ? labels.badge(filter) : labels.field(entry.field) })}
            </span>
            <span className="pill">{t('search.resultCount', { count: entry.count })}</span>
          </li>
        );
      }
      case 'reset':
        return (
          <li key={entry.key} {...common}>
            <span className="search-option__action">{t('search.reset')}</span>
          </li>
        );
      case 'widen':
        return (
          <li key={entry.key} {...common}>
            <span className="search-option__action">{t('search.searchEverywhere')}</span>
            <span className="pill">{t('search.resultCount', { count: entry.count })}</span>
          </li>
        );
    }
  };

  const status = !searching
    ? ''
    : results.length === 0
      ? t('search.noResultsStatus')
      : t('search.resultCount', { count: results.length });
  const shortcut = isMac() ? '⌘F' : 'Ctrl+F';
  const hasContent = query.text.length > 0 || query.filters.length > 0;

  return (
    <div
      ref={wrapper}
      className={`search${open ? ' search--open' : ''}`}
      role="search"
      onBlur={(event) => {
        // Focus left the search: close the dropdown.
        const next = event.relatedTarget as Node | null;
        if (next && !wrapper.current?.contains(next)) {
          search.setOpen(false);
        }
      }}
    >
      <div className="search__field" onMouseDown={(event) => event.target === event.currentTarget && event.preventDefault()} onClick={focusInput}>
        <svg className="search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        {query.filters.length > 0 && (
          <div className="search__badges" ref={badgesRef}>
          {query.filters.map((filter) => (
            <span key={filter.field} className="search-chip">
              <span className="search-chip__field">{labels.field(filter.field)}</span>
              <span className="search-chip__op" aria-hidden="true">
                =
              </span>
              <span className="search-chip__value">{labels.value(filter.field, filter.value)}</span>
              <button
                type="button"
                className="search-chip__remove"
                aria-label={t('search.removeFilter', { filter: labels.badge(filter) })}
                title={t('search.removeFilter', { filter: labels.badge(filter) })}
                onClick={(event) => {
                  event.stopPropagation();
                  setQuery({ ...query, filters: removeFilter(query.filters, filter.field) });
                  focusInput();
                }}
              >
                ✕
              </button>
            </span>
          ))}
          </div>
        )}
        {hiddenBadges > 0 && (
          <span
            className="search__more-badges"
            aria-label={t('search.moreBadges', { count: hiddenBadges })}
            title={query.filters.slice(query.filters.length - hiddenBadges).map(labels.badge).join(', ')}
          >
            +{hiddenBadges}
          </span>
        )}
        <input
          ref={search.inputRef}
          className="search__input"
          type="text"
          role="combobox"
          aria-label={t('search.label')}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={open && active ? optionId(active) : undefined}
          aria-keyshortcuts="Control+F Meta+F"
          placeholder={query.filters.length > 0 ? t('search.placeholderMore') : t('search.placeholder')}
          value={query.text}
          spellCheck={false}
          autoComplete="off"
          onFocus={() => search.setOpen(true)}
          onChange={(event) => {
            setCaret(event.target.selectionStart ?? event.target.value.length);
            setQuery({ ...query, text: event.target.value });
          }}
          onSelect={(event) => setCaret(event.currentTarget.selectionStart ?? 0)}
          onKeyDown={onInputKeyDown}
        />
        {hasContent ? (
          <button
            type="button"
            className="search__clear"
            aria-label={t('search.clear')}
            title={t('search.clear')}
            onClick={(event) => {
              event.stopPropagation();
              setQuery(EMPTY_QUERY);
              focusInput();
            }}
          >
            ✕
          </button>
        ) : (
          !open && (
            <kbd className="search__shortcut" aria-hidden="true">
              {shortcut}
            </kbd>
          )
        )}
      </div>

      {open && (
        <div className="search__dropdown">
          {parsed.problems.length > 0 && (
            <div className="search__problems" role="note">
              {parsed.problems.map((problem, index) => (
                <p key={index}>
                  {problem.kind === 'field'
                    ? t('search.problemField', { name: problem.name })
                    : t('search.problemValue', { value: problem.value, field: problem.field.label })}
                </p>
              ))}
            </div>
          )}

          {page && (
            <fieldset className="segmented search__scope">
              <legend className="sr-only">{t('search.scopeLabel')}</legend>
              <label className={scope === 'all' ? 'segmented__on' : undefined}>
                <input type="radio" name={`${uid}-scope`} checked={scope === 'all'} onChange={() => search.setScope('all')} />
                {t('search.everywhere')}
              </label>
              <label className={scope === 'page' ? 'segmented__on' : undefined}>
                <input type="radio" name={`${uid}-scope`} checked={scope === 'page'} onChange={() => search.setScope('page')} />
                {t('search.onlyPage', { page: page.label })}
              </label>
            </fieldset>
          )}

          <ul id={listboxId} className="search__list" role="listbox" aria-label={t('search.results')}>
            {sections.map((section) => (
              <li key={section.id} role="presentation">
                <div className="search__group" aria-hidden="true">
                  <span>{section.label}</span>
                  {section.count !== undefined && <span>{section.count}</span>}
                </div>
                <ul role="group" aria-label={section.label} className="search__group-list">
                  {section.entries.map(renderEntry)}
                </ul>
              </li>
            ))}
            {!searching && sections.length === 0 && (
              <li role="presentation" className="search__hint">
                {t('search.emptyHint')}
              </li>
            )}
          </ul>

          <div className="search__footer">
            <span aria-hidden="true">
              <kbd>↑</kbd>
              <kbd>↓</kbd> {t('search.keys.move')}
            </span>
            <span aria-hidden="true">
              <kbd>Enter</kbd> {t('search.keys.open')}
            </span>
            <span aria-hidden="true">
              <kbd>@</kbd> {t('search.keys.fields')}
            </span>
            <span aria-hidden="true">
              <kbd>Esc</kbd> {t('search.keys.close')}
            </span>
            {!searching && history.searches.length + recent.length > 0 && (
              <button type="button" className="link-button" onClick={() => search.clearHistory()}>
                {t('search.clearHistory')}
              </button>
            )}
            {searching && page && pageMatches > 0 && (
              <button type="button" className="link-button search__highlight" onClick={search.showOnPage}>
                {t('search.showOnPage', { page: page.label })} <kbd aria-hidden="true">{isMac() ? '⌘' : 'Ctrl'}+Enter</kbd>
              </button>
            )}
          </div>
        </div>
      )}
      <div role="status" className="sr-only">
        {open ? status : ''}
      </div>
    </div>
  );
}
