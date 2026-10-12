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
import { NewStoryDialog } from '../components/NewStoryDialog';
import { OverlayCard } from '../components/StoryCard';
import { dropTargetIn, placementOf, useDragSensors, type DropTarget } from '../dnd/dnd';
import { dropStory, parseColumnId, sprintStories, storiesInColumn, totalPoints, type Placement } from '../domain/board';
import { runningSprint, todayIso } from '../domain/sprints';
import { formatSprintDates } from '../components/sprintFormat';
import { hrefs } from '../router';
import { STATUSES, type Status } from '../domain/types';
import { useApp } from '../state/AppState';
import { useBuiltin } from '../components/useBuiltin';
import { HighlightBar } from '../components/search/HighlightBar';
import { useSearchPage } from '../state/Search';

interface Hover {
  overId: string;
  placement: Placement | undefined;
}

export function BoardPage() {
  const { t, i18n } = useTranslation();
  const builtin = useBuiltin();
  const app = useApp();
  const sprint = runningSprint(app.sprints, todayIso());
  const sprintId = sprint?.id ?? null;
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
    return dropTargetIn(sprintStories(after, sprintId), activeId, (story) => story.status);
  }, [activeId, hover, app.stories, sprintId]);

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
  const inSprint = sprintStories(app.stories, sprintId);
  useSearchPage(t('nav.board'), { story: inSprint.map((story) => story.id), sprint: sprintId ? [sprintId] : [] });

  if (!sprint) {
    return (
      <>
        <div className="page-head">
          <h1>{t('board.noSprintTitle')}</h1>
        </div>
        <p className="muted">
          {t('board.noSprint')} <a href={hrefs.map}>{t('board.toMap')}</a>
        </p>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>{sprint.name}</h1>
        <span className="muted">
          {formatSprintDates(sprint, i18n.language)} · {builtin.summary(inSprint.length, totalPoints(inSprint))}
        </span>
        <button type="button" className="btn btn--primary page-head__action" onClick={() => setCreating(true)}>
          {t('newStory.open')}
        </button>
      </div>

      <HighlightBar storyIds={inSprint.map((story) => story.id)} />

      {creating && <NewStoryDialog sprintId={sprintId} onClose={() => setCreating(false)} />}

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
              stories={storiesInColumn(app.stories, sprintId, status)}
              epics={epics}
              drop={target?.group === status ? { beforeId: target.beforeId } : undefined}
            />
          ))}
        </div>
        <DragOverlay>
          {activeStory ? <OverlayCard story={activeStory} epic={epics.get(activeStory.epicId ?? '')} /> : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}
