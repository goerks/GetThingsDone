import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { fieldValues, fold, setFilter, valueCounts, type FilterField } from '../../domain/search';
import { MORE_FIELDS } from '../../state/searchLabels';
import { useSearch } from '../../state/Search';

/** Above this many values, the menu gets a field to narrow the list. */
const NARROW_FROM = 8;

interface Props {
  field: FilterField;
  /** Closes the menu; `toInput` moves focus back to the search field, otherwise to the button that opened it. */
  onClose: (toInput: boolean) => void;
}

/** The values of one field as checkboxes with the number of results, plus "is / is not". Changes apply at once. */
export function FilterMenu({ field, onClose }: Props) {
  const { t } = useTranslation();
  const search = useSearch();
  const uid = useId();
  const [narrow, setNarrow] = useState('');
  const first = useRef<HTMLInputElement>(null);
  const { query, snapshot, labels } = search;
  const filter = query.filters.find((item) => item.field === field);
  const selected = filter?.values ?? [];
  const negate = filter?.negate ?? false;
  const counts = useMemo(() => valueCounts(snapshot, query, field), [snapshot, query, field]);
  const values = fieldValues(snapshot, field);
  const shown = values.filter((value) => !narrow || fold(labels.value(field, value)).includes(fold(narrow)));

  useEffect(() => {
    first.current?.focus();
  }, []);

  const change = (nextValues: string[], nextNegate: boolean): void =>
    search.setQuery({ ...query, filters: setFilter(query.filters, field, nextValues, nextNegate) });

  const toggle = (value: string): void =>
    change(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value], negate);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose(false);
    } else if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT' && (event.target as HTMLInputElement).type !== 'text') {
      event.preventDefault();
      onClose(true);
    }
  };

  return (
    <div className="search-menu" role="dialog" aria-label={t('search.menuLabel', { field: labels.field(field) })} onKeyDown={onKeyDown}>
      {field !== 'scope' && (
        <fieldset className="segmented">
          <legend className="sr-only">{t('search.matchLabel')}</legend>
          <label className={!negate ? 'segmented__on' : undefined}>
            <input
              ref={first}
              type="radio"
              name={`${uid}-negate`}
              checked={!negate}
              onChange={() => change(selected, false)}
            />
            {t('search.is')}
          </label>
          <label className={negate ? 'segmented__on' : undefined}>
            <input type="radio" name={`${uid}-negate`} checked={negate} onChange={() => change(selected, true)} />
            {t('search.isNot')}
          </label>
        </fieldset>
      )}
      {values.length > NARROW_FROM && (
        <input
          className="input search-menu__narrow"
          aria-label={t('search.narrow', { field: labels.field(field) })}
          placeholder={t('search.narrow', { field: labels.field(field) })}
          value={narrow}
          onChange={(event) => setNarrow(event.target.value)}
        />
      )}
      <fieldset className="search-menu__values">
        <legend className="sr-only">{labels.field(field)}</legend>
        {shown.map((value, index) => {
          const count = counts.get(value) ?? 0;
          const checked = selected.includes(value);
          const epic = field === 'epic' ? snapshot.epics.find((item) => item.id === value) : undefined;
          return (
            <label key={value} className={`search-menu__option${count === 0 && !checked ? ' search-menu__option--empty' : ''}`}>
              <input
                ref={field === 'scope' && index === 0 ? first : undefined}
                type="checkbox"
                checked={checked}
                onChange={() => toggle(value)}
              />
              {epic && <span className="epic__dot" style={{ background: `var(--epic-${epic.colorKey})` }} aria-hidden="true" />}
              <span className="search-menu__label">{labels.value(field, value)}</span>
              <span className="search-menu__count" aria-label={t('search.resultCount', { count })}>
                {count}
              </span>
            </label>
          );
        })}
      </fieldset>
      <div className="search-menu__actions">
        {selected.length > 0 && (
          <button type="button" className="btn btn--small" onClick={() => change([], false)}>
            {t('search.removeFilter', { filter: labels.field(field) })}
          </button>
        )}
        <button type="button" className="btn btn--small btn--primary" onClick={() => onClose(true)}>
          {t('search.done')}
        </button>
      </div>
    </div>
  );
}

/** The list behind "+ Filter": fields that have no button of their own. */
export function FieldMenu({ onPick, onClose }: { onPick: (field: FilterField) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const { labels } = useSearch();
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    first.current?.focus();
  }, []);

  return (
    <div
      className="search-menu"
      role="dialog"
      aria-label={t('search.moreFilters')}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <ul className="search-menu__fields">
        {MORE_FIELDS.map((field, index) => (
          <li key={field}>
            <button ref={index === 0 ? first : undefined} type="button" className="search-menu__field" onClick={() => onPick(field)}>
              {labels.field(field)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
