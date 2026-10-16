import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import {
  BUILTIN_FILTER_FIELDS,
  NOT_PLANNED,
  NO_ASSIGNEE,
  NO_EPIC,
  TEXT_FILTER_FIELDS,
  customFieldId,
  customFieldKey,
  fieldValues,
  type FieldEntry,
  type Filter,
  type FilterField,
  type SearchQuery
} from '../domain/search';
import type { SearchSnapshot } from '../domain/types';
import { statusLabel } from '../components/statusLabel';

export interface SearchLabels {
  field(field: FilterField): string;
  value(field: FilterField, value: string): string;
  /** "Status = Open". */
  badge(filter: Filter): string;
  /** The whole query in one line, for the history and the result bar. */
  query(query: SearchQuery): string;
  /** All fields that can be typed in the search text, with their names and values. */
  catalog: FieldEntry[];
}

/** Names of search fields and values in the current language; English names work as aliases. */
export function useSearchLabels(snapshot: SearchSnapshot): SearchLabels {
  const { t } = useTranslation();
  const en = useMemo(() => i18n.getFixedT('en'), []);

  const field = useCallback(
    (name: FilterField): string => {
      const customId = customFieldId(name);
      if (customId === null) return t(`search.field.${name}`);
      return snapshot.fields?.find((item) => item.id === customId)?.label ?? name;
    },
    [t, snapshot.fields]
  );

  const value = useCallback(
    (name: FilterField, item: string): string => {
      const customId = customFieldId(name);
      if (customId !== null) {
        const definition = snapshot.fields?.find((candidate) => candidate.id === customId);
        if (definition?.dataType === 'checkbox') return item === 'true' ? t('search.yes') : t('search.no');
        return definition?.options.find((option) => option.id === item)?.label ?? item;
      }
      switch (name) {
        case 'status':
          return statusLabel(t, snapshot.statuses, item);
        case 'epic':
          return item === NO_EPIC ? t('epics.noEpic') : (snapshot.epics.find((epic) => epic.id === item)?.name ?? item);
        case 'sprint':
          return item === NOT_PLANNED ? t('sprint.notPlanned') : (snapshot.sprints.find((sprint) => sprint.id === item)?.name ?? item);
        case 'assignee':
          return item === NO_ASSIGNEE ? t('team.unassigned') : (snapshot.members?.find((member) => member.id === item)?.name ?? item);
        case 'type':
          return t(`search.kind.${item}`);
        case 'criteria':
          return t(`search.criteriaState.${item}`);
        default:
          return item;
      }
    },
    [t, snapshot.epics, snapshot.sprints, snapshot.statuses, snapshot.fields, snapshot.members]
  );

  const badge = useCallback((filter: Filter) => t('search.badge', { field: field(filter.field), value: value(filter.field, filter.value) }), [
    t,
    field,
    value
  ]);

  const query = useCallback(
    (item: SearchQuery): string => {
      const text = item.text.trim();
      return [text && `«${text}»`, ...item.filters.map(badge)].filter(Boolean).join(' · ');
    },
    [badge]
  );

  const catalog = useMemo<FieldEntry[]>(() => {
    const englishValue = (name: FilterField, item: string): string[] => {
      switch (name) {
        case 'status':
          return [statusLabel(en, snapshot.statuses, item), item.replace('_', ' ')];
        case 'type':
          return [en(`search.kind.${item}`)];
        case 'criteria':
          return [en(`search.criteriaState.${item}`)];
        case 'epic':
          return item === NO_EPIC ? [en('epics.noEpic')] : [];
        case 'sprint':
          return item === NOT_PLANNED ? [en('sprint.notPlanned')] : [];
        case 'assignee':
          return item === NO_ASSIGNEE ? [en('team.unassigned')] : [snapshot.members?.find((member) => member.id === item)?.initials ?? ''].filter(Boolean);
        default:
          return [];
      }
    };
    // Without the team there is no assignee to filter by: the snapshot then has no member list.
    const builtins = BUILTIN_FILTER_FIELDS.filter((name) => name !== 'assignee' || snapshot.members !== undefined).map<FieldEntry>((name) => ({
      key: name,
      label: field(name),
      aliases: [en(`search.field.${name}`), name],
      values: fieldValues(snapshot, name).map((item) => ({ value: item, label: value(name, item), aliases: englishValue(name, item) })),
      freeValue: TEXT_FILTER_FIELDS.includes(name)
    }));
    const custom = (snapshot.fields ?? [])
      .filter((definition) => definition.kind === 'custom' && definition.label)
      .map<FieldEntry>((definition) => {
        const key = customFieldKey(definition.id);
        const choice = ['single_select', 'multi_select', 'checkbox'].includes(definition.dataType);
        return {
          key,
          label: definition.label ?? '',
          aliases: [],
          values: fieldValues(snapshot, key).map((item) => ({
            value: item,
            label: value(key, item),
            aliases: definition.dataType === 'checkbox' ? [en(item === 'true' ? 'search.yes' : 'search.no')] : []
          })),
          freeValue: !choice
        };
      });
    return [...builtins, ...custom];
  }, [snapshot, field, value, en]);

  return useMemo(() => ({ field, value, badge, query, catalog }), [field, value, badge, query, catalog]);
}
