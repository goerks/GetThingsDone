import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NewReleaseDialog } from '../components/ReleaseForm';
import { formatPeriod } from '../components/releaseFormat';
import { useNewShortcut } from '../components/useNewShortcut';
import { useBuiltin } from '../components/useBuiltin';
import { netChange, scopeReport } from '../domain/history';
import { releaseState, releaseStats, sortReleases } from '../domain/releases';
import { todayIso } from '../domain/sprints';
import { useApp } from '../state/AppState';
import { useDetails } from '../state/Details';

/** All releases as cards; a click opens the release in a dialog. Ctrl+N or the last card creates a release. */
export function ReleasesPage() {
  const { t, i18n } = useTranslation();
  const app = useApp();
  const builtin = useBuiltin();
  const details = useDetails();
  const [creating, setCreating] = useState(false);
  const open = useCallback(() => setCreating(true), []);
  useNewShortcut(open, !creating);
  const today = todayIso();
  const language = i18n.resolvedLanguage ?? 'en';
  const pointsShown = builtin.shown('story', 'points');
  const planned = app.stories.filter((story) => story.releaseId !== null);

  return (
    <>
      <div className="page-head">
        <h1>{t('releases.title')}</h1>
        <span className="muted">{app.releases.length > 0 ? `${t('releases.count', { count: app.releases.length })} · ${builtin.summary(planned.length, planned.reduce((sum, story) => sum + story.points, 0))}` : t('releases.hint')}</span>
      </div>
      {creating && <NewReleaseDialog onClose={() => setCreating(false)} />}
      {app.releases.length === 0 && <p className="muted">{t('releases.none')}</p>}
      <ul className="release-list">
        {sortReleases(app.releases, app.stories, app.isDone).map((release) => {
          const stats = releaseStats(app.stories, release.id, app.isDone);
          const state = releaseState(release, app.stories, today, app.isDone);
          const percent = stats.points === 0 ? 0 : Math.round(((pointsShown ? stats.donePoints / stats.points : stats.doneStories / stats.stories) || 0) * 100);
          const progress = pointsShown
            ? t('releases.progress', { done: stats.donePoints, total: stats.points })
            : t('releases.progressStories', { done: stats.doneStories, total: stats.stories });
          const report = scopeReport(release, app.events, today);
          const net = report ? netChange(report) : null;
          const delta = (value: number): string => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '±0');
          return (
            <li key={release.id}>
              <button type="button" className="release-card" onClick={() => details.openRelease(release.id)}>
                <span className="release-card__top">
                  <span className="release-card__title">{release.title}</span>
                  <span className={`release-state release-state--${state}`}>{t(`releases.state.${state}`)}</span>
                </span>
                <span className="release-card__period">{formatPeriod(release, t, language)}</span>
                {release.description && <span className="release-card__description">{release.description}</span>}
                <span className="release-card__numbers">
                  <span>
                    <strong>{stats.stories}</strong> {t('releases.stat.stories')}
                  </span>
                  {pointsShown && (
                    <span>
                      <strong>{stats.points}</strong> {t('releases.stat.points')}
                    </span>
                  )}
                  <span>
                    <strong>{pointsShown ? stats.donePoints : stats.doneStories}</strong> {pointsShown ? t('releases.stat.donePoints') : t('releases.state.done')}
                  </span>
                </span>
                <span className="progress" role="img" aria-label={progress}>
                  <span className="progress__bar" style={{ width: `${percent}%` }} />
                </span>
                {net && (
                  <span className="release-card__scope">
                    {t('releases.sinceStart')}{' '}
                    {net.tickets === 0 && net.points === 0 ? (
                      <span className="delta">{t('releases.sinceNone')}</span>
                    ) : (
                      <>
                        <span className={`delta ${net.tickets >= 0 ? 'delta--up' : 'delta--down'}`}>{`${net.tickets === 0 ? '±' : net.tickets < 0 ? '−' : '+'}${t('summary.stories', { count: Math.abs(net.tickets) })}`}</span>{' '}
                        {pointsShown && <span className={`delta ${net.points >= 0 ? 'delta--up' : 'delta--down'}`}>{`${delta(net.points)} ${t('releases.scope.unitShort.points')}`}</span>}
                      </>
                    )}
                  </span>
                )}
              </button>
            </li>
          );
        })}
        <li>
          <button type="button" className="release-card release-card--new" onClick={open} aria-keyshortcuts="Control+N Meta+N">
            <span>{t('releases.newCard')}</span>
            <kbd className="release-card__keys">{t('releases.shortcut')}</kbd>
          </button>
        </li>
      </ul>
    </>
  );
}
