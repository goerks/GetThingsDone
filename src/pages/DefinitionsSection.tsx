import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { DndContext, closestCenter, type Announcements, type CollisionDetection, type DragEndEvent, type UniqueIdentifier } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { groupName, itemText } from '../components/definitions';
import { GripIcon, TrashIcon } from '../components/icons';
import { useDragSensors } from '../dnd/dnd';
import {
  DEFINITION_KINDS,
  DEFINITION_RULES,
  addGroup,
  addItem,
  exampleList,
  itemsOf,
  moveRow,
  removeGroup,
  removeItem,
  renameGroup,
  setEnforce,
  stepRow,
  updateItem
} from '../domain/definitions';
import { newId } from '../domain/ids';
import type { DefinitionGroup, DefinitionItem, DefinitionKind, DefinitionList, DefinitionRule } from '../domain/types';
import { useApp } from '../state/AppState';

interface RowProps {
  id: string;
  moveLabel: string;
  className: string;
  children: (handle: ReactNode) => ReactNode;
}

function Row({ id, moveLabel, className, children }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button type="button" ref={setActivatorNodeRef} className="drag-handle" aria-label={moveLabel} {...attributes} {...listeners}>
      <GripIcon />
    </button>
  );
  return (
    <li
      ref={setNodeRef}
      className={`${className}${isDragging ? ' definition-edit__row--dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {children(handle)}
    </li>
  );
}

/** A text field that saves on Enter and on leaving it, undoes with Escape and moves its row with Alt+Up and Alt+Down. */
function NameField({
  value,
  label,
  placeholder,
  onSave,
  onStep
}: {
  value: string;
  label: string;
  placeholder?: string;
  onSave: (value: string) => void;
  onStep: (direction: -1 | 1) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (): void => {
    if (draft === null) return;
    const next = draft.trim();
    setDraft(null);
    if (next !== value) onSave(next);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape' && draft !== null) {
      event.preventDefault();
      event.stopPropagation();
      setDraft(null);
    } else if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      commit();
      onStep(event.key === 'ArrowUp' ? -1 : 1);
    }
  };
  return (
    <input
      className="input definition-edit__name"
      aria-label={label}
      value={draft ?? value}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  );
}

function ItemRow({ item, onChange, onStep }: { item: DefinitionItem; onChange: (change: (list: DefinitionList) => DefinitionList) => void; onStep: (id: string, direction: -1 | 1) => void }) {
  const { t } = useTranslation();
  const text = itemText(t, item);
  return (
    <Row id={item.id} className="definition-edit__row definition-edit__item" moveLabel={t('definitions.settings.moveItem', { text })}>
      {(handle) => (
        <>
          {handle}
          {item.rule ? (
            <span className="definition-edit__text">{text}</span>
          ) : (
            <NameField
              value={item.text}
              label={t('definitions.settings.itemText', { text })}
              onSave={(value) => onChange((list) => updateItem(list, item.id, { text: value }))}
              onStep={(direction) => onStep(item.id, direction)}
            />
          )}
          <span className={item.rule ? 'definition-item__auto' : 'definition-item__manual'}>{t(item.rule ? 'definitions.automatic' : 'definitions.manual')}</span>
          <label className="check definition-edit__na">
            <input
              type="checkbox"
              checked={item.mayBeIrrelevant}
              aria-label={t('definitions.settings.mayBeIrrelevantFor', { text })}
              onChange={(event) => onChange((list) => updateItem(list, item.id, { mayBeIrrelevant: event.target.checked }))}
            />
            <span>{t('definitions.settings.mayBeIrrelevant')}</span>
          </label>
          <button
            type="button"
            className="icon-btn icon-btn--quiet"
            aria-label={t('definitions.settings.removeItem', { text })}
            title={t('definitions.settings.removeItem', { text })}
            onClick={() => onChange((list) => removeItem(list, item.id))}
          >
            <TrashIcon />
          </button>
        </>
      )}
    </Row>
  );
}

/**
 * The library of automatic checks (#26): a picker with a description per check. Checks that are already in the list are
 * shown but cannot be chosen again. Arrow keys choose, Enter adds, Escape closes and the focus returns to the button.
 */
function LibraryPicker({ groupName: name, used, onPick }: { groupName: string; used: ReadonlySet<DefinitionRule>; onPick: (rule: DefinitionRule) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const uid = useId();

  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    const close = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (!list.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const openPicker = (): void => {
    setActive(Math.max(0, DEFINITION_RULES.findIndex((rule) => !used.has(rule))));
    setOpen(true);
  };
  const close = (): void => {
    setOpen(false);
    button.current?.focus();
  };
  const pick = (rule: DefinitionRule): void => {
    if (used.has(rule)) return;
    onPick(rule);
    close();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index + (event.key === 'ArrowDown' ? 1 : DEFINITION_RULES.length - 1)) % DEFINITION_RULES.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      pick(DEFINITION_RULES[active]);
    }
  };

  return (
    <div className="library">
      <button
        type="button"
        ref={button}
        className="btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? uid : undefined}
        aria-label={t('definitions.settings.libraryFor', { name })}
        onClick={() => (open ? close() : openPicker())}
      >
        {t('definitions.settings.library')} ▾
      </button>
      {open && (
        <div className="library__popover">
          <p className="library__title">{t('definitions.settings.libraryTitle')}</p>
          <ul id={uid} ref={list} role="listbox" tabIndex={0} aria-label={t('definitions.settings.libraryTitle')} aria-activedescendant={`${uid}-${DEFINITION_RULES[active]}`} className="library__list" onKeyDown={onKeyDown}>
            {DEFINITION_RULES.map((rule, index) => {
              const taken = used.has(rule);
              return (
                <li
                  key={rule}
                  id={`${uid}-${rule}`}
                  role="option"
                  aria-selected={index === active}
                  aria-disabled={taken}
                  className={`library__item${index === active ? ' library__item--active' : ''}${taken ? ' library__item--used' : ''}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(rule)}
                >
                  <span className="library__name">{t(`definitions.rule.${rule}`)}</span>
                  {taken && <span className="badge">{t('definitions.settings.libraryUsed')}</span>}
                  <span className="muted library__help">{t(`definitions.ruleHelp.${rule}`)}</span>
                </li>
              );
            })}
          </ul>
          <p className="muted library__hint">{t('definitions.settings.libraryHint')}</p>
        </div>
      )}
    </div>
  );
}

/** A group as a block (#26): handle, fold button, name, counter and remove in its head; its items; a row to add an item. */
function GroupBlock({
  group,
  used,
  onChange,
  onStep
}: {
  group: DefinitionGroup;
  used: ReadonlySet<DefinitionRule>;
  onChange: (change: (list: DefinitionList) => DefinitionList) => void;
  onStep: (id: string, direction: -1 | 1) => void;
}) {
  const { t } = useTranslation();
  const name = groupName(t, group.name);
  const [open, setOpen] = useState(true);
  const [text, setText] = useState('');
  const bodyId = useId();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!text.trim()) return;
    onChange((list) => addItem(list, group.id, { id: newId(), text, rule: null, mayBeIrrelevant: false }, newId()));
    setText('');
  };

  return (
    <li ref={setNodeRef} className={`definition-block${isDragging ? ' definition-block--dragging' : ''}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <div className="definition-block__head">
        <button type="button" ref={setActivatorNodeRef} className="drag-handle" aria-label={t('definitions.settings.moveGroup', { name })} {...attributes} {...listeners}>
          <GripIcon />
        </button>
        <button
          type="button"
          className="definition-block__fold"
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={t(open ? 'definitions.settings.foldGroup' : 'definitions.settings.unfoldGroup', { name })}
          onClick={() => setOpen(!open)}
        >
          <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        </button>
        <NameField
          value={group.name}
          label={t('definitions.settings.groupName', { name })}
          placeholder={t('definitions.generalGroup')}
          onSave={(value) => onChange((list) => renameGroup(list, group.id, value))}
          onStep={(direction) => onStep(group.id, direction)}
        />
        <span className="muted definition-edit__count">{t('definitions.settings.items', { count: group.items.length })}</span>
        <button
          type="button"
          className="icon-btn icon-btn--quiet"
          aria-label={t('definitions.settings.removeGroup', { name })}
          title={t('definitions.settings.removeGroup', { name })}
          onClick={() => onChange((list) => removeGroup(list, group.id))}
        >
          <TrashIcon />
        </button>
      </div>
      <div id={bodyId} hidden={!open}>
        <SortableContext items={group.items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <ul className="definition-edit definition-block__items">
            {group.items.map((item) => (
              <ItemRow key={item.id} item={item} onChange={onChange} onStep={onStep} />
            ))}
          </ul>
        </SortableContext>
        <form className="definition-block__add" onSubmit={submit}>
          <input
            className="input"
            aria-label={t('definitions.settings.newItemIn', { name })}
            placeholder={t('definitions.settings.newItemPlaceholder')}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <button type="submit" className="btn" aria-label={t('definitions.settings.addItemTo', { name })} disabled={!text.trim()}>
            {t('definitions.settings.addItem')}
          </button>
          <LibraryPicker groupName={name} used={used} onPick={(rule) => onChange((list) => addItem(list, group.id, { id: newId(), text: '', rule, mayBeIrrelevant: false }, newId()))} />
        </form>
      </div>
    </li>
  );
}

/**
 * One list (#26) as a card: a switch to activate it, and only when it is active its content, the groups as blocks. An off list
 * shows nothing but its heading; when it is empty too it offers the example list or an empty start. An active list folds to a
 * summary. Saved at once.
 */
function ListCard({ kind }: { kind: DefinitionKind }) {
  const { t } = useTranslation();
  const app = useApp();
  const sensors = useDragSensors();
  const [open, setOpen] = useState(true);
  const [newGroup, setNewGroup] = useState('');
  const bodyId = useId();
  const { definitions } = app.settings;
  const list = definitions[kind];
  const name = t(`definitions.${kind}`);
  const items = itemsOf(list);

  const change = (next: (list: DefinitionList) => DefinitionList): void => app.setDefinitions({ ...definitions, [kind]: next(list) });
  const groupIds = new Set(list.groups.map((group) => group.id));
  const used = new Set(items.flatMap((item) => (item.rule ? [item.rule] : [])));
  const rowIds = list.groups.flatMap((group) => [group.id, ...group.items.map((item) => item.id)]);
  const labelOf = (id: UniqueIdentifier): string => {
    for (const group of list.groups) {
      if (group.id === id) return groupName(t, group.name);
      const item = group.items.find((entry) => entry.id === id);
      if (item) return itemText(t, item);
    }
    return '';
  };
  const positionOf = (id: UniqueIdentifier): number => rowIds.indexOf(String(id)) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('board.dnd.pickedUp', { title: labelOf(active.id) }),
    onDragOver: ({ active, over }) => (over ? t('detail.dnd.over', { title: labelOf(active.id), position: positionOf(over.id) }) : undefined),
    onDragEnd: ({ active, over }) =>
      over ? t('detail.dnd.dropped', { title: labelOf(active.id), position: positionOf(over.id) }) : t('board.dnd.cancelled', { title: labelOf(active.id) }),
    onDragCancel: ({ active }) => t('board.dnd.cancelled', { title: labelOf(active.id) })
  };
  /** A block is dropped between blocks, so while one is dragged only the blocks count; an item may land on any block or item. */
  const collision: CollisionDetection = (args) =>
    closestCenter(groupIds.has(String(args.active.id)) ? { ...args, droppableContainers: args.droppableContainers.filter((container) => groupIds.has(String(container.id))) } : args);
  const onDragEnd = (event: DragEndEvent): void => {
    if (event.over) change((current) => moveRow(current, String(event.active.id), String(event.over?.id)));
  };
  const step = (id: string, direction: -1 | 1): void => change((current) => stepRow(current, id, direction));
  const submitGroup = (event: FormEvent): void => {
    event.preventDefault();
    if (!newGroup.trim()) return;
    change((current) => addGroup(current, newId(), newGroup));
    setNewGroup('');
  };
  const summary = `${t('definitions.settings.groups', { count: list.groups.length })} · ${t('definitions.settings.items', { count: items.length })}`;

  return (
    <section className={`feature definition-listcard${list.enforce ? '' : ' definition-listcard--off'}`} aria-label={name} data-kind={kind}>
      <div className="definition-listcard__head">
        <label className="check feature__toggle">
          <input
            type="checkbox"
            role="switch"
            checked={list.enforce}
            aria-label={t(`definitions.settings.enforce.${kind}`)}
            aria-describedby={`${bodyId}-hint`}
            onChange={(event) => change((current) => setEnforce(current, event.target.checked))}
          />
          <h3 className="feature__name">{name}</h3>
          <span className={`badge${list.enforce ? '' : ' badge--off'}`}>{t(list.enforce ? 'settings.features.on' : 'settings.features.off')}</span>
        </label>
        {list.enforce && (
          <button
            type="button"
            className="icon-btn icon-btn--quiet"
            aria-expanded={open}
            aria-controls={bodyId}
            aria-label={t(open ? 'definitions.settings.foldList' : 'definitions.settings.unfoldList', { name })}
            title={t(open ? 'definitions.settings.foldList' : 'definitions.settings.unfoldList', { name })}
            onClick={() => setOpen(!open)}
          >
            <span aria-hidden="true">{open ? '▾' : '▸'}</span>
          </button>
        )}
      </div>
      <p id={`${bodyId}-hint`} className="muted feature__text">
        {list.enforce && !open ? summary : t(`definitions.settings.enforceHint.${kind}`)}
      </p>
      {!list.enforce && list.groups.length === 0 && (
        <div role="note" className="definition-cta">
          <p>{t('definitions.settings.emptyOff')}</p>
          <button type="button" className="btn" onClick={() => change(() => exampleList(kind, newId))}>
            {t('definitions.settings.insertExample')}
          </button>
          <button type="button" className="btn" onClick={() => change((current) => setEnforce(current, true))}>
            {t('definitions.settings.startEmpty')}
          </button>
        </div>
      )}
      {!list.enforce && list.groups.length > 0 && (
        <p role="note" className="definition-off">
          {t('definitions.settings.off')}
        </p>
      )}
      {list.enforce && (
        <div id={bodyId} className="definition-listcard__body" hidden={!open}>
          {list.groups.length === 0 && <p className="muted">{t('definitions.settings.empty')}</p>}
          <DndContext sensors={sensors} collisionDetection={collision} onDragEnd={onDragEnd} accessibility={{ announcements, screenReaderInstructions: { draggable: t('detail.dnd.instructions') } }}>
            <SortableContext items={list.groups.map((group) => group.id)} strategy={verticalListSortingStrategy}>
              <ul className="definition-blocks">
                {list.groups.map((group) => (
                  <GroupBlock key={group.id} group={group} used={used} onChange={change} onStep={step} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          <form className="definition-newgroup" onSubmit={submitGroup}>
            <input className="input" aria-label={t('definitions.settings.newGroup')} placeholder={t('definitions.settings.newGroupPlaceholder')} value={newGroup} onChange={(event) => setNewGroup(event.target.value)} />
            <button type="submit" className="btn" disabled={!newGroup.trim()}>
              {t('definitions.settings.addGroup')}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

/** Settings › Definitions (#26): the Definition of Ready and the Definition of Done one under the other. */
export function DefinitionsSection() {
  const { t } = useTranslation();
  return (
    <div className="map-settings definitions-settings">
      <div className="map-settings__head">
        <h2>{t('definitions.title')}</h2>
      </div>
      <p className="muted">{t('definitions.settings.hint')}</p>
      <div className="definition-lists">
        {DEFINITION_KINDS.map((kind) => (
          <ListCard key={kind} kind={kind} />
        ))}
      </div>
    </div>
  );
}
