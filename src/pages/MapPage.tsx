import { createContext, useContext, useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';
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
import { SyncControl } from '../components/SyncControl';
import { useTranslation } from 'react-i18next';
import { NewEpicDialog } from '../components/EpicDialogs';
import { NewStoryDialog } from '../components/NewStoryDialog';
import { NewButton } from '../components/NewButton';
import { StoryQuickAdd } from '../components/QuickAdd';
import { useStoryMenu } from '../state/StoryMenu';
import { NewReleaseDialog } from '../components/ReleaseForm';
import { formatPeriod } from '../components/releaseFormat';
import { SprintDialog } from '../components/SprintDialog';
import { SprintPlan } from '../components/SprintPlan';
import { formatSprintDates } from '../components/sprintFormat';
import { dropTargetIn, keepInPlace, placementOf, useDragSensors } from '../dnd/dnd';
import {
  NO_EPIC,
  backlogOrder,
  cellId,
  dropOnMap,
  dropOnReleaseMap,
  releaseCellId,
  storiesInCell,
  storiesInReleaseCell,
  totalPoints,
  type Placement
} from '../domain/board';
import { effectiveMapRows, featureOn } from '../domain/settings';
import { isReleaseDone, releaseState, sortReleases, storiesAfterReleaseEnd } from '../domain/releases';
import { sortEpics } from '../domain/epics';
import { isUpcoming, mapSprints, moveSprint, todayIso } from '../domain/sprints';
import type { Epic, Release, Sprint, Story } from '../domain/types';
import { hrefs } from '../router';
import { GearIcon } from '../components/icons';
import { StoryCardContent } from '../components/StoryCard';
import { useDetails } from '../state/Details';
import { useApp } from '../state/AppState';
import { useBuiltin } from '../components/useBuiltin';
import { HighlightBar, useMatchClass } from '../components/search/HighlightBar';
import { usePageMatches, useSearchPage } from '../state/Search';
import { useNewShortcut } from '../components/useNewShortcut';

const NOT_PLANNED = '-';
/** Key of a cell: epic ("-" for no epic) and sprint ("-" for not planned). */
const cellKey = (epicId: string | null, sprintId: string | null): string => `${epicId ?? NO_EPIC}::${sprintId ?? NOT_PLANNED}`;
/** Id of the column header, which labels the cells of a column. */
const columnLabelId = (epic: Epic | null): string => `map-epic-${epic?.id ?? 'none'}`;

interface Hover {
  overId: string;
  placement: Placement | undefined;
}

/* ---------- Card ---------- */

/** Whether the map shows one line per story; the cards read it, so it does not travel through every cell. */
const CompactContext = createContext(false);

function MapCard({ story, dropBefore }: { story: Story; dropBefore: boolean }) {
  const { t } = useTranslation();
  const details = useDetails();
  const menu = useStoryMenu();
  const app = useApp();
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

  const compact = useContext(CompactContext);
  const match = useMatchClass(story.id, 'map-card');
  const classes = ['card', 'map-card', compact && 'card--compact', isDragging && 'map-card--dragging', dropBefore && 'drop-before', app.flashed === story.id && 'flash', menu.openId === story.id && 'ctx-target', match].filter(Boolean).join(' ');

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
        onClick={() => details.openStory(story.id)}
        onContextMenu={(event) => menu.openFor(story.id, event)}
      >
        <StoryCardContent story={story} epic={app.epics.find((item) => item.id === story.epicId)} compact={compact} />
      </article>
    </li>
  );
}

/* ---------- Cell ---------- */

interface CellProps {
  /** Null for the column of stories without an epic. */
  epic: Epic | null;
  /** The id of the drop target and the key of the cell: sprint or release mode. */
  dropId: string;
  cellKey: string;
  /** The row is "not planned" or "no release". */
  unplanned: boolean;
  /** The name of the row for the label of the "+" button, and the label itself. */
  addLabel: string;
  stories: Story[];
  /** Set while a dragged story would land in this cell: in front of `beforeId`, or at the end when null. */
  drop: { beforeId: string | null } | null;
  labelledBy: string;
  /** Where "+" puts a new story, in words, and as ids. */
  place: string;
  quick: { sprintId: string | null; epicId: string | null; releaseId?: string | null };
}

function Cell({ dropId, cellKey: key, unplanned, addLabel, stories, drop, labelledBy, place, quick }: CellProps) {
  const { setNodeRef } = useDroppable({ id: dropId });
  const classes = ['map-cell', drop && 'map-cell--target', unplanned && 'map-cell--unplanned'].filter(Boolean).join(' ');

  return (
    <div className={classes} data-cell={key} data-drop-target={drop ? 'true' : undefined}>
      <SortableContext items={stories.map((story) => story.id)} strategy={keepInPlace}>
        <ul ref={setNodeRef} className="map-cell__list" aria-labelledby={labelledBy}>
          {stories.map((story) => (
            <MapCard key={story.id} story={story} dropBefore={drop?.beforeId === story.id} />
          ))}
          {drop && drop.beforeId === null && stories.length > 0 && <li className="drop-line" aria-hidden="true" />}
        </ul>
      </SortableContext>
      <StoryQuickAdd
        variant="cell"
        place={place}
        buttonLabel={addLabel}
        extraClass={stories.length === 0 ? 'map-cell__add--empty' : undefined}
        sprintId={quick.sprintId}
        epicId={quick.epicId}
        releaseId={quick.releaseId}
      />
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
  stories: Story[];
  labelId: string;
  isTarget: boolean;
}

function SprintLabelContent({ sprint, stories, labelId }: Omit<SprintLabelProps, 'isTarget'>) {
  const { t, i18n } = useTranslation();
  const builtin = useBuiltin();
  return (
    <>
      {sprint.state === 'running' && <span className="badge-running">{t('sprint.running')}</span>}
      {sprint.state === 'planned' && <span className="badge-planned">{t('sprint.planned')}</span>}
      <span id={labelId} className="map-sprint__name">
        {sprint.name}
      </span>
      <span className="map-sprint__dates">{formatSprintDates(sprint, i18n.language)}</span>
      <span className="map-sprint__sum">{builtin.summary(stories.length, totalPoints(stories))}</span>
      <SprintPlan points={totalPoints(stories)} className="map-sprint__plan" />
    </>
  );
}

/**
 * The label of a sprint row. A click opens the sprint; a sprint that has not started yet can also be dragged
 * up or down to reorder the upcoming sprints.
 */
function SprintLabel({ sprint, stories, labelId, isTarget }: SprintLabelProps) {
  const { t, i18n } = useTranslation();
  const details = useDetails();
  const movable = isUpcoming(sprint);
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: sprintDragId(sprint.id),
    disabled: !movable,
    attributes: { roleDescription: t('map.sprintRole') }
  });
  const match = useMatchClass(sprint.id, 'map-sprint', 'sprint', false);
  const classes = [
    'map-sprint',
    match,
    sprint.state === 'running' && 'map-sprint--running',
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
      data-sprint-id={sprint.id}
      {...(movable ? attributes : {})}
      {...(movable ? listeners : {})}
      onClick={() => details.openSprint(sprint.id)}
      aria-label={[sprint.name, formatSprintDates(sprint, i18n.language), t(`sprint.${sprint.state}`)]
        .filter(Boolean)
        .join(', ')}
      aria-describedby={`${labelId}-edit`}
      title={movable ? t('map.editOrMoveSprint') : t('map.editSprint')}
    >
      <SprintLabelContent sprint={sprint} stories={stories} labelId={labelId} />
      <span id={`${labelId}-edit`} className="sr-only">
        {movable ? t('map.editOrMoveSprint') : t('map.editSprint')}
      </span>
    </button>
  );
}

/* ---------- Release label (rows in release mode) ---------- */

interface ReleaseLabelProps {
  release: Release;
  stories: Story[];
  labelId: string;
  isTarget: boolean;
  today: string;
}

/** The label of a release row: a click opens the release. */
function ReleaseLabel({ release, stories, labelId, isTarget, today }: ReleaseLabelProps) {
  const { t, i18n } = useTranslation();
  const app = useApp();
  const builtin = useBuiltin();
  const details = useDetails();
  const state = releaseState(release, app.stories, today, app.isDone);
  const late = storiesAfterReleaseEnd(release, app.stories, app.sprints).length;
  const period = formatPeriod(release, t, i18n.resolvedLanguage ?? 'en');
  return (
    <button
      type="button"
      className={`map-sprint map-release${state === 'running' ? ' map-sprint--running' : ''}${isTarget ? ' map-sprint--target' : ''}`}
      onClick={() => details.openRelease(release.id)}
      aria-label={[release.title, period, t(`releases.state.${state}`)].join(', ')}
      title={t('map.editRelease')}
    >
      <span className={`release-state release-state--${state}`}>{t(`releases.state.${state}`)}</span>
      <span id={labelId} className="map-sprint__name">
        {release.title}
      </span>
      <span className="map-sprint__dates">{period}</span>
      <span className="map-sprint__sum">{builtin.summary(stories.length, totalPoints(stories))}</span>
      {late > 0 && <span className="hint map-release__hint">{t('map.afterEnd', { count: late })}</span>}
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

type DialogState =
  | { kind: 'story'; epicId: string | null; sprintId: string | null; releaseId?: string | null }
  | { kind: 'epic' }
  | { kind: 'sprint' }
  | { kind: 'release' }
  | null;

export function MapPage() {
  const { t, i18n } = useTranslation();
  const app = useApp();
  const builtin = useBuiltin();
  const colorShown = builtin.shown('epic', 'color');
  const sensors = useDragSensors();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [compact, setCompact] = useState(readCompact);
  // Ctrl+N creates a story that is not planned yet; the cells' "+" create one in a given epic and sprint.
  useNewShortcut(() => setDialog({ kind: 'story', epicId: null, sprintId: null }), dialog === null);
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
  const releaseMode = effectiveMapRows(app.settings) === 'releases';
  const epics = useMemo(() => sortEpics(app.epics), [app.epics]);
  // Stories without an epic get their own column at the end, shown only while there are such stories.
  const hasLooseStories = app.stories.some((story) => story.epicId === null);
  const columns = useMemo<Array<Epic | null>>(() => (hasLooseStories ? [...epics, null] : epics), [epics, hasLooseStories]);
  const sprints = mapSprints(app.sprints);
  // Releases that are done are left out like past sprints; their stories are done as well.
  const releases = sortReleases(app.releases, app.stories, app.isDone).filter((release) => !isReleaseDone(app.stories, release.id, app.isDone));
  const shownStories = releaseMode
    ? app.stories.filter((story) => story.releaseId === null || releases.some((release) => release.id === story.releaseId))
    : app.stories.filter((story) => story.sprintId === null || sprints.some((sprint) => sprint.id === story.sprintId));
  const cellOf = (story: Story): string => cellKey(story.epicId, releaseMode ? story.releaseId : story.sprintId);
  const matches = usePageMatches();
  useSearchPage(t('nav.storyMap'), {
    story: shownStories.map((story) => story.id),
    epic: epics.map((epic) => epic.id),
    sprint: releaseMode ? [] : sprints.map((sprint) => sprint.id)
  });

  /** The backlog order a drop would produce, or null when nothing would change. */
  const preview = (active: string, over: string, placement?: Placement): Story[] | null => {
    if (active === over) return null;
    const after = releaseMode
      ? dropOnReleaseMap(app.stories, app.sprints, app.releases, active, over, placement)
      : dropOnMap(app.stories, app.sprints, active, over, placement);
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
    const order = mapSprints(after);
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
    const epic = app.epics.find((item) => item.id === story.epicId)?.name ?? t('epics.noEpic');
    if (releaseMode) {
      const position = storiesInReleaseCell(list, story.epicId, story.releaseId).findIndex((item) => item.id === active) + 1;
      return t(`map.dnd.release${key === 'over' ? 'Over' : 'Dropped'}`, {
        title: story.title,
        release: app.releases.find((release) => release.id === story.releaseId)?.title ?? t('map.noRelease'),
        epic,
        position
      });
    }
    const position = storiesInCell(list, story.epicId, story.sprintId).findIndex((item) => item.id === active) + 1;
    return t(`map.dnd.${key}`, {
      title: story.title,
      sprint: app.sprints.find((sprint) => sprint.id === story.sprintId)?.name ?? t('sprint.notPlanned'),
      epic,
      position
    });
  };
  const describeSprint = (active: UniqueIdentifier, over: UniqueIdentifier, key: 'sprintOver' | 'sprintDropped'): string | undefined => {
    const after = sprintPreview(String(active), String(over), undefined);
    const moved = after?.find((sprint) => sprint.id === sprintOfDragId(active));
    if (!after || !moved) return undefined;
    const position = mapSprints(after).findIndex((sprint) => sprint.id === moved.id) + 1;
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
      if (releaseMode) app.dropOnReleaseMap(active, over, placementOf(event));
      else app.dropOnMap(active, over, placementOf(event));
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
        <SprintLabel sprint={sprint} stories={inSprint} labelId={labelId} isTarget={isTarget || sprintTarget?.overId === sprint.id} />
      ) : (
        <div className={`map-sprint map-sprint--unplanned${isTarget ? ' map-sprint--target' : ''}`}>
          <span id={labelId} className="map-sprint__name">
            {t('sprint.notPlanned')}
          </span>
          <span className="map-sprint__sum">
            {builtin.summary(inSprint.length, totalPoints(inSprint))}
          </span>
        </div>
      )}
      {columns.map((epic) => (
        <Cell
          key={epic?.id ?? NO_EPIC}
          epic={epic}
          dropId={cellId(epic?.id ?? null, sprint?.id ?? null)}
          cellKey={cellKey(epic?.id ?? null, sprint?.id ?? null)}
          unplanned={!sprint}
          addLabel={t('map.newStoryIn', { epic: epic ? epic.name : t('epics.noEpic'), sprint: sprint ? sprint.name : t('sprint.notPlanned') })}
          stories={storiesInCell(app.stories, epic?.id ?? null, sprint?.id ?? null)}
          drop={target && target.group === cellKey(epic?.id ?? null, sprint?.id ?? null) ? { beforeId: target.beforeId } : null}
          labelledBy={`${labelId} ${columnLabelId(epic)}`}
          place={`${sprint ? sprint.name : t('sprint.notPlanned')}, ${epic ? epic.name : t('epics.noEpic')}`}
          quick={{ sprintId: sprint?.id ?? null, epicId: epic?.id ?? null }}
        />
      ))}
    </div>
  );
  };

  /** A row in release mode: a release, or "no release" for null. The sprint of the stories stays as it is. */
  const renderReleaseRow = (release: Release | null) => {
    const key = release?.id ?? NOT_PLANNED;
    const labelId = `map-release-${key}`;
    const inRelease = shownStories.filter((story) => story.releaseId === (release?.id ?? null));
    const isTarget = targetSprint === key;
    return (
      <div key={key} className={['map__row', !release && 'map__row--unplanned'].filter(Boolean).join(' ')}>
        {release ? (
          <ReleaseLabel release={release} stories={inRelease} labelId={labelId} isTarget={isTarget} today={today} />
        ) : (
          <div className={`map-sprint map-sprint--unplanned${isTarget ? ' map-sprint--target' : ''}`}>
            <span id={labelId} className="map-sprint__name">
              {t('map.noRelease')}
            </span>
            <span className="map-sprint__sum">{builtin.summary(inRelease.length, totalPoints(inRelease))}</span>
          </div>
        )}
        {columns.map((epic) => (
          <Cell
            key={epic?.id ?? NO_EPIC}
            epic={epic}
            dropId={releaseCellId(epic?.id ?? null, release?.id ?? null)}
            cellKey={cellKey(epic?.id ?? null, release?.id ?? null)}
            unplanned={!release}
            addLabel={t('map.newStoryInRelease', { epic: epic ? epic.name : t('epics.noEpic'), release: release ? release.title : t('map.noRelease') })}
            stories={storiesInReleaseCell(app.stories, epic?.id ?? null, release?.id ?? null)}
            drop={target && target.group === cellKey(epic?.id ?? null, release?.id ?? null) ? { beforeId: target.beforeId } : null}
            labelledBy={`${labelId} ${columnLabelId(epic)}`}
            place={`${release ? release.title : t('map.noRelease')}, ${epic ? epic.name : t('epics.noEpic')}`}
            quick={{ sprintId: null, epicId: epic?.id ?? null, releaseId: release?.id ?? null }}
          />
        ))}
      </div>
    );
  };

  const activeStory = activeId && !sprintDrag ? app.stories.find((story) => story.id === activeId) : undefined;
  const activeSprint = activeId && sprintDrag ? app.sprints.find((sprint) => sprint.id === sprintOfDragId(activeId)) : undefined;
  const gridStyle = { '--map-columns': columns.length } as CSSProperties;

  return (
    <>
      <div className="page-head">
        <h1>{t('map.title')}</h1>
        <span className="muted">
          {releaseMode
            ? t('map.summaryReleases', { epics: epics.length, releases: releases.length, stories: shownStories.length })
            : t('map.summary', { epics: epics.length, sprints: sprints.length, stories: shownStories.length })}
        </span>
        <SyncControl />
        <a
          href={hrefs.settingsMap}
          className="btn page-head__action map-rows-link"
          aria-label={t('map.rowsLink', { rows: t(releaseMode ? 'map.rowsReleases' : 'map.rowsSprints') })}
          title={t('map.rowsLink', { rows: t(releaseMode ? 'map.rowsReleases' : 'map.rowsSprints') })}
        >
          <span aria-hidden="true">{t('map.rows', { rows: t(releaseMode ? 'map.rowsReleases' : 'map.rowsSprints') })}</span>
          <GearIcon />
        </a>
        <button
          type="button"
          className={`btn${compact ? ' btn--pressed' : ''}`}
          aria-pressed={compact}
          onClick={toggleCompact}
        >
          {t('map.compact')}
        </button>
        <NewButton label={t('newStory.open')} onClick={() => setDialog({ kind: 'story', epicId: null, sprintId: null })} />
      </div>

      {app.settings.mapRows === 'releases' && !featureOn(app.settings, 'releases') && (
        <p className="hint hint--warn" role="note">
          {t('map.rowsOff')} <a href={hrefs.settingsReleases}>{t('settings.map.toReleases')}</a>
        </p>
      )}

      <HighlightBar storyIds={shownStories.map((story) => story.id)} />

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
          accessibility={{ announcements, screenReaderInstructions: { draggable: t(releaseMode ? 'map.dnd.instructionsReleases' : 'map.dnd.instructions') } }}
        >
          <CompactContext.Provider value={compact}>
          <div className={`map${compact ? ' map--compact' : ''}`} style={gridStyle}>
            <div className="map__row map__row--head">
              <div className="map__corner" aria-hidden="true">
                {t(releaseMode ? 'map.cornerReleases' : 'map.corner')}
              </div>
              {epics.map((epic) => {
                const inEpic = shownStories.filter((story) => story.epicId === epic.id);
                return (
                  <button
                    type="button"
                    key={epic.id}
                    className={`map-epic${targetEpic === epic.id ? ' map-epic--target' : ''}${matches?.ids.epic.has(epic.id) ? ' map-epic--match' : ''}`}
                    data-epic-id={epic.id}
                    style={{ '--epic-color': colorShown ? `var(--epic-${epic.colorKey})` : 'var(--border)' } as CSSProperties}
                    onClick={() => details.openEpic(epic.id)}
                  >
                    <span id={columnLabelId(epic)} className="map-epic__name">
                      {epic.name}
                    </span>
                    <span className="map-epic__sum">
                      {builtin.summary(inEpic.length, totalPoints(inEpic))}
                    </span>
                  </button>
                );
              })}
              {hasLooseStories && (
                <div className={`map-epic map-epic--none${targetEpic === NO_EPIC ? ' map-epic--target' : ''}`}>
                  <span id={columnLabelId(null)} className="map-epic__name">
                    {t('epics.noEpic')}
                  </span>
                  <span className="map-epic__sum">
                    {builtin.summary(
                      shownStories.filter((story) => story.epicId === null).length,
                      totalPoints(shownStories.filter((story) => story.epicId === null))
                    )}
                  </span>
                </div>
              )}
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

            {releaseMode ? (
              <>
                {releases.map((release) => renderReleaseRow(release))}
                <div className="map__row map__row--add">
                  <button type="button" className="map__add-sprint" onClick={() => setDialog({ kind: 'release' })}>
                    {t('map.addRelease')}
                  </button>
                </div>
                {renderReleaseRow(null)}
              </>
            ) : (
              <>
                <SortableContext items={sprints.map((sprint) => sprintDragId(sprint.id))} strategy={keepInPlace}>
                  {sprints.map((sprint) => renderRow(sprint))}
                </SortableContext>
                <div className="map__row map__row--add">
                  <button type="button" className="map__add-sprint" onClick={() => setDialog({ kind: 'sprint' })}>
                    {t('map.addSprint')}
                  </button>
                </div>
                {renderRow(null)}
              </>
            )}
          </div>
          </CompactContext.Provider>
          <DragOverlay>
            {activeSprint ? (
              <div className="map-sprint map-sprint--overlay" aria-hidden="true">
                <SprintLabelContent
                  sprint={activeSprint}
                  stories={shownStories.filter((story) => story.sprintId === activeSprint.id)}
                  labelId="map-sprint-overlay"
                />
              </div>
            ) : activeStory ? (
              <article className={`card map-card map-card--overlay${compact ? ' card--compact' : ''}`} aria-hidden="true">
                <StoryCardContent story={activeStory} epic={app.epics.find((item) => item.id === activeStory.epicId)} compact={compact} />
              </article>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {dialog?.kind === 'story' && (
        <NewStoryDialog sprintId={dialog.sprintId} epicId={dialog.epicId} releaseId={dialog.releaseId} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'epic' && <NewEpicDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'sprint' && <SprintDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'release' && <NewReleaseDialog onClose={() => setDialog(null)} />}
    </>
  );
}
