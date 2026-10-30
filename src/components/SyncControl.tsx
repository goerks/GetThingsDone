import { useEffect, useId, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { LABELS_FIELD_ID, decisionKey, pendingFields, type ConflictEntry, type Decision, type FieldName, type SyncChange, type SyncEntry } from '../domain/sync';
import type { ExternalFields } from '../domain/types';
import { useApp } from '../state/AppState';
import { useSyncT } from '../sync/useSyncT';
import { Dialog } from './Dialog';
import { InfoHint } from './InfoHint';
import { statusLabel } from './statusLabel';
import { useFeature } from './useFeature';
import { Button, CheckInput } from '../ui';

export const fieldList = (t: TFunction, names: readonly FieldName[]): string => names.map((name) => t(`sync.field.${name}`)).join(', ');

/** One side of a conflict as text. */
export function valueText(t: TFunction, fields: ExternalFields, name: FieldName): string {
  switch (name) {
    case 'title':
      return fields.title;
    case 'description':
      return fields.description === '' ? t('sync.value.empty') : fields.description;
    case 'labels':
      return fields.labels.length === 0 ? t('sync.value.empty') : fields.labels.join(', ');
    case 'criteria':
      return fields.criteria.length === 0 ? t('sync.value.empty') : fields.criteria.map((item) => `${item.done ? '☑' : '☐'} ${item.text}`).join('\n');
    case 'done':
      return fields.done ? t('sync.value.done') : t('sync.value.open');
    case 'release':
      return fields.release ?? t('sync.value.none');
    case 'epic':
      return fields.epic ?? t('sync.value.none');
    case 'status':
      return fields.status ?? t('sync.value.firstColumn');
    case 'points':
      return String(fields.points ?? 0);
    case 'sprint':
      return fields.sprint ?? t('sync.value.backlog');
    case 'assignee':
      return fields.assignee ?? t('sync.value.none');
  }
}

export function changeText(t: TFunction, change: SyncChange, status: string): string {
  switch (change.kind) {
    case 'created':
      return t('sync.change.created');
    case 'title':
      return t('sync.change.title', { from: change.from, to: change.to });
    case 'description':
      return t('sync.change.description');
    case 'labels': {
      const parts = [
        change.added.length > 0 ? t('sync.change.labelsAdded', { labels: change.added.join(', ') }) : '',
        change.removed.length > 0 ? t('sync.change.labelsRemoved', { labels: change.removed.join(', ') }) : ''
      ].filter(Boolean);
      return t('sync.change.labels', { parts: parts.join(', ') });
    }
    case 'criteria': {
      const parts = [
        change.added > 0 ? t('sync.change.criteriaAdded', { count: change.added }) : '',
        change.removed > 0 ? t('sync.change.criteriaRemoved', { count: change.removed }) : '',
        change.changed > 0 ? t('sync.change.criteriaTicked', { count: change.changed }) : ''
      ].filter(Boolean);
      return t('sync.change.criteria', { parts: parts.length > 0 ? parts.join(', ') : t('sync.change.criteriaOrder') });
    }
    case 'release':
      return t('sync.change.release', { from: change.from ?? t('sync.value.none'), to: change.to ?? t('sync.value.none') });
    case 'epic':
      return t('sync.change.epic', { from: change.from ?? t('sync.value.none'), to: change.to ?? t('sync.value.none') });
    case 'status':
      return t('sync.change.status', { from: change.from ?? t('sync.value.firstColumn'), to: change.to ?? t('sync.value.firstColumn') });
    case 'points':
      return t('sync.change.points', { from: change.from, to: change.to });
    case 'sprint':
      return t('sync.change.sprint', { from: change.from ?? t('sync.value.backlog'), to: change.to ?? t('sync.value.backlog') });
    case 'assignee':
      return t('sync.change.assignee', { from: change.from ?? t('sync.value.none'), to: change.to ?? t('sync.value.none') });
    case 'closed':
      return t('sync.change.closed', { status });
    case 'reopened':
      return t('sync.change.reopened', { status });
  }
}

export function Entries({ entries }: { entries: SyncEntry[] }) {
  const { t } = useSyncT();
  const app = useApp();
  return (
    <ul className="github-result__list">
      {entries.map((entry) => {
        const status = statusLabel(t, app.statuses, app.stories.find((story) => story.id === entry.storyId)?.status ?? '');
        return (
          <li key={entry.storyId}>
            <span className="github-badge github-badge--plain">{entry.key}</span>
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
  const { t } = useSyncT();
  const app = useApp();
  const id = useId();
  // GitHub is the recommended answer, as it is the default rule.
  const [chosen, setChosen] = useState<Record<string, Decision>>(() => Object.fromEntries(conflicts.map((item) => [decisionKey(item.storyId, item.field), 'remote' as Decision])));
  return (
    <Dialog title={t('sync.conflict.title')} onClose={onCancel} wide>
      <p>
        {t('sync.conflict.intro')} <InfoHint text={t('sync.conflict.hint')} />
      </p>
      {conflicts.map((item, index) => {
        const key = decisionKey(item.storyId, item.field);
        const title = app.stories.find((story) => story.id === item.storyId)?.title ?? '';
        return (
          <fieldset key={key} className="github-conflict">
            <legend>
              {t('sync.conflict.group', { field: t(`sync.field.${item.field}`), code: item.code })} · {title}
            </legend>
            <div className="github-conflict__versions">
              <div className="github-conflict__version">
                <h4>{t('sync.conflict.local')}</h4>
                {valueText(t, item.local, item.field)}
              </div>
              <div className="github-conflict__version">
                <h4>{t('sync.conflict.remote')}</h4>
                {valueText(t, item.remote, item.field)}
              </div>
            </div>
            <label>
              <CheckInput kind="radio" name={`${id}-${index}`} checked={chosen[key] === 'local'} onChange={() => setChosen({ ...chosen, [key]: 'local' })} /> {t('sync.conflict.keepLocal')}
            </label>
            <label>
              <CheckInput kind="radio" name={`${id}-${index}`} checked={chosen[key] === 'remote'} onChange={() => setChosen({ ...chosen, [key]: 'remote' })} /> {t('sync.conflict.takeRemote')}
            </label>
          </fieldset>
        );
      })}
      <div className="form__actions">
        <Button type="button" onClick={onCancel}>
          {t('sync.conflict.cancel')}
        </Button>
        <Button type="button" variant="primary" onClick={() => onApply(chosen)}>
          {t('sync.conflict.apply')}
        </Button>
      </div>
    </Dialog>
  );
}

/** "Synchronise" icon in the head of the backlog, board and story map (#30). The result is a short notice, never a dialog; only a conflict that the PO has to decide opens one. Only while the feature is on. */
export function SyncControl() {
  const { t, i18n } = useSyncT();
  const app = useApp();
  const on = useFeature('sync');
  const [conflicts, setConflicts] = useState<ConflictEntry[] | null>(null);
  const [tick, setTick] = useState(false);
  const { busy, paused, review } = app.syncState;
  const last = app.settings.sync.lastSyncAt;
  const first = useRef(true);

  // A tick for a moment after every finished sync, by hand or by itself.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!last) return;
    setTick(true);
    const timer = setTimeout(() => setTick(false), 3000);
    return () => clearTimeout(timer);
  }, [last]);

  const sync = async (decisions?: Record<string, Decision>): Promise<void> => {
    if (busy) return;
    const summary = await app.syncNow(decisions, 'manual');
    // The rule "I decide" asks right away.
    if (summary && summary.conflicts.length > 0) setConflicts(summary.conflicts);
  };

  // "Review" in the notice of an automatic run asks for the same choice.
  useEffect(() => {
    if (!on || !review || busy) return;
    app.clearSyncReview();
    void sync();
    // The request is consumed once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, review, busy]);

  if (!on) return null;

  const lastText = last ? new Date(last).toLocaleString(i18n.resolvedLanguage, { dateStyle: 'short', timeStyle: 'short' }) : null;
  const pendingCount = app.stories.reduce(
    (sum, story) => sum + pendingFields(story, app.fields.find((field) => field.id === LABELS_FIELD_ID), app.statuses, { epics: app.epics, releases: app.releases }).length,
    0
  );
  const name = t('sync.sync.button');
  const tooltip = [
    name,
    busy ? t('sync.sync.running') : lastText ? t('sync.sync.last', { when: lastText }) : t('sync.sync.never'),
    paused ? t('sync.sync.paused') : '',
    pendingCount > 0 ? t('sync.sync.pendingCount', { count: pendingCount }) : ''
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <span className="github-sync">
      <Button type="button" className="btn--icon github-sync__button" aria-label={name} aria-busy={busy || undefined} title={tooltip} aria-disabled={busy || undefined} onClick={() => void sync()}>
        <svg className={`github-sync__icon${busy ? ' github-sync__icon--spin' : ''}`} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a9 9 0 0 0-15.5-6.2L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 15.5 6.2L21 16" />
          <path d="M21 21v-5h-5" />
        </svg>
        {paused ? (
          <span className="github-sync__count github-sync__count--warn" aria-hidden="true">
            !
          </span>
        ) : tick && pendingCount === 0 ? (
          <span className="github-sync__count github-sync__count--ok" aria-hidden="true">
            ✓
          </span>
        ) : (
          pendingCount > 0 && (
            <span className="github-sync__count" aria-hidden="true">
              {pendingCount}
            </span>
          )
        )}
      </Button>
      <span className="sr-only" role="status">
        {busy ? t('sync.sync.running') : lastText ? t('sync.sync.last', { when: lastText }) : t('sync.sync.never')}
      </span>
      {pendingCount > 0 && <span className="sr-only">{t('sync.sync.pendingCount', { count: pendingCount })}</span>}
      {paused && <span className="sr-only">{t('sync.sync.paused')}</span>}
      {conflicts && (
        <Conflicts
          conflicts={conflicts}
          onCancel={() => setConflicts(null)}
          onApply={(decisions) => {
            setConflicts(null);
            void sync(decisions);
          }}
        />
      )}
    </span>
  );
}
