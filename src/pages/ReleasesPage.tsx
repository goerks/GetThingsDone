import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NewReleaseDialog } from '../components/ReleaseForm';
import { NewButton } from '../components/NewButton';
import { useNewShortcut } from '../components/useNewShortcut';
import { useBuiltin } from '../components/useBuiltin';
import { sortReleases } from '../domain/releases';
import { useApp } from '../state/AppState';
import { ReleaseCard } from '../components/ReleaseCard';

/** All releases as cards; a click opens the release in a dialog. Ctrl+N or the button in the page head creates a release. */
export function ReleasesPage() {
  const { t } = useTranslation();
  const app = useApp();
  const builtin = useBuiltin();
  const [creating, setCreating] = useState(false);
  const open = useCallback(() => setCreating(true), []);
  useNewShortcut(open, !creating);
  const planned = app.stories.filter((story) => story.releaseId !== null);

  return (
    <>
      <div className="page-head">
        <h1>{t('releases.title')}</h1>
        <span className="muted">{app.releases.length > 0 ? `${t('releases.count', { count: app.releases.length })} · ${builtin.summary(planned.length, planned.reduce((sum, story) => sum + story.points, 0))}` : t('releases.hint')}</span>
        <NewButton label={t('releases.newCard')} onClick={open} />
      </div>
      {creating && <NewReleaseDialog onClose={() => setCreating(false)} />}
      {app.releases.length === 0 && <p className="muted">{t('releases.none')}</p>}
      <ul className="release-list">
        {sortReleases(app.releases, app.stories, app.isDone).map((release) => (
          <li key={release.id}>
            <ReleaseCard release={release} />
          </li>
        ))}
      </ul>
    </>
  );
}
