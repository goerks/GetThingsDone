import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SyncSummary } from '../domain/github';
import { LOG_MAX_DAYS, LOG_MAX_ENTRIES, filterLog, isQuiet, type LogFilter } from '../domain/syncLog';
import type { SyncLogEntry } from '../domain/types';
import { syncMessage } from '../github/syncMessage';
import { useApp } from '../state/AppState';
import { Entries, fieldList } from './GithubSync';
import { InfoHint } from './InfoHint';

const FILTERS: readonly LogFilter[] = ['all', 'changes', 'errors'];

/** The single changes of one run (#30, AC20): tickets with their fields, what was written, labels and milestones made or deleted. */
function Details({ summary }: { summary: SyncSummary }) {
  const { t } = useTranslation();
  const skipped = [...new Set(summary.published.flatMap((entry) => entry.skippedLabels))];
  const housekeeping = [
    ...summary.milestonesCreated.map((name) => t('github.sync.milestoneCreated', { name })),
    ...summary.labelsCreated.map((name) => t('github.sync.labelCreated', { name })),
    ...summary.labelsDeleted.map((name) => t('github.sync.labelDeleted', { name })),
    ...summary.milestonesDeleted.map((name) => t('github.sync.milestoneDeleted', { name })),
    ...summary.releasesCreated.map((title) => t('github.sync.releaseCreated', { title })),
    ...summary.epicsCreated.map((name) => t('github.sync.epicCreated', { name }))
  ];
  return (
    <>
      <Entries entries={[...summary.created, ...summary.updated, ...summary.closed]} />
      {summary.published.length > 0 && (
        <section className="github-result__section">
          <h4>{t('github.sync.publishedTitle')}</h4>
          <ul className="github-result__list">
            {summary.published.map((entry) => (
              <li key={entry.storyId}>
                <span className="github-badge github-badge--plain">#{entry.number}</span>
                <span className="card__code">{entry.code}</span> {entry.title}: {fieldList(t, entry.fields)}
              </li>
            ))}
          </ul>
          {skipped.length > 0 && <p className="muted">{t('github.sync.skippedLabels', { labels: skipped.join(', ') })}</p>}
        </section>
      )}
      {summary.overwritten.length > 0 && (
        <section className="github-result__section">
          <h4>{t('github.sync.overwrittenTitle')}</h4>
          <ul className="github-result__list">
            {summary.overwritten.map((entry) => (
              <li key={`${entry.storyId}:${entry.field}`}>
                <span className="github-badge github-badge--plain">#{entry.number}</span>
                <span className="card__code">{entry.code}</span>{' '}
                {t(`github.overwritten.${entry.side}${entry.value !== undefined ? 'Value' : ''}`, { field: t(`github.field.${entry.field}`), value: entry.value })}
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
      {summary.missingLabels.length > 0 && <p>{t('github.sync.missingLabels', { names: summary.missingLabels.join(', ') })}</p>}
      {summary.missingMilestones.length > 0 && <p>{t('github.sync.missingMilestones', { titles: summary.missingMilestones.join(', ') })}</p>}
      {summary.multipleEpics.length > 0 && <p>{t('github.sync.multipleEpics', { issues: summary.multipleEpics.map((item) => `${item.code} (#${item.number})`).join(', ') })}</p>}
      {summary.pending > 0 && <p>{t('github.sync.pendingNote', { count: summary.pending })}</p>}
      {summary.conflicts.length > 0 && <p>{t('github.sync.conflictsOpen', { count: summary.conflicts.length })}</p>}
    </>
  );
}

function Row({ entry }: { entry: SyncLogEntry }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const id = useId();
  const when = new Date(entry.at).toLocaleString(i18n.resolvedLanguage, { dateStyle: 'short', timeStyle: 'short' });
  const quiet = isQuiet(entry);
  const text = entry.error
    ? t('github.toast.failed', { reason: t(`github.errors.${entry.error}`) })
    : quiet
      ? entry.runs > 1
        ? t('github.log.quietRuns', { count: entry.runs })
        : t('github.log.quiet')
      : entry.summary
        ? syncMessage(t, entry.summary)
        : '';
  const detail = entry.summary !== null && !quiet;
  return (
    <li className="github-log__row">
      <button type="button" className="github-log__toggle" aria-expanded={detail ? open : undefined} aria-controls={detail ? id : undefined} disabled={!detail} onClick={() => setOpen(!open)}>
        <span>{when}</span>
        <span className="muted">{t(`github.log.trigger.${entry.trigger}`)}</span>
        <span>{text}</span>
        <span className={entry.error ? 'github-log__result--bad' : 'muted'}>{entry.error ? `⚠ ${t('github.log.error')}` : `✓ ${t('github.log.ok')}`}</span>
      </button>
      {detail && open && entry.summary && (
        <div id={id} className="github-log__detail">
          <Details summary={entry.summary} />
        </div>
      )}
    </li>
  );
}

/** Settings › GitHub: the sync log (#30, AC20), newest run first. */
export function GithubLog() {
  const { t } = useTranslation();
  const app = useApp();
  const id = useId();
  const [filter, setFilter] = useState<LogFilter>('all');
  const entries = filterLog(app.settings.github.log, filter);
  return (
    <section className="github-log" aria-labelledby={`${id}-title`}>
      <div className="github-log__head">
        <h3 id={`${id}-title`}>
          {t('github.log.title')} <InfoHint text={t('github.log.hint', { count: LOG_MAX_ENTRIES, days: LOG_MAX_DAYS })} />
        </h3>
        <label className="sr-only" htmlFor={`${id}-filter`}>
          {t('github.log.filter')}
        </label>
        <select id={`${id}-filter`} className="input" value={filter} onChange={(event) => setFilter(event.target.value as LogFilter)}>
          {FILTERS.map((name) => (
            <option key={name} value={name}>
              {t(`github.log.filters.${name}`)}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn--small" disabled={app.settings.github.log.length === 0} onClick={() => app.clearGithubLog()}>
          {t('github.log.clear')}
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="muted">{t('github.log.empty')}</p>
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
