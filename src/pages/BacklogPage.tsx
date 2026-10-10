import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EpicTag } from '../components/EpicTag';
import { sortByRank } from '../domain/board';
import { hrefs } from '../router';
import { useApp } from '../state/AppState';

export function BacklogPage() {
  const { t } = useTranslation();
  const app = useApp();
  const epics = useMemo(() => new Map(app.epics.map((epic) => [epic.id, epic])), [app.epics]);
  const rows = sortByRank(app.stories);

  return (
    <>
      <div className="page-head">
        <h1>{t('backlog.title')}</h1>
        <span className="muted">{t('backlog.hint')}</span>
      </div>
      <ol className="backlog">
        {rows.map((story, index) => (
          <li key={story.id} className="backlog__row">
            <span className="backlog__rank" aria-label={t('backlog.rank', { rank: index + 1 })}>
              {index + 1}
            </span>
            <span className="card__code backlog__code">{story.code}</span>
            <a className="backlog__title" href={hrefs.story(story.id)}>
              {story.title}
            </a>
            <EpicTag epic={epics.get(story.epicId)} />
            <span className="pill" title={t('card.points', { count: story.points })}>
              {story.points}
            </span>
            <button
              type="button"
              className={`btn btn--toggle${story.inSprint ? ' btn--on' : ''}`}
              aria-pressed={story.inSprint}
              onClick={() => app.toggleSprint(story.id)}
            >
              {t('backlog.sprintToggle')}{' '}
              <span className="sr-only">– {story.title}</span>
            </button>
            <div className="backlog__moves">
              <button
                type="button"
                className="icon-btn"
                aria-label={t('backlog.moveUp', { title: story.title })}
                disabled={index === 0}
                onClick={() => app.moveInBacklog(story.id, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={t('backlog.moveDown', { title: story.title })}
                disabled={index === rows.length - 1}
                onClick={() => app.moveInBacklog(story.id, 1)}
              >
                ↓
              </button>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
