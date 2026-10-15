import { describe, expect, it } from 'vitest';
import {
  addGroup,
  addItem,
  evaluate,
  gatesCrossed,
  gatesToAsk,
  itemState,
  moveRow,
  normalizeDefinitions,
  notDone,
  notReady,
  pruneChecks,
  removeGroup,
  removeItem,
  renameGroup,
  setCheck,
  setEnforce,
  stepRow,
  updateItem,
  withDoneSnapshots,
  EMPTY_DEFINITIONS
} from './definitions';
import { DEFAULT_STATUSES, isDoneIn } from './statuses';
import type { DefinitionItem, DefinitionList, Definitions, Story } from './types';

const isDone = isDoneIn(DEFAULT_STATUSES);

function story(overrides: Partial<Story> = {}): Story {
  return {
    id: 's8',
    code: 'S-8',
    title: 'Reset password',
    description: 'Users request a link.',
    epicId: 'e1',
    points: 3,
    status: 'todo',
    sprintId: null,
    releaseId: null,
    rank: 0,
    criteria: [{ id: 'c1', text: 'Mail arrives', done: true }],
    values: {},
    checks: {},
    doneItems: null,
    ...overrides
  };
}

const manual = (id: string, text: string, mayBeIrrelevant = false): DefinitionItem => ({ id, text, rule: null, mayBeIrrelevant });
const auto = (id: string, rule: NonNullable<DefinitionItem['rule']>): DefinitionItem => ({ id, text: '', rule, mayBeIrrelevant: false });

const ready: DefinitionList = {
  enforce: true,
  groups: [
    { id: 'g-fach', name: 'Functional', items: [auto('r-desc', 'hasDescription'), auto('r-crit', 'hasCriteria')] },
    { id: 'g-tech', name: 'Technical', items: [manual('r-dep', 'Dependencies are clarified')] },
    { id: 'g-design', name: 'Design', items: [manual('r-design', 'Design is available', true), manual('r-texts', 'Texts are agreed', true)] }
  ]
};
const done: DefinitionList = {
  enforce: true,
  groups: [{ id: 'g-q', name: 'Quality', items: [auto('d-acc', 'allCriteriaAccepted'), manual('d-review', 'Code is reviewed')] }]
};
const definitions: Definitions = { ready, done };

describe('items and their states', () => {
  it('AC2.1 an item is open until it is checked or set to not relevant', () => {
    // Given a manual item that allows "not relevant"
    const item = manual('r-design', 'Design is available', true);
    // When the story has no entry, "checked" or "na"
    // Then the item is open, checked or not relevant
    expect(itemState(item, story())).toBe('open');
    expect(itemState(item, story({ checks: { 'r-design': 'checked' } }))).toBe('checked');
    expect(itemState(item, story({ checks: { 'r-design': 'na' } }))).toBe('na');
  });

  it('AC2.3 an automatic item shows its own state', () => {
    // Given the item "All criteria accepted" and a story with one accepted and one open criterion
    const item = auto('d-acc', 'allCriteriaAccepted');
    const open = story({ criteria: [{ id: 'c1', text: 'a', done: true }, { id: 'c2', text: 'b', done: false }] });
    expect(itemState(item, open)).toBe('open');
    // When the second criterion is accepted
    const accepted = story({ criteria: open.criteria.map((criterion) => ({ ...criterion, done: true })) });
    // Then the item is checked, and a story without criteria never meets it
    expect(itemState(item, accepted)).toBe('checked');
    expect(itemState(item, story({ criteria: [] }))).toBe('open');
  });

  it('AC2.3 every automatic check looks at the story', () => {
    expect(itemState(auto('x', 'hasDescription'), story({ description: '  ' }))).toBe('open');
    expect(itemState(auto('x', 'hasCriteria'), story({ criteria: [] }))).toBe('open');
    expect(itemState(auto('x', 'hasPoints'), story({ points: 0 }))).toBe('open');
    expect(itemState(auto('x', 'hasPoints'), story())).toBe('checked');
    expect(itemState(auto('x', 'hasEpic'), story({ epicId: null }))).toBe('open');
    expect(itemState(auto('x', 'inSprint'), story({ sprintId: 'sprint-1' }))).toBe('checked');
  });

  it('AC2.3 an automatic item can be set to not relevant, and a set "not relevant" stays when the item stops allowing it', () => {
    const item = { ...auto('d-acc', 'allCriteriaAccepted'), mayBeIrrelevant: false };
    expect(itemState(item, story({ checks: { 'd-acc': 'na' } }))).toBe('na');
  });
});

describe('evaluate', () => {
  it('AC2.4 not relevant counts as met', () => {
    // Given the Ready list with 5 items: 2 automatic (met), 2 manual checked, 1 manual open that may be irrelevant
    const checked = story({ checks: { 'r-dep': 'checked', 'r-design': 'checked' } });
    expect(evaluate(ready, checked)).toMatchObject({ total: 5, checked: 4, na: 0, open: 1, met: false });
    // When the open item is set to not relevant
    const result = evaluate(ready, story({ checks: { 'r-dep': 'checked', 'r-design': 'checked', 'r-texts': 'na' } }));
    // Then the counter reads 4 of 5 with 1 not relevant and nothing is open
    expect(result).toMatchObject({ total: 5, checked: 4, na: 1, open: 0, met: true });
  });

  it('AC3.1 groups carry their own counters', () => {
    const result = evaluate(ready, story({ checks: { 'r-design': 'na' } }));
    expect(result.groups.map((group) => [group.group.name, group.checked, group.items.length, group.na])).toEqual([
      ['Functional', 2, 2, 0],
      ['Technical', 0, 1, 0],
      ['Design', 0, 2, 1]
    ]);
  });

  it('AC5.4 only the items of a snapshot count', () => {
    const result = evaluate(done, story(), new Set(['d-review']));
    expect(result.total).toBe(1);
    expect(result.groups[0].items.map((entry) => entry.item.id)).toEqual(['d-review']);
  });
});

describe('gates', () => {
  it('AC4.1 leaving "not started" crosses the Ready list and entering "done" the Done list', () => {
    expect(gatesCrossed(DEFAULT_STATUSES, 'todo', 'in_progress')).toEqual(['ready']);
    expect(gatesCrossed(DEFAULT_STATUSES, 'review', 'done')).toEqual(['done']);
  });

  it('AC4.6 from "not started" straight to "done" crosses both lists, in order', () => {
    expect(gatesCrossed(DEFAULT_STATUSES, 'todo', 'done')).toEqual(['ready', 'done']);
  });

  it('AC4.7 inside a category and backwards nothing is crossed', () => {
    expect(gatesCrossed(DEFAULT_STATUSES, 'in_progress', 'review')).toEqual([]);
    expect(gatesCrossed(DEFAULT_STATUSES, 'done', 'in_progress')).toEqual([]);
    expect(gatesCrossed(DEFAULT_STATUSES, 'in_progress', 'todo')).toEqual([]);
    expect(gatesCrossed(DEFAULT_STATUSES, 'todo', 'todo')).toEqual([]);
    expect(gatesCrossed(DEFAULT_STATUSES, 'todo', 'gone')).toEqual([]);
  });

  it('AC4.1 asks only for the lists that are crossed and not met', () => {
    expect(gatesToAsk(definitions, DEFAULT_STATUSES, story(), 'in_progress')).toEqual(['ready']);
    expect(gatesToAsk(definitions, DEFAULT_STATUSES, story({ status: 'review' }), 'done')).toEqual(['done']);
  });

  it('AC4.8 asks nothing when the list is met', () => {
    const met = story({ checks: { 'r-dep': 'checked', 'r-design': 'na', 'r-texts': 'na' } });
    expect(gatesToAsk(definitions, DEFAULT_STATUSES, met, 'in_progress')).toEqual([]);
  });

  it('AC1.5 and AC5.5 asks nothing when the list is switched off or empty', () => {
    const off: Definitions = { ready: setEnforce(ready, false), done: setEnforce(done, false) };
    expect(gatesToAsk(off, DEFAULT_STATUSES, story(), 'done')).toEqual([]);
    expect(gatesToAsk(EMPTY_DEFINITIONS, DEFAULT_STATUSES, story(), 'done')).toEqual([]);
  });
});

describe('Done snapshots', () => {
  it('AC5.4 a story that becomes done remembers the Done items of that moment', () => {
    const before = [story({ status: 'review' })];
    const after = withDoneSnapshots(before, [{ ...before[0], status: 'done' }], isDone, isDone, definitions);
    expect(after[0].doneItems).toEqual(['d-acc', 'd-review']);
  });

  it('AC5.4 a story that was done before keeps its snapshot, also when the list changes later', () => {
    const before = [story({ status: 'done', doneItems: [] })];
    const changed = [{ ...before[0], title: 'x' }];
    expect(withDoneSnapshots(before, changed, isDone, isDone, definitions)).toBe(changed);
    expect(notDone(definitions, before[0], true)).toBeNull();
  });

  it('AC5.4 leaving "done" forgets the snapshot, entering again takes a new one', () => {
    const before = [story({ status: 'done', doneItems: ['d-review'] })];
    const back = withDoneSnapshots(before, [{ ...before[0], status: 'in_progress' }], isDone, isDone, definitions);
    expect(back[0].doneItems).toBeNull();
    const again = withDoneSnapshots(back, [{ ...back[0], status: 'done' }], isDone, isDone, definitions);
    expect(again[0].doneItems).toEqual(['d-acc', 'd-review']);
  });

  it('AC1.5 a switched off list gives an empty snapshot, so the story is never marked', () => {
    const before = [story({ status: 'review' })];
    const off: Definitions = { ready, done: setEnforce(done, false) };
    const after = withDoneSnapshots(before, [{ ...before[0], status: 'done' }], isDone, isDone, off);
    expect(after[0].doneItems).toEqual([]);
  });
});

describe('marks', () => {
  it('AC5.1 a story that is not done and not ready is marked with its counter', () => {
    const result = notReady(definitions, story({ checks: { 'r-dep': 'checked' } }), false);
    expect(result).toMatchObject({ checked: 3, total: 5, open: 2 });
  });

  it('AC5.1 a done story is never marked "not ready"', () => {
    expect(notReady(definitions, story(), true)).toBeNull();
  });

  it('AC5.2 a story that meets the list is not marked', () => {
    const met = story({ checks: { 'r-dep': 'checked', 'r-design': 'checked', 'r-texts': 'checked' } });
    expect(notReady(definitions, met, false)).toBeNull();
  });

  it('AC5.3 a done story is marked by the Done list of its snapshot', () => {
    const marked = story({ status: 'done', doneItems: ['d-acc', 'd-review'] });
    expect(notDone(definitions, marked, true)).toMatchObject({ checked: 1, total: 2 });
    expect(notDone(definitions, marked, false)).toBeNull();
  });

  it('AC5.5 empty lists mark nothing', () => {
    expect(notReady(EMPTY_DEFINITIONS, story(), false)).toBeNull();
    expect(notDone(EMPTY_DEFINITIONS, story({ status: 'done', doneItems: [] }), true)).toBeNull();
  });
});

describe('checks of a story', () => {
  it('AC2.1 sets, changes and clears the state of an item', () => {
    const stories = [story()];
    const checked = setCheck(stories, 's8', 'r-dep', 'checked');
    expect(checked[0].checks).toEqual({ 'r-dep': 'checked' });
    expect(setCheck(checked, 's8', 'r-dep', 'na')[0].checks).toEqual({ 'r-dep': 'na' });
    expect(setCheck(checked, 's8', 'r-dep', null)[0].checks).toEqual({});
    expect(stories[0].checks).toEqual({});
  });

  it('removing an item drops the states of its stories', () => {
    const stories = [story({ checks: { 'r-dep': 'checked', gone: 'checked' } })];
    const pruned = pruneChecks(stories, definitions);
    expect(pruned[0].checks).toEqual({ 'r-dep': 'checked' });
    expect(pruneChecks(pruned, definitions)).toBe(pruned);
  });
});

describe('editing the lists', () => {
  it('AC1.1 adds a group and a manual item into it', () => {
    const list = addItem(addGroup({ enforce: true, groups: [] }, 'g1', ' Technical '), 'g1', manual('i1', ' Dependencies clarified '), 'unused');
    expect(list.groups).toEqual([{ id: 'g1', name: 'Technical', items: [{ id: 'i1', text: 'Dependencies clarified', rule: null, mayBeIrrelevant: false }] }]);
  });

  it('AC1.1 the first item of an empty list creates a general group, an empty text adds nothing', () => {
    const empty: DefinitionList = { enforce: true, groups: [] };
    expect(addItem(empty, null, manual('i1', '  '), 'g1')).toBe(empty);
    expect(addItem(empty, null, manual('i1', 'Review'), 'g1').groups).toEqual([{ id: 'g1', name: '', items: [manual('i1', 'Review')] }]);
  });

  it('AC1.2 an automatic item takes no text', () => {
    const list = addItem(ready, 'g-tech', { ...auto('i9', 'hasPoints'), text: 'ignored' }, 'unused');
    expect(list.groups[1].items.at(-1)).toEqual(auto('i9', 'hasPoints'));
  });

  it('AC1.3 renames and removes a group and an item', () => {
    expect(renameGroup(ready, 'g-tech', 'Technisch').groups[1].name).toBe('Technisch');
    expect(removeGroup(ready, 'g-tech').groups.map((group) => group.id)).toEqual(['g-fach', 'g-design']);
    expect(removeItem(ready, 'r-dep').groups[1].items).toEqual([]);
    expect(updateItem(ready, 'r-dep', { text: ' Clear ' }).groups[1].items[0].text).toBe('Clear');
    expect(updateItem(ready, 'r-dep', { text: '  ' }).groups[1].items[0].text).toBe('Dependencies are clarified');
    expect(updateItem(ready, 'r-desc', { text: 'new' }).groups[0].items[0].text).toBe('');
  });

  it('AC1.4 sets "may be irrelevant" per item', () => {
    expect(updateItem(ready, 'r-dep', { mayBeIrrelevant: true }).groups[1].items[0].mayBeIrrelevant).toBe(true);
  });

  it('AC1.3 drags a group over another one, with its items', () => {
    const moved = moveRow(ready, 'g-tech', 'g-fach');
    expect(moved.groups.map((group) => group.id)).toEqual(['g-tech', 'g-fach', 'g-design']);
    expect(moved.groups[1].items.map((item) => item.id)).toEqual(['r-desc', 'r-crit']);
  });

  it('AC1.3 drags an item into another group', () => {
    const moved = moveRow(ready, 'r-dep', 'r-design');
    expect(moved.groups.map((group) => group.items.map((item) => item.id))).toEqual([['r-desc', 'r-crit'], [], ['r-design', 'r-dep', 'r-texts']]);
  });

  it('AC1.3 an item dropped on the head of a block becomes its first item', () => {
    const moved = moveRow(ready, 'r-desc', 'g-design');
    expect(moved.groups.map((group) => group.items.map((item) => item.id))).toEqual([['r-crit'], ['r-dep'], ['r-desc', 'r-design', 'r-texts']]);
  });

  it('AC1.3 steps an item up over a group border and a group down', () => {
    const up = stepRow(ready, 'r-design', -1);
    expect(up.groups.map((group) => group.items.map((item) => item.id))).toEqual([['r-desc', 'r-crit'], ['r-dep', 'r-design'], ['r-texts']]);
    expect(stepRow(ready, 'g-fach', 1).groups.map((group) => group.id)).toEqual(['g-tech', 'g-fach', 'g-design']);
    expect(stepRow(ready, 'g-fach', -1)).toBe(ready);
    expect(stepRow(ready, 'r-texts', 1)).toBe(ready);
  });

  it('AC1.5 switches a list on and off', () => {
    expect(setEnforce(ready, false).enforce).toBe(false);
  });
});

describe('stored data', () => {
  it('AC5.5 missing or broken data gives empty lists that are off', () => {
    expect(normalizeDefinitions(undefined)).toEqual(EMPTY_DEFINITIONS);
    expect(normalizeDefinitions({ ready: 'x', done: { groups: 3 } })).toEqual(EMPTY_DEFINITIONS);
    expect(EMPTY_DEFINITIONS.ready.enforce).toBe(false);
  });

  it('AC1.5 a list is on only when it says so', () => {
    expect(normalizeDefinitions({ ready: { enforce: true, groups: [] }, done: { groups: [] } })).toEqual({ ready: { enforce: true, groups: [] }, done: { enforce: false, groups: [] } });
  });

  it('keeps valid groups and drops broken items', () => {
    const stored = {
      ready: {
        enforce: false,
        groups: [{ id: 'g', name: 'G', items: [{ id: 'a', text: 'Review', rule: null, mayBeIrrelevant: true }, { id: 'b', text: '', rule: null }, { id: 'c', rule: 'hasEpic' }, { id: 'd', text: 'x', rule: 'bogus' }] }]
      }
    };
    expect(normalizeDefinitions(stored).ready).toEqual({
      enforce: false,
      groups: [{ id: 'g', name: 'G', items: [manual('a', 'Review', true), auto('c', 'hasEpic'), manual('d', 'x')] }]
    });
  });
});
