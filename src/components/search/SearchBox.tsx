import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EMPTY_QUERY,
  addFilterValue,
  groupResults,
  isActive,
  relaxations,
  removeFilter,
  suggestFilters,
  type FilterField,
  type FilterSuggestion,
  type ResultKind,
  isOnPage
} from '../../domain/search';
import type { RecentItem } from '../../domain/searchHistory';
import { useSearch } from '../../state/Search';
import { FieldMenu, FilterMenu } from './FilterMenu';
import { ResultRow } from './ResultRow';

/** Results shown per group before "+ n more". */
export const GROUP_LIMIT = 5;

type Entry =
  | { key: string; type: 'suggestion'; suggestion: FilterSuggestion }
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

type Menu = { field: FilterField | 'more'; trigger: HTMLElement | null } | null;

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
  const [menu, setMenu] = useState<Menu>(null);
  const [markedChip, setMarkedChip] = useState<number | null>(null);
  const { query, results, history, snapshot, labels, open, page, scope } = search;
  const searching = isActive(query);
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
    if (!searching) {
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
    const suggestions = suggestFilters(query.text, query.filters, labels.suggestions);
    if (suggestions.length > 0)
      list.push({
        id: 'suggestions',
        label: t('search.useAsFilter'),
        entries: suggestions.map((suggestion) => ({
          key: `suggestion:${suggestion.field}:${suggestion.value}`,
          type: 'suggestion',
          suggestion
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
    if (results.length === 0) {
      const elsewhere = search.allResults.length;
      const entries: Entry[] = elsewhere > 0 ? [{ key: 'widen', type: 'widen', count: elsewhere }] : [];
      entries.push(...relaxations(snapshot, query).map((item) => ({
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
  }, [searching, history, snapshot, query, results, search.allResults, expanded, labels, t]);

  const entries = useMemo(() => sections.flatMap((section) => section.entries), [sections]);
  const activeEntry = entries.find((entry) => entry.key === active) ?? null;

  // Keep a valid marked entry: the result last opened when coming back, otherwise the first result.
  useEffect(() => {
    if (active && entries.some((entry) => entry.key === active)) return;
    const back = search.returnKey && entries.find((entry) => entry.key === search.returnKey);
    // Results come first; without results a filter suggestion is the most likely next step.
    const first = entries.find((entry) => entry.type === 'result' || entry.type === 'history' || entry.type === 'recent') ?? entries[0];
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
        setMenu(null);
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

  const setQuery = (next: typeof query): void => {
    search.setQuery(next);
    setExpanded(new Set());
    setMarkedChip(null);
    search.setOpen(true);
  };

  const focusInput = (): void => {
    search.inputRef.current?.focus();
  };

  const pageMatches = page ? results.filter((result) => isOnPage(result, page.items)).length : 0;

  const activate = (entry: Entry): void => {
    switch (entry.type) {
      case 'suggestion':
        setQuery({ text: '', filters: addFilterValue(query.filters, entry.suggestion.field, entry.suggestion.value) });
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
        setQuery({ ...query, filters: removeFilter(query.filters, entry.field) });
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
    if (event.key === 'Tab' && !event.shiftKey && open) {
      const suggestion =
        activeEntry?.type === 'suggestion' ? activeEntry : entries.find((entry) => entry.type === 'suggestion');
      if (suggestion) {
        event.preventDefault();
        activate(suggestion);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (menu) setMenu(null);
      else if (open) search.setOpen(false);
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
    if ((event.key === 'Backspace' || event.key === 'ArrowLeft') && atStart && query.filters.length > 0) {
      const last = query.filters.length - 1;
      if (event.key === 'Backspace' && markedChip !== null) {
        event.preventDefault();
        setQuery({ ...query, filters: query.filters.filter((_, index) => index !== markedChip) });
        return;
      }
      if (event.key === 'Backspace' || markedChip === null) {
        event.preventDefault();
        setMarkedChip(markedChip === null ? last : Math.max(0, markedChip - 1));
        return;
      }
      event.preventDefault();
      setMarkedChip(Math.max(0, markedChip - 1));
      return;
    }
    if (markedChip !== null) setMarkedChip(null);
  };

  const openMenu = (field: FilterField | 'more', trigger: HTMLElement | null): void => {
    setMenu((current) => (current?.field === field ? null : { field, trigger }));
  };

  const closeMenu = (toInput: boolean): void => {
    const trigger = menu?.trigger;
    setMenu(null);
    if (toInput || !trigger?.isConnected) focusInput();
    else trigger.focus();
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
      case 'suggestion':
        return (
          <li key={entry.key} {...common}>
            <span className="result__icon result__icon--accent" aria-hidden="true">
              ⇥
            </span>
            <span className="result__main">
              <span className="result__title">
                {labels.field(entry.suggestion.field)} = <strong>{entry.suggestion.label}</strong>
              </span>
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
                  <span key={filter.field} className={`search-chip search-chip--static${filter.negate ? ' search-chip--not' : ''}`}>
                    {labels.chip(filter)}
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
        const filter = query.filters.find((item) => item.field === entry.field);
        return (
          <li key={entry.key} {...common}>
            <span className="search-option__action">
              {t('search.withoutFilter', { filter: filter ? labels.chip(filter) : labels.field(entry.field) })}
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
          setMenu(null);
        }
      }}
    >
      <div className="search__field" onMouseDown={(event) => event.target === event.currentTarget && event.preventDefault()} onClick={focusInput}>
        <svg className="search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        {query.filters.map((filter, index) => (
          <span
            key={filter.field}
            className={`search-chip${filter.negate ? ' search-chip--not' : ''}${markedChip === index ? ' search-chip--marked' : ''}`}
          >
            <button
              type="button"
              className="search-chip__label"
              aria-label={t('search.editFilter', { filter: labels.chip(filter) })}
              onClick={(event) => {
                event.stopPropagation();
                search.setOpen(true);
                openMenu(filter.field, event.currentTarget);
              }}
            >
              {labels.chip(filter)}
            </button>
            <button
              type="button"
              className="search-chip__remove"
              aria-label={t('search.removeFilter', { filter: labels.chip(filter) })}
              title={t('search.removeFilter', { filter: labels.chip(filter) })}
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
          onChange={(event) => setQuery({ ...query, text: event.target.value })}
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
          <div className="search__filters" role="toolbar" aria-label={t('search.filters')}>
            {(['status', 'epic', 'sprint'] as const).map((field) => {
              const used = query.filters.some((filter) => filter.field === field);
              return (
                <button
                  key={field}
                  type="button"
                  className={`filter-button${used ? ' filter-button--used' : ''}`}
                  aria-expanded={menu?.field === field}
                  onClick={(event) => openMenu(field, event.currentTarget)}
                >
                  {labels.field(field)} <span aria-hidden="true">▾</span>
                </button>
              );
            })}
            <button
              type="button"
              className="filter-button filter-button--more"
              aria-expanded={menu?.field === 'more'}
              onClick={(event) => openMenu('more', event.currentTarget)}
            >
              + {t('search.moreFilters')}
            </button>
          </div>

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

          {menu?.field === 'more' && (
            <FieldMenu onPick={(field) => setMenu({ field, trigger: menu.trigger })} onClose={() => closeMenu(false)} />
          )}
          {menu && menu.field !== 'more' && <FilterMenu key={menu.field} field={menu.field} onClose={closeMenu} />}

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
