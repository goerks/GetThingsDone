import type {
  BuiltinKey,
  CustomDataType,
  EpicColorKey,
  FieldAssignment,
  FieldDefinition,
  FieldOption,
  FieldValue,
  ItemType
} from './types';
import { EPIC_COLOR_KEYS } from './types';

interface BuiltinField {
  key: BuiltinKey;
  kind: 'system' | 'builtin';
  dataType: FieldDefinition['dataType'];
  itemTypes: readonly ItemType[];
}

/**
 * System and built-in fields in their default order. Their values live in the item tables,
 * the field library only carries label, order and visibility (see ADR 0003).
 */
export const BUILTIN_FIELDS: readonly BuiltinField[] = [
  { key: 'key', kind: 'system', dataType: 'key', itemTypes: ['story'] },
  { key: 'title', kind: 'system', dataType: 'text', itemTypes: ['story', 'epic'] },
  { key: 'status', kind: 'system', dataType: 'status', itemTypes: ['story'] },
  { key: 'description', kind: 'builtin', dataType: 'long_text', itemTypes: ['story'] },
  { key: 'epic', kind: 'builtin', dataType: 'epic', itemTypes: ['story'] },
  { key: 'points', kind: 'builtin', dataType: 'points', itemTypes: ['story'] },
  { key: 'criteria', kind: 'builtin', dataType: 'checklist', itemTypes: ['story'] },
  { key: 'color', kind: 'builtin', dataType: 'color', itemTypes: ['epic'] }
];

/** Stable id of a built-in field, the same in every database. */
export function builtinFieldId(key: BuiltinKey): string {
  return `field-${key}`;
}

function assignment(itemType: ItemType, fieldId: string, position: number): FieldAssignment {
  return { itemType, fieldId, position, required: false, hidden: false, onCard: false, inCreate: false };
}

/**
 * Adds the system and built-in fields and assignments that are missing, so a new release can add one
 * without a database migration. Returns only what was added; both lists are empty when nothing is missing.
 */
export function missingBuiltins(
  fields: readonly FieldDefinition[],
  assignments: readonly FieldAssignment[]
): { fields: FieldDefinition[]; assignments: FieldAssignment[] } {
  const known = new Set(fields.map((field) => field.id));
  const addedFields: FieldDefinition[] = [];
  const addedAssignments: FieldAssignment[] = [];
  for (const builtin of BUILTIN_FIELDS) {
    const id = builtinFieldId(builtin.key);
    if (known.has(id)) continue;
    addedFields.push({
      id,
      builtinKey: builtin.key,
      kind: builtin.kind,
      dataType: builtin.dataType,
      label: null,
      options: [],
      defaultValue: null
    });
    for (const itemType of builtin.itemTypes) {
      const position = BUILTIN_FIELDS.filter((item) => item.itemTypes.includes(itemType)).indexOf(builtin);
      const taken = assignments.some((item) => item.itemType === itemType && item.fieldId === id);
      if (!taken) addedAssignments.push(assignment(itemType, id, position));
    }
  }
  return { fields: addedFields, assignments: addedAssignments };
}

export function isCustomDataType(value: string): value is CustomDataType {
  return value === 'text' || value === 'long_text' || value === 'number' || value === 'single_select';
}

/** Item types a field is assigned to. */
export function assignedTypes(assignments: readonly FieldAssignment[], fieldId: string): ItemType[] {
  return assignments.filter((item) => item.fieldId === fieldId).map((item) => item.itemType);
}

/** The visible custom fields of an item type, in their configured order. */
export function customFieldsFor(
  itemType: ItemType,
  fields: readonly FieldDefinition[],
  assignments: readonly FieldAssignment[]
): FieldDefinition[] {
  const byId = new Map(fields.map((field) => [field.id, field]));
  return assignments
    .filter((item) => item.itemType === itemType && !item.hidden)
    .sort((a, b) => a.position - b.position)
    .map((item) => byId.get(item.fieldId))
    .filter((field): field is FieldDefinition => field !== undefined && field.kind === 'custom');
}

/** Anything that carries values of custom fields: stories and epics, later sprints and releases. */
export interface WithValues {
  id: string;
  values: Record<string, FieldValue>;
}

/** Number of items that have a value for the field. */
export function countValues(items: readonly WithValues[], fieldId: string): number {
  return items.filter((item) => item.values[fieldId] !== undefined).length;
}

export interface OptionInput {
  /** Id of an existing option, missing for a new one. */
  id?: string;
  label: string;
  colorKey?: EpicColorKey;
}

export interface FieldInput {
  label: string;
  dataType: CustomDataType;
  options: readonly OptionInput[];
  itemTypes: readonly ItemType[];
  /** Default as typed: text, a number, or the label of an option. Empty means no default. */
  defaultValue?: string;
}

export type FieldError = 'labelRequired' | 'labelTaken' | 'optionsRequired' | 'optionLabelTaken' | 'defaultInvalid';

/** Checks a new or changed custom field. Returns null when it is valid. */
export function validateField(
  fields: readonly FieldDefinition[],
  input: FieldInput,
  ownId: string | null = null
): FieldError | null {
  const label = input.label.trim();
  if (!label) return 'labelRequired';
  const taken = fields.some(
    (field) => field.id !== ownId && field.kind === 'custom' && field.label?.toLocaleLowerCase() === label.toLocaleLowerCase()
  );
  if (taken) return 'labelTaken';
  if (input.dataType === 'single_select') {
    const labels = input.options.map((option) => option.label.trim()).filter(Boolean);
    if (labels.length === 0) return 'optionsRequired';
    if (new Set(labels.map((item) => item.toLocaleLowerCase())).size !== labels.length) return 'optionLabelTaken';
  }
  const raw = input.defaultValue?.trim() ?? '';
  if (raw) {
    if (input.dataType === 'number' && !Number.isFinite(Number(raw.replace(',', '.')))) return 'defaultInvalid';
    if (input.dataType === 'single_select' && !input.options.some((option) => sameLabel(option.label, raw))) return 'defaultInvalid';
  }
  return null;
}

function sameLabel(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

/** Turns the typed default into a stored value; a select default is looked up by option label. */
function resolveDefault(field: FieldDefinition, raw: string | undefined): FieldValue | null {
  const text = raw?.trim() ?? '';
  if (!text) return null;
  if (field.dataType === 'single_select') return field.options.find((option) => sameLabel(option.label, text))?.id ?? null;
  return parseValue(field, text);
}

/** The default of a field as the field dialog shows it: text, a number, or an option label. */
export function defaultAsText(field: FieldDefinition): string {
  if (field.defaultValue === null) return '';
  if (field.dataType === 'single_select') return field.options.find((option) => option.id === field.defaultValue)?.label ?? '';
  return String(field.defaultValue);
}

/** Trims the options, drops empty ones and gives new ones an id and the next free colour. */
function cleanOptions(input: FieldInput, newId: () => string): FieldOption[] {
  if (input.dataType !== 'single_select') return [];
  const options: FieldOption[] = [];
  for (const option of input.options) {
    const label = option.label.trim();
    if (!label) continue;
    const colorKey = option.colorKey ?? EPIC_COLOR_KEYS[options.length % EPIC_COLOR_KEYS.length];
    options.push({ id: option.id ?? newId(), label, colorKey });
  }
  return options;
}

/** Assignments of one field after choosing its item types. New assignments go to the end. */
export function assignTo(
  assignments: readonly FieldAssignment[],
  fieldId: string,
  itemTypes: readonly ItemType[]
): FieldAssignment[] {
  const kept = assignments.filter((item) => item.fieldId !== fieldId || itemTypes.includes(item.itemType));
  const added = itemTypes
    .filter((itemType) => !kept.some((item) => item.fieldId === fieldId && item.itemType === itemType))
    .map((itemType) => {
      const last = kept.filter((item) => item.itemType === itemType).reduce((max, item) => Math.max(max, item.position), -1);
      return assignment(itemType, fieldId, last + 1);
    });
  return [...kept, ...added];
}

export interface FieldChange {
  fields: FieldDefinition[];
  assignments: FieldAssignment[];
  field: FieldDefinition;
}

/** Adds a custom field to the library and assigns it. Returns null when the input is invalid. */
export function createField(
  fields: readonly FieldDefinition[],
  assignments: readonly FieldAssignment[],
  input: FieldInput,
  newId: () => string
): FieldChange | null {
  if (validateField(fields, input) !== null) return null;
  const draft: FieldDefinition = {
    id: newId(),
    builtinKey: null,
    kind: 'custom',
    dataType: input.dataType,
    label: input.label.trim(),
    options: cleanOptions(input, newId),
    defaultValue: null
  };
  const field: FieldDefinition = { ...draft, defaultValue: resolveDefault(draft, input.defaultValue) };
  return { fields: [...fields, field], assignments: assignTo(assignments, field.id, input.itemTypes), field };
}

/** What the field dialog changes on an existing field. Item types are switched in the field table. */
export type FieldPatch = Pick<FieldInput, 'label' | 'options' | 'defaultValue'>;

/**
 * Changes label and options of a custom field. The data type stays.
 * Returns null when the field is unknown, not a custom field, or the input is invalid.
 */
export function updateField(
  fields: readonly FieldDefinition[],
  id: string,
  input: FieldPatch,
  newId: () => string
): { fields: FieldDefinition[]; field: FieldDefinition } | null {
  const current = fields.find((field) => field.id === id);
  if (!current || current.kind !== 'custom' || !isCustomDataType(current.dataType)) return null;
  const full: FieldInput = { ...input, dataType: current.dataType, itemTypes: [] };
  if (validateField(fields, full, id) !== null) return null;
  const draft: FieldDefinition = { ...current, label: input.label.trim(), options: cleanOptions(full, newId) };
  const field: FieldDefinition = { ...draft, defaultValue: resolveDefault(draft, input.defaultValue) };
  return { fields: fields.map((item) => (item.id === id ? field : item)), field };
}

/** Removes values that point to options a select field no longer has. */
export function dropRemovedOptions<T extends WithValues>(items: T[], field: FieldDefinition): T[] {
  if (field.dataType !== 'single_select') return items;
  const valid = new Set(field.options.map((option) => option.id));
  return items.map((item) => {
    const value = item.values[field.id];
    if (value === undefined || valid.has(String(value))) return item;
    return { ...item, values: withoutKey(item.values, field.id) };
  });
}

export function withoutKey(values: Record<string, FieldValue>, key: string): Record<string, FieldValue> {
  const next = { ...values };
  delete next[key];
  return next;
}

/** Removes a custom field with its assignments. System and built-in fields are kept. Values: see `withoutField`. */
export function deleteField(
  fields: readonly FieldDefinition[],
  assignments: readonly FieldAssignment[],
  id: string
): { fields: FieldDefinition[]; assignments: FieldAssignment[] } | null {
  const field = fields.find((item) => item.id === id);
  if (!field || field.kind !== 'custom') return null;
  return {
    fields: fields.filter((item) => item.id !== id),
    assignments: assignments.filter((item) => item.fieldId !== id)
  };
}

/** Removes every value of a field from the items. */
export function withoutField<T extends WithValues>(items: T[], fieldId: string): T[] {
  return items.map((item) => (item.values[fieldId] === undefined ? item : { ...item, values: withoutKey(item.values, fieldId) }));
}

/**
 * Uses a custom field on an item type or stops using it there. Values stay when the field is taken off.
 * Returns null for system and built-in fields, which cannot be switched yet.
 */
export function setAssigned(
  fields: readonly FieldDefinition[],
  assignments: readonly FieldAssignment[],
  fieldId: string,
  itemType: ItemType,
  used: boolean
): FieldAssignment[] | null {
  const field = fields.find((item) => item.id === fieldId);
  if (!field || field.kind !== 'custom') return null;
  const types = assignedTypes(assignments, fieldId).filter((type) => type !== itemType);
  return assignTo(assignments, fieldId, used ? [...types, itemType] : types);
}

/**
 * Turns what the user typed or picked into a stored value. Text is trimmed, numbers must be finite,
 * select values must be an option of the field. Null means "no value".
 */
export function parseValue(field: FieldDefinition, raw: string): FieldValue | null {
  const text = raw.trim();
  if (!text) return null;
  switch (field.dataType) {
    case 'text':
    case 'long_text':
      return text;
    case 'number': {
      const number = Number(text.replace(',', '.'));
      return Number.isFinite(number) ? number : null;
    }
    case 'single_select':
      return field.options.some((option) => option.id === text) ? text : null;
    default:
      return null;
  }
}

/** Sets or clears the value of a field on one item. */
export function setItemValue<T extends WithValues>(items: T[], itemId: string, fieldId: string, value: FieldValue | null): T[] {
  return items.map((item) => {
    if (item.id !== itemId) return item;
    return { ...item, values: value === null ? withoutKey(item.values, fieldId) : { ...item.values, [fieldId]: value } };
  });
}

/* ---------- Layout per item type (stage 3) ---------- */

/** At most this many fields show on a card, so cards stay small. */
export const CARD_FIELD_LIMIT = 3;

export interface LayoutEntry {
  field: FieldDefinition;
  assignment: FieldAssignment;
}

/** All fields of an item type with their assignment, in their order. Hidden ones are included. */
export function layoutFor(
  itemType: ItemType,
  fields: readonly FieldDefinition[],
  assignments: readonly FieldAssignment[]
): LayoutEntry[] {
  const byId = new Map(fields.map((field) => [field.id, field]));
  return assignments
    .filter((item) => item.itemType === itemType)
    .sort((a, b) => a.position - b.position)
    .flatMap((assignment) => {
      const field = byId.get(assignment.fieldId);
      return field ? [{ field, assignment }] : [];
    });
}

/**
 * Moves a custom field before or after another custom field of the same item type.
 * System and built-in fields keep their places; positions are renumbered without gaps.
 */
export function moveInLayout(
  itemType: ItemType,
  fields: readonly FieldDefinition[],
  assignments: readonly FieldAssignment[],
  activeId: string,
  overId: string
): FieldAssignment[] {
  if (activeId === overId) return [...assignments];
  const layout = layoutFor(itemType, fields, assignments);
  const custom = layout.filter((entry) => entry.field.kind === 'custom');
  const from = custom.findIndex((entry) => entry.field.id === activeId);
  const to = custom.findIndex((entry) => entry.field.id === overId);
  if (from < 0 || to < 0) return [...assignments];
  const moved = [...custom];
  const [entry] = moved.splice(from, 1);
  moved.splice(to, 0, entry);
  const fixed = layout.filter((item) => item.field.kind !== 'custom');
  const order = [...fixed, ...moved].map((item) => item.field.id);
  return assignments.map((item) =>
    item.itemType === itemType && order.includes(item.fieldId) ? { ...item, position: order.indexOf(item.fieldId) } : item
  );
}

export type LayoutPatch = Partial<Pick<FieldAssignment, 'required' | 'onCard' | 'inCreate'>>;

/**
 * Changes how a custom field behaves on an item type. A required field is always in the create dialog.
 * Returns null for system and built-in fields, unknown assignments, and a card that is already full.
 */
export function updateLayout(
  itemType: ItemType,
  fields: readonly FieldDefinition[],
  assignments: readonly FieldAssignment[],
  fieldId: string,
  patch: LayoutPatch
): FieldAssignment[] | null {
  const field = fields.find((item) => item.id === fieldId);
  const current = assignments.find((item) => item.itemType === itemType && item.fieldId === fieldId);
  if (!field || field.kind !== 'custom' || !current) return null;
  if (patch.onCard && !current.onCard && cardFieldsFor(itemType, fields, assignments).length >= CARD_FIELD_LIMIT) return null;
  const next: FieldAssignment = { ...current, ...patch };
  if (next.required) next.inCreate = true;
  return assignments.map((item) => (item === current ? next : item));
}

/** Visible custom fields of an item type that the user ticked for the card, at most `CARD_FIELD_LIMIT`. */
export function cardFieldsFor(
  itemType: ItemType,
  fields: readonly FieldDefinition[],
  assignments: readonly FieldAssignment[]
): FieldDefinition[] {
  return layoutFor(itemType, fields, assignments)
    .filter((entry) => entry.field.kind === 'custom' && entry.assignment.onCard && !entry.assignment.hidden)
    .slice(0, CARD_FIELD_LIMIT)
    .map((entry) => entry.field);
}

/** Visible custom fields of an item type for the create dialog: the ticked ones and every required one. */
export function createFieldsFor(
  itemType: ItemType,
  fields: readonly FieldDefinition[],
  assignments: readonly FieldAssignment[]
): LayoutEntry[] {
  return layoutFor(itemType, fields, assignments).filter(
    (entry) => entry.field.kind === 'custom' && !entry.assignment.hidden && (entry.assignment.inCreate || entry.assignment.required)
  );
}

/** Whether a field is required on an item type. */
export function isRequired(itemType: ItemType, assignments: readonly FieldAssignment[], fieldId: string): boolean {
  return assignments.some((item) => item.itemType === itemType && item.fieldId === fieldId && item.required);
}

/** Required custom fields of an item type that have no value. */
export function missingRequired(
  itemType: ItemType,
  fields: readonly FieldDefinition[],
  assignments: readonly FieldAssignment[],
  values: Record<string, FieldValue>
): FieldDefinition[] {
  return layoutFor(itemType, fields, assignments)
    .filter((entry) => entry.field.kind === 'custom' && !entry.assignment.hidden && entry.assignment.required)
    .filter((entry) => values[entry.field.id] === undefined)
    .map((entry) => entry.field);
}

/** Values a new item of a type starts with: the defaults of its visible custom fields. */
export function defaultValuesFor(
  itemType: ItemType,
  fields: readonly FieldDefinition[],
  assignments: readonly FieldAssignment[]
): Record<string, FieldValue> {
  const values: Record<string, FieldValue> = {};
  for (const entry of layoutFor(itemType, fields, assignments)) {
    if (entry.field.kind === 'custom' && !entry.assignment.hidden && entry.field.defaultValue !== null) {
      values[entry.field.id] = entry.field.defaultValue;
    }
  }
  return values;
}

/** A value as text for cards and lists: the option label, the number or the text. */
export function formatValue(field: FieldDefinition, value: FieldValue): string {
  if (field.dataType === 'single_select') return field.options.find((option) => option.id === value)?.label ?? '';
  return String(value);
}
