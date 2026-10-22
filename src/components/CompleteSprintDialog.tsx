import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { completeNeedsDate, completeSprint, contentsOf, summarizeSprint, type Completion, type UnfinishedTarget } from '../domain/sprintLife';
import { plannedSprints, todayIso } from '../domain/sprints';
import type { Sprint, Story } from '../domain/types';
import { useApp } from '../state/AppState';
import { Dialog } from './Dialog';
import { formatDayLong, formatSprintDates } from './sprintFormat';
import { statusLabel } from './statusLabel';
import { useBuiltin } from './useBuiltin';
import { Button } from '../ui';

interface Props {
  /** The running sprint. */
  sprint: Sprint;
  onClose: () => void;
  /** Called after the sprint is completed; `startId` is the sprint to start next when the box was ticked. */
  onCompleted: (completion: Completion, startId: string | null) => void;
}

const signed = (value: number): string => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0');

/**
 * Completes the running sprint (#17) in one step: the result, the stories, where the unfinished stories go, the end
 * date when today is not the planned end, and whether to start the next sprint right away.
 */
export function CompleteSprintDialog({ sprint, onClose, onCompleted }: Props) {
  const { t, i18n } = useTranslation();
  const app = useApp();
  const builtin = useBuiltin();
  const uid = useId();
  const today = todayIso();
  const summary = summarizeSprint(sprint, app.stories, app.isDone);
  const planned = plannedSprints(app.sprints);
  const [chosen, setChosen] = useState<UnfinishedTarget>(planned.length > 0 ? 'next' : 'new');
  const [endDate, setEndDate] = useState<'today' | 'keep'>('today');
  const [startNext, setStartNext] = useState(false);

  const hasUnfinished = summary.notDone.length > 0;
  const target: UnfinishedTarget = chosen === 'next' && planned.length === 0 ? 'new' : chosen;
  const asksEnd = completeNeedsDate(sprint, today);
  const nameFor = (number: number): string => t('sprint.defaultName', { number });
  // What completing would do with the current choices: shows the new sprint and the sprint that could start next.
  const preview = completeSprint(app.sprints, app.stories, sprint.id, app.isDone, { target, endDate, today, newId: 'preview', nameFor });
  const next = preview ? (plannedSprints(preview.sprints)[0] ?? null) : null;
  const nextSprint = planned[0];

  const doneShare = summary.plannedPoints > 0 ? Math.round((summary.donePoints / summary.plannedPoints) * 100) : null;
  const total = summary.donePoints + summary.notDonePoints;

  const changes: string[] = [];
  if (summary.added.length > 0)
    changes.push(t('lifecycle.complete.added', { count: summary.added.length, points: summary.addedPoints, codes: summary.added.map((story) => story.code).join(', ') }));
  if (summary.removed.length > 0)
    changes.push(t('lifecycle.complete.removed', { count: summary.removed.length, points: summary.removedPoints, codes: summary.removed.map((item) => item.code).join(', ') }));
  if (summary.changedPoints !== 0) changes.push(t('lifecycle.complete.changedPoints', { delta: signed(summary.changedPoints) }));
  if (summary.added.length > 0 && summary.removed.length === 0) changes.push(t('lifecycle.complete.nothingRemoved'));
  if (summary.removed.length > 0 && summary.added.length === 0) changes.push(t('lifecycle.complete.nothingAdded'));

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const completion = app.completeSprint(sprint.id, { target, endDate });
    if (!completion) return;
    const after = plannedSprints(completion.sprints)[0];
    onCompleted(completion, startNext && after ? after.id : null);
    onClose();
  };

  const storyRows = (stories: Story[]) => (
    <ul>
      {stories.map((story) => (
        <li key={story.id}>
          <span className="mono">{story.code}</span>
          <span>{story.title}</span>
          <span className="muted">{statusLabel(t, app.statuses, story.status)}</span>
          <span className="pill" title={builtin.pointsTitle(story.points)}>
            {story.points}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <Dialog title={t('lifecycle.complete.title', { name: sprint.name })} onClose={onClose}>
      <form className="sprint-dialog" onSubmit={submit}>
        <p className="muted">{formatSprintDates(sprint, i18n.language)}</p>
        <div className="sprint-figures">
          <div className="sprint-figure">
            <span className="sprint-figure__label">{t('lifecycle.complete.atStart')}</span>
            <span className="sprint-figure__value">{summary.plannedPoints}</span>
            <span className="sprint-figure__unit">{t('lifecycle.complete.figure', { points: summary.plannedPoints, count: summary.plannedStories })}</span>
          </div>
          <div className="sprint-figure">
            <span className="sprint-figure__label">{t('lifecycle.complete.done')}</span>
            <span className="sprint-figure__value">{summary.donePoints}</span>
            <span className="sprint-figure__unit">{t('lifecycle.complete.figure', { points: summary.donePoints, count: summary.done.length })}</span>
          </div>
          <div className="sprint-figure">
            <span className="sprint-figure__label">{t('lifecycle.complete.notDone')}</span>
            <span className="sprint-figure__value">{summary.notDonePoints}</span>
            <span className="sprint-figure__unit">{t('lifecycle.complete.figure', { points: summary.notDonePoints, count: summary.notDone.length })}</span>
          </div>
        </div>
        {changes.length > 0 && (
          <p className="sprint-changes">
            {t('lifecycle.complete.changes')} {changes.join(', ')}.
          </p>
        )}
        <div className="sprint-meter">
          <span className="sprint-meter__track" aria-hidden="true">
            <span className="sprint-meter__fill" style={{ width: `${total > 0 ? (summary.donePoints / total) * 100 : 0}%` }} />
          </span>
          <span className="muted">
            {t('lifecycle.complete.meter', { done: summary.donePoints, total })}
            {doneShare !== null && ` · ${t('lifecycle.complete.meterShare', { share: doneShare, planned: summary.plannedPoints })}`}
          </span>
        </div>
        {summary.withoutPoints.length > 0 && (
          <p className="muted">
            {t('lifecycle.start.withoutPoints', { count: summary.withoutPoints.length, codes: summary.withoutPoints.map((story) => story.code).join(', ') })}
          </p>
        )}
        <details className="sprint-stories">
          <summary>
            {t('lifecycle.complete.doneStories')}
            <span className="sprint-stories__count">
              {summary.done.length} · {summary.donePoints}
            </span>
          </summary>
          {storyRows(summary.done)}
        </details>
        {hasUnfinished ? (
          <>
            <details className="sprint-stories" open>
              <summary>
                {t('lifecycle.complete.notDoneStories')}
                <span className="sprint-stories__count">
                  {summary.notDone.length} · {summary.notDonePoints}
                </span>
              </summary>
              {storyRows(summary.notDone)}
            </details>
            <fieldset className="sprint-choice">
              <legend>{t('lifecycle.complete.whereLegend', { count: summary.notDone.length })}</legend>
              {nextSprint && (
                <label className="sprint-option">
                  <input type="radio" name={`${uid}-target`} checked={target === 'next'} onChange={() => setChosen('next')} />
                  <span>
                    {t('lifecycle.complete.next', { name: nextSprint.name })}
                    <small>
                      {t('lifecycle.complete.nextDetail', {
                        dates: formatSprintDates(nextSprint, i18n.language),
                        count: contentsOf(app.stories, nextSprint.id).stories.length,
                        points: contentsOf(app.stories, nextSprint.id).points
                      })}
                    </small>
                  </span>
                </label>
              )}
              <label className="sprint-option">
                <input type="radio" name={`${uid}-target`} checked={target === 'new'} onChange={() => setChosen('new')} />
                <span>
                  {t('lifecycle.complete.newSprint')}
                  {(() => {
                    const created = completeSprint(app.sprints, app.stories, sprint.id, app.isDone, { target: 'new', endDate, today, newId: 'preview', nameFor })?.targetSprint;
                    return created && <small>{t('lifecycle.complete.newDetail', { name: created.name, dates: formatSprintDates(created, i18n.language) })}</small>;
                  })()}
                </span>
              </label>
              <label className="sprint-option">
                <input type="radio" name={`${uid}-target`} checked={target === 'backlog'} onChange={() => setChosen('backlog')} />
                <span>
                  {t('lifecycle.complete.backlog')}
                  <small>{t('lifecycle.complete.backlogDetail')}</small>
                </span>
              </label>
            </fieldset>
          </>
        ) : (
          <p className="muted">{t('lifecycle.complete.allDone')}</p>
        )}
        {asksEnd && (
          <fieldset className="sprint-choice">
            <legend>{t('lifecycle.complete.endLegend')}</legend>
            <p className="muted">
              {t('lifecycle.complete.endNote', { planned: formatDayLong(sprint.endDate, i18n.language), today: formatDayLong(today, i18n.language) })}
            </p>
            <label className="sprint-option">
              <input type="radio" name={`${uid}-end`} checked={endDate === 'today'} onChange={() => setEndDate('today')} />
              <span>{t('lifecycle.complete.endToday', { date: formatDayLong(today, i18n.language) })}</span>
            </label>
            <label className="sprint-option">
              <input type="radio" name={`${uid}-end`} checked={endDate === 'keep'} onChange={() => setEndDate('keep')} />
              <span>{t('lifecycle.complete.endKeep', { date: formatDayLong(sprint.endDate, i18n.language) })}</span>
            </label>
          </fieldset>
        )}
        {next && (
          <label className="sprint-option">
            <input type="checkbox" checked={startNext} onChange={(event) => setStartNext(event.target.checked)} />
            <span>
              {t('lifecycle.complete.startNext', { name: next.name })}
              <small>{t('lifecycle.complete.startNextHint')}</small>
            </span>
          </label>
        )}
        <div className="form__actions">
          <Button type="submit" variant="primary">
            {t('lifecycle.complete.submit')}
          </Button>
          <Button type="button" onClick={onClose}>
            {t('newStory.cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
