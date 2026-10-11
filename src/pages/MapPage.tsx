import { useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  closestCorners,
  useDroppable,
  type CollisionDetection,
  type Announcements,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type UniqueIdentifier
} from '@dnd-kit/core';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { NewEpicDialog } from '../components/EpicDialogs';
import { NewStoryDialog } from '../components/NewStoryDialog';
import { SprintDialog } from '../components/SprintDialog';
import { formatSprintDates } from '../components/sprintFormat';
import { dropTargetIn, keepInPlace, placementOf, useDragSensors } from '../dnd/dnd';
import { backlogOrder, cellId, dropOnMap, storiesInCell, totalPoints, type Placement } from '../domain/board';
import { sortEpics } from '../domain/epics';
import { isRunning, isUpcoming, mapSprints, moveSprint, todayIso } from '../domain/sprints';
import type { Epic, Sprint, Story } from '../domain/types';
import { TitleButton } from '../components/StoryCard';
import { useDetails } from '../state/Details';
import { useApp } from '../state/AppState';

const NOT_PLANNED = '-';
/** Key of a cell: epic and sprint ("-" for not planned). */
const cellKey = (epicId: string, sprintId: string | null): string => `${epicId}::${sprintId ?? NOT_PLANNED}`;
const cellOf = (story: Story): string => cellKey(story.epicId, story.sprintId);

interface Hover {
  overId: string;
  placement: Placement | undefined;
}

/* ---------- Card ---------- */

function CardContent({ story }: { story: Story }) {
  const { t } = useTranslation();
  return (
    <>
      <span className="map-card__top">
        <span className="card__code">{story.code}</span>
        <span className="pill" title={t('card.points', { count: story.points })}>
          {story.points}
        </span>
      </span>
      <TitleButton story={story} className="map-card__title" />
      <span className={`status-dot status-dot--${story.status}`}>{t(`status.${story.status}`)}</span>
    </>
  );
}

function MapCard({ story, dropBefore }: { story: Story; dropBefore: boolean }) {
  const { t } = useTranslation();
  const details = useDetails();
  const { attributes, listeners, setNodeRef, isDragging, active } = useSortable({
    id: story.id,
    attributes: { role: 'group', roleDescription: t('board.cardRole') }
  });

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Enter' && !active && event.target === event.currentTarget) {
      event.preventDefault();
      details.openStory(story.id);
      return;
    }
    listeners?.onKeyDown?.(event);
  };

  const classes = ['map-card', isDragging && 'map-card--dragging', dropBefore && 'drop-before'].filter(Boolean).join(' ');

  return (
    <li>
      <article
        ref={setNodeRef}
        className={classes}
        data-story-id={story.id}
        {...attributes}
        aria-label={`${story.code}: ${story.title}`}
        {...listeners}
        onKeyDown={onKeyDown}
        onDoubleClick={() => details.openStory(story.id)}
      >
        <CardContent story={story} />
      </article>
    </li>
  );
}

/* ---------- Cell ---------- */

interface CellProps {
  epic: Epic;
  sprint: Sprint | null;
  stories: Story[];
  /** Set while a dragged story would land in this cell: in front of `beforeId`, or at the end when null. */
  drop: { beforeId: string | null } | null;
  labelledBy: string;
  onAdd: () => void;
}

function Cell({ epic, sprint, stories, drop, labelledBy, onAdd }: CellProps) {
  const { t } = useTranslation();
  const { setNodeRef } = useDroppable({ id: cellId(epic.id, sprint?.id ?? null) });
  const classes = ['map-cell', drop && 'map-cell--target', !sprint && 'map-cell--unplanned'].filter(Boolean).join(' ');
  const sprintName = sprint ? sprint.name : t('sprint.notPlanned');

  return (
    <div className={classes} data-cell={cellKey(epic.id, sprint?.id ?? null)} data-drop-target={drop ? 'true' : undefined}>
      <SortableContext items={stories.map((story) => story.id)} strategy={keepInPlace}>
        <ul ref={setNodeRef} className="map-cell__list" aria-labelledby={labelledBy}>
          {stories.map((story) => (
            <MapCard key={story.id} story={story} dropBefore={drop?.beforeId === story.id} />
          ))}
          {drop && drop.beforeId === null && stories.length > 0 && <li className="drop-line" aria-hidden="true" />}
        </ul>
      </SortableContext>
      <button
        type="button"
        className={`map-cell__add${stories.length === 0 ? ' map-cell__add--empty' : ''}`}
        aria-label={t('map.newStoryIn', { epic: epic.name, sprint: sprintName })}
        title={t('map.newStoryIn', { epic: epic.name, sprint: sprintName })}
        onClick={onAdd}
      >
        +
      </button>
    </div>
  );
}

/* ---------- Sprint label ---------- */

/** Drag id of a sprint label, kept apart from story ids. */
const SPRINT_PREFIX = 'sprint:';
const sprintDragId = (id: string): string => `${SPRINT_PREFIX}${id}`;
const isSprintDragId = (id: UniqueIdentifier): boolean => String(id).startsWith(SPRINT_PREFIX);
const sprintOfDragId = (id: UniqueIdentifier): string => String(id).slice(SPRINT_PREFIX.length);

interface SprintLabelProps {
  sprint: Sprint;
  today: string;
  stories: Story[];
  labelId: string;
  isTarget: boolean;
}

function SprintLabelContent({ sprint, today, stories, labelId }: Omit<SprintLabelProps, 'isTarget'>) {
  const { t, i18n } = useTranslation();
  return (
    <>
      {isRunning(sprint, today) && <span className="badge-running">{t('sprint.running')}</span>}
      <span id={labelId} className="map-sprint__name">
        {sprint.name}
      </span>
      <span className="map-sprint__dates">{formatSprintDates(sprint, i18n.language)}</span>
      <span className="map-sprint__sum">{t('map.storiesPoints', { count: stories.length, points: totalPoints(stories) })}</span>
    </>
  );
}

/**
 * The label of a sprint row. A click opens the sprint; a sprint that has not started yet can also be dragged
 * up or down to reorder the upcoming sprints.
 */
function SprintLabel({ sprint, today, stories, labelId, isTarget }: SprintLabelProps) {
  const { t, i18n } = useTranslation();
  const details = useDetails();
  const movable = isUpcoming(sprint, today);
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: sprintDragId(sprint.id),
    disabled: !movable,
    attributes: { roleDescription: t('map.sprintRole') }
  });
  const classes = [
    'map-sprint',
    isRunning(sprint, today) && 'map-sprint--running',
    movable && 'map-sprint--movable',
    isTarget && 'map-sprint--target',
    isDragging && 'map-sprint--dragging'
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={classes}
      {...(movable ? attributes : {})}
      {...(movable ? listeners : {})}
      onClick={() => details.openSprint(sprint.id)}
      aria-label={[sprint.name, formatSprintDates(sprint, i18n.language), isRunning(sprint, today) ? t('sprint.running') : null]
        .filter(Boolean)
        .join(', ')}
      aria-describedby={`${labelId}-edit`}
      title={movable ? t('map.editOrMoveSprint') : t('map.editSprint')}
    >
      <SprintLabelContent sprint={sprint} today={today} stories={stories} labelId={labelId} />
      <span id={`${labelId}-edit`} className="sr-only">
        {movable ? t('map.editOrMoveSprint') : t('map.editSprint')}
      </span>
    </button>
  );
}

const COMPACT_KEY = 'getitdone.mapCompact';

function readCompact(): boolean {
  try {
    return window.localStorage.getItem(COMPACT_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Stories are dragged among cards and cells, sprint labels only among the upcoming sprint labels. */
const collision: CollisionDetection = (args) => {
  const sprint = isSprintDragId(args.active.id);
  const droppableContainers = args.droppableContainers.filter((container) => isSprintDragId(container.id) === sprint);
  return (sprint ? closestCenter : closestCorners)({ ...args, droppableContainers });
};

/* ---------- Page ---------- */

type DialogState = { kind: 'story'; epicId: string; sprintId: string | null } | { kind: 'epic' } | { kind: 'sprint' } | null;

export function MapPage() {
  const { t, i18n } = useTranslation();
  const app = useApp();
  const sensors = useDragSensors();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [compact, setCompact] = useState(readCompact);
  const details = useDetails();

  const toggleCompact = (): void => {
    setCompact((value) => {
      try {
        window.localStorage.setItem(COMPACT_KEY, String(!value));
      } catch {
        // the choice just will not be remembered
      }
      return !value;
    });
  };

  const today = todayIso();
  const epics = useMemo(() => sortEpics(app.epics), [app.epics]);
  const sprints = mapSprints(app.sprints, today);
  const shownStories = app.stories.filter(
    (story) => story.sprintId === null || sprints.some((sprint) => sprint.id === story.sprintId)
  );

  /** The backlog order a drop would produce, or null when nothing would change. */
  const preview = (active: string, over: string, placement?: Placement): Story[] | null => {
    if (active === over) return null;
    const after = dropOnMap(app.stories, app.sprints, active, over, placement);
    return after === app.stories ? null : backlogOrder(after, app.sprints);
  };

  const sprintDrag = activeId !== null && isSprintDragId(activeId);

  /** Where a dragged sprint would go: the sprint list after the move, or null when it would not change. */
  const sprintPreview = (active: string, over: string, placement: Placement | undefined): Sprint[] | null => {
    if (!isSprintDragId(active) || !isSprintDragId(over)) return null;
    const from = sprints.findIndex((sprint) => sprint.id === sprintOfDragId(active));
    const to = sprints.findIndex((sprint) => sprint.id === sprintOfDragId(over));
    const side = placement ?? (from < to ? 'after' : 'before');
    const after = moveSprint(app.sprints, today, sprintOfDragId(active), sprintOfDragId(over), side);
    return after === app.sprints ? null : after;
  };
  const sprintTarget = (() => {
    if (!sprintDrag || !hover) return null;
    const after = sprintPreview(activeId, hover.overId, hover.placement);
    if (!after) return null;
    const moved = after.find((sprint) => sprint.id === sprintOfDragId(activeId));
    const order = mapSprints(after, today);
    const index = order.findIndex((sprint) => sprint.id === moved?.id);
    const next = order[index + 1];
    return moved ? { overId: sprintOfDragId(hover.overId), beforeId: next?.id ?? null, moved } : null;
  })();

  const target = (() => {
    if (!activeId || !hover || sprintDrag) return null;
    const list = preview(activeId, hover.overId, hover.placement);
    return list ? dropTargetIn(list, activeId, cellOf) : null;
  })();
  const [targetEpic, targetSprint] = target ? target.group.split('::') : [null, null];

  const describe = (active: UniqueIdentifier, over: UniqueIdentifier, key: 'over' | 'dropped'): string | undefined => {
    const list = preview(String(active), String(over));
    const story = list?.find((item) => item.id === active);
    if (!list || !story) return undefined;
    const position = storiesInCell(list, story.epicId, story.sprintId).findIndex((item) => item.id === active) + 1;
    return t(`map.dnd.${key}`, {
      title: story.title,
      sprint: app.sprints.find((sprint) => sprint.id === story.sprintId)?.name ?? t('sprint.notPlanned'),
      epic: app.epics.find((epic) => epic.id === story.epicId)?.name ?? '',
      position
    });
  };
  const describeSprint = (active: UniqueIdentifier, over: UniqueIdentifier, key: 'sprintOver' | 'sprintDropped'): string | undefined => {
    const after = sprintPreview(String(active), String(over), undefined);
    const moved = after?.find((sprint) => sprint.id === sprintOfDragId(active));
    if (!after || !moved) return undefined;
    const position = mapSprints(after, today).findIndex((sprint) => sprint.id === moved.id) + 1;
    return t(`map.dnd.${key}`, { name: moved.name, position, dates: formatSprintDates(moved, i18n.language) });
  };
  const titleOf = (id: UniqueIdentifier): string =>
    isSprintDragId(id)
      ? (app.sprints.find((sprint) => sprint.id === sprintOfDragId(id))?.name ?? '')
      : (app.stories.find((story) => story.id === id)?.title ?? '');
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('board.dnd.pickedUp', { title: titleOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over
        ? isSprintDragId(active.id)
          ? describeSprint(active.id, over.id, 'sprintOver')
          : describe(active.id, over.id, 'over')
        : undefined,
    onDragEnd: ({ active, over }) =>
      (over &&
        (isSprintDragId(active.id)
          ? describeSprint(active.id, over.id, 'sprintDropped')
          : describe(active.id, over.id, 'dropped'))) ??
      t('board.dnd.cancelled', { title: titleOf(active.id) }),
    onDragCancel: ({ active }) => t('board.dnd.cancelled', { title: titleOf(active.id) })
  };

  const onDragMove = (event: DragMoveEvent): void => {
    const next = event.over ? { overId: String(event.over.id), placement: placementOf(event) } : null;
    setHover((current) =>
      current?.overId === next?.overId && current?.placement === next?.placement ? current : next
    );
  };
  const onDragEnd = (event: DragEndEvent): void => {
    setActiveId(null);
    setHover(null);
    if (!event.over) return;
    const active = String(event.active.id);
    const over = String(event.over.id);
    if (isSprintDragId(active)) {
      if (!isSprintDragId(over)) return;
      const from = sprints.findIndex((sprint) => sprint.id === sprintOfDragId(active));
      const to = sprints.findIndex((sprint) => sprint.id === sprintOfDragId(over));
      app.moveSprint(sprintOfDragId(active), sprintOfDragId(over), placementOf(event) ?? (from < to ? 'after' : 'before'));
    } else {
      app.dropOnMap(active, over, placementOf(event));
    }
  };
  const onDragCancel = (): void => {
    setActiveId(null);
    setHover(null);
  };

  const renderRow = (sprint: Sprint | null) => {
  const key = sprint?.id ?? NOT_PLANNED;
  const labelId = `map-sprint-${key}`;
  const inSprint = shownStories.filter((story) => story.sprintId === (sprint?.id ?? null));
  const isTarget = targetSprint === key;
  const dropBefore = Boolean(sprintTarget && sprint && sprintTarget.beforeId === sprint.id);
  const dropAfter = Boolean(
    sprintTarget && sprint && sprintTarget.beforeId === null && sprints[sprints.length - 1]?.id === sprint.id
  );
  return (
    <div
      key={key}
      className={[
        'map__row',
        !sprint && 'map__row--unplanned',
        dropBefore && 'map__row--drop-before',
        dropAfter && 'map__row--drop-after'
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {sprintTarget && (dropBefore || dropAfter) && (
        <span className="map-drop-pill" aria-hidden="true">
          {t('map.sprintDropLabel', {
            name: sprintTarget.moved.name,
            dates: formatSprintDates(sprintTarget.moved, i18n.language)
          })}
        </span>
      )}
      {sprint ? (
        <SprintLabel sprint={sprint} today={today} stories={inSprint} labelId={labelId} isTarget={isTarget || sprintTarget?.overId === sprint.id} />
      ) : (
        <div className={`map-sprint map-sprint--unplanned${isTarget ? ' map-sprint--target' : ''}`}>
          <span id={labelId} className="map-sprint__name">
            {t('sprint.notPlanned')}
          </span>
          <span className="map-sprint__sum">
            {t('map.storiesPoints', { count: inSprint.length, points: totalPoints(inSprint) })}
          </span>
        </div>
      )}
      {epics.map((epic) => (
        <Cell
          key={epic.id}
          epic={epic}
          sprint={sprint}
          stories={storiesInCell(app.stories, epic.id, sprint?.id ?? null)}
          drop={target && target.group === cellKey(epic.id, sprint?.id ?? null) ? { beforeId: target.beforeId } : null}
          labelledBy={`${labelId} map-epic-${epic.id}`}
          onAdd={() => setDialog({ kind: 'story', epicId: epic.id, sprintId: sprint?.id ?? null })}
        />
      ))}
    </div>
  );
  };

  const activeStory = activeId && !sprintDrag ? app.stories.find((story) => story.id === activeId) : undefined;
  const activeSprint = activeId && sprintDrag ? app.sprints.find((sprint) => sprint.id === sprintOfDragId(activeId)) : undefined;
  const gridStyle = { '--map-columns': epics.length } as CSSProperties;

  return (
    <>
      <div className="page-head">
        <h1>{t('map.title')}</h1>
        <span className="muted">
          {t('map.summary', { epics: epics.length, sprints: sprints.length, stories: shownStories.length })}
        </span>
        <button
          type="button"
          className={`btn page-head__action${compact ? ' btn--pressed' : ''}`}
          aria-pressed={compact}
          onClick={toggleCompact}
        >
          {t('map.compact')}
        </button>
      </div>

      {epics.length === 0 ? (
        <div className="map-empty">
          <p className="muted">{t('map.noEpics')}</p>
          <button type="button" className="btn btn--primary" onClick={() => setDialog({ kind: 'epic' })}>
            {t('epics.new')}
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collision}
          onDragStart={(event: DragStartEvent) => setActiveId(String(event.active.id))}
          onDragMove={onDragMove}
          onDragOver={onDragMove}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
          accessibility={{ announcements, screenReaderInstructions: { draggable: t('map.dnd.instructions') } }}
        >
          <div className={`map${compact ? ' map--compact' : ''}`} style={gridStyle}>
            <div className="map__row map__row--head">
              <div className="map__corner" aria-hidden="true">
                {t('map.corner')}
              </div>
              {epics.map((epic) => {
                const inEpic = shownStories.filter((story) => story.epicId === epic.id);
                return (
                  <button
                    type="button"
                    key={epic.id}
                    className={`map-epic${targetEpic === epic.id ? ' map-epic--target' : ''}`}
                    style={{ '--epic-color': `var(--epic-${epic.colorKey})` } as CSSProperties}
                    onClick={() => details.openEpic(epic.id)}
                  >
                    <span id={`map-epic-${epic.id}`} className="map-epic__name">
                      {epic.name}
                    </span>
                    <span className="map-epic__sum">
                      {t('map.storiesPoints', { count: inEpic.length, points: totalPoints(inEpic) })}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                className="map__add-epic"
                aria-label={t('map.addEpic')}
                title={t('map.addEpic')}
                onClick={() => setDialog({ kind: 'epic' })}
              >
                +
              </button>
            </div>

            <SortableContext items={sprints.map((sprint) => sprintDragId(sprint.id))} strategy={keepInPlace}>
              {sprints.map((sprint) => renderRow(sprint))}
            </SortableContext>
            <div className="map__row map__row--add">
              <button type="button" className="map__add-sprint" onClick={() => setDialog({ kind: 'sprint' })}>
                {t('map.addSprint')}
              </button>
            </div>
            {renderRow(null)}
          </div>
          <DragOverlay>
            {activeSprint ? (
              <div className="map-sprint map-sprint--overlay" aria-hidden="true">
                <SprintLabelContent
                  sprint={activeSprint}
                  today={today}
                  stories={shownStories.filter((story) => story.sprintId === activeSprint.id)}
                  labelId="map-sprint-overlay"
                />
              </div>
            ) : activeStory ? (
              <article className="map-card map-card--overlay" aria-hidden="true">
                <CardContent story={activeStory} />
              </article>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {dialog?.kind === 'story' && (
        <NewStoryDialog sprintId={dialog.sprintId} epicId={dialog.epicId} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'epic' && <NewEpicDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'sprint' && <SprintDialog onClose={() => setDialog(null)} />}
    </>
  );
}
