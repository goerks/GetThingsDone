import type { Sprint } from '../domain/types';

/** "06.10.–19.10." style range in the given language; the year is shown only when the range crosses years. */
export function formatSprintDates(sprint: Pick<Sprint, 'startDate' | 'endDate'>, language: string): string {
  const toDate = (day: string): Date => {
    const [year, month, date] = day.split('-').map(Number);
    return new Date(year, month - 1, date);
  };
  const start = toDate(sprint.startDate);
  const end = toDate(sprint.endDate);
  const sameYear = start.getFullYear() === end.getFullYear();
  const format = new Intl.DateTimeFormat(language, sameYear ? { day: 'numeric', month: 'short' } : { dateStyle: 'medium' });
  return `${format.format(start)} – ${format.format(end)}`;
}

/** A day without the year, for example "20. October": for texts that say when a sprint ended or was planned. */
export function formatDayLong(day: string, language: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long' }).format(new Date(year, month - 1, date));
}
