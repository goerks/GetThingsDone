import type { TFunction } from 'i18next';
import { isEmptySummary, type SyncSummary } from '../domain/sync';

/** The one line of the notice after a sync: what changed in numbers, or that nothing did (#30, AC17). */
export function syncMessage(t: TFunction, summary: SyncSummary): string {
  // Writing is off and local changes wait: that is not "up to date".
  if (isEmptySummary(summary) && !summary.skipped && !summary.unmatchedAssignees?.length) return summary.pending > 0 ? t('sync.sync.pendingNote', { count: summary.pending }) : t('sync.toast.upToDate');
  const published = summary.published.reduce((sum, entry) => sum + entry.fields.length, 0);
  const other =
    summary.labelsCreated.length + summary.labelsDeleted.length + summary.milestonesCreated.length + summary.milestonesDeleted.length + summary.releasesCreated.length + summary.epicsCreated.length + (summary.sprintsCreated?.length ?? 0);
  const parts = [
    summary.created.length > 0 ? t('sync.toast.new', { count: summary.created.length }) : '',
    summary.updated.length > 0 ? t('sync.toast.updated', { count: summary.updated.length }) : '',
    summary.closed.length > 0 ? t('sync.toast.closed', { count: summary.closed.length }) : '',
    published > 0 ? t('sync.toast.published', { count: published }) : '',
    other > 0 ? t('sync.toast.other', { count: other }) : '',
    summary.skipped ? t('sync.toast.skipped', { count: summary.skipped }) : '',
    summary.unmatchedAssignees?.length ? t('sync.toast.unmatched', { names: summary.unmatchedAssignees.join(', ') }) : ''
  ].filter(Boolean);
  return t('sync.toast.done', { parts: parts.join(', ') });
}
