import { useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { isEmptySummary, type GithubChange, type SyncEntry, type SyncSummary } from '../domain/github';
import { githubErrorKey } from '../pages/GithubSection';
import { hrefs } from '../router';
import { useApp } from '../state/AppState';
import type { GithubErrorKind } from '../github';
import { Dialog } from './Dialog';
import { statusLabel } from './statusLabel';
import { useFeature } from './useFeature';

type Outcome = { kind: 'done'; summary: SyncSummary } | { kind: 'error'; error: GithubErrorKind };

function changeText(t: TFunction, change: GithubChange, status: string): string {
  switch (change.kind) {
    case 'created':
      return t('github.change.created');
    case 'title':
      return t('github.change.title', { from: change.from, to: change.to });
    case 'description':
      return t('github.change.description');
    case 'labels': {
      const parts = [
        change.added.length > 0 ? t('github.change.labelsAdded', { labels: change.added.join(', ') }) : '',
        change.removed.length > 0 ? t('github.change.labelsRemoved', { labels: change.removed.join(', ') }) : ''
      ].filter(Boolean);
      return t('github.change.labels', { parts: parts.join(', ') });
    }
    case 'criteria': {
      const parts = [
        change.added > 0 ? t('github.change.criteriaAdded', { count: change.added }) : '',
        change.removed > 0 ? t('github.change.criteriaRemoved', { count: change.removed }) : '',
        change.changed > 0 ? t('github.change.criteriaTicked', { count: change.changed }) : ''
      ].filter(Boolean);
      return t('github.change.criteria', { parts: parts.length > 0 ? parts.join(', ') : t('github.change.criteriaOrder') });
    }
    case 'closed':
      return t('github.change.closed', { status });
    case 'reopened':
      return t('github.change.reopened', { status });
  }
}

function Entries({ entries }: { entries: SyncEntry[] }) {
  const { t } = useTranslation();
  const app = useApp();
  return (
    <ul className="github-result__list">
      {entries.map((entry) => {
        const status = statusLabel(t, app.statuses, app.stories.find((story) => story.id === entry.storyId)?.status ?? '');
        return (
          <li key={entry.storyId}>
            <span className="github-badge github-badge--plain">#{entry.number}</span>
            <span className="card__code">{entry.code}</span> {entry.title}
            <ul>
              {entry.changes.map((change, index) => (
                <li key={index}>{changeText(t, change, status)}</li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

function Result({ outcome, onClose }: { outcome: Outcome; onClose: () => void }) {
  const { t } = useTranslation();
  if (outcome.kind === 'error') {
    return (
      <Dialog title={t('github.sync.failed')} onClose={onClose}>
        <p role="alert" className="github-result__error">
          {t(`github.errors.${outcome.error}`)}
        </p>
        {outcome.error === 'config' && (
          <p>
            <a href={hrefs.settingsGithub} onClick={onClose}>
              {t('github.sync.toSettings')}
            </a>
          </p>
        )}
        <div className="form__actions">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            {t('github.sync.close')}
          </button>
        </div>
      </Dialog>
    );
  }
  const { summary } = outcome;
  const empty = isEmptySummary(summary);
  return (
    <Dialog title={t('github.sync.done')} onClose={onClose}>
      <ul className="github-result__counts">
        <li>
          <strong>{summary.created.length}</strong> {t('github.sync.created')}
        </li>
        <li>
          <strong>{summary.updated.length}</strong> {t('github.sync.updated')}
        </li>
        <li>
          <strong>{summary.closed.length}</strong> {t('github.sync.closed')}
        </li>
      </ul>
      {empty ? (
        <p>{t('github.sync.nothing')}</p>
      ) : (
        <>
          <Entries entries={[...summary.created, ...summary.updated, ...summary.closed]} />
          {summary.updated.length + summary.closed.length > 0 && <p className="muted">{t('github.sync.wins')}</p>}
        </>
      )}
      <div className="form__actions">
        <button type="button" className="btn btn--primary" onClick={onClose}>
          {t('github.sync.close')}
        </button>
      </div>
    </Dialog>
  );
}

/** "Synchronise" in the head of the backlog, with the time of the last sync and the result dialog (#30). Only while the feature is on. */
export function GithubSync() {
  const { t, i18n } = useTranslation();
  const app = useApp();
  const on = useFeature('github');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  if (!on) return null;

  const last = app.settings.github.lastSyncAt;
  const lastText = last ? new Date(last).toLocaleString(i18n.resolvedLanguage, { dateStyle: 'short', timeStyle: 'short' }) : null;

  const sync = async (): Promise<void> => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      setOutcome({ kind: 'done', summary: await app.syncGithub() });
    } catch (cause) {
      setOutcome({ kind: 'error', error: githubErrorKey(cause) });
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  return (
    <span className="github-sync">
      <span className="github-sync__last muted" role="status">
        {busy ? t('github.sync.running') : lastText ? t('github.sync.last', { when: lastText }) : t('github.sync.never')}
      </span>
      <button type="button" className="btn" aria-disabled={busy || undefined} onClick={() => void sync()}>
        {t('github.sync.button')}
      </button>
      {outcome && <Result outcome={outcome} onClose={() => setOutcome(null)} />}
    </span>
  );
}
