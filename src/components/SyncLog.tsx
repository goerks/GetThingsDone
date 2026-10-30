import { useId, useState } from 'react';
import type { SyncSummary } from '../domain/sync';
import { LOG_MAX_DAYS, LOG_MAX_ENTRIES, filterLog, isQuiet, type LogFilter } from '../domain/syncLog';
import type { SyncLogEntry } from '../domain/types';
import { useApp } from '../state/AppState';
import { syncMessage } from '../sync/syncMessage';
import { useSyncT } from '../sync/useSyncT';
import { Entries, fieldList } from './SyncControl';
import { InfoHint } from './InfoHint';
import { BareButton, Button, Select } from '../ui';

const FILTERS: readonly LogFilter[] = ['all', 'changes', 'errors'];

/** The single changes of one run (#30, AC20): tickets with their fields, what was written, labels and milestones made or deleted. */
function Details({ summary }: { summary: SyncSummary }) {
  const { t } = useSyncT();
  const skipped = [...new Set(summary.published.flatMap((entry) => entry.skippedLabels))];
  const housekeeping = [
    ...summary.milestonesCreated.map((name) => t('sync.sync.milestoneCreated', { name })),
    ...summary.labelsCreated.map((name) => t('sync.sync.labelCreated', { name })),
    ...summary.labelsDeleted.map((name) => t('sync.sync.labelDeleted', { name })),
    ...summary.milestonesDeleted.map((name) => t('sync.sync.milestoneDeleted', { name })),
    ...summary.releasesCreated.map((title) => t('sync.sync.releaseCreated', { title })),
    ...summary.epicsCreated.map((name) => t('sync.sync.epicCreated', { name }))
  ];
  return (
    <>
      <Entries entries={[...summary.created, ...summary.updated, ...summary.closed]} />
      {summary.published.length > 0 && (
        <section className="github-result__section">
          <h4>{t('sync.sync.publishedTitle')}</h4>
          <ul className="github-result__list">
            {summary.published.map((entry) => (
              <li key={entry.storyId}>
                <span className="github-badge github-badge--plain">{entry.key}</span>
                <span className="card__code">{entry.code}</span> {entry.title}: {fieldList(t, entry.fields)}
              </li>
            ))}
          </ul>
          {skipped.length > 0 && <p className="muted">{t('sync.sync.skippedLabels', { labels: skipped.join(', ') })}</p>}
        </section>
      )}
      {summary.overwritten.length > 0 && (
        <section className="github-result__section">
          <h4>{t('sync.sync.overwrittenTitle')}</h4>
          <ul className="github-result__list">
            {summary.overwritten.map((entry) => (
              <li key={`${entry.storyId}:${entry.field}`}>
                <span className="github-badge github-badge--plain">{entry.key}</span>
                <span className="card__code">{entry.code}</span>{' '}
                {t(`sync.overwritten.${entry.side}${entry.value !== undefined ? 'Value' : ''}`, { field: t(`sync.field.${entry.field}`), value: entry.value })}
              </li>
            ))}
          </ul>
        </section>
      )}
      {housekeeping.length > 0 && (
        <ul className="github-result__list">
          {housekeeping.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}
      {summary.missingLabels.length > 0 && <p>{t('sync.sync.missingLabels', { names: summary.missingLabels.join(', ') })}</p>}
      {summary.missingMilestones.length > 0 && <p>{t('sync.sync.missingMilestones', { titles: summary.missingMilestones.join(', ') })}</p>}
      {summary.multipleEpics.length > 0 && <p>{t('sync.sync.multipleEpics', { issues: summary.multipleEpics.map((item) => `${item.code} (${item.key})`).join(', ') })}</p>}
      {summary.pending > 0 && <p>{t('sync.sync.pendingNote', { count: summary.pending })}</p>}
      {summary.conflicts.length > 0 && <p>{t('sync.sync.conflictsOpen', { count: summary.conflicts.length })}</p>}
    </>
  );
}

function Row({ entry }: { entry: SyncLogEntry }) {
  const { t, i18n } = useSyncT();
  const [open, setOpen] = useState(false);
  const id = useId();
  const when = new Date(entry.at).toLocaleString(i18n.resolvedLanguage, { dateStyle: 'short', timeStyle: 'short' });
  const quiet = isQuiet(entry);
  const text = entry.error
    ? t('sync.toast.failed', { reason: t(`sync.errors.${entry.error}`) })
    : quiet
      ? entry.runs > 1
        ? t('sync.log.quietRuns', { count: entry.runs })
        : t('sync.log.quiet')
      : entry.summary
        ? syncMessage(t, entry.summary)
        : '';
  const detail = entry.summary !== null && !quiet;
  return (
    <li className="github-log__row">
      <BareButton type="button" className="github-log__toggle" aria-expanded={detail ? open : undefined} aria-controls={detail ? id : undefined} disabled={!detail} onClick={() => setOpen(!open)}>
        <span>{when}</span>
        <span className="muted">{t(`sync.log.trigger.${entry.trigger}`)}</span>
        <span>{text}</span>
        <span className={entry.error ? 'github-log__result--bad' : 'muted'}>{entry.error ? `⚠ ${t('sync.log.error')}` : `✓ ${t('sync.log.ok')}`}</span>
      </BareButton>
      {detail && open && entry.summary && (
        <div id={id} className="github-log__detail">
          <Details summary={entry.summary} />
        </div>
      )}
    </li>
  );
}

/** Settings › Synchronisation: the sync log (#30, AC20), newest run first. */
export function SyncLog() {
  const { t } = useSyncT();
  const app = useApp();
  const id = useId();
  const [filter, setFilter] = useState<LogFilter>('all');
  const entries = filterLog(app.settings.sync.log, filter);
  return (
    <section className="github-log" aria-labelledby={`${id}-title`}>
      <div className="github-log__head">
        <h3 id={`${id}-title`}>
          {t('sync.log.title')} <InfoHint text={t('sync.log.hint', { count: LOG_MAX_ENTRIES, days: LOG_MAX_DAYS })} />
        </h3>
        <label className="sr-only" htmlFor={`${id}-filter`}>
          {t('sync.log.filter')}
        </label>
        <Select id={`${id}-filter`} value={filter} onChange={(event) => setFilter(event.target.value as LogFilter)}>
          {FILTERS.map((name) => (
            <option key={name} value={name}>
              {t(`sync.log.filters.${name}`)}
            </option>
          ))}
        </Select>
        <Button type="button" size="small" disabled={app.settings.sync.log.length === 0} onClick={() => app.clearSyncLog()}>
          {t('sync.log.clear')}
        </Button>
      </div>
      {entries.length === 0 ? (
        <p className="muted">{t('sync.log.empty')}</p>
      ) : (
        <ul className="github-log__list">
          {entries.map((entry) => (
            <Row key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}
