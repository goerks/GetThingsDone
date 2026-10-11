import { useId, useState, type FormEvent } from 'react';
import { DndContext, closestCenter, type Announcements, type DragEndEvent, type UniqueIdentifier } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { EditableText } from '../components/EditableText';
import { EpicSelect } from '../components/EpicSelect';
import { EpicTag } from '../components/EpicTag';
import { GripIcon, TrashIcon } from '../components/icons';
import { useDragSensors } from '../dnd/dnd';
import { criteriaProgress } from '../domain/board';
import { POINT_VALUES, STATUSES, type Criterion, type Status } from '../domain/types';
import { hrefs } from '../router';
import { useApp } from '../state/AppState';

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

export function StoryPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const app = useApp();
  const uid = useId();
  const sensors = useDragSensors();
  const [draft, setDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const story = app.stories.find((item) => item.id === id);
  if (!story) {
    return (
      <>
        <a className="back" href={hrefs.board}>
          ← {t('detail.back')}
        </a>
        <p>{t('detail.notFound')}</p>
      </>
    );
  }

  const epic = app.epics.find((item) => item.id === story.epicId);
  const progress = criteriaProgress(story);
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
    window.location.hash = hrefs.board;
  };

  return (
    <>
      <a className="back" href={hrefs.board}>
        ← {t('detail.back')}
      </a>
      <div className="detail">
        <div className="detail__main">
          <div>
            <div className="detail__meta">
              <span className="card__code">{story.code}</span>
              <EpicTag epic={epic} />
            </div>
            <h1>
              <EditableText
                value={story.title}
                label={t('detail.title')}
                required
                className="detail__title"
                onSave={(title) => app.updateStory(story.id, { title })}
              />
            </h1>
          </div>

          <section className="panel">
            <h2>{t('detail.description')}</h2>
            <EditableText
              value={story.description}
              label={t('detail.description')}
              multiline
              placeholder={t('detail.noDescription')}
              className="detail__description"
              onSave={(description) => app.updateStory(story.id, { description })}
            />
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2>{t('detail.criteria')}</h2>
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
        </div>

        <aside className="panel detail__side">
          <h2>{t('detail.details')}</h2>
          <div className="form">
            <div className="field">
              <label htmlFor={`${uid}-status`}>{t('detail.status')}</label>
              <select
                id={`${uid}-status`}
                className="select"
                value={story.status}
                onChange={(event) => app.updateStory(story.id, { status: event.target.value as Status })}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`status.${status}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${uid}-epic`}>{t('detail.epic')}</label>
              <EpicSelect id={`${uid}-epic`} value={story.epicId} onChange={(epicId) => app.updateStory(story.id, { epicId })} />
            </div>
            <div className="field">
              <label htmlFor={`${uid}-points`}>{t('detail.points')}</label>
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
            <label className="check">
              <input
                type="checkbox"
                checked={story.inSprint}
                onChange={(event) => app.updateStory(story.id, { inSprint: event.target.checked })}
              />
              {t('detail.inSprint')}
            </label>
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
    </>
  );
}
