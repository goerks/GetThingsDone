import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { BoardColumn } from '../components/BoardColumn';
import { NewStoryForm } from '../components/NewStoryForm';
import { OverlayCard } from '../components/StoryCard';
import { parseColumnId, sprintPoints, sprintStories, storiesInColumn } from '../domain/board';
import { STATUSES } from '../domain/types';
import { useApp } from '../state/AppState';

export function BoardPage() {
  const { t } = useTranslation();
  const app = useApp();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const epics = useMemo(() => new Map(app.epics.map((epic) => [epic.id, epic])), [app.epics]);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const titleOf = (id: UniqueIdentifier): string => app.stories.find((story) => story.id === id)?.title ?? '';
  const columnNameOf = (id: UniqueIdentifier): string => {
    const column = parseColumnId(String(id));
    if (column) return t(`status.${column}`);
    const story = app.stories.find((item) => item.id === id);
    return story ? t(`status.${story.status}`) : '';
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => t('board.dnd.pickedUp', { title: titleOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over ? t('board.dnd.over', { title: titleOf(active.id), target: columnNameOf(over.id) }) : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t('board.dnd.dropped', { title: titleOf(active.id), target: columnNameOf(over.id) })
        : t('board.dnd.cancelled', { title: titleOf(active.id) }),
    onDragCancel: ({ active }) => t('board.dnd.cancelled', { title: titleOf(active.id) })
  };

  const onDragStart = (event: DragStartEvent): void => setActiveId(String(event.active.id));
  const onDragEnd = (event: DragEndEvent): void => {
    setActiveId(null);
    if (event.over) app.drop(String(event.active.id), String(event.over.id));
  };

  const activeStory = activeId ? app.stories.find((story) => story.id === activeId) : undefined;
  const inSprint = sprintStories(app.stories);

  return (
    <>
      <div className="page-head">
        <h1>{t('board.title')}</h1>
        <span className="muted">{t('board.summary', { count: inSprint.length, points: sprintPoints(app.stories) })}</span>
        {!creating && (
          <button type="button" className="btn btn--primary page-head__action" onClick={() => setCreating(true)}>
            {t('newStory.open')}
          </button>
        )}
      </div>

      {creating && (
        <NewStoryForm
          epics={app.epics}
          onCancel={() => setCreating(false)}
          onCreate={(input) => {
            app.createStory(input);
            setCreating(false);
          }}
        />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
        accessibility={{ announcements, screenReaderInstructions: { draggable: t('board.dnd.instructions') } }}
      >
        <div className="columns">
          {STATUSES.map((status) => (
            <BoardColumn key={status} status={status} stories={storiesInColumn(app.stories, status)} epics={epics} />
          ))}
        </div>
        <DragOverlay>
          {activeStory ? <OverlayCard story={activeStory} epic={epics.get(activeStory.epicId)} /> : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}
