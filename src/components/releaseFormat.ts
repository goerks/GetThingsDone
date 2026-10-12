import type { TFunction } from 'i18next';
import type { Release } from '../domain/types';

/** A calendar day (`YYYY-MM-DD`) as a medium date in the given language, for example "5 Oct 2026". */
export function formatDay(day: string, language: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(year, month - 1, date));
}

/** The period of a release as text; a release can have one date, both or none. */
export function formatPeriod(release: Pick<Release, 'startDate' | 'endDate'>, t: TFunction, language: string): string {
  const { startDate, endDate } = release;
  if (startDate && endDate) return t('releases.period.range', { start: formatDay(startDate, language), end: formatDay(endDate, language) });
  if (startDate) return t('releases.period.from', { start: formatDay(startDate, language) });
  if (endDate) return t('releases.period.until', { end: formatDay(endDate, language) });
  return t('releases.period.none');
}
