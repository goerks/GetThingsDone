import { featureOn } from '../domain/settings';
import { useState } from 'react';
import { DndContext, closestCenter, type Announcements, type DragEndEvent, type UniqueIdentifier } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { fieldLabel } from '../components/fieldLabel';
import { GripIcon, LockIcon } from '../components/icons';
import { useDragSensors } from '../dnd/dnd';
import { CARD_FIELD_LIMIT, cardFieldsFor, layoutFor, type LayoutEntry } from '../domain/fields';
import type { ItemType } from '../domain/types';
import { hrefs } from '../router';
import { useApp } from '../state/AppState';
import { BareButton, Check, DragHandle } from '../ui';

/** Item types with a layout; sprints and releases are shown as planned. */
const LAYOUT_TYPES: readonly ItemType[] = ['story', 'epic'];
const PLANNED_TYPES = ['sprint', 'release'] as const;

/** Only stories have cards today; epics appear as list rows and map headers. */
const HAS_CARD: Record<ItemType, boolean> = { story: true, epic: false, release: false };

interface RowProps {
  itemType: ItemType;
  entry: LayoutEntry;
  cardFull: boolean;
}

function FixedRow({ entry }: { entry: LayoutEntry }) {
  const { t } = useTranslation();
  return (
    <li className="layout-row layout-row--fixed">
      <span className="layout-row__lock" aria-hidden="true">
        <LockIcon />
      </span>
      <span className="layout-row__name">{fieldLabel(t, entry.field)}</span>
      <span className="muted layout-row__type">{t(`fields.type.${entry.field.dataType}`)}</span>
      <span className="muted layout-row__note">{t('fields.layout.fixed')}</span>
    </li>
  );
}

/** The "Release" system field keeps its place but can show in the create dialog and on the card (both off by default). */
function ReleaseRow({ entry }: { entry: LayoutEntry }) {
  const { t } = useTranslation();
  const app = useApp();
  const { field, assignment } = entry;
  const update = (patch: Parameters<typeof app.updateFieldLayout>[2]): void => {
    app.updateFieldLayout('story', field.id, patch);
  };
  if (!featureOn(app.settings, 'releases')) {
    return (
      <li className="layout-row layout-row--fixed layout-row--off">
        <span className="layout-row__lock" aria-hidden="true">
          <LockIcon />
        </span>
        <span className="layout-row__name">{fieldLabel(t, field)}</span>
        <span className="muted layout-row__type">{t(`fields.type.${field.dataType}`)}</span>
        <span className="muted layout-row__note">
          {t('fields.layout.releaseOff')} · <a href={hrefs.settingsReleases}>{t('fields.layout.releaseOffLink')}</a>
        </span>
      </li>
    );
  }
  return (
    <li className="layout-row layout-row--fixed">
      <span className="layout-row__lock" aria-hidden="true">
        <LockIcon />
      </span>
      <span className="layout-row__name">{fieldLabel(t, field)}</span>
      <span className="muted layout-row__type">{t(`fields.type.${field.dataType}`)}</span>
      <span className="layout-row__options">
        <Check checked={assignment.inCreate} onChange={(event) => update({ inCreate: event.target.checked })}>
          {t('fields.layout.inCreate')}
        </Check>
        <Check checked={assignment.onCard} onChange={(event) => update({ onCard: event.target.checked })}>
          {t('fields.layout.onCard')}
        </Check>
      </span>
    </li>
  );
}

function CustomRow({ itemType, entry, cardFull }: RowProps) {
  const { t } = useTranslation();
  const app = useApp();
  const { field, assignment } = entry;
  const name = fieldLabel(t, field);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const update = (patch: Parameters<typeof app.updateFieldLayout>[2]): void => {
    app.updateFieldLayout(itemType, field.id, patch);
  };

  return (
    <li
      ref={setNodeRef}
      className={`layout-row${isDragging ? ' layout-row--dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {/* Rows hold checkboxes, so they are dragged by a handle. */}
      <DragHandle
       
        ref={setActivatorNodeRef}
       
        aria-label={t('fields.layout.move', { name })}
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </DragHandle>
      <span className="layout-row__name">{name}</span>
      <span className="muted layout-row__type">{t(`fields.type.${field.dataType}`)}</span>
      <span className="layout-row__options">
        <Check checked={assignment.required} onChange={(event) => update({ required: event.target.checked })}>
          {t('fields.layout.required')}
        </Check>
        <Check
          checked={assignment.inCreate || assignment.required}
            disabled={assignment.required}
            onChange={(event) => update({ inCreate: event.target.checked })}>
          {t('fields.layout.inCreate')}
        </Check>
        {HAS_CARD[itemType] && (
          <Check title={cardFull && !assignment.onCard ? t('fields.layout.cardFull', { count: CARD_FIELD_LIMIT }) : undefined}
            checked={assignment.onCard}
              disabled={cardFull && !assignment.onCard}
              onChange={(event) => update({ onCard: event.target.checked })}>
            {t('fields.layout.onCard')}
          </Check>
        )}
      </span>
    </li>
  );
}

/** Order and behaviour of the fields of one item type: required, in the create dialog, on the card. */
export function FieldLayout() {
  const { t } = useTranslation();
  const app = useApp();
  const sensors = useDragSensors();
  const [itemType, setItemType] = useState<ItemType>('story');
  const layout = layoutFor(itemType, app.fields, app.assignments).filter((entry) => !entry.assignment.hidden);
  const fixed = layout.filter((entry) => entry.field.kind !== 'custom');
  const custom = layout.filter((entry) => entry.field.kind === 'custom');
  const cardFull = cardFieldsFor(itemType, app.fields, app.assignments).length >= CARD_FIELD_LIMIT;

  const nameOf = (id: UniqueIdentifier): string => {
    const field = app.fields.find((item) => item.id === id);
    return field ? fieldLabel(t, field) : '';
  };
  const positionOf = (id: UniqueIdentifier): number => custom.findIndex((entry) => entry.field.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('board.dnd.pickedUp', { title: nameOf(active.id) }),
    onDragOver: ({ active, over }) => (over ? t('detail.dnd.over', { title: nameOf(active.id), position: positionOf(over.id) }) : undefined),
    onDragEnd: ({ active, over }) =>
      over ? t('detail.dnd.dropped', { title: nameOf(active.id), position: positionOf(over.id) }) : t('board.dnd.cancelled', { title: nameOf(active.id) }),
    onDragCancel: ({ active }) => t('board.dnd.cancelled', { title: nameOf(active.id) })
  };
  const onDrop = (event: DragEndEvent): void => {
    if (event.over) app.moveFieldInLayout(itemType, String(event.active.id), String(event.over.id));
  };

  return (
    <div className="layout">
      <div className="type-tabs" role="tablist" aria-label={t('fields.layout.types')}>
        {LAYOUT_TYPES.map((type) => (
          <BareButton
            key={type}
            type="button"
            role="tab"
            aria-selected={type === itemType}
            className="type-tabs__tab"
            onClick={() => setItemType(type)}
          >
            {t(`fields.itemType.${type}`)}
          </BareButton>
        ))}
        {PLANNED_TYPES.map((type) => (
          <span key={type} className="type-tabs__tab type-tabs__tab--planned">
            {t(`fields.itemType.${type}`)}
            <span className="badge" aria-hidden="true">
              {t('settings.planned')}
            </span>
            <span className="sr-only">: {t('settings.plannedNote')}</span>
          </span>
        ))}
      </div>
      <div role="tabpanel" aria-label={t(`fields.itemType.${itemType}`)} className="layout__panel">
        <p className="muted">{HAS_CARD[itemType] ? t('fields.layout.hint', { count: CARD_FIELD_LIMIT }) : t('fields.layout.hintNoCard')}</p>
        <ol className="layout-list">
          {fixed.map((entry) =>
            entry.field.builtinKey === 'release' && itemType === 'story' ? (
              <ReleaseRow key={entry.field.id} entry={entry} />
            ) : (
              <FixedRow key={entry.field.id} entry={entry} />
            )
          )}
        </ol>
        {custom.length === 0 ? (
          <p className="muted">{t('fields.layout.noCustom')}</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDrop}
            accessibility={{ announcements, screenReaderInstructions: { draggable: t('fields.layout.instructions') } }}
          >
            <SortableContext items={custom.map((entry) => entry.field.id)} strategy={verticalListSortingStrategy}>
              <ol className="layout-list" aria-label={t('fields.group.custom')}>
                {custom.map((entry) => (
                  <CustomRow key={entry.field.id} itemType={itemType} entry={entry} cardFull={cardFull} />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
