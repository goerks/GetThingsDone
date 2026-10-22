import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../components/Dialog';
import { downloadTextFile } from '../data/files';
import { isTauri } from '../data/createRepository';
import { BACKUP_VERSION, backupFileName, countsOf, parseBackup, serializeBackup, type BackupCounts, type BackupProblem, type ParsedBackup } from '../domain/backup';
import { todayIso } from '../domain/sprints';
import type { Snapshot } from '../domain/types';
import { useApp } from '../state/AppState';
import { BareInput, Button } from '../ui';

type Message = { kind: 'ok' | 'problem'; text: string };
type Accepted = Extract<ParsedBackup, { ok: true }> & { fileName: string };

/**
 * Settings › Data (#16): export all data into one file and import such a file. An import replaces everything, so it
 * shows what the file holds and what is replaced, and asks first.
 */
export function DataSection() {
  const { t, i18n } = useTranslation();
  const app = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [exported, setExported] = useState<Message | null>(null);
  const [imported, setImported] = useState<Message | null>(null);
  const [pending, setPending] = useState<Accepted | null>(null);
  const [busy, setBusy] = useState(false);

  const snapshot = (): Snapshot => ({
    epics: app.epics,
    sprints: app.sprints,
    releases: app.releases,
    members: app.members,
    events: app.events,
    changeLog: app.changeLog,
    stories: app.stories,
    statuses: app.statuses,
    fields: app.fields,
    assignments: app.assignments,
    settings: app.settings
  });

  const countsText = (counts: BackupCounts): string =>
    (['stories', 'epics', 'sprints', 'releases'] as const).map((kind) => t(`settings.data.count.${kind}`, { count: counts[kind] })).join(', ');

  /** Saves the current data as a file. Returns its name. */
  const exportNow = (): string => {
    const name = backupFileName(todayIso());
    downloadTextFile(name, serializeBackup(snapshot(), new Date().toISOString()));
    return name;
  };

  const onExport = (): void => {
    const name = exportNow();
    setExported({ kind: 'ok', text: t('settings.data.exported', { name, counts: countsText(countsOf(app)) }) });
  };

  const problemText = (problem: BackupProblem, version?: number): string =>
    t(`settings.data.problem.${problem}`, { version, known: BACKUP_VERSION });

  const onFile = async (file: File | undefined): Promise<void> => {
    if (input.current) input.current.value = '';
    if (!file) return;
    setImported(null);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setImported({ kind: 'problem', text: t('settings.data.problem.unreadable') });
      return;
    }
    const parsed = parseBackup(text, todayIso());
    if (!parsed.ok) {
      setImported({ kind: 'problem', text: t('settings.data.problem.refused', { reason: problemText(parsed.problem, parsed.version) }) });
      return;
    }
    setPending({ ...parsed, fileName: file.name });
  };

  const onReplace = async (): Promise<void> => {
    if (!pending) return;
    setBusy(true);
    try {
      await app.importData(pending.snapshot);
      setImported({ kind: 'ok', text: t('settings.data.imported', { counts: countsText(pending.counts) }) });
      setPending(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setPending(null);
      setImported({ kind: 'problem', text: t('settings.data.importFailed', { message }) });
    } finally {
      setBusy(false);
    }
  };

  const exportedOn = (iso: string | null): string | null => {
    const date = iso ? new Date(iso) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(i18n.language) : null;
  };

  return (
    <div className="map-settings data-settings">
      <div className="map-settings__head">
        <h2>{t('settings.data.title')}</h2>
        <p className="muted">{t('settings.data.subtitle')}</p>
      </div>

      <section className="feature data-card" aria-labelledby="data-export-title">
        <h3 id="data-export-title">{t('settings.data.export.title')}</h3>
        <p className="muted">{t('settings.data.export.text')}</p>
        <div className="data-card__actions">
          <Button type="button" variant="primary" onClick={onExport}>
            {t('settings.data.export.button')}
          </Button>
          <span className="muted">{t('settings.data.export.fileName')}</span>
          <code className="data-card__file">{backupFileName(todayIso())}</code>
        </div>
        <p role="status" className={`data-card__message${exported ? ' data-card__message--ok' : ''}`}>
          {exported ? `✓ ${exported.text}` : ''}
        </p>
      </section>

      <section className="feature data-card" aria-labelledby="data-import-title">
        <h3 id="data-import-title">{t('settings.data.import.title')}</h3>
        <p className="muted">
          {t('settings.data.import.text1')} <strong>{t('settings.data.import.replaces')}</strong> {t('settings.data.import.text2')}
        </p>
        {!isTauri() && <p className="muted data-card__demo">{t('settings.data.import.demo')}</p>}
        <div className="data-card__actions">
          <Button type="button" onClick={() => input.current?.click()}>
            {t('settings.data.import.button')}
          </Button>
          <span className="muted">{t('settings.data.import.safe')}</span>
          <BareInput
            ref={input}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            tabIndex={-1}
            aria-label={t('settings.data.import.fileLabel')}
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
        </div>
        <div aria-live="polite" className="data-card__live">
          {imported && (
            <p role={imported.kind === 'problem' ? 'alert' : 'status'} className={`data-card__message data-card__message--${imported.kind}`}>
              {imported.kind === 'ok' ? '✓ ' : '⚠ '}
              {imported.text}
            </p>
          )}
        </div>
      </section>

      {pending && (
        <Dialog title={t('settings.data.confirm.title')} onClose={() => !busy && setPending(null)}>
          <p className="muted">
            {t('settings.data.confirm.file', { name: pending.fileName })}
            {exportedOn(pending.exportedAt) ? t('settings.data.confirm.exportedOn', { date: exportedOn(pending.exportedAt) }) : ''}
          </p>
          <table className="data-compare">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">{t('settings.data.confirm.kind')}</span>
                </th>
                <th scope="col">{t('settings.data.confirm.inFile')}</th>
                <th scope="col">{t('settings.data.confirm.today')}</th>
              </tr>
            </thead>
            <tbody>
              {(['stories', 'epics', 'sprints', 'releases'] as const).map((kind) => (
                <tr key={kind}>
                  <th scope="row">{t(`settings.data.confirm.${kind}`)}</th>
                  <td>{pending.counts[kind]}</td>
                  <td>{countsOf(app)[kind]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="data-warning" role="note">
            <span aria-hidden="true">⚠</span> {t('settings.data.confirm.warning')}
          </p>
          <div className="form__actions data-confirm__actions">
            <Button type="button" onClick={() => setPending(null)} disabled={busy}>
              {t('settings.data.confirm.cancel')}
            </Button>
            <Button type="button" onClick={exportNow} disabled={busy}>
              {t('settings.data.confirm.exportFirst')}
            </Button>
            <Button type="button" variant="danger" onClick={() => void onReplace()} disabled={busy}>
              {t('settings.data.confirm.replace')}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
