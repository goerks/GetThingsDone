import { useTranslation } from 'react-i18next';
import { criteriaProgress, totalPoints } from '../../domain/board';
import type { SearchResult } from '../../domain/search';
import type { SearchSnapshot } from '../../domain/types';
import { formatSprintDates } from '../sprintFormat';
import { Highlighted } from './Highlighted';
import { StatusDot } from '../StatusDot';

const ICON = { story: 'S', epic: 'E', sprint: 'SP' } as const;

/** One search result: what it is, its name with the match marked, and where it stands. */
export function ResultRow({ result, snapshot, onPage = false }: { result: SearchResult; snapshot: SearchSnapshot; onPage?: boolean }) {
  const { t, i18n } = useTranslation();
  const badge = onPage ? <span className="result__here">{t('search.onPage')}</span> : null;

  if (result.kind === 'story') {
    const { story } = result;
    const epic = snapshot.epics.find((item) => item.id === story.epicId);
    const sprint = snapshot.sprints.find((item) => item.id === story.sprintId);
    const progress = criteriaProgress(story);
    return (
      <>
        <span className="result__icon" aria-hidden="true">
          {ICON.story}
        </span>
        <span className="result__main">
          <span className="result__title">
            <span className="card__code">
              <Highlighted text={story.code} ranges={result.codeRanges} />
            </span>{' '}
            <Highlighted text={story.title} ranges={result.titleRanges} />
            {badge}
          </span>
          <span className="result__meta">
            {epic && (
              <span className="epic">
                <span className="epic__dot" style={{ background: `var(--epic-${epic.colorKey})` }} aria-hidden="true" />
                {epic.name}
              </span>
            )}
            <span>{t('search.pointsValue', { count: story.points })}</span>
            {progress.total > 0 && (
              <span className="result__progress">
                <span className="progress" aria-hidden="true">
                  <span className="progress__bar" style={{ width: `${progress.percent}%` }} />
                </span>
                {t('search.criteriaCount', { done: progress.done, total: progress.total })}
              </span>
            )}
            <span>{sprint ? sprint.name : t('sprint.notPlanned')}</span>
          </span>
          {result.snippet && (
            <span className="result__snippet">
              {result.snippet.field === 'custom' ? result.snippet.fieldName : t(`search.foundIn.${result.snippet.field}`)}: {result.snippet.cutStart && '… '}
              <Highlighted text={result.snippet.text} ranges={result.snippet.ranges} />
              {result.snippet.cutEnd && ' …'}
            </span>
          )}
        </span>
        <StatusDot status={story.status} />
      </>
    );
  }

  if (result.kind === 'epic') {
    const { epic } = result;
    const stories = snapshot.stories.filter((story) => story.epicId === epic.id);
    return (
      <>
        <span className="result__icon" aria-hidden="true">
          {ICON.epic}
        </span>
        <span className="result__main">
          <span className="result__title">
            <span className="epic__dot" style={{ background: `var(--epic-${epic.colorKey})` }} aria-hidden="true" />{' '}
            <Highlighted text={epic.name} ranges={result.nameRanges} />
            {badge}
          </span>
          <span className="result__meta">
            {t('epics.storyCount', { count: stories.length })} · {t('search.pointsValue', { count: totalPoints(stories) })}
          </span>
        </span>
        <span className="result__kind">{t('search.kind.epic')}</span>
      </>
    );
  }

  const { sprint } = result;
  const stories = snapshot.stories.filter((story) => story.sprintId === sprint.id);
  return (
    <>
      <span className="result__icon" aria-hidden="true">
        {ICON.sprint}
      </span>
      <span className="result__main">
        <span className="result__title">
          <Highlighted text={sprint.name} ranges={result.nameRanges} />
          {badge}
        </span>
        <span className="result__meta">
          {formatSprintDates(sprint, i18n.language)} · {t('search.storiesAndPoints', { count: stories.length, points: totalPoints(stories) })}
        </span>
      </span>
      <span className="result__kind">{t('search.kind.sprint')}</span>
    </>
  );
}
