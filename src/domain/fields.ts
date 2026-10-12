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
import { CUSTOM_DATA_TYPES, EPIC_COLOR_KEYS } from './types';

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
  { key: 'title', kind: 'system', dataType: 'text', itemTypes: ['story', 'epic', 'release'] },
  { key: 'status', kind: 'system', dataType: 'status', itemTypes: ['story'] },
  { key: 'release', kind: 'system', dataType: 'release', itemTypes: ['story'] },
  { key: 'description', kind: 'builtin', dataType: 'long_text', itemTypes: ['story', 'release'] },
  { key: 'epic', kind: 'builtin', dataType: 'epic', itemTypes: ['story'] },
  { key: 'points', kind: 'builtin', dataType: 'points', itemTypes: ['story'] },
  { key: 'criteria', kind: 'builtin', dataType: 'checklist', itemTypes: ['story'] },
  { key: 'color', kind: 'builtin', dataType: 'color', itemTypes: ['epic'] },
  { key: 'start', kind: 'builtin', dataType: 'date', itemTypes: ['release'] },
  { key: 'end', kind: 'builtin', dataType: 'date', itemTypes: ['release'] }
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
 * without a database migration. That includes a known field that gets a new item type (the title and the
 * description of releases). Returns only what was added; both lists are empty when nothing is missing.
 * Added assignments go after the existing ones of their item type.
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
    if (!known.has(id)) {
      addedFields.push({
        id,
        builtinKey: builtin.key,
        kind: builtin.kind,
        dataType: builtin.dataType,
        label: null,
        options: [],
        defaultValue: null
      });
    }
    for (const itemType of builtin.itemTypes) {
      const all = [...assignments, ...addedAssignments];
      if (all.some((item) => item.itemType === itemType && item.fieldId === id)) continue;
      const last = all.filter((item) => item.itemType === itemType).reduce((max, item) => Math.max(max, item.position), -1);
      addedAssignments.push(assignment(itemType, id, last + 1));
    }
  }
  return { fields: addedFields, assignments: addedAssignments };
}

export function isCustomDataType(value: string): value is CustomDataType {
  return (CUSTOM_DATA_TYPES as readonly string[]).includes(value);
}

/** Single and multi select fields have options. */
export function hasOptions(dataType: FieldDefinition['dataType']): boolean {
  return dataType === 'single_select' || dataType === 'multi_select';
}

/** Type changes that keep every value; anything else needs a new field. */
export const CONVERSIONS: Readonly<Record<CustomDataType, readonly CustomDataType[]>> = {
  text: ['long_text'],
  long_text: [],
  number: ['text'],
  date: ['text'],
  checkbox: [],
  single_select: ['multi_select'],
  multi_select: [],
  url: ['text']
};

/** Whether a field may change from one data type to another. */
export function canConvert(from: FieldDefinition['dataType'], to: CustomDataType): boolean {
  return from === to || (isCustomDataType(from) && CONVERSIONS[from].includes(to));
}

/** A value after a lossless type change. */
export function convertValue(value: FieldValue, to: CustomDataType): FieldValue {
  if (to === 'multi_select') return Array.isArray(value) ? value : [String(value)];
  if (to === 'text' || to === 'long_text') return String(value);
  return value;
}

/** Changes every value of a field to its new type. */
export function convertValues<T extends WithValues>(items: T[], fieldId: string, to: CustomDataType): T[] {
  return items.map((item) => {
    const value = item.values[fieldId];
    return value === undefined ? item : { ...item, values: { ...item.values, [fieldId]: convertValue(value, to) } };
  });
}

/** A calendar day as `YYYY-MM-DD` that exists, for example not 2026-02-30. */
export function isIsoDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

/** A web link, with "https://" added when the scheme is missing. Null when it is not a valid http(s) link. */
export function normalizeUrl(text: string): string | null {
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null;
    return url.href;
  } catch {
    return null;
  }
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
  if (hasOptions(input.dataType)) {
    const labels = input.options.map((option) => option.label.trim()).filter(Boolean);
    if (labels.length === 0) return 'optionsRequired';
    if (new Set(labels.map((item) => item.toLocaleLowerCase())).size !== labels.length) return 'optionLabelTaken';
  }
  const raw = input.defaultValue?.trim() ?? '';
  if (raw) {
    const known = (label: string): boolean => input.options.some((option) => sameLabel(option.label, label));
    switch (input.dataType) {
      case 'number':
        if (!Number.isFinite(Number(raw.replace(',', '.')))) return 'defaultInvalid';
        break;
      case 'single_select':
        if (!known(raw)) return 'defaultInvalid';
        break;
      case 'multi_select':
        if (!splitLabels(raw).every(known)) return 'defaultInvalid';
        break;
      case 'date':
        if (!isIsoDate(raw)) return 'defaultInvalid';
        break;
      case 'url':
        if (normalizeUrl(raw) === null) return 'defaultInvalid';
        break;
      default:
        break;
    }
  }
  return null;
}

/** Option labels of a multi select default, written as "A, B". */
function splitLabels(text: string): string[] {
  return text
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean);
}

function sameLabel(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

/** Turns the typed default into a stored value; a select default is looked up by option label. */
function resolveDefault(field: FieldDefinition, raw: string | undefined): FieldValue | null {
  const text = raw?.trim() ?? '';
  if (!text) return null;
  if (field.dataType === 'single_select') return field.options.find((option) => sameLabel(option.label, text))?.id ?? null;
  if (field.dataType === 'multi_select') {
    const ids = splitLabels(text).flatMap((label) => field.options.filter((option) => sameLabel(option.label, label)).map((option) => option.id));
    return parseOptions(field, ids);
  }
  return parseValue(field, text);
}

/** The default of a field as the field dialog shows it: text, a number, a date, "true", or option labels. */
export function defaultAsText(field: FieldDefinition): string {
  if (field.defaultValue === null) return '';
  if (hasOptions(field.dataType)) {
    const ids = Array.isArray(field.defaultValue) ? field.defaultValue : [String(field.defaultValue)];
    return field.options
      .filter((option) => ids.includes(option.id))
      .map((option) => option.label)
      .join(', ');
  }
  return String(field.defaultValue);
}

/** Trims the options, drops empty ones and gives new ones an id and the next free colour. */
function cleanOptions(input: FieldInput, newId: () => string): FieldOption[] {
  if (!hasOptions(input.dataType)) return [];
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

/**
 * What the field dialog changes on an existing field. Item types are switched in the field table.
 * The data type may change only along `CONVERSIONS`; the values are converted with `convertValues`.
 */
export type FieldPatch = Pick<FieldInput, 'label' | 'options' | 'defaultValue'> & { dataType?: CustomDataType };

/**
 * Changes label, options, default and, where it keeps every value, the data type of a custom field.
 * Returns null when the field is unknown, not a custom field, the type change loses values, or the input is invalid.
 */
export function updateField(
  fields: readonly FieldDefinition[],
  id: string,
  input: FieldPatch,
  newId: () => string
): { fields: FieldDefinition[]; field: FieldDefinition } | null {
  const current = fields.find((field) => field.id === id);
  if (!current || current.kind !== 'custom' || !isCustomDataType(current.dataType)) return null;
  const dataType = input.dataType ?? current.dataType;
  if (!canConvert(current.dataType, dataType)) return null;
  const full: FieldInput = { ...input, dataType, itemTypes: [] };
  if (validateField(fields, full, id) !== null) return null;
  const draft: FieldDefinition = { ...current, dataType, label: input.label.trim(), options: cleanOptions(full, newId) };
  const field: FieldDefinition = { ...draft, defaultValue: resolveDefault(draft, input.defaultValue) };
  return { fields: fields.map((item) => (item.id === id ? field : item)), field };
}

/** Removes values that point to options a select field no longer has. */
export function dropRemovedOptions<T extends WithValues>(items: T[], field: FieldDefinition): T[] {
  if (!hasOptions(field.dataType)) return items;
  const valid = new Set(field.options.map((option) => option.id));
  return items.map((item) => {
    const value = item.values[field.id];
    if (value === undefined) return item;
    if (Array.isArray(value)) {
      const kept = value.filter((id) => valid.has(id));
      if (kept.length === value.length) return item;
      return { ...item, values: kept.length > 0 ? { ...item.values, [field.id]: kept } : withoutKey(item.values, field.id) };
    }
    if (valid.has(String(value))) return item;
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
 * Turns what the user typed or picked into a stored value. Text is trimmed, numbers must be finite, dates must
 * exist, links must be http(s), select values must be options of the field. Null means "no value".
 * A multi select takes the chosen option ids, separated by commas; a checkbox takes "true".
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
    case 'date':
      return isIsoDate(text) ? text : null;
    case 'checkbox':
      return text === 'true' ? true : null;
    case 'url':
      return normalizeUrl(text);
    case 'single_select':
      return field.options.some((option) => option.id === text) ? text : null;
    case 'multi_select':
      return parseOptions(field, text.split(','));
    default:
      return null;
  }
}

/** The chosen options of a multi select in the order of the field's options; null when none is valid. */
export function parseOptions(field: FieldDefinition, ids: readonly string[]): string[] | null {
  const chosen = new Set(ids.map((id) => id.trim()));
  const kept = field.options.filter((option) => chosen.has(option.id)).map((option) => option.id);
  return kept.length > 0 ? kept : null;
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
 * Returns null for system and built-in fields (except where and whether the release of a story shows, which is
 * the only thing they can change), unknown assignments, and a card that is already full.
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
  // The "Release" system field of stories can be shown on the card and in the create dialog, never required.
  const releaseField = field?.builtinKey === 'release' && itemType === 'story' && !patch.required;
  if (!field || (field.kind !== 'custom' && !releaseField) || !current) return null;
  if (field.kind === 'custom' && patch.onCard && !current.onCard && cardFieldsFor(itemType, fields, assignments).length >= CARD_FIELD_LIMIT) {
    return null;
  }
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

/** Where the "Release" system field of stories shows besides the story dialog (both off by default, #10). */
export function releaseLayout(assignments: readonly FieldAssignment[]): { inCreate: boolean; onCard: boolean } {
  const own = assignments.find((item) => item.itemType === 'story' && item.fieldId === builtinFieldId('release'));
  return { inCreate: own?.inCreate === true && !own.hidden, onCard: own?.onCard === true && !own.hidden };
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

/**
 * A value as text for cards and lists: option labels, the number, the text, the date in the given locale, or the
 * host of a link. A ticked checkbox has no text of its own; callers show the field name.
 */
export function formatValue(field: FieldDefinition, value: FieldValue, locale = 'en'): string {
  switch (field.dataType) {
    case 'single_select':
    case 'multi_select': {
      const ids = Array.isArray(value) ? value : [String(value)];
      return field.options
        .filter((option) => ids.includes(option.id))
        .map((option) => option.label)
        .join(', ');
    }
    case 'date':
      return typeof value === 'string' && isIsoDate(value)
        ? new Date(`${value}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
        : String(value);
    case 'url':
      try {
        return new URL(String(value)).host;
      } catch {
        return String(value);
      }
    case 'checkbox':
      return '';
    default:
      return String(value);
  }
}

/* ---------- System and built-in fields as configuration (stage 5) ---------- */

/** Built-in fields a team can hide on stories and epics. The epic stays visible for now (PO decision in #4). */
export const HIDEABLE_BUILTINS: readonly BuiltinKey[] = ['description', 'points', 'criteria', 'color'];

/** Built-in fields a team can hide on releases: the dates. Title and description stay (PO design for #10). */
export const HIDEABLE_ON_RELEASES: readonly BuiltinKey[] = ['start', 'end'];

/** Every system and built-in field can be renamed except the key, which is an identifier. */
export function canRename(field: FieldDefinition): boolean {
  return field.builtinKey !== 'key';
}

/** Whether a built-in field can be hidden, on an item type when given (a release can hide only its dates). */
export function canHide(field: FieldDefinition, itemType?: ItemType): boolean {
  if (field.builtinKey === null) return false;
  if (itemType === 'release') return HIDEABLE_ON_RELEASES.includes(field.builtinKey);
  if (itemType === undefined) return HIDEABLE_BUILTINS.includes(field.builtinKey) || HIDEABLE_ON_RELEASES.includes(field.builtinKey);
  return HIDEABLE_BUILTINS.includes(field.builtinKey);
}

/** Whether a system or built-in field shows on an item type: it belongs to the type and is not hidden. */
export function isBuiltinShown(
  itemType: ItemType,
  key: BuiltinKey,
  assignments: readonly FieldAssignment[]
): boolean {
  const assignment = assignments.find((item) => item.itemType === itemType && item.fieldId === builtinFieldId(key));
  return assignment !== undefined && !assignment.hidden;
}

/** Hides or shows a built-in field on an item type; its values stay. Null when the field cannot be hidden. */
export function setBuiltinHidden(
  fields: readonly FieldDefinition[],
  assignments: readonly FieldAssignment[],
  fieldId: string,
  itemType: ItemType,
  hidden: boolean
): FieldAssignment[] | null {
  const field = fields.find((item) => item.id === fieldId);
  const current = assignments.find((item) => item.itemType === itemType && item.fieldId === fieldId);
  if (!field || !canHide(field, itemType) || !current) return null;
  return assignments.map((item) => (item === current ? { ...item, hidden } : item));
}

/**
 * Renames a system or built-in field with one label for all languages; null or an empty label brings back the
 * translated default. Null when the field cannot be renamed.
 */
export function renameBuiltin(
  fields: readonly FieldDefinition[],
  fieldId: string,
  label: string | null
): { fields: FieldDefinition[]; field: FieldDefinition } | null {
  const current = fields.find((item) => item.id === fieldId);
  if (!current || current.kind === 'custom' || !canRename(current)) return null;
  const field: FieldDefinition = { ...current, label: label?.trim() || null };
  return { fields: fields.map((item) => (item.id === fieldId ? field : item)), field };
}
