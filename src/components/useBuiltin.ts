import { useTranslation } from 'react-i18next';
import { builtinFieldId, isBuiltinShown } from '../domain/fields';
import type { BuiltinKey, ItemType } from '../domain/types';
import { useApp } from '../state/AppState';

interface Builtin {
  /** The team's label of a system or built-in field, or the given translated default. */
  label(key: BuiltinKey, fallback: string): string;
  /** Whether a built-in field shows on an item type. */
  shown(itemType: ItemType, key: BuiltinKey): boolean;
  /**
   * "6 stories · 23 points", or "6 stories" while points are hidden. Uses a renamed points label. With stories that
   * are not estimated the text ends with "· 2 without estimate" (#54).
   */
  summary(stories: number, points: number, unestimated?: number): string;
  /** The points of one story for a tooltip, with a renamed label. */
  pointsTitle(points: number): string;
}

/** Labels and visibility of the system and built-in fields, as the team configured them (#4, stage 5). */
export function useBuiltin(): Builtin {
  const { t } = useTranslation();
  const app = useApp();
  const customLabel = (key: BuiltinKey): string | null =>
    app.fields.find((field) => field.id === builtinFieldId(key))?.label ?? null;
  const pointsText = (points: number): string => {
    const renamed = customLabel('points');
    return renamed ? `${points} ${renamed}` : t('summary.points', { count: points });
  };
  const shown = (itemType: ItemType, key: BuiltinKey): boolean => isBuiltinShown(itemType, key, app.assignments);

  return {
    label: (key, fallback) => customLabel(key) ?? fallback,
    shown,
    summary: (stories, points, unestimated = 0) => {
      const count = t('summary.stories', { count: stories });
      if (!shown('story', 'points')) return count;
      const text = `${count} · ${pointsText(points)}`;
      return unestimated > 0 ? `${text} · ${t('summary.unestimated', { count: unestimated })}` : text;
    },
    pointsTitle: pointsText
  };
}
