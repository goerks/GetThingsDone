import { featureOn } from '../domain/settings';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { NewStoryInput } from '../domain/board';
import { releaseLayout } from '../domain/fields';
import { POINT_VALUES } from '../domain/types';
import { useApp } from '../state/AppState';
import { useCreateFields } from './CreateFields';
import { Dialog } from './Dialog';
import { DialogFooter } from './DialogFooter';
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
  /** Prefilled title, when the dialog takes over from a quick add that lacked a required field. */
  initialTitle?: string;
  /** The status the new story starts in; without it the first status of "not started". */
  status?: string;
  /** Shows at once which required field is missing (after a quick add). */
  flagMissing?: boolean;
  onClose: () => void;
}

export function NewStoryDialog({ sprintId: initialSprintId, epicId: initialEpicId, releaseId: initialReleaseId, initialTitle = '', status, flagMissing = false, onClose }: Props) {
  const { t } = useTranslation();
  const app = useApp();
  const builtin = useBuiltin();
  const uid = useId();
  const [title, setTitle] = useState(initialTitle);
  const [added, setAdded] = useState<string | null>(null);
  // A missing title is reported in the app's own words under the field, not by the browser.
  const [titleMissing, setTitleMissing] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState('');
  const [epicId, setEpicId] = useState<string | null>(initialEpicId ?? null);
  const [points, setPoints] = useState<number | null>(null);
  const [sprintId, setSprintId] = useState(initialSprintId);
  const [releaseId, setReleaseId] = useState<string | null>(initialReleaseId ?? null);
  // The release shows when the team put it into the create dialog, or when the caller prefilled one.
  const releaseShown = featureOn(app.settings, 'releases') && (releaseLayout(app.assignments).inCreate || initialReleaseId !== undefined);
  const custom = useCreateFields('story');

  useEffect(() => {
    if (flagMissing) custom.collect();
    // Only once, when the dialog takes over from the quick add.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Creates the story; with `another` the dialog stays open for the next one and keeps epic, sprint, release and points. */
  const create = (another: boolean): void => {
    if (!title.trim()) {
      setTitleMissing(true);
      titleRef.current?.focus();
      return;
    }
    const values = custom.collect();
    if (!values) return;
    const input: NewStoryInput = { title, description, epicId, points, sprintId, releaseId, values, status };
    app.createStory(input);
    if (!another) {
      onClose();
      return;
    }
    setAdded(title.trim());
    setTitle('');
    setDescription('');
    titleRef.current?.focus();
  };

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    create(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>): void => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey) {
      event.preventDefault();
      create(true);
    }
  };

  return (
    <Dialog title={t('newStory.dialogTitle')} dirty={Boolean(title.trim() || description.trim())} submitShortcut onClose={onClose}>
      <form className="form" onSubmit={submit} onKeyDown={onKeyDown} noValidate>
        {added && (
          <p role="status" className="notice notice--ok create-added">
            {t('newStory.addedAnother', { title: added })}
          </p>
        )}
        <div className="field">
          <label htmlFor={`${uid}-title`}>{builtin.label('title', t('newStory.title'))}</label>
          <input
            id={`${uid}-title`}
            className="input"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setTitleMissing(false);
            }}
            ref={titleRef}
            aria-required="true"
            aria-invalid={titleMissing || undefined}
            aria-describedby={titleMissing ? `${uid}-title-problem` : undefined}
            autoFocus
          />
          {titleMissing && (
            <p id={`${uid}-title-problem`} role="alert" className="field-error">
              {t('newStory.problem.title')}
            </p>
          )}
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
                value={points ?? ''}
                onChange={(event) => setPoints(event.target.value === '' ? null : Number(event.target.value))}
              >
                <option value="">{t('estimate.none')}</option>
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
        <DialogFooter submit={t('newStory.add')} onCancel={onClose}>
          <button type="button" className="btn" onClick={() => create(true)}>
            {t('newStory.addAnother')}
          </button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
