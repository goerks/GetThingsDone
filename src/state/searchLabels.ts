import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FILTER_FIELDS,
  NOT_PLANNED,
  NO_EPIC,
  fieldValues,
  type Filter,
  type FilterField,
  type FilterSuggestion,
  type SearchQuery
} from '../domain/search';
import type { Snapshot } from '../domain/types';

export interface SearchLabels {
  field(field: FilterField): string;
  value(field: FilterField, value: string): string;
  /** "Status: In progress or Review", "Status is not Done". */
  chip(filter: Filter): string;
  /** The whole query in one line, for the history and the result bar. */
  query(query: SearchQuery): string;
  /** Names of the values free text can stand for: statuses, epics and sprints. */
  suggestions: FilterSuggestion[];
}

/** Names of search fields and values in the current language. */
export function useSearchLabels(snapshot: Snapshot): SearchLabels {
  const { t } = useTranslation();

  const field = useCallback((name: FilterField) => t(`search.field.${name}`), [t]);

  const value = useCallback(
    (name: FilterField, item: string): string => {
      switch (name) {
        case 'status':
          return t(`status.${item}`);
        case 'epic':
          return item === NO_EPIC ? t('epics.noEpic') : (snapshot.epics.find((epic) => epic.id === item)?.name ?? item);
        case 'sprint':
          return item === NOT_PLANNED ? t('sprint.notPlanned') : (snapshot.sprints.find((sprint) => sprint.id === item)?.name ?? item);
        case 'type':
          return t(`search.kind.${item}`);
        case 'points':
          return t('search.pointsValue', { count: Number(item) });
        case 'criteria':
          return t(`search.criteriaState.${item}`);
        case 'scope':
          return t(`search.scope.${item}`);
      }
    },
    [t, snapshot.epics, snapshot.sprints]
  );

  const chip = useCallback(
    (filter: Filter): string => {
      const values = filter.values.map((item) => value(filter.field, item)).join(` ${t('search.or')} `);
      return filter.negate
        ? t('search.chipNot', { field: field(filter.field), values })
        : t('search.chip', { field: field(filter.field), values });
    },
    [t, field, value]
  );

  const query = useCallback(
    (item: SearchQuery): string => {
      const parts = item.filters.filter((filter) => filter.values.length > 0).map(chip);
      const text = item.text.trim();
      return [text && `«${text}»`, ...parts].filter(Boolean).join(' · ');
    },
    [chip]
  );

  const suggestions = useMemo(
    () =>
      (['status', 'epic', 'sprint'] as const).flatMap((name) =>
        fieldValues(snapshot, name).map((item) => ({ field: name, value: item, label: value(name, item) }))
      ),
    [snapshot, value]
  );

  return useMemo(() => ({ field, value, chip, query, suggestions }), [field, value, chip, query, suggestions]);
}

/** Fields offered under "+ Filter"; the others have their own button. */
export const MORE_FIELDS: FilterField[] = FILTER_FIELDS.filter((name) => !['status', 'epic', 'sprint'].includes(name));
