import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { validateRelease, releaseStats, storiesAfterReleaseEnd, storiesInRelease, type ReleaseProblem } from '../domain/releases';
import type { Release } from '../domain/types';
import { useApp } from '../state/AppState';
import { Dialog } from './Dialog';
import { EditableText } from './EditableText';
import { ScopeReport } from './ScopeReport';
import { StoryPicker } from './StoryPicker';
import { formatDay } from './releaseFormat';
import { useBuiltin } from './useBuiltin';

type Tab = 'details' | 'stories' | 'scope';
const TABS: readonly Tab[] = ['details', 'stories', 'scope'];

interface Props {
  id: string;
  onClose: () => void;
  /** Opens a story in its own dialog (this dialog closes). */
  onOpenStory: (storyId: string) => void;
}

const inputOf = (release: Release, patch: Partial<Release> = {}) => ({
  title: release.title,
  description: release.description,
  startDate: release.startDate,
  endDate: release.endDate,
  ...patch
});

/**
 * Details of a release in a dialog: title, description and dates are saved at once. A second tab lists the
 * release's stories and adds or removes some, a third shows the scope report. The burndown follows (#10).
 */
export function ReleaseDialog({ id, onClose, onOpenStory }: Props) {
  const { t, i18n } = useTranslation();
  const app = useApp();
  const builtin = useBuiltin();
  const uid = useId();
  const release = app.releases.find((item) => item.id === id);
  const [tab, setTab] = useState<Tab>('details');
  const [dates, setDates] = useState({ start: release?.startDate ?? '', end: release?.endDate ?? '' });
  const [dateProblem, setDateProblem] = useState<ReleaseProblem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  if (!release) {
    return (
      <Dialog title={t('releases.notFound')} onClose={onClose}>
        <div className="form__actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('releases.close')}
          </button>
        </div>
      </Dialog>
    );
  }

  const own = storiesInRelease(app.stories, release.id);
  const stats = releaseStats(app.stories, release.id);
  const pointsShown = builtin.shown('story', 'points');
  const language = i18n.resolvedLanguage ?? 'en';
  const late = storiesAfterReleaseEnd(release, app.stories, app.sprints);
  const candidates = app.stories.filter((story) => story.releaseId === null).sort((a, b) => a.rank - b.rank);
  const showStart = builtin.shown('release', 'start');
  const showEnd = builtin.shown('release', 'end');
  const epicName = (epicId: string | null): string => app.epics.find((epic) => epic.id === epicId)?.name ?? '–';
  const sprintName = (sprintId: string | null): string => app.sprints.find((sprint) => sprint.id === sprintId)?.name ?? '–';

  const changeDate = (field: 'start' | 'end', value: string): void => {
    const next = { ...dates, [field]: value };
    setDates(next);
    const input = inputOf(release, { startDate: next.start || null, endDate: next.end || null });
    const problem = validateRelease(input);
    setDateProblem(problem);
    if (!problem) app.updateRelease(release.id, input);
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const index = TABS.indexOf(tab);
    let next: Tab | null = null;
    if (event.key === 'ArrowRight') next = TABS[(index + 1) % TABS.length];
    else if (event.key === 'ArrowLeft') next = TABS[(index + TABS.length - 1) % TABS.length];
    else if (event.key === 'Home') next = TABS[0];
    else if (event.key === 'End') next = TABS[TABS.length - 1];
    if (!next) return;
    event.preventDefault();
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  const remove = (): void => {
    app.deleteRelease(release.id);
    onClose();
  };

  return (
    <Dialog label={release.title} wide onClose={onClose}>
      <div className="detail-dialog__close">
        <button type="button" className="icon-btn icon-btn--quiet" aria-label={t('releases.close')} title={t('releases.close')} onClick={onClose}>
          ×
        </button>
      </div>
      <div className="release-dialog">
        <h2 className="dialog__title release-dialog__title">
          <EditableText
            value={release.title}
            label={builtin.label('title', t('releases.name'))}
            required
            onSave={(title) => app.updateRelease(release.id, inputOf(release, { title }))}
          />
        </h2>

        <div className="view-tabs" role="tablist" aria-label={t('releases.tabs.label')}>
          {TABS.map((item) => (
            <button
              key={item}
              ref={(element) => {
                tabRefs.current[item] = element;
              }}
              type="button"
              role="tab"
              id={`${uid}-tab-${item}`}
              aria-selected={tab === item}
              aria-controls={`${uid}-panel-${item}`}
              tabIndex={tab === item ? 0 : -1}
              className="view-tabs__tab"
              onClick={() => setTab(item)}
              onKeyDown={onTabKeyDown}
            >
              {t(`releases.tabs.${item}`, { count: own.length })}
            </button>
          ))}
        </div>

        {tab === 'details' && (
          <div role="tabpanel" id={`${uid}-panel-details`} aria-labelledby={`${uid}-tab-details`} className="form">
            <div className="field">
              <span aria-hidden="true">{builtin.label('description', t('releases.description'))}</span>
              <EditableText
                value={release.description}
                label={builtin.label('description', t('releases.description'))}
                multiline
                placeholder={t('releases.noDescription')}
                className="detail__description"
                onSave={(description) => app.updateRelease(release.id, inputOf(release, { description }))}
              />
            </div>
            {(showStart || showEnd) && (
              <div className="form__row">
                {showStart && (
                  <div className="field">
                    <label htmlFor={`${uid}-start`}>{builtin.label('start', t('releases.start'))}</label>
                    <input id={`${uid}-start`} type="date" className="input" value={dates.start} onChange={(event) => changeDate('start', event.target.value)} />
                  </div>
                )}
                {showEnd && (
                  <div className="field">
                    <label htmlFor={`${uid}-end`}>{builtin.label('end', t('releases.end'))}</label>
                    <input id={`${uid}-end`} type="date" className="input" value={dates.end} onChange={(event) => changeDate('end', event.target.value)} />
                  </div>
                )}
              </div>
            )}
            {dateProblem && (
              <p role="alert" className="field-error">
                {t(`releases.problem.${dateProblem}`)}
              </p>
            )}
            <div className="release-summary">
              <p>
                <strong>{builtin.summary(stats.stories, stats.points)}</strong>
              </p>
              {stats.stories > 0 && (
                <>
                  <div
                    className="progress progress--wide"
                    role="img"
                    aria-label={pointsShown ? t('releases.progress', { done: stats.donePoints, total: stats.points }) : t('releases.progressStories', { done: stats.doneStories, total: stats.stories })}
                  >
                    <div
                      className="progress__bar"
                      style={{ width: `${Math.round(((pointsShown ? stats.donePoints / stats.points : stats.doneStories / stats.stories) || 0) * 100)}%` }}
                    />
                  </div>
                  <p className="muted">
                    {pointsShown
                      ? t('releases.progress', { done: stats.donePoints, total: stats.points })
                      : t('releases.progressStories', { done: stats.doneStories, total: stats.stories })}
                  </p>
                </>
              )}
            </div>
            {late.length > 0 && release.endDate && (
              <p className="hint" role="note">
                {t('releases.afterEnd', { count: late.length, date: formatDay(release.endDate, language), codes: late.map((story) => story.code).join(', ') })}
              </p>
            )}
            <div className="danger">
              {confirmDelete ? (
                <div role="group" aria-labelledby={`${uid}-confirm`} className="danger__confirm">
                  <p id={`${uid}-confirm`}>
                    {own.length > 0
                      ? t('releases.deleteConfirm', { title: release.title, count: own.length })
                      : t('releases.deleteConfirmEmpty', { title: release.title })}
                  </p>
                  <div className="form__actions">
                    <button type="button" className="btn btn--danger" onClick={remove} autoFocus>
                      {t('releases.deleteYes')}
                    </button>
                    <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
                      {t('releases.deleteNo')}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn btn--danger-quiet" onClick={() => setConfirmDelete(true)}>
                  {t('releases.delete')}
                </button>
              )}
            </div>
          </div>
        )}

        {tab === 'scope' && (
          <div role="tabpanel" id={`${uid}-panel-scope`} aria-labelledby={`${uid}-tab-scope`}>
            <ScopeReport release={release} />
          </div>
        )}

        {tab === 'stories' && (
          <div role="tabpanel" id={`${uid}-panel-stories`} aria-labelledby={`${uid}-tab-stories`} className="form">
            <div className="release-add">
              <StoryPicker stories={candidates} onPick={(story) => app.updateStory(story.id, { releaseId: release.id })} />
            </div>
            {own.length === 0 ? (
              <p className="muted">{t('releases.noStories')}</p>
            ) : (
              <div className="release-table-wrap">
                <table className="release-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('releases.column.key')}</th>
                      <th scope="col">{t('releases.column.title')}</th>
                      <th scope="col">{t('releases.column.epic')}</th>
                      <th scope="col">{t('releases.column.sprint')}</th>
                      {pointsShown && <th scope="col">{t('releases.column.points')}</th>}
                      <th scope="col">{t('releases.column.status')}</th>
                      <td />
                    </tr>
                  </thead>
                  <tbody>
                    {own.map((story) => (
                      <tr key={story.id}>
                        <th scope="row" className="release-table__code">
                          {story.code}
                        </th>
                        <td>
                          <button type="button" className="title-button" onClick={() => onOpenStory(story.id)}>
                            {story.title}
                          </button>
                        </td>
                        <td>{epicName(story.epicId)}</td>
                        <td>{sprintName(story.sprintId)}</td>
                        {pointsShown && <td>{story.points}</td>}
                        <td>{t(`status.${story.status}`)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn"
                            aria-label={t('releases.remove', { code: story.code })}
                            onClick={() => app.updateStory(story.id, { releaseId: null })}
                          >
                            {t('releases.removeShort')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
