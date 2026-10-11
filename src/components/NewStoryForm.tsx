import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { POINT_VALUES, type Epic } from '../domain/types';
import { EpicSelect } from './EpicSelect';

interface Props {
  epics: Epic[];
  onCreate: (input: { title: string; description: string; epicId: string; points: number }) => void;
  onCancel: () => void;
}

export function NewStoryForm({ epics, onCreate, onCancel }: Props) {
  const { t } = useTranslation();
  const uid = useId();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [epicId, setEpicId] = useState(epics[0]?.id ?? '');
  const [points, setPoints] = useState(3);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!title.trim() || !epicId) return;
    onCreate({ title, description, epicId, points });
  };

  return (
    <form className="panel form" onSubmit={submit}>
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
      <div className="form__actions">
        <button type="submit" className="btn btn--primary">
          {t('newStory.add')}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {t('newStory.cancel')}
        </button>
      </div>
    </form>
  );
}
