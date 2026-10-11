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
  setStoryValue,
  updateField,
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
  ]
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
    expect(result?.field).toEqual({ id: 'id-1', builtinKey: null, kind: 'custom', dataType: 'text', label: 'Customer', options: [] });
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
  const assignments: FieldAssignment[] = assignTo([], 'prio', ['story']);

  it('renames the field, keeps option ids and adds new options', () => {
    const result = updateField(
      [select],
      assignments,
      'prio',
      { label: 'Importance', options: [{ id: 'must', label: 'Must have', colorKey: 'rose' }, { label: 'Nice' }], itemTypes: ['story'] },
      ids()
    );
    expect(result?.field.label).toBe('Importance');
    expect(result?.field.options.map((option) => option.id)).toEqual(['must', 'id-1']);
    expect(result?.field.dataType).toBe('single_select');
  });

  it('unassigns a field without touching other fields', () => {
    const both = assignTo(assignments, 'other', ['story']);
    const result = updateField([select], both, 'prio', { label: 'Priority', options: select.options, itemTypes: [] }, ids());
    expect(result?.assignments.map((item) => item.fieldId)).toEqual(['other']);
  });

  it('does not change system or built-in fields', () => {
    const title = builtins.fields.find((field) => field.builtinKey === 'title') as FieldDefinition;
    expect(updateField(builtins.fields, builtins.assignments, title.id, { label: 'Name', options: [], itemTypes: ['story'] }, ids())).toBeNull();
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
    const result = deleteField([select], assignTo([], 'prio', ['story']), stories, 'prio');
    expect(result).toEqual({ fields: [], assignments: [], stories: [story('a', { other: 'x' })] });
  });

  it('keeps system and built-in fields', () => {
    expect(deleteField(builtins.fields, builtins.assignments, [], builtinFieldId('points'))).toBeNull();
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
    stories = setStoryValue(stories, 'a', 'prio', 'must');
    expect(stories[0].values).toEqual({ prio: 'must' });
    expect(countValues(stories, 'prio')).toBe(1);
    stories = setStoryValue(stories, 'a', 'prio', null);
    expect(stories[0].values).toEqual({});
    expect(countValues(stories, 'prio')).toBe(0);
  });
});
