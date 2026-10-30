import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { contentsOf, startNeedsDates } from '../domain/sprintLife';
import { addDays, daysBetween, startableSprints, todayIso } from '../domain/sprints';
import { useApp } from '../state/AppState';
import { Dialog } from './Dialog';
import { SprintPlan } from './SprintPlan';
import { formatDayLong, formatSprintDates } from './sprintFormat';
import { Button, CheckInput, Select } from '../ui';
import { useStoryKey } from './useStoryKey';

interface Props {
  /** The planned sprint that is selected when the dialog opens. */
  sprintId: string;
  onClose: () => void;
}

/**
 * Starts a planned sprint (#17): shows its stories and points, which are kept as the planned scope, and asks which
 * dates the sprint gets when today is not its planned start day.
 */
export function StartSprintDialog({ sprintId, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const app = useApp();
  const keyOf = useStoryKey();
  const uid = useId();
  const options = startableSprints(app.sprints);
  const [selected, setSelected] = useState(options.some((sprint) => sprint.id === sprintId) ? sprintId : (options[0]?.id ?? ''));
  const [dates, setDates] = useState<'today' | 'keep'>('today');
  const sprint = options.find((item) => item.id === selected);
  if (!sprint) return null;

  const today = todayIso();
  const contents = contentsOf(app.stories, sprint.id);
  const asksDates = startNeedsDates(sprint, today);
  const length = daysBetween(sprint.startDate, sprint.endDate);
  const fromToday = { startDate: today, endDate: addDays(today, length) };

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    app.startSprint(sprint.id, dates);
    onClose();
  };

  return (
    <Dialog title={t('lifecycle.start.title')} onClose={onClose}>
      <form className="sprint-dialog" onSubmit={submit}>
        <div className="field">
          <label htmlFor={`${uid}-sprint`}>{t('lifecycle.start.sprint')}</label>
          <Select id={`${uid}-sprint`} value={sprint.id} onChange={(event) => setSelected(event.target.value)}>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} ({formatSprintDates(option, i18n.language)})
              </option>
            ))}
          </Select>
        </div>
        <div className="sprint-figures">
          <div className="sprint-figure">
            <span className="sprint-figure__label">{t('lifecycle.start.stories')}</span>
            <span className="sprint-figure__value">{contents.stories.length}</span>
          </div>
          <div className="sprint-figure">
            <span className="sprint-figure__label">{t('lifecycle.start.plannedPoints')}</span>
            <span className="sprint-figure__value">
              {contents.points}
              <span className="sprint-figure__unit">{t('lifecycle.start.points')}</span>
            </span>
          </div>
        </div>
        <SprintPlan points={contents.points} className="muted sprint-plan" />
        <p className="muted">{t('lifecycle.start.note', { points: contents.points })}</p>
        {contents.withoutPoints.length > 0 && (
          <p className="muted">
            {t('lifecycle.start.withoutPoints', {
              count: contents.withoutPoints.length,
              codes: contents.withoutPoints.map((story) => keyOf(story)).join(', ')
            })}
          </p>
        )}
        {asksDates && (
          <fieldset className="sprint-choice">
            <legend>{t('lifecycle.start.datesLegend')}</legend>
            <p className="muted">
              {t('lifecycle.start.datesNote', {
                planned: formatDayLong(sprint.startDate, i18n.language),
                today: formatDayLong(today, i18n.language)
              })}
            </p>
            <label className="sprint-option">
              <CheckInput kind="radio" name={`${uid}-dates`} checked={dates === 'today'} onChange={() => setDates('today')} />
              <span>
                {t('lifecycle.start.today', { dates: formatSprintDates(fromToday, i18n.language) })}
                <small>{t('lifecycle.start.todayHint', { days: length + 1 })}</small>
              </span>
            </label>
            <label className="sprint-option">
              <CheckInput kind="radio" name={`${uid}-dates`} checked={dates === 'keep'} onChange={() => setDates('keep')} />
              <span>{t('lifecycle.start.keep', { dates: formatSprintDates(sprint, i18n.language) })}</span>
            </label>
          </fieldset>
        )}
        <div className="form__actions">
          <Button type="submit" variant="primary">
            {t('lifecycle.start.submit')}
          </Button>
          <Button type="button" onClick={onClose}>
            {t('newStory.cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
