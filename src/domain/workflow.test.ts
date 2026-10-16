import { describe, expect, it } from 'vitest';
import { parseBackup, serializeBackup } from './backup';
import { seedSnapshot } from '../data/seed';
import { DEFAULT_STATUSES } from './statuses';
import { WORKFLOW_END, type StatusValue, type Workflow } from './types';
import {
  DEFAULT_WORKFLOW,
  allowedTargets,
  canBeFree,
  canDelete,
  canMove,
  canStartIn,
  canSwitchOffStart,
  hasExceptions,
  leadsToEnd,
  newStoryStatus,
  currentVersionId,
  nameVersion,
  normalizeWorkflow,
  recordVersion,
  restoreVersion,
  versionsNewestFirst,
  pruneWorkflow,
  setEnabled,
  setFree,
  setStart,
  setTransition,
  startStatuses
} from './workflow';

/** Demo statuses: todo (Not started), in_progress and review (In progress), done (Done). */
const statuses: StatusValue[] = DEFAULT_STATUSES.map((status) => ({ ...status }));
/** Two statuses in "Not started" for the start rules. */
const withReady: StatusValue[] = [statuses[0], { id: 'ready', label: 'Ready', category: 'not_started' }, ...statuses.slice(1)];
const on: Workflow = setEnabled(DEFAULT_WORKFLOW, true);

describe('workflow (#49)', () => {
  it('AC1.1 allows every transition by default, with the workflow on or off', () => {
    // Given the default workflow, off, and the same workflow switched on without any change
    // When a story moves from "To do" straight to "Done" and back
    // Then both are allowed
    for (const workflow of [DEFAULT_WORKFLOW, on]) {
      expect(canMove(workflow, 'todo', 'done')).toBe(true);
      expect(canMove(workflow, 'done', 'todo')).toBe(true);
      expect(canDelete(workflow, 'review')).toBe(true);
    }
  });

  it('AC1.2 forbids one transition and keeps the opposite direction and the other transitions allowed', () => {
    // Given the workflow is on and "To do" → "Done" is forbidden
    const workflow = setTransition(on, 'todo', 'done', false);
    // Then that one transition is forbidden, and the others are not
    expect(canMove(workflow, 'todo', 'done')).toBe(false);
    expect(canMove(workflow, 'done', 'todo')).toBe(true);
    expect(canMove(workflow, 'todo', 'in_progress')).toBe(true);
    expect(allowedTargets(workflow, statuses, 'todo').map((status) => status.id)).toEqual(['in_progress', 'review']);
    // And allowing it again restores the default
    expect(setTransition(workflow, 'todo', 'done', true).story.blocked).toEqual({});
  });

  it('AC1.2 forbids nothing while the workflow is off, and staying in the same status is always allowed', () => {
    // Given a forbidden transition that is saved but the workflow is off
    const workflow = { ...setTransition(on, 'todo', 'done', false), enabled: false };
    expect(canMove(workflow, 'todo', 'done')).toBe(true);
    expect(canMove(setTransition(on, 'todo', 'done', false), 'todo', 'todo')).toBe(true);
  });

  it('AC1.3 starts a new story in the allowed start status, in board order', () => {
    // Given "Not started" has two statuses, "To do" and "Ready"
    // When the start is only "Ready"
    const workflow = setStart(setStart(on, withReady, 'ready', true), withReady, 'todo', false);
    // Then new stories start in "Ready"
    expect(startStatuses(workflow, withReady)).toEqual(['ready']);
    expect(newStoryStatus(workflow, withReady)).toBe('ready');
    expect(canStartIn(workflow, withReady, 'todo')).toBe(false);
    // And by default the first status of "Not started" is the start
    expect(startStatuses(on, withReady)).toEqual(['todo']);
    // And both allowed: the first in board order wins
    expect(newStoryStatus(setStart(on, withReady, 'ready', true), withReady)).toBe('todo');
  });

  it('AC1.4 keeps the last start status on and refuses a start outside "Not started"', () => {
    // Given only "To do" is a start
    // When it is switched off
    const refused = setStart(on, statuses, 'todo', false);
    // Then nothing changes
    expect(refused).toBe(on);
    expect(canSwitchOffStart(on, statuses, 'todo')).toBe(false);
    expect(setStart(on, statuses, 'review', true)).toBe(on);
    // And with two starts one can go
    const two = setStart(on, withReady, 'ready', true);
    expect(canSwitchOffStart(two, withReady, 'todo')).toBe(true);
  });

  it('AC4.1 forbids deleting from a status without a way to the end', () => {
    // Given the end is forbidden for "Done"
    const workflow = setTransition(on, 'done', WORKFLOW_END, false);
    // Then a story in "Done" cannot be deleted, a story in "To do" can
    expect(canDelete(workflow, 'done')).toBe(false);
    expect(canDelete(workflow, 'todo')).toBe(true);
    expect(canMove(workflow, 'done', WORKFLOW_END)).toBe(false);
  });

  it('AC4.2 notices that no status leads to the end', () => {
    // Given the end is forbidden everywhere
    const none = statuses.reduce((workflow, status) => setTransition(workflow, status.id, WORKFLOW_END, false), on);
    // Then the settings warn; with one way left they do not
    expect(leadsToEnd(none, statuses)).toBe(false);
    expect(leadsToEnd(setTransition(none, 'todo', WORKFLOW_END, true), statuses)).toBe(true);
  });

  it('AC5.1 leaves a story in a status that is no longer reachable, and lets it leave along an allowed transition', () => {
    // Given every transition into "Review" is forbidden and the only way out of it is "In progress"
    let workflow = on;
    for (const from of ['todo', 'in_progress', 'done']) workflow = setTransition(workflow, from, 'review', false);
    for (const to of ['todo', 'done', WORKFLOW_END]) workflow = setTransition(workflow, 'review', to, false);
    // Then nobody can enter "Review", and a story in it can still go to "In progress"
    expect(canMove(workflow, 'todo', 'review')).toBe(false);
    expect(allowedTargets(workflow, statuses, 'review').map((status) => status.id)).toEqual(['in_progress']);
  });

  it('AC6.1 removes the transitions of a removed status', () => {
    // Given transitions to and from "Review" are forbidden
    const workflow = setTransition(setTransition(on, 'todo', 'review', false), 'review', 'done', false);
    // When "Review" is removed
    const pruned = pruneWorkflow(workflow, statuses.filter((status) => status.id !== 'review'));
    // Then nothing refers to it any more
    expect(pruned.story.blocked).toEqual({});
    // And a workflow that refers to nothing gone is returned as it is
    expect(pruneWorkflow(on, statuses)).toBe(on);
  });

  it('AC6.2 allows every transition from and to a new status', () => {
    // Given a workflow with restrictions and a new status "Test"
    const workflow = setTransition(on, 'todo', 'done', false);
    const next: StatusValue[] = [...statuses.slice(0, 3), { id: 'test', label: 'Test', category: 'in_progress' }, statuses[3]];
    // Then every transition from and to "Test" is allowed
    expect(next.filter((status) => status.id !== 'test').every((status) => canMove(workflow, status.id, 'test') && canMove(workflow, 'test', status.id))).toBe(true);
    expect(canDelete(workflow, 'test')).toBe(true);
  });

  it('AC7.1 stays the same after saving, loading and a backup', () => {
    // Given a snapshot with a workflow that forbids "To do" → "Done"
    const seed = seedSnapshot('2026-10-13');
    const workflow = setTransition(on, 'todo', 'done', false);
    const snapshot = { ...seed, settings: { ...seed.settings, workflow } };
    // When it is exported and read again
    const parsed = parseBackup(serializeBackup(snapshot, '2026-10-13T10:00:00Z'), '2026-10-13');
    // Then the workflow is the same
    expect(parsed.ok && parsed.snapshot.settings.workflow).toEqual(workflow);
    // And data of an earlier version gets the default workflow, off
    expect(normalizeWorkflow(undefined)).toEqual(DEFAULT_WORKFLOW);
    expect(normalizeWorkflow(JSON.parse(JSON.stringify(workflow)))).toEqual(workflow);
  });

  it('AC9.1 turns a category free: every transition inside it is allowed, the others stay as they are', () => {
    // Given the transitions between "In progress" and "Review" and "To do" → "Done" are forbidden and the switch is off
    let workflow = setFree(on, statuses, 'in_progress', false);
    workflow = setTransition(setTransition(setTransition(workflow, 'in_progress', 'review', false), 'review', 'in_progress', false), 'todo', 'done', false);
    // When the switch of "In progress" is turned on
    workflow = setFree(workflow, statuses, 'in_progress', true);
    // Then both directions inside the category are allowed, and "To do" → "Done" is still forbidden
    expect(canMove(workflow, 'in_progress', 'review')).toBe(true);
    expect(canMove(workflow, 'review', 'in_progress')).toBe(true);
    expect(canMove(workflow, 'todo', 'done')).toBe(false);
    expect(workflow.story.free.in_progress).toBe(true);
  });

  it('AC9.2 keeps an exception made after the switch and reports it', () => {
    // Given the switch of "In progress" is on
    // When "Review" → "In progress" is forbidden
    const workflow = setTransition(setFree(on, statuses, 'in_progress', true), 'review', 'in_progress', false);
    // Then the transition stays forbidden, the switch stays on and the category has an exception
    expect(canMove(workflow, 'review', 'in_progress')).toBe(false);
    expect(workflow.story.free.in_progress).toBe(true);
    expect(hasExceptions(workflow, statuses, 'in_progress')).toBe(true);
    expect(hasExceptions(on, statuses, 'in_progress')).toBe(false);
  });

  it('AC9.3 keeps the transitions when the switch is turned off', () => {
    // Given the switch of "In progress" is on and all transitions inside are allowed
    const free = setFree(on, statuses, 'in_progress', true);
    // When it is turned off
    const off = setFree(free, statuses, 'in_progress', false);
    // Then all of them stay allowed, only the switch changes
    expect(canMove(off, 'in_progress', 'review')).toBe(true);
    expect(canMove(off, 'review', 'in_progress')).toBe(true);
    expect(off.story.free.in_progress).toBe(false);
    expect(off.story.blocked).toEqual(free.story.blocked);
    expect(hasExceptions(off, statuses, 'in_progress')).toBe(false);
  });

  it('AC9.4 offers the switch only for a category with two or more statuses', () => {
    // Given the demo statuses: "In progress" has two, "Done" has one
    expect(canBeFree(statuses, 'in_progress')).toBe(true);
    expect(canBeFree(statuses, 'done')).toBe(false);
    expect(canBeFree(statuses, 'not_started')).toBe(false);
  });

  it('AC11.1 is off by default', () => {
    // Given no stored workflow
    // Then it is off, with the first status as start and nothing forbidden
    expect(normalizeWorkflow(null).enabled).toBe(false);
    expect(DEFAULT_WORKFLOW.enabled).toBe(false);
    expect(startStatuses(DEFAULT_WORKFLOW, withReady)).toEqual(['todo']);
  });

  it('AC11.5 ignores a saved start and a saved end rule while the workflow is off', () => {
    // Given a saved start in "Ready" and a forbidden end in "Done", but the workflow is off
    const saved = { ...setTransition(setStart(on, withReady, 'ready', true), 'done', WORKFLOW_END, false), enabled: false };
    // Then new stories start as before and a story in "Done" can be deleted
    expect(newStoryStatus(saved, withReady)).toBe('todo');
    expect(canDelete(saved, 'done')).toBe(true);
    // And switching it on again brings the rules back
    const again = setEnabled(saved, true);
    expect(canDelete(again, 'done')).toBe(false);
  });

  it('AC11.4 keeps what was set while it is switched off and on', () => {
    // Given a forbidden transition
    const workflow = setTransition(on, 'todo', 'done', false);
    // When the workflow is switched off and on again
    const back = setEnabled(setEnabled(workflow, false), true);
    // Then the transition is still forbidden
    expect(canMove(back, 'todo', 'done')).toBe(false);
  });

  it('AC10.1 stores the workflow per item type: only stories have one, and unknown stored parts are dropped', () => {
    // Given stored data with junk
    const workflow = normalizeWorkflow({ enabled: true, story: { blocked: { todo: ['done', 5, 'todo'], x: [] }, start: [], free: { done: false } }, epic: { blocked: { a: ['b'] } } });
    // Then only the story part is kept, cleaned
    expect(Object.keys(workflow)).toEqual(['enabled', 'versions', 'story']);
    expect(workflow.story.blocked).toEqual({ todo: ['done'] });
    expect(workflow.story.start).toBeNull();
    expect(workflow.story.free).toEqual({ not_started: true, in_progress: true, done: false });
  });

  /** Ids v1, v2, … and a fixed time per call, so the versions are easy to tell apart. */
  const ids = (): (() => string) => {
    let n = 0;
    return () => `v${++n}`;
  };

  it('AC12.1 adds a version with every change, and none for switching on or off', () => {
    // Given the workflow is on and has no version yet
    const newId = ids();
    // When a transition is forbidden
    const changed = recordVersion(on, setTransition(on, 'todo', 'done', false), '2026-10-16T10:00:00Z', newId);
    // Then the state before and the new state are versions, the newest one is current
    expect(changed.versions.map((version) => version.at)).toEqual(['2026-10-16T10:00:00Z', '2026-10-16T10:00:00Z']);
    expect(changed.versions[0].story.blocked).toEqual({});
    expect(versionsNewestFirst(changed)[0].story.blocked).toEqual({ todo: ['done'] });
    expect(currentVersionId(changed)).toBe(changed.versions[1].id);
    // And switching the workflow off creates no version
    expect(recordVersion(changed, setEnabled(changed, false), '2026-10-16T11:00:00Z', newId).versions).toHaveLength(2);
    // And the next change adds exactly one
    expect(recordVersion(changed, setTransition(changed, 'done', 'todo', false), '2026-10-16T12:00:00Z', newId).versions).toHaveLength(3);
  });

  it('AC12.2 names a version, trims the name and removes it when empty', () => {
    // Given two versions
    const base = recordVersion(on, setTransition(on, 'todo', 'done', false), '2026-10-16T10:00:00Z', ids());
    const top = base.versions[1].id;
    // When the newest one is named
    const named = nameVersion(base, top, '  Vor dem Umbau ');
    // Then it has the trimmed name and no version was added
    expect(named.versions[1].name).toBe('Vor dem Umbau');
    expect(named.versions).toHaveLength(2);
    // And an empty name removes it
    expect(nameVersion(named, top, ' ').versions[1].name).toBeUndefined();
  });

  it('AC12.3 goes back to an old version as a new current one without losing any', () => {
    // Given a working workflow, then a broken one (everything from "To do" forbidden)
    const newId = ids();
    const good = recordVersion(on, setTransition(on, 'todo', 'done', false), '2026-10-16T10:00:00Z', newId);
    const broken = recordVersion(good, setTransition(setTransition(good, 'todo', 'in_progress', false), 'todo', 'review', false), '2026-10-16T11:00:00Z', newId);
    const goodId = good.versions[1].id;
    const brokenId = broken.versions[broken.versions.length - 1].id;
    // When I go back to the working version
    const restored = restoreVersion(broken, goodId, '2026-10-16T12:00:00Z', newId);
    // Then the transitions are those of the working version, it is a new version, and the broken one is still there
    expect(restored.story.blocked).toEqual({ todo: ['done'] });
    expect(restored.versions).toHaveLength(broken.versions.length + 1);
    expect(restored.versions.some((version) => version.id === brokenId)).toBe(true);
  });

  it('AC12.4 goes back and forth between versions without losing any', () => {
    // Given a working and a broken version and a return to the working one
    const newId = ids();
    const good = recordVersion(on, setTransition(on, 'todo', 'done', false), '2026-10-16T10:00:00Z', newId);
    const broken = recordVersion(good, setTransition(good, 'todo', 'in_progress', false), '2026-10-16T11:00:00Z', newId);
    const brokenId = broken.versions[broken.versions.length - 1].id;
    const restored = restoreVersion(broken, good.versions[1].id, '2026-10-16T12:00:00Z', newId);
    // When I go back to the broken one
    const again = restoreVersion(restored, brokenId, '2026-10-16T13:00:00Z', newId);
    // Then it works, every earlier version is still there, and an unknown version changes nothing
    expect(again.story.blocked).toEqual(broken.story.blocked);
    expect(again.versions).toHaveLength(restored.versions.length + 1);
    expect(restoreVersion(again, 'nope', '2026-10-16T14:00:00Z', newId)).toBe(again);
  });

  it('AC12.5 keeps the versions with their names in a backup', () => {
    // Given a workflow with a named version
    const base = recordVersion(on, setTransition(on, 'todo', 'done', false), '2026-10-16T10:00:00Z', ids());
    const workflow = nameVersion(base, base.versions[1].id, 'Vor dem Umbau');
    // When it is exported and read again
    const snapshot = seedSnapshot('2026-10-16');
    const parsed = parseBackup(serializeBackup({ ...snapshot, settings: { ...snapshot.settings, workflow } }, '2026-10-16T10:00:00Z'), '2026-10-16');
    // Then every version is there with its name
    expect(parsed.ok && parsed.snapshot.settings.workflow.versions).toEqual(workflow.versions);
  });
});
