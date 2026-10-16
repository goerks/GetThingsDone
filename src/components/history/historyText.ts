import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { diffStates, isCustomKey, isRef, fieldIdOf, type ChangeVersion, type FieldChange, type ListEntry, type StateValue } from '../../domain/changeLog';
import { builtinFieldId, formatValue } from '../../domain/fields';
import type { BuiltinKey, FieldValue } from '../../domain/types';
import { useApp } from '../../state/AppState';
import { fieldLabel } from '../fieldLabel';
import { formatDay } from '../releaseFormat';
import { statusLabel } from '../statusLabel';

/** Turns the raw states of the change log into text in the chosen language. */
export interface HistoryText {
  /** Date and time of a version, for example "13 Oct 2026, 14:05". */
  time(at: string): string;
  /** "V6", or "Current (V9)" for the latest version. */
  versionName(version: ChangeVersion, latest: number): string;
  /** The name of a field of an item type. */
  label(itemType: string, key: string): string;
  /** The value of a field as short text. */
  value(itemType: string, key: string, value: StateValue | undefined): string;
  /** Long texts are not shown in the list, only that they changed; the comparison shows them line by line. */
  isLong(key: string): boolean;
  /** A story of a sprint, for example "S-3 (5 points)". */
  entryName(key: string, entry: ListEntry): string;
  /** What one field change says, one line per change. */
  lines(itemType: string, change: FieldChange): string[];
  /** What a version says: its creation, the start of the history, or the changes against the version before. */
  summary(itemType: string, version: ChangeVersion, previous: ChangeVersion | null): string[];
}

/** The keys whose text is translated by the field library: title, status, points, epic, release, description, criteria, colour, start, end. */
const BUILTIN_KEYS: readonly string[] = ['title', 'status', 'points', 'epic', 'release', 'description', 'criteria', 'color', 'start', 'end'];

export function useHistoryText(): HistoryText {
  const { t, i18n } = useTranslation();
  const app = useApp();
  const language = i18n.resolvedLanguage ?? 'en';
  return useMemo<HistoryText>(() => {
    const customField = (key: string) => app.fields.find((field) => field.id === fieldIdOf(key));
    const isLong = (key: string): boolean => key === 'description' || (isCustomKey(key) && customField(key)?.dataType === 'long_text');
    const label = (itemType: string, key: string): string => {
      if (isCustomKey(key)) {
        const field = customField(key);
        return field ? fieldLabel(t, field) : t('history.fieldRemoved');
      }
      if (key === 'title' && itemType === 'sprint') return t('sprint.name');
      if (key === 'title' && itemType === 'epic') return t('epics.name');
      if (BUILTIN_KEYS.includes(key)) {
        const renamed = app.fields.find((field) => field.id === builtinFieldId(key as BuiltinKey))?.label;
        return renamed ?? t(`fields.builtin.${key}`);
      }
      return t(`history.fieldName.${key}`, { defaultValue: key });
    };
    const yesNo = (flag: boolean): string => t(flag ? 'history.yes' : 'history.no');
    const value = (_itemType: string, key: string, raw: StateValue | undefined): string => {
      if (raw === null || raw === undefined || raw === '' || (Array.isArray(raw) && raw.length === 0)) return key === 'assignee' ? t('team.nobody') : t('history.none');
      if (isRef(raw)) {
        const live =
          key === 'epic' ? app.epics.find((item) => item.id === raw.id)?.name : key === 'sprint' ? app.sprints.find((item) => item.id === raw.id)?.name : key === 'release' ? app.releases.find((item) => item.id === raw.id)?.title : key === 'assignee' ? app.members.find((item) => item.id === raw.id)?.name : undefined;
        return live ?? raw.label;
      }
      if (key === 'status' && typeof raw === 'string') return statusLabel(t, app.statuses, raw);
      if (key === 'color' && typeof raw === 'string') return t(`epics.color.${raw}`, { defaultValue: raw });
      if (key === 'state' && typeof raw === 'string') return t(`sprint.${raw}`, { defaultValue: raw });
      if ((key === 'start' || key === 'end') && typeof raw === 'string') return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? formatDay(raw, language) : raw;
      if (isCustomKey(key)) {
        const field = customField(key);
        if (field && !Array.isArray(raw) && typeof raw !== 'object') {
          if (field.dataType === 'checkbox') return yesNo(raw === true);
          return formatValue(field, raw as FieldValue, language) || String(raw);
        }
        if (field && Array.isArray(raw)) return formatValue(field, raw as string[], language) || t('history.none');
      }
      if (typeof raw === 'boolean') return yesNo(raw);
      if (Array.isArray(raw)) return raw.map((item) => (typeof item === 'string' ? item : item.text)).join(', ');
      return String(raw);
    };
    const entryName = (key: string, entry: ListEntry): string =>
      key === 'stories' && entry.points !== undefined ? t('history.storyWithPoints', { code: entry.text, count: entry.points }) : entry.text;
    const lines = (itemType: string, change: FieldChange): string[] => {
      const field = label(itemType, change.key);
      if (change.kind === 'value') {
        if (isLong(change.key)) return [t('history.line.changed', { field })];
        return [t('history.line.value', { field, from: value(itemType, change.key, change.before), to: value(itemType, change.key, change.after) })];
      }
      const kind = change.key === 'criteria' ? 'criterion' : change.key === 'stories' ? 'story' : 'entry';
      const name = (entry: ListEntry): string => entryName(change.key, entry);
      return [
        ...change.added.map((entry) => t(`history.line.${kind}Added`, { field, name: name(entry) })),
        ...change.ticked.map((entry) => t('history.line.criterionTicked', { name: name(entry) })),
        ...change.unticked.map((entry) => t('history.line.criterionUnticked', { name: name(entry) })),
        ...change.edited.map((entry) => t('history.line.criterionEdited', { from: name(entry.before), to: name(entry.after) })),
        ...change.removed.map((entry) => t(`history.line.${kind}Removed`, { field, name: name(entry) }))
      ];
    };
    return {
      time: (at) => new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(at)),
      versionName: (version, latest) => (version.version === latest ? t('history.versionCurrent', { number: version.version }) : t('history.version', { number: version.version })),
      label,
      value,
      isLong,
      entryName,
      lines,
      summary: (itemType, version, previous) => {
        if (version.origin === 'created') return [t(`history.created.${itemType}`, { defaultValue: t('history.created.item') })];
        if (version.origin === 'baseline' || !previous) return [t('history.baseline')];
        return diffStates(previous.state, version.state).flatMap((change) => lines(itemType, change));
      }
    };
  }, [app.fields, app.epics, app.sprints, app.releases, app.members, app.statuses, language, t]);
}
