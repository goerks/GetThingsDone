import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { NewStoryInput } from '../domain/board';
import { POINT_VALUES } from '../domain/types';
import { useApp } from '../state/AppState';
import { Dialog } from './Dialog';
import { EpicSelect } from './EpicSelect';

interface Props {
  /** Whether the "In Sprint 1" box starts ticked: yes from the board, no from the backlog. */
  inSprint: boolean;
  onClose: () => void;
}

export function NewStoryDialog({ inSprint: initialInSprint, onClose }: Props) {
  const { t } = useTranslation();
  const app = useApp();
  const uid = useId();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [epicId, setEpicId] = useState(app.epics[0]?.id ?? '');
  const [points, setPoints] = useState(3);
  const [inSprint, setInSprint] = useState(initialInSprint);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!title.trim() || !epicId) return;
    const input: NewStoryInput = { title, description, epicId, points, inSprint };
    app.createStory(input);
    onClose();
  };

  return (
    <Dialog title={t('newStory.dialogTitle')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="field">
          <label htmlFor={`${uid}-title`}>{t('newStory.title')}</label>
          <input
            id={`${uid}-title`}
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor={`${uid}-description`}>{t('newStory.description')}</label>
          <textarea
            id={`${uid}-description`}
            className="input"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="form__row">
          <div className="field">
            <label htmlFor={`${uid}-epic`}>{t('newStory.epic')}</label>
            <EpicSelect id={`${uid}-epic`} value={epicId} onChange={setEpicId} />
          </div>
          <div className="field">
            <label htmlFor={`${uid}-points`}>{t('newStory.points')}</label>
            <select
              id={`${uid}-points`}
              className="select"
              value={points}
              onChange={(event) => setPoints(Number(event.target.value))}
            >
              {POINT_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={inSprint} onChange={(event) => setInSprint(event.target.checked)} />
          {t('detail.inSprint')}
        </label>
        <div className="form__actions">
          <button type="submit" className="btn btn--primary">
            {t('newStory.add')}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            {t('newStory.cancel')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
