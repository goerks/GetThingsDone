import { describe, expect, it } from 'vitest';
import { LocalStorageRepository } from './localStorageRepository';

describe('LocalStorageRepository', () => {
  it('never deletes a system or built-in field', async () => {
    const repository = new LocalStorageRepository();
    const seeded = await repository.load();
    const points = seeded.fields.find((field) => field.builtinKey === 'points');
    if (!points) throw new Error('points field missing');
    // A renamed field shows whether it was deleted and added back with its default label on load.
    await repository.saveField({ ...points, label: 'Effort' });
    const before = await repository.load();
    const locked = before.fields.filter((field) => field.kind !== 'custom');
    expect(locked.length).toBeGreaterThan(0);
    for (const field of locked) {
      await repository.deleteField(field.id);
    }
    const after = await repository.load();
    expect(after.fields).toEqual(before.fields);
    expect(after.assignments).toEqual(before.assignments);
  });

  it('deletes a custom field with its assignments and values', async () => {
    const repository = new LocalStorageRepository();
    await repository.deleteField('field-demo-priority');
    const after = await repository.load();
    expect(after.fields.some((field) => field.id === 'field-demo-priority')).toBe(false);
    expect(after.assignments.some((item) => item.fieldId === 'field-demo-priority')).toBe(false);
    expect([...after.stories, ...after.epics].every((item) => item.values['field-demo-priority'] === undefined)).toBe(true);
  });

  it('keeps a renamed and hidden built-in field', async () => {
    const repository = new LocalStorageRepository();
    const before = await repository.load();
    const points = before.fields.find((field) => field.builtinKey === 'points');
    if (!points) throw new Error('points field missing');
    await repository.saveField({ ...points, label: 'Effort' });
    await repository.saveAssignments(
      points.id,
      before.assignments.filter((item) => item.fieldId === points.id).map((item) => ({ ...item, hidden: true }))
    );
    const after = await new LocalStorageRepository().load();
    expect(after.fields.find((field) => field.id === points.id)?.label).toBe('Effort');
    expect(after.assignments.find((item) => item.fieldId === points.id)?.hidden).toBe(true);
  });
});
