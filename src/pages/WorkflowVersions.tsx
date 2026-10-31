import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { currentVersionId, versionsNewestFirst } from '../domain/workflow';
import type { WorkflowVersion } from '../domain/types';
import { useApp } from '../state/AppState';
import { Button, TextInput } from '../ui';

/** Date and time of a version in the language of the app. */
function when(language: string, at: string): string {
  return new Date(at).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' });
}

/** One version: date and time, an optional name, and going back (with a confirmation). */
function VersionRow({ version, current }: { version: WorkflowVersion; current: boolean }) {
  const { t, i18n } = useTranslation();
  const app = useApp();
  const [asking, setAsking] = useState(false);
  const at = when(i18n.language, version.at);
  return (
    <li className={`workflow-version${current ? ' workflow-version--current' : ''}`} data-version={version.id}>
      <span className="workflow-version__at">{at}</span>
      {current && <span className="badge">{t('workflow.versions.current')}</span>}
      <TextInput
        className="workflow-version__name"
        aria-label={t('workflow.versions.name', { at })}
        placeholder={t('workflow.versions.namePlaceholder')}
        defaultValue={version.name ?? ''}
        onBlur={(event) => {
          if (event.target.value.trim() !== (version.name ?? '')) app.nameWorkflowVersion(version.id, event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
      {!current && !asking && (
        <Button type="button" aria-label={t('workflow.versions.restoreLabel', { at })} onClick={() => setAsking(true)}>
          {t('workflow.versions.restore')}
        </Button>
      )}
      {asking && (
        <span className="workflow-version__confirm" role="group" aria-label={t('workflow.versions.confirm', { at })}>
          <span>{t('workflow.versions.confirm', { at })}</span>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              app.restoreWorkflowVersion(version.id);
              setAsking(false);
            }}
          >
            {t('workflow.versions.confirmYes')}
          </Button>
          <Button type="button" onClick={() => setAsking(false)}>
            {t('workflow.versions.cancel')}
          </Button>
        </span>
      )}
    </li>
  );
}

/** The versions of the workflow, newest first (#49, AC12). */
export function WorkflowVersions() {
  const { t } = useTranslation();
  const app = useApp();
  const { workflow } = app.settings;
  const headId = useId();
  const current = currentVersionId(workflow);
  return (
    <section className="workflow-versions" aria-labelledby={headId} data-part="versions">
      <h3 id={headId}>{t('workflow.versions.title')}</h3>
      <p className="muted">{t('workflow.versions.hint')}</p>
      {workflow.versions.length === 0 ? (
        <p className="muted">{t('workflow.versions.empty')}</p>
      ) : (
        <ul className="workflow-version-list">
          {versionsNewestFirst(workflow).map((version) => (
            <VersionRow key={version.id} version={version} current={version.id === current} />
          ))}
        </ul>
      )}
    </section>
  );
}
