import { featureOn } from '../domain/settings';
import { useId, useState, type FormEvent } from 'react';
import { DndContext, closestCenter, type Announcements, type DragEndEvent, type UniqueIdentifier } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { DefinitionsPanel } from './definitions';
import { Dialog } from './Dialog';
import { EditableText } from './EditableText';
import { HistoryPanel } from './history/HistoryPanel';
import { EpicSelect } from './EpicSelect';
import { EpicTag } from './EpicTag';
import { FieldControl } from './FieldControl';
import { MemberSelect } from './MemberSelect';
import { ReleaseSelect } from './ReleaseSelect';
import { formatDay } from './releaseFormat';
import { SprintSelect } from './SprintSelect';
import { GripIcon, TrashIcon } from './icons';
import { useDragSensors } from '../dnd/dnd';
import { criteriaProgress } from '../domain/board';
import { customFieldsFor, isRequired } from '../domain/fields';
import { sprintEndsAfterRelease } from '../domain/releases';
import { POINT_VALUES, type Criterion } from '../domain/types';
import { statusLabel } from './statusLabel';
import { STATUS_CATEGORIES, statusesIn } from '../domain/statuses';
import { useApp } from '../state/AppState';
import { useBuiltin } from './useBuiltin';

interface CriterionProps {
  storyId: string;
  criterion: Criterion;
}

function CriterionRow({ storyId, criterion }: CriterionProps) {
  const { t } = useTranslation();
  const app = useApp();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: criterion.id
  });

  return (
    <li
      ref={setNodeRef}
      className={`criteria__item${isDragging ? ' criteria__item--dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {/* Criteria rows hold a checkbox and editable text, so they are dragged by a handle. */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="drag-handle"
        aria-label={t('detail.moveCriterion', { text: criterion.text })}
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>
      <input
        type="checkbox"
        checked={criterion.done}
        aria-label={criterion.text}
        onChange={() => app.toggleCriterion(storyId, criterion.id)}
      />
      <EditableText
        value={criterion.text}
        label={t('detail.criterionText')}
        required
        className="criteria__text"
        onSave={(text) => app.editCriterion(storyId, criterion.id, text)}
      />
      <button
        type="button"
        className="icon-btn icon-btn--quiet"
        aria-label={t('detail.deleteCriterion', { text: criterion.text })}
        title={t('detail.deleteCriterion', { text: criterion.text })}
        onClick={() => app.deleteCriterion(storyId, criterion.id)}
      >
        <TrashIcon />
      </button>
    </li>
  );
}

/** Details of a story in a dialog over the current page: everything is edited in place and saved at once. */
export function StoryDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const app = useApp();
  const builtin = useBuiltin();
  const uid = useId();
  const sensors = useDragSensors();
  const [draft, setDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const story = app.stories.find((item) => item.id === id);
  if (!story) {
    return (
      <Dialog title={t('detail.notFoundTitle')} onClose={onClose}>
        <p>{t('detail.notFound')}</p>
        <div className="form__actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('detail.close')}
          </button>
        </div>
      </Dialog>
    );
  }

  const epic = app.epics.find((item) => item.id === story.epicId);
  const customFields = customFieldsFor('story', app.fields, app.assignments);
  const progress = criteriaProgress(story);
  const late = sprintEndsAfterRelease(story, app.releases, app.sprints);
  const language = i18n.resolvedLanguage ?? 'en';
  const allAccepted = progress.total > 0 && progress.done === progress.total;

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!draft.trim()) return;
    app.addCriterion(story.id, draft);
    setDraft('');
  };

  const textOf = (criterionId: UniqueIdentifier): string =>
    story.criteria.find((criterion) => criterion.id === criterionId)?.text ?? '';
  const positionOf = (criterionId: UniqueIdentifier): number =>
    story.criteria.findIndex((criterion) => criterion.id === criterionId) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('board.dnd.pickedUp', { title: textOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over ? t('detail.dnd.over', { title: textOf(active.id), position: positionOf(over.id) }) : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t('detail.dnd.dropped', { title: textOf(active.id), position: positionOf(over.id) })
        : t('board.dnd.cancelled', { title: textOf(active.id) }),
    onDragCancel: ({ active }) => t('board.dnd.cancelled', { title: textOf(active.id) })
  };

  const onCriterionDrop = (event: DragEndEvent): void => {
    if (event.over) app.moveCriterion(story.id, String(event.active.id), String(event.over.id));
  };

  const remove = (): void => {
    app.deleteStory(story.id);
    onClose();
  };

  return (
    <Dialog label={`${story.code}: ${story.title}`} wide onClose={onClose}>
      <div className="detail-dialog__close">
        <button type="button" className="icon-btn icon-btn--quiet" aria-label={t('detail.close')} title={t('detail.close')} onClick={onClose}>
          ×
        </button>
      </div>
      <div className="detail">
        <div className="detail__main">
          <div>
            <div className="detail__meta">
              <span className="card__code">{story.code}</span>
              <EpicTag epic={epic} />
            </div>
            <h2 className="detail__heading">
              <EditableText
                value={story.title}
                label={builtin.label('title', t('detail.title'))}
                required
                className="detail__title"
                onSave={(title) => app.updateStory(story.id, { title })}
              />
            </h2>
          </div>

          {builtin.shown('story', 'description') && (
            <section className="panel">
              <h2>{builtin.label('description', t('detail.description'))}</h2>
              <EditableText
                value={story.description}
                label={builtin.label('description', t('detail.description'))}
                multiline
                placeholder={t('detail.noDescription')}
                className="detail__description"
                onSave={(description) => app.updateStory(story.id, { description })}
              />
            </section>
          )}

          {builtin.shown('story', 'criteria') && (
            <section className="panel">
              <div className="panel__head">
                <h2>{builtin.label('criteria', t('detail.criteria'))}</h2>
                <span className="muted">{t('detail.progress', { done: progress.done, total: progress.total })}</span>
              </div>
              <div className="progress progress--wide" aria-hidden="true">
                <div className="progress__bar" style={{ width: `${progress.percent}%` }} />
              </div>
              {story.criteria.length === 0 ? (
                <p className="muted">{t('detail.noCriteria')}</p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onCriterionDrop}
                  accessibility={{ announcements, screenReaderInstructions: { draggable: t('detail.dnd.instructions') } }}
                >
                  <SortableContext items={story.criteria.map((criterion) => criterion.id)} strategy={verticalListSortingStrategy}>
                    <ul className="criteria">
                      {story.criteria.map((criterion) => (
                        <CriterionRow key={criterion.id} storyId={story.id} criterion={criterion} />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              )}
              {allAccepted && (
                <div role="status" className="notice">
                  {t('detail.allAccepted')}
                </div>
              )}
              <form className="inline-form" onSubmit={submit}>
                <label htmlFor={`${uid}-criterion`} className="sr-only">
                  {t('detail.newCriterion')}
                </label>
                <input
                  id={`${uid}-criterion`}
                  className="input"
                  placeholder={t('detail.newCriterion')}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <button type="submit" className="btn">
                  {t('detail.addCriterion')}
                </button>
              </form>
            </section>
          )}

          <DefinitionsPanel story={story} />

          <HistoryPanel itemType="story" itemId={story.id} label={`${story.code}: ${story.title}`} />
        </div>

        <aside className="panel detail__side">
          <h2>{t('detail.details')}</h2>
          <div className="form">
            <div className="field">
              <label htmlFor={`${uid}-status`}>{builtin.label('status', t('detail.status'))}</label>
              <select
                id={`${uid}-status`}
                className="select"
                value={story.status}
                onChange={(event) => app.updateStory(story.id, { status: event.target.value })}
              >
                {STATUS_CATEGORIES.map((category) => (
                  <optgroup key={category} label={t(`statusValues.category.${category}`)}>
                    {statusesIn(app.statuses, category).map((status) => (
                      <option key={status.id} value={status.id}>
                        {statusLabel(t, app.statuses, status.id)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${uid}-epic`}>{builtin.label('epic', t('detail.epic'))}</label>
              <EpicSelect id={`${uid}-epic`} value={story.epicId} onChange={(epicId) => app.updateStory(story.id, { epicId })} />
            </div>
            <div className="field">
              <label htmlFor={`${uid}-assignee`}>{t('team.field')}</label>
              <MemberSelect id={`${uid}-assignee`} value={story.assigneeId} onChange={(assigneeId) => app.updateStory(story.id, { assigneeId })} />
            </div>
            {builtin.shown('story', 'points') && (
              <div className="field">
                <label htmlFor={`${uid}-points`}>{builtin.label('points', t('detail.points'))}</label>
                <select
                  id={`${uid}-points`}
                  className="select"
                  value={story.points}
                  onChange={(event) => app.updateStory(story.id, { points: Number(event.target.value) })}
                >
                  {POINT_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label htmlFor={`${uid}-sprint`}>{t('sprint.label')}</label>
              <SprintSelect id={`${uid}-sprint`} value={story.sprintId} onChange={(sprintId) => app.updateStory(story.id, { sprintId })} />
            </div>
            {featureOn(app.settings, 'releases') && (
              <div className="field">
                <label htmlFor={`${uid}-release`}>{builtin.label('release', t('releases.label'))}</label>
                <ReleaseSelect id={`${uid}-release`} value={story.releaseId} onChange={(releaseId) => app.updateStory(story.id, { releaseId })} />
                {late && late.release.endDate && (
                  <p className="hint" role="note">
                    {t('releases.sprintAfter', {
                      sprint: late.sprint.name,
                      sprintEnd: formatDay(late.sprint.endDate, language),
                      release: late.release.title,
                      releaseEnd: formatDay(late.release.endDate, language)
                    })}
                  </p>
                )}
              </div>
            )}
            {customFields.map((field) => (
              <FieldControl
                key={field.id}
                field={field}
                value={story.values[field.id]}
                required={isRequired('story', app.assignments, field.id)}
                onChange={(value) => app.setFieldValue(story.id, field.id, value)}
              />
            ))}
          </div>

          <div className="danger">
            {confirmDelete ? (
              <div role="group" aria-labelledby={`${uid}-confirm`} className="danger__confirm">
                <p id={`${uid}-confirm`}>{t('detail.deleteConfirm', { code: story.code, count: story.criteria.length })}</p>
                <div className="form__actions">
                  <button type="button" className="btn btn--danger" onClick={remove} autoFocus>
                    {t('detail.deleteYes')}
                  </button>
                  <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
                    {t('detail.deleteNo')}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn--danger-quiet" onClick={() => setConfirmDelete(true)}>
                {t('detail.delete')}
              </button>
            )}
          </div>
        </aside>
      </div>
    </Dialog>
  );
}
