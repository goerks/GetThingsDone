import { describe, expect, it } from 'vitest';
import {
  BUILTIN_FIELDS,
  assignTo,
  assignedTypes,
  builtinFieldId,
  countValues,
  createField,
  customFieldsFor,
  deleteField,
  dropRemovedOptions,
  missingBuiltins,
  parseValue,
  CARD_FIELD_LIMIT,
  canConvert,
  convertValues,
  isIsoDate,
  normalizeUrl,
  parseOptions,
  cardFieldsFor,
  createFieldsFor,
  defaultAsText,
  defaultValuesFor,
  formatValue,
  layoutFor,
  missingRequired,
  moveInLayout,
  setAssigned,
  setItemValue,
  updateLayout,
  updateField,
  withoutField,
  validateField,
  type FieldInput
} from './fields';
import type { FieldAssignment, FieldDefinition, Story } from './types';

function ids(): () => string {
  let next = 0;
  return () => {
    next += 1;
    return `id-${next}`;
  };
}

function story(id: string, values: Story['values'] = {}): Story {
  return {
    id,
    code: id,
    title: id,
    description: '',
    epicId: null,
    points: 1,
    status: 'todo',
    sprintId: null,
    rank: 0,
    criteria: [],
    values
  };
}

const builtins = missingBuiltins([], []);

const select: FieldDefinition = {
  id: 'prio',
  builtinKey: null,
  kind: 'custom',
  dataType: 'single_select',
  label: 'Priority',
  options: [
    { id: 'must', label: 'Must', colorKey: 'rose' },
    { id: 'could', label: 'Could', colorKey: 'slate' }
  ],
  defaultValue: null
};

const textInput: FieldInput = { label: 'Customer', dataType: 'text', options: [], itemTypes: ['story'] };

describe('missingBuiltins', () => {
  it('adds every system and built-in field to an empty library', () => {
    expect(builtins.fields.map((field) => field.builtinKey)).toEqual(BUILTIN_FIELDS.map((field) => field.key));
    expect(builtins.fields.every((field) => field.label === null && field.kind !== 'custom')).toBe(true);
  });

  it('assigns them to their item types in the default order', () => {
    const story = builtins.assignments.filter((item) => item.itemType === 'story').sort((a, b) => a.position - b.position);
    expect(story.map((item) => item.fieldId)).toEqual(
      ['key', 'title', 'status', 'description', 'epic', 'points', 'criteria'].map((key) => builtinFieldId(key as never))
    );
    expect(assignedTypes(builtins.assignments, builtinFieldId('title')).sort()).toEqual(['epic', 'story']);
    expect(assignedTypes(builtins.assignments, builtinFieldId('color'))).toEqual(['epic']);
  });

  it('adds nothing when everything is there', () => {
    expect(missingBuiltins(builtins.fields, builtins.assignments)).toEqual({ fields: [], assignments: [] });
  });

  it('keeps a renamed built-in field as it is', () => {
    const renamed = builtins.fields.map((field) => (field.builtinKey === 'points' ? { ...field, label: 'Effort' } : field));
    expect(missingBuiltins(renamed, builtins.assignments).fields).toEqual([]);
  });
});

describe('validateField', () => {
  it('needs a name', () => {
    expect(validateField([], { ...textInput, label: '  ' })).toBe('labelRequired');
  });

  it('rejects a name another custom field has, ignoring case', () => {
    expect(validateField([select], { ...textInput, label: 'priority' })).toBe('labelTaken');
  });

  it('accepts the field keeping its own name', () => {
    expect(validateField([select], { ...textInput, dataType: 'single_select', label: 'Priority', options: [{ label: 'A' }] }, 'prio')).toBeNull();
  });

  it('needs at least one option for a select field', () => {
    expect(validateField([], { ...textInput, dataType: 'single_select', options: [{ label: ' ' }] })).toBe('optionsRequired');
  });

  it('rejects two options with the same name', () => {
    expect(validateField([], { ...textInput, dataType: 'single_select', options: [{ label: 'A' }, { label: 'a ' }] })).toBe(
      'optionLabelTaken'
    );
  });
});

describe('createField', () => {
  it('adds a trimmed custom field and assigns it after the existing fields', () => {
    const result = createField(builtins.fields, builtins.assignments, { ...textInput, label: ' Customer ' }, ids());
    expect(result?.field).toEqual({ id: 'id-1', builtinKey: null, kind: 'custom', dataType: 'text', label: 'Customer', options: [], defaultValue: null });
    const own = result?.assignments.find((item) => item.fieldId === 'id-1');
    expect(own).toMatchObject({ itemType: 'story', position: 7, hidden: false, required: false });
  });

  it('gives options ids and colours and drops empty ones', () => {
    const input: FieldInput = { ...textInput, dataType: 'single_select', options: [{ label: 'Low' }, { label: '' }, { label: 'High', colorKey: 'rose' }] };
    const result = createField([], [], input, ids());
    expect(result?.field.options).toEqual([
      { id: 'id-2', label: 'Low', colorKey: 'blue' },
      { id: 'id-3', label: 'High', colorKey: 'rose' }
    ]);
  });

  it('ignores options of a field that is not a select field', () => {
    expect(createField([], [], { ...textInput, options: [{ label: 'A' }] }, ids())?.field.options).toEqual([]);
  });

  it('returns null for invalid input', () => {
    expect(createField([], [], { ...textInput, label: '' }, ids())).toBeNull();
  });

  it('can create a field that is not used anywhere', () => {
    const result = createField([], [], { ...textInput, itemTypes: [] }, ids());
    expect(result?.assignments).toEqual([]);
  });
});

describe('updateField', () => {
  it('renames the field, keeps option ids and adds new options', () => {
    const result = updateField(
      [select],
      'prio',
      { label: 'Importance', options: [{ id: 'must', label: 'Must have', colorKey: 'rose' }, { label: 'Nice' }] },
      ids()
    );
    expect(result?.field.label).toBe('Importance');
    expect(result?.field.options.map((option) => option.id)).toEqual(['must', 'id-1']);
    expect(result?.field.dataType).toBe('single_select');
  });

  it('does not change system or built-in fields', () => {
    const title = builtins.fields.find((field) => field.builtinKey === 'title') as FieldDefinition;
    expect(updateField(builtins.fields, title.id, { label: 'Name', options: [] }, ids())).toBeNull();
  });
});

describe('setAssigned', () => {
  const assignments: FieldAssignment[] = assignTo([], 'prio', ['story']);

  it('adds an item type at the end of its fields', () => {
    const before = assignTo(assignments, 'other', ['epic']);
    const after = setAssigned([select], before, 'prio', 'epic', true);
    expect(after?.find((item) => item.fieldId === 'prio' && item.itemType === 'epic')?.position).toBe(1);
    expect(after?.filter((item) => item.fieldId === 'prio').map((item) => item.itemType).sort()).toEqual(['epic', 'story']);
  });

  it('takes a field off one item type without touching other fields', () => {
    const both = assignTo(assignments, 'other', ['story']);
    expect(setAssigned([select], both, 'prio', 'story', false)?.map((item) => item.fieldId)).toEqual(['other']);
  });

  it('does not switch system or built-in fields', () => {
    expect(setAssigned(builtins.fields, builtins.assignments, builtinFieldId('points'), 'story', false)).toBeNull();
    expect(setAssigned(builtins.fields, builtins.assignments, builtinFieldId('title'), 'epic', false)).toBeNull();
  });
});

describe('assignTo', () => {
  it('keeps the position of an existing assignment', () => {
    const first = assignTo([], 'a', ['story']);
    const second = assignTo(first, 'b', ['story']);
    expect(assignTo(second, 'a', ['story'])).toEqual(second);
    expect(second.map((item) => item.position)).toEqual([0, 1]);
  });
});

describe('dropRemovedOptions', () => {
  it('removes values of options the field no longer has', () => {
    const stories = [story('a', { prio: 'must' }), story('b', { prio: 'gone' }), story('c')];
    const after = dropRemovedOptions(stories, select);
    expect(after.map((item) => item.values)).toEqual([{ prio: 'must' }, {}, {}]);
    expect(after[0]).toBe(stories[0]);
  });
});

describe('deleteField', () => {
  it('removes the field, its assignments and its values', () => {
    const stories = [story('a', { prio: 'must', other: 'x' })];
    const result = deleteField([select], assignTo([], 'prio', ['story']), 'prio');
    expect(result).toEqual({ fields: [], assignments: [] });
    expect(withoutField(stories, 'prio')).toEqual([story('a', { other: 'x' })]);
  });

  it('keeps system and built-in fields', () => {
    expect(deleteField(builtins.fields, builtins.assignments, builtinFieldId('points'))).toBeNull();
  });
});

describe('customFieldsFor', () => {
  it('lists the visible custom fields of a type in their order', () => {
    const second: FieldDefinition = { ...select, id: 'second', label: 'Second' };
    let assignments = assignTo(builtins.assignments, 'second', ['story']);
    assignments = assignTo(assignments, 'prio', ['story']);
    const fields = [...builtins.fields, select, second];
    expect(customFieldsFor('story', fields, assignments).map((field) => field.id)).toEqual(['second', 'prio']);
    expect(customFieldsFor('epic', fields, assignments)).toEqual([]);
    const hidden = assignments.map((item) => (item.fieldId === 'second' ? { ...item, hidden: true } : item));
    expect(customFieldsFor('story', fields, hidden).map((field) => field.id)).toEqual(['prio']);
  });
});

describe('parseValue', () => {
  const text: FieldDefinition = { ...select, dataType: 'text', options: [] };
  const number: FieldDefinition = { ...select, dataType: 'number', options: [] };

  it('trims text and treats empty text as no value', () => {
    expect(parseValue(text, '  ACME ')).toBe('ACME');
    expect(parseValue(text, '   ')).toBeNull();
  });

  it('reads numbers with a dot or a comma', () => {
    expect(parseValue(number, '8')).toBe(8);
    expect(parseValue(number, '2,5')).toBe(2.5);
    expect(parseValue(number, 'many')).toBeNull();
  });

  it('accepts only options of the field', () => {
    expect(parseValue(select, 'must')).toBe('must');
    expect(parseValue(select, 'unknown')).toBeNull();
  });
});

describe('values on stories', () => {
  it('sets, replaces and clears a value', () => {
    let stories = [story('a'), story('b')];
    stories = setItemValue(stories, 'a', 'prio', 'must');
    expect(stories[0].values).toEqual({ prio: 'must' });
    expect(countValues(stories, 'prio')).toBe(1);
    stories = setItemValue(stories, 'a', 'prio', null);
    expect(stories[0].values).toEqual({});
    expect(countValues(stories, 'prio')).toBe(0);
  });
});

describe('default values', () => {
  it('stores a number default and rejects one that is not a number', () => {
    const input: FieldInput = { ...textInput, label: 'Value', dataType: 'number', defaultValue: '2,5' };
    expect(createField([], [], input, ids())?.field.defaultValue).toBe(2.5);
    expect(validateField([], { ...input, defaultValue: 'many' })).toBe('defaultInvalid');
  });

  it('finds a select default by option label and shows it as the label again', () => {
    const input: FieldInput = { ...textInput, dataType: 'single_select', options: [{ label: 'Low' }, { label: 'High' }], defaultValue: 'high' };
    const field = createField([], [], input, ids())?.field as FieldDefinition;
    expect(field.defaultValue).toBe(field.options[1].id);
    expect(defaultAsText(field)).toBe('High');
    expect(validateField([], { ...input, defaultValue: 'Medium' })).toBe('defaultInvalid');
  });

  it('keeps a select default when its option is renamed', () => {
    const field = { ...select, defaultValue: 'must' };
    const result = updateField([field], 'prio', { label: 'Priority', options: [{ id: 'must', label: 'Must have' }, { id: 'could', label: 'Could' }], defaultValue: 'Must have' }, ids());
    expect(result?.field.defaultValue).toBe('must');
  });

  it('gives a new item the defaults of the visible custom fields of its type', () => {
    const fields = [...builtins.fields, { ...select, defaultValue: 'could' }];
    const assignments = assignTo(builtins.assignments, 'prio', ['story']);
    expect(defaultValuesFor('story', fields, assignments)).toEqual({ prio: 'could' });
    expect(defaultValuesFor('epic', fields, assignments)).toEqual({});
  });
});

describe('layout per item type', () => {
  const second: FieldDefinition = { ...select, id: 'second', label: 'Second' };
  const third: FieldDefinition = { ...select, id: 'third', label: 'Third' };
  const fourth: FieldDefinition = { ...select, id: 'fourth', label: 'Fourth' };
  const fields = [...builtins.fields, select, second, third, fourth];
  let assignments = builtins.assignments;
  for (const id of ['prio', 'second', 'third', 'fourth']) assignments = assignTo(assignments, id, ['story']);
  const customOrder = (list: FieldAssignment[]): string[] =>
    layoutFor('story', fields, list).filter((entry) => entry.field.kind === 'custom').map((entry) => entry.field.id);

  it('lists the fields of a type in their order, built-in fields first', () => {
    const layout = layoutFor('story', fields, assignments);
    expect(layout[0].field.builtinKey).toBe('key');
    expect(customOrder(assignments)).toEqual(['prio', 'second', 'third', 'fourth']);
  });

  it('moves a custom field and keeps the fixed fields in place', () => {
    const after = moveInLayout('story', fields, assignments, 'fourth', 'prio');
    expect(customOrder(after)).toEqual(['fourth', 'prio', 'second', 'third']);
    expect(layoutFor('story', fields, after).slice(0, 7).map((entry) => entry.field.kind)).not.toContain('custom');
    expect(moveInLayout('story', fields, assignments, builtinFieldId('title'), 'prio')).toEqual(assignments);
  });

  it('puts a required field into the create dialog and lists it as missing', () => {
    const after = updateLayout('story', fields, assignments, 'second', { required: true }) as FieldAssignment[];
    const entry = after.find((item) => item.fieldId === 'second' && item.itemType === 'story');
    expect(entry).toMatchObject({ required: true, inCreate: true });
    expect(createFieldsFor('story', fields, after).map((item) => item.field.id)).toEqual(['second']);
    expect(missingRequired('story', fields, after, {}).map((field) => field.id)).toEqual(['second']);
    expect(missingRequired('story', fields, after, { second: 'must' })).toEqual([]);
  });

  it('allows at most a few fields on a card', () => {
    let list = assignments;
    for (const id of ['prio', 'second', 'third']) list = updateLayout('story', fields, list, id, { onCard: true }) as FieldAssignment[];
    expect(cardFieldsFor('story', fields, list)).toHaveLength(CARD_FIELD_LIMIT);
    expect(updateLayout('story', fields, list, 'fourth', { onCard: true })).toBeNull();
    expect(updateLayout('story', fields, list, 'prio', { onCard: false })).not.toBeNull();
  });

  it('does not change system or built-in fields', () => {
    expect(updateLayout('story', fields, assignments, builtinFieldId('points'), { required: true })).toBeNull();
  });

  it('formats values for cards', () => {
    expect(formatValue(select, 'must')).toBe('Must');
    expect(formatValue({ ...select, dataType: 'number', options: [] }, 8)).toBe('8');
  });
});

describe('more data types', () => {
  const field = (dataType: FieldDefinition['dataType']): FieldDefinition => ({ ...select, dataType, options: dataType.endsWith('select') ? select.options : [] });
  const multi = field('multi_select');

  it('accepts only real calendar days', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('28.02.2026')).toBe(false);
    expect(parseValue(field('date'), '2026-12-24')).toBe('2026-12-24');
    expect(parseValue(field('date'), '24.12.2026')).toBeNull();
  });

  it('accepts web links and adds https when it is missing', () => {
    expect(normalizeUrl('example.com/spec')).toBe('https://example.com/spec');
    expect(normalizeUrl('http://intranet.local')).toBe('http://intranet.local/');
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('not a link')).toBeNull();
    expect(parseValue(field('url'), 'github.com')).toBe('https://github.com/');
  });

  it('stores a ticked checkbox as true and an unticked one as no value', () => {
    expect(parseValue(field('checkbox'), 'true')).toBe(true);
    expect(parseValue(field('checkbox'), '')).toBeNull();
  });

  it('keeps the chosen options of a multi select in option order', () => {
    expect(parseOptions(multi, ['could', 'must'])).toEqual(['must', 'could']);
    expect(parseOptions(multi, ['gone'])).toBeNull();
    expect(parseValue(multi, 'could,must')).toEqual(['must', 'could']);
  });

  it('removes deleted options from multi select values', () => {
    const stories = [story('a', { prio: ['must', 'gone'] }), story('b', { prio: ['gone'] })];
    const after = dropRemovedOptions(stories, multi);
    expect(after.map((item) => item.values)).toEqual([{ prio: ['must'] }, {}]);
  });

  it('reads defaults of the new types', () => {
    const create = (input: Partial<FieldInput>) => createField([], [], { ...textInput, ...input }, ids())?.field;
    expect(create({ dataType: 'checkbox', defaultValue: 'true' })?.defaultValue).toBe(true);
    expect(create({ dataType: 'date', defaultValue: '2026-10-11' })?.defaultValue).toBe('2026-10-11');
    expect(create({ dataType: 'url', defaultValue: 'example.com' })?.defaultValue).toBe('https://example.com/');
    const labels = create({ dataType: 'multi_select', options: [{ label: 'A' }, { label: 'B' }], defaultValue: 'b, a' });
    expect(labels?.defaultValue).toEqual(labels?.options.map((option) => option.id));
    expect(defaultAsText(labels as FieldDefinition)).toBe('A, B');
    expect(validateField([], { ...textInput, dataType: 'date', defaultValue: 'tomorrow' })).toBe('defaultInvalid');
    expect(validateField([], { ...textInput, dataType: 'multi_select', options: [{ label: 'A' }], defaultValue: 'A, C' })).toBe('defaultInvalid');
  });

  it('formats dates, links, checkboxes and multi selects for cards', () => {
    expect(formatValue(field('date'), '2026-12-24', 'de')).toBe('24. Dez. 2026');
    expect(formatValue(field('url'), 'https://github.com/goerks')).toBe('github.com');
    expect(formatValue(field('checkbox'), true)).toBe('');
    expect(formatValue(multi, ['must', 'could'])).toBe('Must, Could');
  });
});

describe('type changes', () => {
  it('allows only changes that keep every value', () => {
    expect(canConvert('text', 'long_text')).toBe(true);
    expect(canConvert('single_select', 'multi_select')).toBe(true);
    expect(canConvert('number', 'text')).toBe(true);
    expect(canConvert('long_text', 'text')).toBe(false);
    expect(canConvert('multi_select', 'single_select')).toBe(false);
    expect(canConvert('text', 'number')).toBe(false);
  });

  it('changes the type and converts the values', () => {
    const result = updateField([select], 'prio', { label: 'Priority', options: select.options, dataType: 'multi_select' }, ids());
    expect(result?.field.dataType).toBe('multi_select');
    expect(convertValues([story('a', { prio: 'must' })], 'prio', 'multi_select')[0].values).toEqual({ prio: ['must'] });
    expect(convertValues([story('a', { n: 8 })], 'n', 'text')[0].values).toEqual({ n: '8' });
  });

  it('refuses a change that would lose values', () => {
    expect(updateField([select], 'prio', { label: 'Priority', options: select.options, dataType: 'number' }, ids())).toBeNull();
  });
});
