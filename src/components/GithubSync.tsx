import { useId, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { LABELS_FIELD_ID, decisionKey, isEmptySummary, pendingFields, type ConflictEntry, type Decision, type FieldName, type GithubChange, type SyncEntry, type SyncSummary } from '../domain/github';
import type { ExternalFields } from '../domain/types';
import { githubErrorKey } from '../pages/GithubSection';
import { hrefs } from '../router';
import { useApp } from '../state/AppState';
import type { GithubErrorKind } from '../github';
import { Dialog } from './Dialog';
import { InfoHint } from './InfoHint';
import { statusLabel } from './statusLabel';
import { useFeature } from './useFeature';

type Outcome = { kind: 'done'; summary: SyncSummary } | { kind: 'error'; error: GithubErrorKind };

const fieldList = (t: TFunction, names: readonly FieldName[]): string => names.map((name) => t(`github.field.${name}`)).join(', ');

/** One side of a conflict as text. */
function valueText(t: TFunction, fields: ExternalFields, name: FieldName): string {
  switch (name) {
    case 'title':
      return fields.title;
    case 'description':
      return fields.description === '' ? t('github.value.empty') : fields.description;
    case 'labels':
      return fields.labels.length === 0 ? t('github.value.empty') : fields.labels.join(', ');
    case 'criteria':
      return fields.criteria.length === 0 ? t('github.value.empty') : fields.criteria.map((item) => `${item.done ? '☑' : '☐'} ${item.text}`).join('\n');
    case 'done':
      return fields.done ? t('github.value.done') : t('github.value.open');
    case 'release':
      return fields.release ?? t('github.value.none');
    case 'epic':
      return fields.epic ?? t('github.value.none');
    case 'status':
      return fields.status ?? t('github.value.firstColumn');
  }
}

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
    case 'release':
      return t('github.change.release', { from: change.from ?? t('github.value.none'), to: change.to ?? t('github.value.none') });
    case 'epic':
      return t('github.change.epic', { from: change.from ?? t('github.value.none'), to: change.to ?? t('github.value.none') });
    case 'status':
      return t('github.change.status', { from: change.from ?? t('github.value.firstColumn'), to: change.to ?? t('github.value.firstColumn') });
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

function Conflicts({ conflicts, onApply, onCancel }: { conflicts: ConflictEntry[]; onApply: (decisions: Record<string, Decision>) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const app = useApp();
  const id = useId();
  // GitHub is the recommended answer, as it is the default rule.
  const [chosen, setChosen] = useState<Record<string, Decision>>(() => Object.fromEntries(conflicts.map((item) => [decisionKey(item.storyId, item.field), 'remote' as Decision])));
  return (
    <Dialog title={t('github.conflict.title')} onClose={onCancel} wide>
      <p>
        {t('github.conflict.intro')} <InfoHint text={t('github.conflict.hint')} />
      </p>
      {conflicts.map((item, index) => {
        const key = decisionKey(item.storyId, item.field);
        const title = app.stories.find((story) => story.id === item.storyId)?.title ?? '';
        return (
          <fieldset key={key} className="github-conflict">
            <legend>
              {t('github.conflict.group', { field: t(`github.field.${item.field}`), code: item.code })} · {title}
            </legend>
            <div className="github-conflict__versions">
              <div className="github-conflict__version">
                <h4>{t('github.conflict.local')}</h4>
                {valueText(t, item.local, item.field)}
              </div>
              <div className="github-conflict__version">
                <h4>{t('github.conflict.remote')}</h4>
                {valueText(t, item.remote, item.field)}
              </div>
            </div>
            <label>
              <input type="radio" name={`${id}-${index}`} checked={chosen[key] === 'local'} onChange={() => setChosen({ ...chosen, [key]: 'local' })} /> {t('github.conflict.keepLocal')}
            </label>
            <label>
              <input type="radio" name={`${id}-${index}`} checked={chosen[key] === 'remote'} onChange={() => setChosen({ ...chosen, [key]: 'remote' })} /> {t('github.conflict.takeRemote')}
            </label>
          </fieldset>
        );
      })}
      <div className="form__actions">
        <button type="button" className="btn" onClick={onCancel}>
          {t('github.conflict.cancel')}
        </button>
        <button type="button" className="btn btn--primary" onClick={() => onApply(chosen)}>
          {t('github.conflict.apply')}
        </button>
      </div>
    </Dialog>
  );
}

function Result({ outcome, onClose, onDecide }: { outcome: Outcome; onClose: () => void; onDecide: () => void }) {
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
  const empty = isEmptySummary(summary) && summary.pending === 0;
  const publishedCount = summary.published.reduce((sum, entry) => sum + entry.fields.length, 0);
  const skipped = [...new Set(summary.published.flatMap((entry) => entry.skippedLabels))];
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
        {publishedCount > 0 && <li>{t('github.sync.publishedCount', { count: publishedCount })}</li>}
      </ul>
      {empty ? (
        <p>{t('github.sync.nothing')}</p>
      ) : (
        <>
          <Entries entries={[...summary.created, ...summary.updated, ...summary.closed]} />
        </>
      )}
      {summary.published.length > 0 && (
        <section className="github-result__section">
          <h3>{t('github.sync.publishedTitle')}</h3>
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
          <h3>{t('github.sync.overwrittenTitle')}</h3>
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
      {(summary.releasesCreated.length > 0 || summary.epicsCreated.length > 0) && (
        <section className="github-result__section">
          <ul className="github-result__list">
            {summary.releasesCreated.map((title) => (
              <li key={`release-${title}`}>{t('github.sync.releaseCreated', { title })}</li>
            ))}
            {summary.epicsCreated.map((name) => (
              <li key={`epic-${name}`}>{t('github.sync.epicCreated', { name })}</li>
            ))}
          </ul>
        </section>
      )}
      {summary.missingMilestones.length > 0 && <p className="github-result__section">{t('github.sync.missingMilestones', { titles: summary.missingMilestones.join(', ') })}</p>}
      {summary.multipleEpics.length > 0 && (
        <p className="github-result__section">{t('github.sync.multipleEpics', { issues: summary.multipleEpics.map((item) => `${item.code} (#${item.number})`).join(', ') })}</p>
      )}
      {summary.pending > 0 && <p className="github-result__section">{t('github.sync.pendingNote', { count: summary.pending })}</p>}
      {summary.conflicts.length > 0 && (
        <p className="github-result__section">
          {t('github.sync.conflictsOpen', { count: summary.conflicts.length })}{' '}
          <button type="button" className="btn btn--small" onClick={onDecide}>
            {t('github.sync.decide')}
          </button>
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

/** "Synchronise" in the head of the backlog, with the time of the last sync and the result dialog (#30). Only while the feature is on. */
export function GithubSync() {
  const { t, i18n } = useTranslation();
  const app = useApp();
  const on = useFeature('github');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  if (!on) return null;

  const last = app.settings.github.lastSyncAt;
  const lastText = last ? new Date(last).toLocaleString(i18n.resolvedLanguage, { dateStyle: 'short', timeStyle: 'short' }) : null;

  const pendingCount = app.stories.reduce(
    (sum, story) => sum + pendingFields(story, app.fields.find((field) => field.id === LABELS_FIELD_ID), app.statuses, { epics: app.epics, releases: app.releases }).length,
    0
  );
  const name = t('github.sync.button');
  const tooltip = [name, busy ? t('github.sync.running') : lastText ? t('github.sync.last', { when: lastText }) : t('github.sync.never'), pendingCount > 0 ? t('github.sync.pendingCount', { count: pendingCount }) : '']
    .filter(Boolean)
    .join(' · ');

  const sync = async (decisions?: Record<string, Decision>): Promise<void> => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const summary = await app.syncGithub(decisions);
      setOutcome({ kind: 'done', summary });
      // The rule "I decide" asks right away; the result dialog stays behind it for the rest.
      setDeciding(summary.conflicts.length > 0);
    } catch (cause) {
      setOutcome({ kind: 'error', error: githubErrorKey(cause) });
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  return (
    <span className="github-sync">
      <button type="button" className="btn btn--icon github-sync__button" aria-label={name} aria-busy={busy || undefined} title={tooltip} aria-disabled={busy || undefined} onClick={() => void sync()}>
        <svg className={`github-sync__icon${busy ? ' github-sync__icon--spin' : ''}`} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a9 9 0 0 0-15.5-6.2L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 15.5 6.2L21 16" />
          <path d="M21 21v-5h-5" />
        </svg>
        {pendingCount > 0 && (
          <span className="github-sync__count" aria-hidden="true">
            {pendingCount}
          </span>
        )}
      </button>
      <span className="sr-only" role="status">
        {busy ? t('github.sync.running') : lastText ? t('github.sync.last', { when: lastText }) : t('github.sync.never')}
      </span>
      {pendingCount > 0 && <span className="sr-only">{t('github.sync.pendingCount', { count: pendingCount })}</span>}
      {outcome && outcome.kind === 'done' && deciding && (
        <Conflicts
          conflicts={outcome.summary.conflicts}
          onCancel={() => setDeciding(false)}
          onApply={(decisions) => {
            setDeciding(false);
            setOutcome(null);
            void sync(decisions);
          }}
        />
      )}
      {outcome && !(outcome.kind === 'done' && deciding) && <Result outcome={outcome} onClose={() => setOutcome(null)} onDecide={() => setDeciding(true)} />}
    </span>
  );
}
