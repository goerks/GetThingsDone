import { describe, expect, it } from 'vitest';
import { seedSnapshot } from '../data/seed';
import { createEpic, deleteEpic, nextColorKey, normalizeColorKey, storiesInEpic, updateEpic } from './epics';
import { EPIC_COLOR_KEYS, type Epic } from './types';

describe('epic colours', () => {
  it('keeps palette keys and maps the colour keys of release 0.1', () => {
    expect(normalizeColorKey('rose')).toBe('rose');
    expect(normalizeColorKey('boards')).toBe('blue');
    expect(normalizeColorKey('backlog')).toBe('amber');
    expect(normalizeColorKey('storage')).toBe('teal');
    expect(normalizeColorKey('accessibility')).toBe('violet');
    expect(normalizeColorKey('unknown')).toBe('blue');
  });

  it('suggests the first unused colour', () => {
    const { epics } = seedSnapshot();
    expect(nextColorKey(epics)).toBe('rose');
    expect(nextColorKey([])).toBe('blue');
  });

  it('suggests the least used colour once all are taken', () => {
    const epics: Epic[] = EPIC_COLOR_KEYS.map((colorKey, index) => ({ id: `e${index}`, name: 'x', colorKey }));
    epics.push({ id: 'extra', name: 'x', colorKey: 'blue' });
    expect(nextColorKey(epics)).toBe('amber');
  });
});

describe('managing epics', () => {
  const { epics, stories } = seedSnapshot();

  it('creates an epic with a trimmed name and the next free colour', () => {
    const result = createEpic(epics, { name: '  Reports ' }, 'epic-new');
    expect(result?.epic).toEqual({ id: 'epic-new', name: 'Reports', colorKey: 'rose' });
    expect(result?.epics).toHaveLength(epics.length + 1);
  });

  it('uses a chosen colour', () => {
    expect(createEpic(epics, { name: 'Reports', colorKey: 'slate' }, 'id')?.epic.colorKey).toBe('slate');
  });

  it('does not create an epic without a name', () => {
    expect(createEpic(epics, { name: '   ' }, 'id')).toBeNull();
  });

  it('renames and recolours, but ignores an empty name', () => {
    const next = updateEpic(epics, 'epic-boards', { name: ' Board ', colorKey: 'green' });
    expect(next.find((e) => e.id === 'epic-boards')).toEqual({ id: 'epic-boards', name: 'Board', colorKey: 'green' });
    expect(updateEpic(epics, 'epic-boards', { name: '' }).find((e) => e.id === 'epic-boards')?.name).toBe('Boards');
  });

  it('counts the stories of an epic', () => {
    expect(storiesInEpic(stories, 'epic-boards')).toBe(2);
  });

  it('deletes only an epic without stories', () => {
    expect(deleteEpic(epics, stories, 'epic-boards')).toBe(epics);
    const empty = [...epics, { id: 'epic-empty', name: 'Empty', colorKey: 'cyan' as const }];
    expect(deleteEpic(empty, stories, 'epic-empty').map((e) => e.id)).not.toContain('epic-empty');
  });
});
