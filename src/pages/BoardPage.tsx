import { useMemo, useState, type CSSProperties } from 'react';
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
import { VelocityButton } from '../components/VelocityButton';
import { BoardColumn } from '../components/BoardColumn';
import { CompleteSprintDialog } from '../components/CompleteSprintDialog';
import { NewStoryDialog } from '../components/NewStoryDialog';
import { NewButton } from '../components/NewButton';
import { StartSprintDialog } from '../components/StartSprintDialog';
import { useNewShortcut } from '../components/useNewShortcut';
import { MemberFilterBar } from '../components/MemberFilterBar';
import { OverlayCard } from '../components/StoryCard';
import { dropTargetIn, placementOf, useDragSensors, type DropTarget } from '../dnd/dnd';
import { dropStory, parseColumnId, sprintStories, storiesInColumn, totalPoints, type Placement } from '../domain/board';
import { ALL_MEMBERS, matchesMemberFilter, type MemberFilter } from '../domain/members';
import { summarizeSprint, type Completion } from '../domain/sprintLife';
import { boardSprint, isEnded, todayIso } from '../domain/sprints';
import { formatDayLong, formatSprintDates } from '../components/sprintFormat';
import { hrefs } from '../router';
import { CATEGORY_COLORS, STATUS_CATEGORIES, statusesIn } from '../domain/statuses';
import type { Status } from '../domain/types';
import { statusLabel } from '../components/statusLabel';
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
  const sprint = boardSprint(app.sprints);
  const today = todayIso();
  const sprintId = sprint?.id ?? null;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [memberFilter, setMemberFilter] = useState<MemberFilter>(ALL_MEMBERS);
  useNewShortcut(() => setCreating(true), !creating);

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
    if (column) return statusLabel(t, app.statuses, column);
    const story = app.stories.find((item) => item.id === id);
    return story ? statusLabel(t, app.statuses, story.status) : '';
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

  const completedText = (completion: Completion): string => {
    const { summary, completed, targetSprint } = completion;
    const base = t('lifecycle.completed.base', { name: completed.name, done: summary.donePoints, planned: summary.plannedPoints });
    if (summary.notDone.length === 0) return base;
    const moved = { count: summary.notDone.length, points: summary.notDonePoints };
    return `${base} ${targetSprint ? t('lifecycle.completed.movedToSprint', { ...moved, target: targetSprint.name }) : t('lifecycle.completed.movedToBacklog', moved)}`;
  };
  const onCompleted = (completion: Completion, startId: string | null): void => {
    setMessage(completedText(completion));
    if (startId) setStartingId(startId);
  };
  const messageBox = message && (
    <div className="sprint-message" role="status">
      <span className="sprint-message__icon" aria-hidden="true">
        ✓
      </span>
      <span className="sprint-message__text">{message}</span>
      <button type="button" className="btn btn--small" aria-label={t('lifecycle.closeMessage')} onClick={() => setMessage(null)}>
        ✕
      </button>
    </div>
  );
  const startDialog = startingId && <StartSprintDialog sprintId={startingId} onClose={() => setStartingId(null)} />;

  if (!sprint) {
    const noSprintAtAll = app.sprints.length === 0;
    return (
      <>
        {messageBox}
        {startDialog}
        <div className="page-head">
          <h1>{noSprintAtAll ? t('board.noSprintTitle') : t('lifecycle.allDoneTitle')}</h1>
          <span className="page-head__actions">
            <VelocityButton />
          </span>
        </div>
        {noSprintAtAll ? (
          <p className="muted">
            {t('board.noSprint')} <a href={hrefs.map}>{t('board.toMap')}</a>
          </p>
        ) : (
          <div className="sprint-empty">
            <p>
              <strong>{t('lifecycle.allDone')}</strong>
            </p>
            <p className="muted">{t('lifecycle.allDoneHint')}</p>
            <a className="btn btn--primary" href={hrefs.map}>
              {t('lifecycle.toMap')}
            </a>
          </div>
        )}
      </>
    );
  }

  const ended = isEnded(sprint, today);
  const atStart = sprint.state === 'running' && sprint.startItems ? summarizeSprint(sprint, app.stories, app.isDone).plannedPoints : null;
  const points = totalPoints(inSprint);
  // A filter on a member who was removed in the meantime shows everything again.
  const filter = memberFilter.kind === 'member' && !app.members.some((member) => member.id === memberFilter.memberId) ? ALL_MEMBERS : memberFilter;
  const shown = (status: string) => storiesInColumn(app.stories, sprintId, status).filter((story) => matchesMemberFilter(story, filter));
  const shownCount = app.statuses.reduce((sum, status) => sum + shown(status.id).length, 0);

  return (
    <>
      <div className="page-head">
        <h1>{sprint.name}</h1>
        <span className={sprint.state === 'running' ? (ended ? 'badge-ended' : 'badge-running') : 'badge-planned'}>
          {t(ended ? 'sprint.ended' : `sprint.${sprint.state}`)}
        </span>
        <span className="muted">
          {formatSprintDates(sprint, i18n.language)} · {builtin.summary(inSprint.length, points)}
          {atStart !== null && atStart !== points && ` (${t('lifecycle.atStart', { points: atStart })})`}
        </span>
        <span className="page-head__actions">
          <VelocityButton />
          {sprint.state === 'running' && !ended && (
            <button type="button" className="btn" onClick={() => setCompleting(true)}>
              {t('lifecycle.completeButton')}
            </button>
          )}
          <NewButton label={t('newStory.open')} onClick={() => setCreating(true)} />
        </span>
      </div>

      {messageBox}

      {sprint.state === 'planned' && (
        <div className="sprint-hint" role="status">
          <span className="sprint-hint__icon" aria-hidden="true">
            ▶
          </span>
          <span className="sprint-hint__text">
            <span className="sprint-hint__title">{t('lifecycle.plannedTitle', { name: sprint.name })}</span>
            <span className="sprint-hint__more">{t('lifecycle.plannedText')}</span>
          </span>
          <button type="button" className="btn btn--primary" onClick={() => setStartingId(sprint.id)}>
            {t('lifecycle.startButton')}
          </button>
        </div>
      )}
      {ended && (
        <div className="sprint-hint sprint-hint--ended" role="status">
          <span className="sprint-hint__icon" aria-hidden="true">
            ⏱
          </span>
          <span className="sprint-hint__text">
            <span className="sprint-hint__title">{t('lifecycle.endedTitle', { name: sprint.name, date: formatDayLong(sprint.endDate, i18n.language) })}</span>
            <span className="sprint-hint__more">{t('lifecycle.endedText')}</span>
          </span>
          <button type="button" className="btn btn--primary" onClick={() => setCompleting(true)}>
            {t('lifecycle.completeButton')}
          </button>
        </div>
      )}

      <HighlightBar storyIds={inSprint.map((story) => story.id)} />
      <MemberFilterBar filter={filter} onChange={setMemberFilter} />
      {filter.kind !== 'all' && shownCount === 0 && (
        <p className="muted" role="status">
          {t('team.filter.empty')}
        </p>
      )}

      {creating && <NewStoryDialog sprintId={sprintId} onClose={() => setCreating(false)} />}
      {completing && <CompleteSprintDialog sprint={sprint} onClose={() => setCompleting(false)} onCompleted={onCompleted} />}
      {startDialog}

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
        {/* One band per category above its columns; with many columns the board scrolls sideways. */}
        <div className="board" role="group" aria-label={t('board.columns')}>
          {STATUS_CATEGORIES.map((category) => {
            const columns = statusesIn(app.statuses, category);
            if (columns.length === 0) return null;
            const count = columns.reduce((sum, status) => sum + shown(status.id).length, 0);
            return (
              <div
                key={category}
                className="board__group"
                role="group"
                aria-labelledby={`band-${category}`}
                data-category={category}
                style={{ '--category-color': CATEGORY_COLORS[category] } as CSSProperties}
              >
                <h2 className="board__band">
                  <span id={`band-${category}`}>{t(`statusValues.category.${category}`)}</span>
                  <span className="board__band-count" aria-label={t('board.bandCount', { count })}>
                    {count}
                  </span>
                </h2>
                <div className="columns">
                  {columns.map((status) => (
                    <BoardColumn
                      key={status.id}
                      status={status.id}
                      sprintId={sprintId}
                      stories={shown(status.id)}
                      epics={epics}
                      drop={target?.group === status.id ? { beforeId: target.beforeId } : undefined}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <DragOverlay>
          {activeStory ? <OverlayCard story={activeStory} epic={epics.get(activeStory.epicId ?? '')} /> : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}
