import type { TFunction } from 'i18next';
import { isEmptySummary, type SyncSummary } from '../domain/github';

/** The one line of the notice after a sync: what changed in numbers, or that nothing did (#30, AC17). */
export function syncMessage(t: TFunction, summary: SyncSummary): string {
  // Writing is off and local changes wait: that is not "up to date".
  if (isEmptySummary(summary)) return summary.pending > 0 ? t('github.sync.pendingNote', { count: summary.pending }) : t('github.toast.upToDate');
  const published = summary.published.reduce((sum, entry) => sum + entry.fields.length, 0);
  const other =
    summary.labelsCreated.length + summary.labelsDeleted.length + summary.milestonesCreated.length + summary.milestonesDeleted.length + summary.releasesCreated.length + summary.epicsCreated.length;
  const parts = [
    summary.created.length > 0 ? t('github.toast.new', { count: summary.created.length }) : '',
    summary.updated.length > 0 ? t('github.toast.updated', { count: summary.updated.length }) : '',
    summary.closed.length > 0 ? t('github.toast.closed', { count: summary.closed.length }) : '',
    published > 0 ? t('github.toast.published', { count: published }) : '',
    other > 0 ? t('github.toast.other', { count: other }) : ''
  ].filter(Boolean);
  return t('github.toast.done', { parts: parts.join(', ') });
}
