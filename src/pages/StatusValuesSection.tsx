import { useId, useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useDroppable,
  type Announcements,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type UniqueIdentifier
} from '@dnd-kit/core';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../components/Dialog';
import { GripIcon, LockIcon, TrashIcon } from '../components/icons';
import { statusLabel } from '../components/statusLabel';
import { keepInPlace, placementOf, useDragSensors } from '../dnd/dnd';
import type { Placement } from '../domain/board';
import {
  CATEGORY_COLORS,
  DEFAULT_STATUS_IDS,
  STATUS_CATEGORIES,
  categoryOf,
  changedCategories,
  defaultTarget,
  dropOf,
  isLastOfRequired,
  moveStatus,
  reorderStatuses,
  statusColor,
  statusesIn,
  stepStatus,
  storiesChangingDone,
  storiesWithStatus,
  type StatusDrop,
  type StatusPlace
} from '../domain/statuses';
import type { StatusCategory, StatusValue } from '../domain/types';
import { useApp } from '../state/AppState';
import { Button, DragHandle, IconButton, Select, TextInput } from '../ui';
import { useStoryKey } from '../components/useStoryKey';
import { columnsFromService } from '../domain/syncOwners';
import { serviceName } from '../sync/syncT';
import { Managed, useManagedText } from '../components/Managed';

const GROUP_PREFIX = 'status-group:';

/** Story keys for a dialog: the first few, then an ellipsis. */
function codesOf(codes: readonly string[]): string {
  return codes.length > 5 ? `${codes.slice(0, 5).join(', ')}, …` : codes.join(', ');
}

/** A move that changes whether stories are done waits for a confirmation. */
interface PendingMove {
  places: StatusPlace[];
  status: StatusValue;
  category: StatusCategory;
}

/** What the pointer is over while a status is dragged, and on which half of it. */
interface Hover {
  overId: string;
  placement: Placement | undefined;
}

interface RowProps {
  status: StatusValue;
  /** A dragged status would land in front of this one: a line shows the place. */
  dropBefore: boolean;
  onRemove: () => void;
  onStep: (direction: -1 | 1) => void;
}

function StatusRow({ status, dropBefore, onRemove, onStep }: RowProps) {
  const { t } = useTranslation();
  const app = useApp();
  const name = statusLabel(t, app.statuses, status.id);
  const [draft, setDraft] = useState<string | null>(null);
  const hintId = useId();
  const count = storiesWithStatus(app.stories, status.id).length;
  const locked = isLastOfRequired(app.statuses, status.id);
  const managedText = useManagedText();
  const managed = columnsFromService(app.settings) ? managedText : null;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useSortable({ id: status.id, disabled: managed !== null });
  const isDefault = DEFAULT_STATUS_IDS.includes(status.id);

  const commit = (): void => {
    if (draft === null) return;
    const value = draft.trim();
    setDraft(null);
    // Keeping the translated default as typed would freeze it in one language.
    if (status.label === null && value === name) return;
    if (!value && !isDefault) return;
    app.renameStatus(status.id, value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape' && draft !== null) {
      // Escape first undoes the typing; a second Escape is left to the page.
      event.preventDefault();
      setDraft(null);
    } else if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      commit();
      onStep(event.key === 'ArrowUp' ? -1 : 1);
    }
  };

  return (
    <li
      ref={setNodeRef}
      className={`status-row${isDragging ? ' status-row--dragging' : ''}${dropBefore ? ' drop-before' : ''}`}
      data-status={status.id}
      style={{ '--status-color': statusColor(app.statuses, status.id) } as CSSProperties}
    >
      <Managed by={managed}>
        <DragHandle ref={setActivatorNodeRef} aria-label={t('statusValues.move', { name })} disabled={managed !== null} {...attributes} {...listeners}>
          <GripIcon />
        </DragHandle>
      </Managed>
      <span className="status-row__dot" aria-hidden="true" />
      <TextInput
        className="status-row__name"
        title={managed ?? undefined}
        disabled={managed !== null}
        aria-label={t('statusValues.name', { name })}
        aria-describedby={hintId}
        value={draft ?? name}
        placeholder={isDefault ? t(`status.${status.id}`) : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
      <span id={hintId} className="sr-only">
        {isDefault ? t('statusValues.nameHint', { name: t(`status.${status.id}`) }) : ''} {t('statusValues.keyboard')}
      </span>
      <span className="status-row__count">{count > 0 ? t('statusValues.stories', { count }) : t('statusValues.noStories')}</span>
      {locked ? (
        <span className="status-row__lock" title={t('statusValues.locked', { name, category: t(`statusValues.category.${status.category}`) })}>
          <LockIcon />
          <span className="sr-only">{t('statusValues.locked', { name, category: t(`statusValues.category.${status.category}`) })}</span>
        </span>
      ) : (
        <Managed by={managed}>
          <IconButton type="button" quiet aria-label={t('statusValues.remove', { name })} disabled={managed !== null} onClick={onRemove}>
            <TrashIcon />
          </IconButton>
        </Managed>
      )}
    </li>
  );
}

function AddStatus({ category }: { category: StatusCategory }) {
  const { t } = useTranslation();
  const app = useApp();
  const [name, setName] = useState<string | null>(null);
  const categoryName = t(`statusValues.category.${category}`);
  const managedText = useManagedText();
  const managed = columnsFromService(app.settings) ? managedText : null;

  if (name === null) {
    return (
      <Managed by={managed}>
        <Button type="button" className="status-group__add" disabled={managed !== null} onClick={() => setName('')}>
          + {t('statusValues.add', { category: categoryName })}
        </Button>
      </Managed>
    );
  }
  return (
    <form
      className="status-group__new"
      onSubmit={(event) => {
        event.preventDefault();
        if (app.addStatus(category, name)) setName(null);
      }}
    >
      <TextInput
       
        autoFocus
        aria-label={t('statusValues.addLabel', { category: categoryName })}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setName(null);
          }
        }}
      />
      <Button type="submit" variant="primary" disabled={!name.trim()}>
        {t('statusValues.addConfirm')}
      </Button>
      <Button type="button" onClick={() => setName(null)}>
        {t('statusValues.cancel')}
      </Button>
    </form>
  );
}

function StatusGroup({ category, target, empty, children }: { category: StatusCategory; target: boolean; empty: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  const { setNodeRef } = useDroppable({ id: `${GROUP_PREFIX}${category}` });
  const headingId = `status-group-${category}`;
  const name = t(`statusValues.category.${category}`);
  return (
    <section
      className={`status-group${target ? ' status-group--over' : ''}`}
      aria-labelledby={headingId}
      data-category={category}
      style={{ '--category-color': CATEGORY_COLORS[category] } as CSSProperties}
    >
      <h3 className="status-group__head">
        <span id={headingId}>{name}</span>
        <span className="status-group__rule">{t(`statusValues.rule.${category}`)}</span>
      </h3>
      <ol ref={setNodeRef} className="status-group__list" aria-label={t('statusValues.list', { category: name })}>
        {children}
        {empty && <li className="status-group__empty">{t('statusValues.emptyGroup')}</li>}
      </ol>
      <AddStatus category={category} />
    </section>
  );
}

function RemoveDialog({ status, onClose }: { status: StatusValue; onClose: () => void }) {
  const { t } = useTranslation();
  const app = useApp();
  const keyOf = useStoryKey();
  const name = statusLabel(t, app.statuses, status.id);
  const affected = storiesWithStatus(app.stories, status.id);
  const [target, setTarget] = useState(() => defaultTarget(app.statuses, status.id) ?? '');
  const uid = useId();
  const codes = codesOf(affected.map((story) => keyOf(story)));

  return (
    <Dialog title={t('statusValues.removeDialog.title', { name })} onClose={onClose}>
      <div className="form status-dialog">
        <p>{affected.length > 0 ? t('statusValues.removeDialog.used', { count: affected.length, codes }) : t('statusValues.removeDialog.unused')}</p>
        {affected.length > 0 && (
          <div className="field">
            <label htmlFor={`${uid}-target`}>{t('statusValues.removeDialog.target')}</label>
            <Select id={`${uid}-target`} value={target} onChange={(event) => setTarget(event.target.value)}>
              {STATUS_CATEGORIES.map((category) => (
                <optgroup key={category} label={t(`statusValues.category.${category}`)}>
                  {statusesIn(app.statuses, category)
                    .filter((item) => item.id !== status.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {statusLabel(t, app.statuses, item.id)}
                      </option>
                    ))}
                </optgroup>
              ))}
            </Select>
          </div>
        )}
        <div className="form__actions">
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              if (app.removeStatus(status.id, affected.length > 0 ? target : null)) onClose();
            }}
          >
            {affected.length > 0 ? t('statusValues.removeDialog.confirmMove', { count: affected.length }) : t('statusValues.removeDialog.confirm')}
          </Button>
          <Button type="button" onClick={onClose} autoFocus>
            {t('statusValues.cancel')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function ConfirmCategoryDialog({ move, onClose }: { move: PendingMove; onClose: () => void }) {
  const { t } = useTranslation();
  const app = useApp();
  const keyOf = useStoryKey();
  const name = statusLabel(t, app.statuses, move.status.id);
  const after = reorderStatuses(app.statuses, move.places) ?? app.statuses;
  const changing = storiesChangingDone(app.stories, app.statuses, after);
  const codes = codesOf(changing.map((story) => keyOf(story)));
  const key = move.category === 'done' ? 'toDone' : 'fromDone';

  return (
    <Dialog title={t('statusValues.confirmCategory.title', { name, category: t(`statusValues.category.${move.category}`) })} onClose={onClose}>
      <p>{t(`statusValues.confirmCategory.${key}`, { count: changing.length, codes })}</p>
      <div className="form__actions">
        <Button
          type="button"
          variant="primary"
          onClick={() => {
            app.reorderStatuses(move.places);
            onClose();
          }}
        >
          {t('statusValues.confirmCategory.confirm')}
        </Button>
        <Button type="button" onClick={onClose} autoFocus>
          {t('statusValues.cancel')}
        </Button>
      </div>
    </Dialog>
  );
}

/**
 * Settings › Status values (#5): the columns of the board, grouped by their fixed categories. Inside a category the
 * team chooses the order; dragging a status into another category changes its category, with a confirmation when
 * stories then count as done (or open) from today on. Changes are saved at once.
 */
export function StatusValuesSection() {
  const { t } = useTranslation();
  const app = useApp();
  const sensors = useDragSensors();
  const [removing, setRemoving] = useState<StatusValue | null>(null);
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [message, setMessage] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const fromService = columnsFromService(app.settings);

  const nameOf = (id: UniqueIdentifier): string => {
    const value = String(id);
    if (value.startsWith(GROUP_PREFIX)) return t(`statusValues.category.${value.slice(GROUP_PREFIX.length)}`);
    return statusLabel(t, app.statuses, value);
  };

  /** Applies a new order, or asks first when stories change between open and done. */
  const apply = (places: StatusPlace[] | null, id: string): void => {
    if (!places) return;
    const after = reorderStatuses(app.statuses, places);
    if (!after) {
      setMessage(t('statusValues.refused'));
      return;
    }
    const moved = changedCategories(app.statuses, after).find((status) => status.id === id);
    const status = app.statuses.find((item) => item.id === id);
    if (moved && status && storiesChangingDone(app.stories, app.statuses, after).length > 0) {
      setPending({ places, status, category: moved.category });
      return;
    }
    app.reorderStatuses(places);
    const category = categoryOf(after, id);
    if (!category) return;
    const position = statusesIn(after, category).findIndex((item) => item.id === id) + 1;
    setMessage(t('statusValues.moved', { name: nameOf(id), position, category: t(`statusValues.category.${category}`) }));
  };

  /**
   * The new order if `activeId` were dropped over `overId` (a status or the free space of a category) on the given
   * half of it. Only the dragged status moves; every other status keeps its category and its place in the list.
   * Without a half (keyboard), the direction of the move decides.
   */
  const placesFor = (activeId: string, overId: string, placement: Placement | undefined): StatusPlace[] | null => {
    if (overId === activeId) return null;
    if (overId.startsWith(GROUP_PREFIX)) {
      return moveStatus(app.statuses, activeId, null, overId.slice(GROUP_PREFIX.length) as StatusCategory, 'after');
    }
    const category = categoryOf(app.statuses, overId);
    if (!category) return null;
    const from = app.statuses.findIndex((status) => status.id === activeId);
    const to = app.statuses.findIndex((status) => status.id === overId);
    return moveStatus(app.statuses, activeId, overId, category, placement ?? (from < to ? 'after' : 'before'));
  };

  // The place a drop would give the dragged status; the line and the highlight follow from it, so preview and drop agree.
  const target = useMemo<StatusDrop | null>(() => {
    if (!activeId || !hover) return null;
    const places = placesFor(activeId, hover.overId, hover.placement);
    if (!places || !reorderStatuses(app.statuses, places)) return null;
    return dropOf(places, activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, hover, app.statuses]);

  const onDragStart = (event: DragStartEvent): void => setActiveId(String(event.active.id));
  const onDragMove = (event: DragMoveEvent): void => {
    const next = event.over ? { overId: String(event.over.id), placement: placementOf(event) } : null;
    setHover((current) => (current?.overId === next?.overId && current?.placement === next?.placement ? current : next));
  };
  const onDragEnd = (event: DragEndEvent): void => {
    setActiveId(null);
    setHover(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    apply(placesFor(String(active.id), String(over.id), placementOf(event)), String(active.id));
  };
  const onDragCancel = (): void => {
    setActiveId(null);
    setHover(null);
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => t('statusValues.dnd.pickedUp', { name: nameOf(active.id) }),
    // Over itself right after the pick-up: keep "picked up" instead of replacing it.
    onDragOver: ({ active, over }) =>
      over && over.id !== active.id ? t('statusValues.dnd.over', { name: nameOf(active.id), target: nameOf(over.id) }) : undefined,
    onDragEnd: ({ active }) => t('statusValues.dnd.dropped', { name: nameOf(active.id) }),
    onDragCancel: ({ active }) => t('statusValues.dnd.cancelled', { name: nameOf(active.id) })
  };

  return (
    <div className="map-settings status-settings">
      <div className="map-settings__head">
        <h2>{t('statusValues.title')}</h2>
      </div>
      <p className="muted">{t('statusValues.hint')}</p>
      {fromService && (
        <p className="hint hint--info" role="note">
          {t('statusValues.fromService', { service: serviceName(t, app.settings.sync.service) })}
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragOver={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        accessibility={{ announcements, screenReaderInstructions: { draggable: t('statusValues.dnd.instructions') } }}
      >
        <SortableContext items={app.statuses.map((status) => status.id)} strategy={keepInPlace}>
          {STATUS_CATEGORIES.map((category) => (
            <StatusGroup key={category} category={category} target={target?.category === category} empty={statusesIn(app.statuses, category).length === 0}>
              {statusesIn(app.statuses, category).map((status) => (
                <StatusRow
                  key={status.id}
                  status={status}
                  dropBefore={target?.beforeId === status.id}
                  onRemove={() => setRemoving(status)}
                  onStep={(direction) => apply(stepStatus(app.statuses, status.id, direction), status.id)}
                />
              ))}
              {target?.category === category && target.beforeId === null && <li className="drop-line" aria-hidden="true" />}
            </StatusGroup>
          ))}
        </SortableContext>
        <DragOverlay>
          {activeId ? (
            <div className="status-row status-row--overlay" style={{ '--status-color': statusColor(app.statuses, activeId) } as CSSProperties}>
              <span className="status-row__dot" aria-hidden="true" />
              <span className="status-row__name">{statusLabel(t, app.statuses, activeId)}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <p className="muted">{t('statusValues.keyboard')}</p>
      <p className="muted">{t('statusValues.saved')}</p>
      <p className="status-settings__message" role="status">
        {message}
      </p>
      {removing && <RemoveDialog status={removing} onClose={() => setRemoving(null)} />}
      {pending && <ConfirmCategoryDialog move={pending} onClose={() => setPending(null)} />}
    </div>
  );
}
