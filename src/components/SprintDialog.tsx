import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { newSprintDefaults, todayIso, validateSprint, type SprintInput } from '../domain/sprints';
import type { Sprint } from '../domain/types';
import { useApp } from '../state/AppState';
import { Dialog } from './Dialog';
import { DialogFooter } from './DialogFooter';
import { HistoryPanel } from './history/HistoryPanel';

interface Props {
  /** The sprint to edit; without it the dialog creates a new, prefilled sprint. */
  sprint?: Sprint;
  onClose: () => void;
}

export function SprintDialog({ sprint, onClose }: Props) {
  const { t } = useTranslation();
  const app = useApp();
  const uid = useId();
  const [initial] = useState<SprintInput>(() =>
    sprint
      ? { name: sprint.name, startDate: sprint.startDate, endDate: sprint.endDate }
      : newSprintDefaults(app.sprints, todayIso(), (number) => t('sprint.defaultName', { number }))
  );
  const [input, setInput] = useState<SprintInput>(initial);
  const dirty = input.name !== initial.name || input.startDate !== initial.startDate || input.endDate !== initial.endDate;
  const [showProblem, setShowProblem] = useState(false);
  const problem = validateSprint(input);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (problem) {
      setShowProblem(true);
      return;
    }
    if (sprint) app.updateSprint(sprint.id, input);
    else app.createSprint(input);
    onClose();
  };

  const change = (field: keyof SprintInput) => (event: { target: { value: string } }) =>
    setInput((current) => ({ ...current, [field]: event.target.value }));

  return (
    <Dialog title={sprint ? t('sprint.edit') : t('sprint.new')} dirty={dirty} submitShortcut onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor={`${uid}-name`}>{t('sprint.name')}</label>
          <input id={`${uid}-name`} className="input" value={input.name} onChange={change('name')} required autoFocus />
        </div>
        <div className="form__row">
          <div className="field">
            <label htmlFor={`${uid}-start`}>{t('sprint.start')}</label>
            <input id={`${uid}-start`} type="date" className="input" value={input.startDate} onChange={change('startDate')} required />
          </div>
          <div className="field">
            <label htmlFor={`${uid}-end`}>{t('sprint.end')}</label>
            <input id={`${uid}-end`} type="date" className="input" value={input.endDate} onChange={change('endDate')} required />
          </div>
        </div>
        {showProblem && problem && (
          <p role="alert" className="field-error">
            {t(`sprint.problem.${problem}`)}
          </p>
        )}
        {sprint && <HistoryPanel itemType="sprint" itemId={sprint.id} label={sprint.name} />}
        <DialogFooter submit={sprint ? t('sprint.save') : t('sprint.add')} onCancel={onClose} />
      </form>
    </Dialog>
  );
}
