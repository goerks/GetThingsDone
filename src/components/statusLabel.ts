import type { TFunction } from 'i18next';
import type { StatusValue } from '../domain/types';

/** The name a status value shows: the team's own name, or the translated default of a default status value. */
export function statusLabel(t: TFunction, statuses: readonly StatusValue[], id: string): string {
  const status = statuses.find((item) => item.id === id);
  if (status?.label) return status.label;
  return t(`status.${id}`, { defaultValue: id });
}
