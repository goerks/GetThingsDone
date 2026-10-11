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
import {
  backlogOrder,
  dropInBacklog,
  parseSectionId,
  sectionId,
  type BacklogSection,
  type Placement
} from '../domain/board';
import type { Epic, Story } from '../domain/types';
import { hrefs, openStory } from '../router';
import { useApp } from '../state/AppState';

const sectionOf = (story: Story): BacklogSection => (story.inSprint ? 'sprint' : 'backlog');

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
  const { t } = useTranslation();
  return (
    <>
      <span className="backlog__rank" aria-hidden="true">
        {rank}
      </span>
      <span className="card__code backlog__code">{story.code}</span>
      {/* The row itself is the keyboard stop (Enter opens it), so the link is for the mouse only. */}
      <a className="backlog__title" href={hrefs.story(story.id)} tabIndex={-1} draggable={false}>
        {story.title}
      </a>
      <EpicTag epic={epic} />
      <span className="pill" title={t('card.points', { count: story.points })}>
        {story.points}
      </span>
    </>
  );
}

function BacklogRow({ story, rank, epic, dropLabel }: RowProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, isDragging, active } = useSortable({
    id: story.id,
    attributes: { role: 'group', roleDescription: t('backlog.rowRole') }
  });

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Enter' && !active && event.target === event.currentTarget) {
      event.preventDefault();
      openStory(story.id);
      return;
    }
    listeners?.onKeyDown?.(event);
  };

  const classes = ['backlog__row', isDragging && 'backlog__row--dragging', dropLabel && 'drop-before']
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
      onDoubleClick={() => openStory(story.id)}
    >
      <RowContent story={story} rank={rank} epic={epic} />
    </li>
  );
}

interface SectionProps {
  section: BacklogSection;
  rows: Story[];
  firstRank: number;
  epics: Map<string, Epic>;
  target: (DropTarget<BacklogSection> & { label: string }) | null;
}

function Section({ section, rows, firstRank, epics, target }: SectionProps) {
  const { t } = useTranslation();
  const { setNodeRef } = useDroppable({ id: sectionId(section) });
  const headingId = `backlog-${section}`;
  const drop = target?.group === section ? target : null;
  const points = rows.reduce((sum, story) => sum + story.points, 0);

  return (
    <section
      className={`backlog__section backlog__section--${section}${drop ? ' backlog__section--target' : ''}`}
      aria-labelledby={headingId}
    >
      <h2 className="backlog__heading">
        <span id={headingId}>{t(`backlog.section.${section}`)}</span>
        <span className="muted">{t('backlog.sectionSummary', { count: rows.length, points })}</span>
      </h2>
      <SortableContext items={rows.map((story) => story.id)} strategy={keepInPlace}>
        <ol ref={setNodeRef} className="backlog" start={firstRank}>
          {rows.map((story, index) => (
            <BacklogRow
              key={story.id}
              story={story}
              rank={firstRank + index}
              epic={epics.get(story.epicId)}
              dropLabel={drop?.beforeId === story.id ? drop.label : undefined}
            />
          ))}
          {drop && drop.beforeId === null && rows.length > 0 && (
            <li className="drop-line" data-drop-label={drop.label} aria-hidden="true" />
          )}
          {rows.length === 0 && <li className="backlog__empty">{t(`backlog.empty.${section}`)}</li>}
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

  const ordered = backlogOrder(app.stories);
  const sprintRows = ordered.filter((story) => story.inSprint);
  const backlogRows = ordered.filter((story) => !story.inSprint);

  /** The list a drop would produce, or null when nothing would change. */
  const preview = (active: string, over: string, placement?: Placement): Story[] | null => {
    if (active === over) return null;
    const after = dropInBacklog(app.stories, active, over, placement);
    return after === app.stories ? null : backlogOrder(after);
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
    const section = parseSectionId(String(over)) ?? (story && sectionOf(story));
    return t('backlog.dnd.over', { title: titleOf(active), rank, section: section ? t(`backlog.section.${section}`) : '' });
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

      {creating && <NewStoryDialog inSprint={false} onClose={() => setCreating(false)} />}

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
          <Section section="sprint" rows={sprintRows} firstRank={1} epics={epics} target={target} />
          <Section
            section="backlog"
            rows={backlogRows}
            firstRank={sprintRows.length + 1}
            epics={epics}
            target={target}
          />
        </div>
        <DragOverlay>
          {activeStory ? (
            <div className="backlog__row backlog__row--overlay" aria-hidden="true">
              <RowContent story={activeStory} rank={activeIndex + 1} epic={epics.get(activeStory.epicId)} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}
