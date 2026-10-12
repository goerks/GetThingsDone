import { useMemo, useState, type KeyboardEvent } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  useDroppable,
  type Announcements,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type UniqueIdentifier
} from '@dnd-kit/core';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { EpicTag } from '../components/EpicTag';
import { NewStoryDialog } from '../components/NewStoryDialog';
import { dropTargetIn, keepInPlace, placementOf, useDragSensors, type DropTarget } from '../dnd/dnd';
import { formatSprintDates } from '../components/sprintFormat';
import { backlogOrder, dropInBacklog, parseSectionId, sectionId, totalPoints, type Placement } from '../domain/board';
import { isRunning, sortSprints, todayIso } from '../domain/sprints';
import type { Epic, Sprint, Story } from '../domain/types';
import { TitleButton } from '../components/StoryCard';
import { useDetails } from '../state/Details';
import { useApp } from '../state/AppState';
import { useBuiltin } from '../components/useBuiltin';
import { HighlightBar, useMatchClass } from '../components/search/HighlightBar';
import { useSearchPage } from '../state/Search';

/** Group key of a section: the sprint id, or "-" for the unplanned stories. */
type SectionKey = string;
const keyOf = (sprintId: string | null): SectionKey => sprintId ?? '-';
const sectionOf = (story: Story): SectionKey => keyOf(story.sprintId);

interface Hover {
  overId: string;
  placement: Placement | undefined;
}

interface RowProps {
  story: Story;
  rank: number;
  epic: Epic | undefined;
  /** Label of the drop line above this row, if the dragged story would land here. */
  dropLabel?: string;
}

function RowContent({ story, rank, epic }: Omit<RowProps, 'dropLabel'>) {
  const builtin = useBuiltin();
  return (
    <>
      <span className="backlog__rank" aria-hidden="true">
        {rank}
      </span>
      <span className="card__code backlog__code">{story.code}</span>
      <TitleButton story={story} className="backlog__title" />
      <EpicTag epic={epic} inCard />
      {builtin.shown('story', 'points') && (
        <span className="pill" title={builtin.pointsTitle(story.points)}>
          {story.points}
        </span>
      )}
    </>
  );
}

function BacklogRow({ story, rank, epic, dropLabel }: RowProps) {
  const { t } = useTranslation();
  const details = useDetails();
  const { attributes, listeners, setNodeRef, isDragging, active } = useSortable({
    id: story.id,
    attributes: { role: 'group', roleDescription: t('backlog.rowRole') }
  });

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Enter' && !active && event.target === event.currentTarget) {
      event.preventDefault();
      details.openStory(story.id);
      return;
    }
    listeners?.onKeyDown?.(event);
  };

  const match = useMatchClass(story.id, 'backlog__row');
  const classes = ['backlog__row', isDragging && 'backlog__row--dragging', dropLabel && 'drop-before', match]
    .filter(Boolean)
    .join(' ');

  return (
    <li
      ref={setNodeRef}
      className={classes}
      data-story-id={story.id}
      data-drop-label={dropLabel}
      {...attributes}
      aria-label={t('backlog.rowLabel', { rank, code: story.code, title: story.title })}
      {...listeners}
      onKeyDown={onKeyDown}
      onDoubleClick={() => details.openStory(story.id)}
    >
      <RowContent story={story} rank={rank} epic={epic} />
    </li>
  );
}

interface SectionProps {
  /** The sprint of this section, or null for the unplanned stories. */
  sprint: Sprint | null;
  rows: Story[];
  firstRank: number;
  epics: Map<string, Epic>;
  target: (DropTarget<SectionKey> & { label: string }) | null;
}

function Section({ sprint, rows, firstRank, epics, target }: SectionProps) {
  const { t, i18n } = useTranslation();
  const builtin = useBuiltin();
  const key = keyOf(sprint?.id ?? null);
  const { setNodeRef } = useDroppable({ id: sectionId(sprint?.id ?? null) });
  const headingId = `backlog-${key}`;
  const drop = target?.group === key ? target : null;
  const running = sprint ? isRunning(sprint, todayIso()) : false;
  const kind = sprint ? 'sprint' : 'backlog';

  return (
    <section
      className={`backlog__section backlog__section--${kind}${drop ? ' backlog__section--target' : ''}`}
      aria-labelledby={headingId}
      data-sprint-id={sprint?.id}
    >
      <h2 className="backlog__heading">
        <span id={headingId}>{sprint ? sprint.name : t('sprint.notPlanned')}</span>
        {running && <span className="badge-running">{t('sprint.running')}</span>}
        {sprint && <span className="muted backlog__dates">{formatSprintDates(sprint, i18n.language)}</span>}
        <span className="muted">{builtin.summary(rows.length, totalPoints(rows))}</span>
      </h2>
      <SortableContext items={rows.map((story) => story.id)} strategy={keepInPlace}>
        <ol ref={setNodeRef} className="backlog" start={firstRank}>
          {rows.map((story, index) => (
            <BacklogRow
              key={story.id}
              story={story}
              rank={firstRank + index}
              epic={epics.get(story.epicId ?? '')}
              dropLabel={drop?.beforeId === story.id ? drop.label : undefined}
            />
          ))}
          {drop && drop.beforeId === null && rows.length > 0 && (
            <li className="drop-line" data-drop-label={drop.label} aria-hidden="true" />
          )}
          {rows.length === 0 && (
            <li className="backlog__empty">
              {sprint ? t('backlog.empty.sprint', { name: sprint.name }) : t('backlog.empty.backlog')}
            </li>
          )}
        </ol>
      </SortableContext>
    </section>
  );
}

export function BacklogPage() {
  const { t } = useTranslation();
  const app = useApp();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [creating, setCreating] = useState(false);
  const sensors = useDragSensors();
  const epics = useMemo(() => new Map(app.epics.map((epic) => [epic.id, epic])), [app.epics]);

  const ordered = backlogOrder(app.stories, app.sprints);
  useSearchPage(t('nav.backlog'), { story: ordered.map((story) => story.id), sprint: app.sprints.map((sprint) => sprint.id) });
  const sections: Array<{ sprint: Sprint | null; rows: Story[]; firstRank: number }> = [];
  let nextRank = 1;
  for (const sprint of [...sortSprints(app.sprints), null]) {
    const rows = ordered.filter((story) => story.sprintId === (sprint?.id ?? null));
    sections.push({ sprint, rows, firstRank: nextRank });
    nextRank += rows.length;
  }

  /** The list a drop would produce, or null when nothing would change. */
  const preview = (active: string, over: string, placement?: Placement): Story[] | null => {
    if (active === over) return null;
    const after = dropInBacklog(app.stories, app.sprints, active, over, placement);
    return after === app.stories ? null : backlogOrder(after, app.sprints);
  };

  const rankAfterDrop = (active: string, over: string, placement?: Placement): number | null => {
    const list = preview(active, over, placement);
    return list ? list.findIndex((story) => story.id === active) + 1 : null;
  };

  const dropTarget = (): SectionProps['target'] => {
    if (!activeId || !hover) return null;
    const list = preview(activeId, hover.overId, hover.placement);
    if (!list) return null;
    const found = dropTargetIn(list, activeId, sectionOf);
    if (!found) return null;
    const rank = list.findIndex((story) => story.id === activeId) + 1;
    return { ...found, label: t('backlog.dropLabel', { rank }) };
  };
  const target = dropTarget();

  const titleOf = (id: UniqueIdentifier): string => app.stories.find((story) => story.id === id)?.title ?? '';
  const announceOver = (active: UniqueIdentifier, over: UniqueIdentifier): string | undefined => {
    const rank = rankAfterDrop(String(active), String(over));
    if (rank === null) return undefined;
    const story = app.stories.find((item) => item.id === over);
    const fromSection = parseSectionId(String(over));
    const sprintId = fromSection !== undefined ? fromSection : (story?.sprintId ?? null);
    const sprint = app.sprints.find((item) => item.id === sprintId);
    return t('backlog.dnd.over', { title: titleOf(active), rank, section: sprint ? sprint.name : t('sprint.notPlanned') });
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => t('board.dnd.pickedUp', { title: titleOf(active.id) }),
    onDragOver: ({ active, over }) => (over ? announceOver(active.id, over.id) : undefined),
    onDragEnd: ({ active, over }) => {
      const rank = over ? rankAfterDrop(String(active.id), String(over.id)) : null;
      return rank === null
        ? t('board.dnd.cancelled', { title: titleOf(active.id) })
        : t('backlog.dnd.dropped', { title: titleOf(active.id), rank });
    },
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
    if (event.over) app.dropInBacklog(String(event.active.id), String(event.over.id), placementOf(event));
  };
  const onDragCancel = (): void => {
    setActiveId(null);
    setHover(null);
  };

  const activeIndex = activeId ? ordered.findIndex((story) => story.id === activeId) : -1;
  const activeStory = activeIndex >= 0 ? ordered[activeIndex] : undefined;

  return (
    <>
      <div className="page-head">
        <h1>{t('backlog.title')}</h1>
        <span className="muted">{t('backlog.hint')}</span>
        <button type="button" className="btn btn--primary page-head__action" onClick={() => setCreating(true)}>
          {t('newStory.open')}
        </button>
      </div>

      <HighlightBar storyIds={app.stories.map((story) => story.id)} />

      {creating && <NewStoryDialog sprintId={null} onClose={() => setCreating(false)} />}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(event: DragStartEvent) => setActiveId(String(event.active.id))}
        onDragMove={onDragMove}
        onDragOver={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        accessibility={{ announcements, screenReaderInstructions: { draggable: t('backlog.dnd.instructions') } }}
      >
        <div className="backlog-sections">
          {sections.map((section) => (
            <Section
              key={section.sprint?.id ?? 'not-planned'}
              sprint={section.sprint}
              rows={section.rows}
              firstRank={section.firstRank}
              epics={epics}
              target={target}
            />
          ))}
        </div>
        <DragOverlay>
          {activeStory ? (
            <div className="backlog__row backlog__row--overlay" aria-hidden="true">
              <RowContent story={activeStory} rank={activeIndex + 1} epic={epics.get(activeStory.epicId ?? '')} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}
