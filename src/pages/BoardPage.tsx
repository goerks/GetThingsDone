import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  type Announcements,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type UniqueIdentifier
} from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { BoardColumn } from '../components/BoardColumn';
import { NewStoryForm } from '../components/NewStoryForm';
import { OverlayCard } from '../components/StoryCard';
import { dropTargetIn, placementOf, useDragSensors, type DropTarget } from '../dnd/dnd';
import { dropStory, parseColumnId, sprintPoints, sprintStories, storiesInColumn, type Placement } from '../domain/board';
import { STATUSES, type Status } from '../domain/types';
import { useApp } from '../state/AppState';

interface Hover {
  overId: string;
  placement: Placement | undefined;
}

export function BoardPage() {
  const { t } = useTranslation();
  const app = useApp();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [creating, setCreating] = useState(false);

  const epics = useMemo(() => new Map(app.epics.map((epic) => [epic.id, epic])), [app.epics]);
  const sensors = useDragSensors();

  // The target column and position follow from the list a drop would produce, so preview and drop always agree.
  const target = useMemo<DropTarget<Status> | null>(() => {
    if (!activeId || !hover || hover.overId === activeId) return null;
    const after = dropStory(app.stories, activeId, hover.overId, hover.placement);
    if (after === app.stories) return null;
    return dropTargetIn(sprintStories(after), activeId, (story) => story.status);
  }, [activeId, hover, app.stories]);

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
  const onDragMove = (event: DragMoveEvent): void => {
    const next = event.over ? { overId: String(event.over.id), placement: placementOf(event) } : null;
    setHover((current) =>
      current?.overId === next?.overId && current?.placement === next?.placement ? current : next
    );
  };
  const onDragEnd = (event: DragEndEvent): void => {
    setActiveId(null);
    setHover(null);
    if (event.over) app.drop(String(event.active.id), String(event.over.id), placementOf(event));
  };
  const onDragCancel = (): void => {
    setActiveId(null);
    setHover(null);
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
        onDragMove={onDragMove}
        onDragOver={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        accessibility={{ announcements, screenReaderInstructions: { draggable: t('board.dnd.instructions') } }}
      >
        <div className="columns">
          {STATUSES.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              stories={storiesInColumn(app.stories, status)}
              epics={epics}
              drop={target?.group === status ? { beforeId: target.beforeId } : undefined}
            />
          ))}
        </div>
        <DragOverlay>
          {activeStory ? <OverlayCard story={activeStory} epic={epics.get(activeStory.epicId)} /> : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}
