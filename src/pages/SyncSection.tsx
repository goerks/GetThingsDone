import { useEffect, useId, useState, type FormEvent } from 'react';
import { DEMO_READONLY_TOKEN, DEMO_REPO, DEMO_WRONG_TOKEN, demoIssues, resetDemoIssues, saveDemoIssues } from '../sync/github/demoApi';
import { isSyncDemo, SyncError } from '../sync';
import { Dialog } from '../components/Dialog';
import { InfoHint } from '../components/InfoHint';
import { SyncLog } from '../components/SyncLog';
import { FeatureTab } from './FeatureTab';
import { SERVICE_KINDS } from '../domain/settings';
import type { ConflictRule, ServiceKind } from '../domain/types';
import { parseRepo, repoText, type RepoRef } from '../sync/github/format';
import { useApp } from '../state/AppState';
import { useSyncT } from '../sync/useSyncT';
import { serviceName } from '../sync/syncT';

type Status = { kind: 'idle' } | { kind: 'testing' } | { kind: 'ok'; count: number } | { kind: 'error'; error: SyncError['kind'] };

/** The kind of a failed call, for the text `sync.errors.<kind>`. */
export const syncErrorKey = (cause: unknown): SyncError['kind'] => (cause instanceof SyncError ? cause.kind : 'other');

/**
 * Settings › Synchronisation (#30, #61, #66): the switch of the feature and, while it is on, the choice of the one
 * service that is active and the connection to it. The token is never shown again after it was saved.
 */
export function SyncSection() {
  return (
    <FeatureTab feature="sync">
      <SyncSettings />
    </FeatureTab>
  );
}

function SyncSettings() {
  const { t, i18n } = useSyncT();
  const app = useApp();
  const id = useId();
  const sync = app.settings.sync;
  const [asking, setAsking] = useState<ServiceKind | null>(null);
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const connected = Object.keys(sync.connection).length > 0;
  const linked = app.stories.filter((story) => story.link).length;

  useEffect(() => {
    let cancelled = false;
    app.syncTokens
      .get()
      .then((stored) => !cancelled && setHasToken(stored !== null && stored !== ''))
      .catch(() => !cancelled && setHasToken(false));
    return () => {
      cancelled = true;
    };
    // The tokens are asked again when the service changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync.service]);

  const choose = (kind: ServiceKind): void => {
    if (kind === sync.service || !app.syncAvailable.includes(kind)) return;
    // Nothing is connected yet: nothing is lost, so nothing is asked.
    if (!connected && !hasToken) void app.switchService(kind);
    else setAsking(kind);
  };

  const isConnected = connected && hasToken === true;

  return (
    <div className="map-settings github-settings">
      <div className="map-settings__head">
        <span className="github-settings__title">
          <h3>{serviceName(t, sync.service)}</h3>
          <InfoHint text={t('sync.settings.hint')} />
        </span>
        <span className="github-settings__badges">
          {isSyncDemo() && <span className="badge badge--demo">{t('sync.demo.badge')}</span>}
          {isConnected && <span className="badge badge--ok">{t('sync.settings.connected')}</span>}
        </span>
      </div>
      <fieldset className="github-services sync-services">
        <legend>
          {t('sync.service.legend')} <InfoHint text={t('sync.service.hint')} />
        </legend>
        {SERVICE_KINDS.map((kind) => {
          const available = app.syncAvailable.includes(kind);
          const selected = kind === sync.service;
          return (
            <label key={kind} className={`sync-service${selected ? ' sync-service--on' : ''}${available ? '' : ' github-services__off'}`}>
              <input type="radio" name={`${id}-service`} checked={selected} disabled={!available} onChange={() => choose(kind)} />
              <strong>{serviceName(t, kind)}</strong>
              <span className={selected && isConnected ? 'badge badge--ok' : 'badge'}>
                {!available ? t('sync.service.planned') : selected ? (isConnected ? t('sync.service.connected') : t('sync.service.active')) : t('sync.service.available')}
              </span>
            </label>
          );
        })}
      </fieldset>
      {sync.service === 'github' ? <GithubForm key={sync.service} hasToken={hasToken} setHasToken={setHasToken} /> : null}
      <div className="github-options github-options--row">
        <label>
          <input type="checkbox" checked={sync.write} onChange={(event) => app.setSyncOptions({ write: event.target.checked })} /> {t('sync.settings.write.label')}
        </label>
        <InfoHint text={t('sync.settings.write.help')} />
      </div>
      <div className="github-auto">
        <div className="github-options github-options--row">
          <label>
            <input type="checkbox" checked={sync.auto} disabled={!connected} onChange={(event) => app.setSyncAuto(event.target.checked)} /> {t('sync.auto.label')}
          </label>
          <InfoHint text={t('sync.auto.hint')} />
        </div>
        {sync.auto && (
          <p className="muted" role="status">
            {[
              sync.lastSyncAt ? t('sync.auto.last', { when: new Date(sync.lastSyncAt).toLocaleTimeString(i18n.resolvedLanguage, { timeStyle: 'short' }) }) : '',
              app.syncState.paused ? t('sync.auto.paused') : app.syncState.nextAt ? t('sync.auto.next', { when: new Date(app.syncState.nextAt).toLocaleTimeString(i18n.resolvedLanguage, { timeStyle: 'short' }) }) : ''
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>
      <fieldset className="github-options">
        <legend>{t('sync.settings.conflict.legend')}</legend>
        {(['remote', 'local', 'ask'] as const).map((rule: ConflictRule) => (
          <label key={rule}>
            <input type="radio" name={`${id}-conflict`} checked={sync.conflict === rule} onChange={() => app.setSyncOptions({ conflict: rule })} /> {t(`sync.settings.conflict.${rule}`)}
          </label>
        ))}
      </fieldset>
      {asking && (
        <Dialog title={t('sync.switch.title', { to: serviceName(t, asking) })} onClose={() => setAsking(null)}>
          <p>{linked > 0 ? t('sync.switch.linked', { count: linked }) : t('sync.switch.connected')}</p>
          <ul>
            <li>{t('sync.switch.removes')}</li>
            {linked > 0 && <li>{t('sync.switch.stay', { count: linked })}</li>}
            {linked > 0 && <li>{t('sync.switch.importAgain', { to: serviceName(t, asking) })}</li>}
            {linked > 0 && <li>{t('sync.switch.create', { to: serviceName(t, asking) })}</li>}
          </ul>
          <div className="form__actions">
            <button type="button" className="btn" onClick={() => setAsking(null)}>
              {t('sync.switch.cancel')}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                const kind = asking;
                setAsking(null);
                void app.switchService(kind);
              }}
            >
              {t('sync.switch.confirm', { to: serviceName(t, asking) })}
            </button>
          </div>
        </Dialog>
      )}
      {connected && <SyncLog />}
      {sync.service === 'github' && isSyncDemo() && <DemoTools />}
    </div>
  );
}

/** The connection to GitHub: repository and access token of the one repository whose issues are imported. */
function GithubForm({ hasToken, setHasToken }: { hasToken: boolean | null; setHasToken: (value: boolean) => void }) {
  const { t } = useSyncT();
  const app = useApp();
  const id = useId();
  const [repoInput, setRepoText] = useState(app.settings.sync.connection.repo ?? '');
  const [token, setToken] = useState('');
  const [problem, setProblem] = useState<'repoMissing' | 'repoFormat' | 'tokenMissing' | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [removing, setRemoving] = useState(false);
  const demo = isSyncDemo();
  const connected = (app.settings.sync.connection.repo ?? '') !== '';

  const test = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const text = repoInput.trim();
    if (text === '') return setProblem('repoMissing');
    if (!parseRepo(text)) return setProblem('repoFormat');
    const entered = token.trim();
    const stored = entered !== '' ? entered : await app.syncTokens.get();
    if (!stored) return setProblem('tokenMissing');
    setProblem(null);
    app.setSyncConnection({ repo: text });
    setStatus({ kind: 'testing' });
    try {
      const count = await app.testSync({ repo: text }, stored);
      // The token is only kept once GitHub accepted it.
      if (entered !== '') {
        await app.syncTokens.set(entered);
        setToken('');
        setHasToken(true);
      }
      setRepoText(repoText(parseRepo(text) as RepoRef));
      setStatus({ kind: 'ok', count });
    } catch (cause) {
      setStatus({ kind: 'error', error: syncErrorKey(cause) });
    }
  };

  const disconnect = async (): Promise<void> => {
    setRemoving(false);
    await app.disconnectSync();
    setRepoText('');
    setToken('');
    setHasToken(false);
    setProblem(null);
    setStatus({ kind: 'idle' });
  };

  const repoProblem = problem === 'repoMissing' || problem === 'repoFormat' ? t(`github.settings.problem.${problem}`) : null;
  const tokenProblem = problem === 'tokenMissing' ? t('github.settings.problem.tokenMissing') : null;

  return (
    <>
      <form className="form" onSubmit={(event) => void test(event)} noValidate>
        <div className="field">
          <label htmlFor={`${id}-repo`}>{t('github.settings.repo')}</label>
          <input
            id={`${id}-repo`}
            className="input"
            value={repoInput}
            placeholder="owner/name"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={repoProblem ? true : undefined}
            aria-describedby={repoProblem ? `${id}-repo-problem` : undefined}
            onChange={(event) => setRepoText(event.target.value)}
          />
          {repoProblem && (
            <p id={`${id}-repo-problem`} role="alert" className="field-error">
              {repoProblem}
            </p>
          )}
        </div>
        <div className="field">
          <div className="field__label-row">
            <label htmlFor={`${id}-token`}>{t('github.settings.token')}</label>
            <InfoHint id={`${id}-token-note`} text={t(demo ? 'github.settings.tokenNoteDemo' : 'github.settings.tokenNote', { wrong: DEMO_WRONG_TOKEN, readonly: DEMO_READONLY_TOKEN })} />
          </div>
          <input
            id={`${id}-token`}
            className="input"
            type="password"
            value={token}
            placeholder={hasToken ? t('github.settings.tokenSaved') : ''}
            autoComplete="off"
            aria-invalid={tokenProblem ? true : undefined}
            aria-describedby={`${id}-token-note${tokenProblem ? ` ${id}-token-problem` : ''}`}
            onChange={(event) => setToken(event.target.value)}
          />
          {tokenProblem && (
            <p id={`${id}-token-problem`} role="alert" className="field-error">
              {tokenProblem}
            </p>
          )}
          {connected && hasToken === false && !tokenProblem && <p className="muted">{t('github.settings.tokenMissingNote')}</p>}
        </div>
        <div className="form__actions github-settings__actions">
          <button type="submit" className="btn btn--primary" disabled={status.kind === 'testing'}>
            {t('sync.settings.test')}
          </button>
          {(connected || hasToken) && (
            <button type="button" className="btn" onClick={() => setRemoving(true)}>
              {t('sync.settings.disconnect')}
            </button>
          )}
        </div>
      </form>
      <div role="status" className="github-settings__status">
        {status.kind === 'testing' && <span className="muted">{t('sync.settings.testing')}</span>}
        {status.kind === 'ok' && <span className="github-ok">✓ {t('sync.settings.ok', { count: status.count })}</span>}
      </div>
      {status.kind === 'error' && (
        <p role="alert" className="notice notice--error">
          {t(`sync.errors.${status.error}`)}
        </p>
      )}
      {removing && (
        <Dialog title={t('sync.disconnect.title')} onClose={() => setRemoving(false)}>
          <p>{t('sync.disconnect.text')}</p>
          <div className="form__actions">
            <button type="button" className="btn" onClick={() => setRemoving(false)}>
              {t('sync.disconnect.cancel')}
            </button>
            <button type="button" className="btn btn--primary" onClick={() => void disconnect()}>
              {t('sync.disconnect.confirm')}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

/** The simulated GitHub of the preview: buttons that change its issues, so a sync can be tried out (#30). */
function DemoTools() {
  const { t } = useSyncT();
  const [done, setDone] = useState<string | null>(null);

  const change = (key: string, work: (issues: ReturnType<typeof demoIssues>) => ReturnType<typeof demoIssues>): void => {
    saveDemoIssues(work(demoIssues()));
    setDone(key);
  };
  const patch = (number: number, changes: Partial<ReturnType<typeof demoIssues>[number]>) => (issues: ReturnType<typeof demoIssues>) =>
    issues.map((issue) => (issue.number === number ? { ...issue, ...changes } : issue));

  const actions: Array<[string, () => void]> = [
    ['rename', () => change('rename', patch(31, { title: 'Login-Seite', body: 'Users log in with e-mail and password, on a page of their own.\n\n## Acceptance criteria\n- [ ] Login possible\n- [x] Error message for a wrong password\n', labels: ['feature', 'bug'] }))],
    ['criteria', () => change('criteria', patch(31, { body: 'Users log in with e-mail and password.\n\n## Acceptance criteria\n- [ ] Login possible\n- [ ] Password can be reset\n- [x] Error message for a wrong password\n' }))],
    ['close', () => change('close', patch(35, { state: 'closed' }))],
    ['reopen', () => change('reopen', patch(35, { state: 'open' }))],
    [
      'add',
      () =>
        change('add', (issues) =>
          issues.some((issue) => issue.number === 44)
            ? issues
            : [...issues, { number: 44, title: 'Notifications', body: 'Tell the team when a sprint ends.', state: 'open', labels: ['feature'], url: `https://github.com/${DEMO_REPO.owner}/${DEMO_REPO.name}/issues/44` }]
        )
    ],
    [
      'reset',
      () => {
        resetDemoIssues();
        setDone('reset');
      }
    ]
  ];

  return (
    <section className="github-demo" aria-label={t('github.demo.title')}>
      <h3>
        {t('github.demo.title')} <InfoHint text={t('github.demo.text', { repo: `${DEMO_REPO.owner}/${DEMO_REPO.name}`, wrong: DEMO_WRONG_TOKEN, readonly: DEMO_READONLY_TOKEN })} />
      </h3>
      <div className="github-demo__buttons">
        {actions.map(([key, run]) => (
          <button key={key} type="button" className="btn btn--small" onClick={run}>
            {t(`github.demo.${key}`)}
          </button>
        ))}
      </div>
      <p role="status" className="muted">
        {done ? t('github.demo.done') : ''}
      </p>
    </section>
  );
}
