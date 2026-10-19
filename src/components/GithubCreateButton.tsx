import { useTranslation } from 'react-i18next';
import { githubErrorKey } from '../pages/GithubSection';
import { featureOn } from '../domain/settings';
import { useApp } from '../state/AppState';
import { useToast } from '../state/Toast';

/**
 * "Create on GitHub" for a release (the milestone) or an epic (the label "epic: <name>"), #30. Only while writing to GitHub
 * is allowed; nothing is made without this action.
 */
export function GithubCreateButton({ kind, id }: { kind: 'release' | 'epic'; id: string }) {
  const { t } = useTranslation();
  const app = useApp();
  const toast = useToast();
  const { github } = app.settings;
  if (!featureOn(app.settings, 'github') || !github.write || github.repo === '') return null;
  const run = (): void => {
    const made = kind === 'release' ? app.createMilestoneOnGithub(id) : app.createEpicLabelOnGithub(id);
    made
      .then((created) => toast.notify(t(created ? `github.create.${kind}Done` : `github.create.${kind}Exists`)))
      .catch((cause: unknown) => toast.notify(t('github.create.itemFailed', { reason: t(`github.errors.${githubErrorKey(cause)}`) })));
  };
  return (
    <button type="button" className="btn" onClick={run}>
      {t('github.create.menu')}
    </button>
  );
}
