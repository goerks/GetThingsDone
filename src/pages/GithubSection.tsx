import { useEffect, useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { DEMO_READONLY_TOKEN, DEMO_REPO, DEMO_WRONG_TOKEN, demoIssues, resetDemoIssues, saveDemoIssues } from '../github/demoSource';
import { CONNECTOR_KINDS, GithubError, isGithubDemo } from '../github';
import { Dialog } from '../components/Dialog';
import { GithubLog } from '../components/GithubLog';
import { InfoHint } from '../components/InfoHint';
import { FeatureTab } from './FeatureTab';
import type { ConflictRule } from '../domain/types';
import { parseRepo, repoText, type RepoRef } from '../domain/github';
import { useApp } from '../state/AppState';

type Status = { kind: 'idle' } | { kind: 'testing' } | { kind: 'ok'; count: number } | { kind: 'error'; error: GithubError['kind'] };

/** The text of a failed call for the user, from `github.errors.<kind>`. */
export const githubErrorKey = (cause: unknown): GithubError['kind'] => (cause instanceof GithubError ? cause.kind : 'other');

/**
 * Settings › GitHub (#30, #61): the switch of the feature and, while it is on, repository and access token of the one
 * repository whose issues are imported. The token is never shown again after it was saved.
 */
export function GithubSection() {
  return (
    <FeatureTab feature="github">
      <GithubSettings />
    </FeatureTab>
  );
}

function GithubSettings() {
  const { t, i18n } = useTranslation();
  const app = useApp();
  const id = useId();
  const [repoInput, setRepoText] = useState(app.settings.github.repo);
  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [problem, setProblem] = useState<'repoMissing' | 'repoFormat' | 'tokenMissing' | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [removing, setRemoving] = useState(false);
  const demo = isGithubDemo();

  useEffect(() => {
    let cancelled = false;
    app.githubTokens
      .get()
      .then((stored) => !cancelled && setHasToken(stored !== null && stored !== ''))
      .catch(() => !cancelled && setHasToken(false));
    return () => {
      cancelled = true;
    };
    // The token store is created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connected = app.settings.github.repo !== '';

  const test = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const text = repoInput.trim();
    if (text === '') return setProblem('repoMissing');
    if (!parseRepo(text)) return setProblem('repoFormat');
    const entered = token.trim();
    const stored = entered !== '' ? entered : await app.githubTokens.get();
    if (!stored) return setProblem('tokenMissing');
    setProblem(null);
    app.setGithubRepo(text);
    setStatus({ kind: 'testing' });
    try {
      const count = await app.testGithub(text, stored);
      // The token is only kept once GitHub accepted it.
      if (entered !== '') {
        await app.githubTokens.set(entered);
        setToken('');
        setHasToken(true);
      }
      setRepoText(repoText(parseRepo(text) as RepoRef));
      setStatus({ kind: 'ok', count });
    } catch (cause) {
      setStatus({ kind: 'error', error: githubErrorKey(cause) });
    }
  };

  const disconnect = async (): Promise<void> => {
    setRemoving(false);
    await app.githubTokens.clear();
    app.disconnectGithub();
    setRepoText('');
    setToken('');
    setHasToken(false);
    setProblem(null);
    setStatus({ kind: 'idle' });
  };

  const repoProblem = problem === 'repoMissing' || problem === 'repoFormat' ? t(`github.settings.problem.${problem}`) : null;
  const tokenProblem = problem === 'tokenMissing' ? t('github.settings.problem.tokenMissing') : null;

  return (
    <div className="map-settings github-settings">
      <div className="map-settings__head">
        <span className="github-settings__title">
          <h3>{t('github.settings.title')}</h3>
          <InfoHint text={t('github.settings.hint')} />
        </span>
        <span className="github-settings__badges">
          {demo && <span className="badge badge--demo">{t('github.demo.badge')}</span>}
          {connected && hasToken && <span className="badge badge--ok">{t('github.settings.connected')}</span>}
        </span>
      </div>
      <h3>
        {t('github.connections.title')} <InfoHint text={t('github.connections.intro')} />
      </h3>
      <ul className="github-services">
        {CONNECTOR_KINDS.map((service) => (
          <li key={service.kind} className={service.status === 'planned' ? 'github-services__off' : undefined}>
            <strong>{t(`github.connections.names.${service.kind}`)}</strong>
            <span className={service.status === 'available' && connected && hasToken ? 'badge badge--ok' : 'badge'}>
              {service.status === 'planned' ? t('github.connections.planned') : connected && hasToken ? t('github.connections.connected') : t('github.connections.available')}
            </span>
          </li>
        ))}
      </ul>
      <h3>{t('github.connections.names.github')}</h3>
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
            {t('github.settings.test')}
          </button>
          {(connected || hasToken) && (
            <button type="button" className="btn" onClick={() => setRemoving(true)}>
              {t('github.settings.disconnect')}
            </button>
          )}
        </div>
      </form>
      <div role="status" className="github-settings__status">
        {status.kind === 'testing' && <span className="muted">{t('github.settings.testing')}</span>}
        {status.kind === 'ok' && <span className="github-ok">✓ {t('github.settings.ok', { count: status.count })}</span>}
      </div>
      {status.kind === 'error' && (
        <p role="alert" className="notice notice--error">
          {t(`github.errors.${status.error}`)}
        </p>
      )}
      <div className="github-options github-options--row">
        <label>
          <input type="checkbox" checked={app.settings.github.write} onChange={(event) => app.setGithubOptions({ write: event.target.checked })} /> {t('github.settings.write.label')}
        </label>
        <InfoHint text={t('github.settings.write.help')} />
      </div>
      <div className="github-auto">
        <div className="github-options github-options--row">
          <label>
            <input type="checkbox" checked={app.settings.github.auto} disabled={!connected} onChange={(event) => app.setGithubAuto(event.target.checked)} /> {t('github.auto.label')}
          </label>
          <InfoHint text={t('github.auto.hint')} />
        </div>
        {app.settings.github.auto && (
          <p className="muted" role="status">
            {[
              app.settings.github.lastSyncAt ? t('github.auto.last', { when: new Date(app.settings.github.lastSyncAt).toLocaleTimeString(i18n.resolvedLanguage, { timeStyle: 'short' }) }) : '',
              app.githubSync.paused ? t('github.auto.paused') : app.githubSync.nextAt ? t('github.auto.next', { when: new Date(app.githubSync.nextAt).toLocaleTimeString(i18n.resolvedLanguage, { timeStyle: 'short' }) }) : ''
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>
      <fieldset className="github-options">
        <legend>{t('github.settings.conflict.legend')}</legend>
        {(['remote', 'local', 'ask'] as const).map((rule: ConflictRule) => (
          <label key={rule}>
            <input type="radio" name={`${id}-conflict`} checked={app.settings.github.conflict === rule} onChange={() => app.setGithubOptions({ conflict: rule })} /> {t(`github.settings.conflict.${rule}`)}
          </label>
        ))}
      </fieldset>
      {removing && (
        <Dialog title={t('github.disconnect.title')} onClose={() => setRemoving(false)}>
          <p>{t('github.disconnect.text')}</p>
          <div className="form__actions">
            <button type="button" className="btn" onClick={() => setRemoving(false)}>
              {t('github.disconnect.cancel')}
            </button>
            <button type="button" className="btn btn--primary" onClick={() => void disconnect()}>
              {t('github.disconnect.confirm')}
            </button>
          </div>
        </Dialog>
      )}
      {connected && <GithubLog />}
      {demo && <DemoTools />}
    </div>
  );
}

/** The simulated GitHub of the preview: buttons that change its issues, so a sync can be tried out (#30). */
function DemoTools() {
  const { t } = useTranslation();
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
