import { featureOn } from '../domain/settings';
import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { NewStoryInput } from '../domain/board';
import { releaseLayout } from '../domain/fields';
import { POINT_VALUES } from '../domain/types';
import { useApp } from '../state/AppState';
import { useCreateFields } from './CreateFields';
import { Dialog } from './Dialog';
import { EpicSelect } from './EpicSelect';
import { ReleaseSelect } from './ReleaseSelect';
import { SprintSelect } from './SprintSelect';
import { useBuiltin } from './useBuiltin';

interface Props {
  /** Prefilled sprint: the running one from the board, "not planned" from the backlog, the cell's on the map. */
  sprintId: string | null;
  /** Prefilled epic (from a map cell, null for the "No epic" column); otherwise no epic. */
  epicId?: string | null;
  /** Prefilled release (from a release row of the story map); otherwise none. */
  releaseId?: string | null;
  onClose: () => void;
}

export function NewStoryDialog({ sprintId: initialSprintId, epicId: initialEpicId, releaseId: initialReleaseId, onClose }: Props) {
  const { t } = useTranslation();
  const app = useApp();
  const builtin = useBuiltin();
  const uid = useId();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [epicId, setEpicId] = useState<string | null>(initialEpicId ?? null);
  const [points, setPoints] = useState(3);
  const [sprintId, setSprintId] = useState(initialSprintId);
  const [releaseId, setReleaseId] = useState<string | null>(initialReleaseId ?? null);
  // The release shows when the team put it into the create dialog, or when the caller prefilled one.
  const releaseShown = featureOn(app.settings, 'releases') && (releaseLayout(app.assignments).inCreate || initialReleaseId !== undefined);
  const custom = useCreateFields('story');

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!title.trim()) return;
    const values = custom.collect();
    if (!values) return;
    const input: NewStoryInput = { title, description, epicId, points, sprintId, releaseId, values };
    app.createStory(input);
    onClose();
  };

  return (
    <Dialog title={t('newStory.dialogTitle')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="field">
          <label htmlFor={`${uid}-title`}>{builtin.label('title', t('newStory.title'))}</label>
          <input
            id={`${uid}-title`}
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            autoFocus
          />
        </div>
        {builtin.shown('story', 'description') && (
          <div className="field">
            <label htmlFor={`${uid}-description`}>{builtin.label('description', t('newStory.description'))}</label>
            <textarea
              id={`${uid}-description`}
              className="input"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        )}
        <div className="form__row">
          <div className="field">
            <label htmlFor={`${uid}-epic`}>{builtin.label('epic', t('newStory.epic'))}</label>
            <EpicSelect id={`${uid}-epic`} value={epicId} onChange={setEpicId} />
          </div>
          {builtin.shown('story', 'points') && (
            <div className="field">
              <label htmlFor={`${uid}-points`}>{builtin.label('points', t('newStory.points'))}</label>
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
          )}
        </div>
        <div className="field">
          <label htmlFor={`${uid}-sprint`}>{t('sprint.label')}</label>
          <SprintSelect id={`${uid}-sprint`} value={sprintId} onChange={setSprintId} />
        </div>
        {releaseShown && (
          <div className="field">
            <label htmlFor={`${uid}-release`}>{builtin.label('release', t('releases.label'))}</label>
            <ReleaseSelect id={`${uid}-release`} value={releaseId} onChange={setReleaseId} />
          </div>
        )}
        {custom.fields}
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
