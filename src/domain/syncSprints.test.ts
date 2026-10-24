import { describe, expect, it } from 'vitest';
import { planSprints, sprintFieldsOf } from './syncSprints';
import type { ExternalSprint } from './sync';
import type { Sprint, SprintFields } from './types';

const sprint = (extra: Partial<Sprint> = {}): Sprint => ({ id: 's-1', name: 'Sprint 15', startDate: '2026-11-16', endDate: '2026-11-29', state: 'planned', startItems: null, result: null, ...extra });
/** A sprint connected to sprint 15 of the service. Its base is the plain sprint, `base` changes it, `change` is what changed here since. */
const linked = (change: Partial<Sprint> = {}, base: Partial<SprintFields> = {}): Sprint => ({ ...sprint(change), link: { service: 'jira', id: '15', base: { ...sprintFieldsOf(sprint()), ...base } } });
const external = (extra: Partial<ExternalSprint> = {}): ExternalSprint => ({ id: '15', name: 'Sprint 15', goal: '', startDate: '2026-11-16', endDate: '2026-11-29', state: 'planned', ...extra });
let counter = 0;
const plan = (sprints: Sprint[], externals: ExternalSprint[], write = true, rule: 'remote' | 'local' | 'ask' = 'remote') =>
  planSprints({ service: 'jira', sprints, external: externals, write, rule, newId: () => `new-${(counter += 1)}`, today: '2026-11-02' });

describe('the sprints of a service', () => {
  it('AC15.1 makes a planned sprint for a sprint of the service, with its dates and goal, and starts it when it runs', () => {
    const result = plan([], [external({ id: '14', name: 'Sprint 14', goal: 'Login ready', startDate: '2026-11-02', endDate: '2026-11-15', state: 'running' }), external()]);
    expect(result.sprints.map((item) => [item.name, item.state, item.goal ?? ''])).toEqual([['Sprint 14', 'planned', 'Login ready'], ['Sprint 15', 'planned', '']]);
    expect(result.actions).toEqual([{ sprintId: 'new-1', action: 'start' }]);
    expect(result.created).toEqual(['Sprint 14', 'Sprint 15']);
    expect(result.sprints[0].link).toMatchObject({ service: 'jira', id: '14' });
  });

  it('AC15.2 takes what only the service changed, and publishes what only we changed', () => {
    // Given a connected sprint, changed in the service (goal) and here (name and end date)
    const local = linked({ name: 'Sprint 15 new', endDate: '2026-12-06' });
    const result = plan([local], [external({ goal: 'New goal' })]);
    // Then the goal is taken, the name and the end date go to the service, and nothing is made twice
    expect(result.sprints).toHaveLength(1);
    expect(result.sprints[0].goal).toBe('New goal');
    expect(result.updates).toEqual([{ sprintId: 's-1', id: '15', patch: { name: 'Sprint 15 new', endDate: '2026-12-06' } }]);
    expect(result.sprints[0].link?.base).toMatchObject({ name: 'Sprint 15 new', endDate: '2026-12-06', goal: 'New goal' });
  });

  it('AC15.2 publishes nothing when writing is off', () => {
    const result = plan([linked({ name: 'Renamed' })], [external()], false);
    expect(result.updates).toEqual([]);
  });

  it('AC15.2 follows the rule when both changed the same field', () => {
    const local = linked({ name: 'Ours' });
    expect(plan([local], [external({ name: 'Theirs' })], true, 'remote').sprints[0].name).toBe('Theirs');
    const ours = plan([local], [external({ name: 'Theirs' })], true, 'local');
    expect(ours.sprints[0].name).toBe('Ours');
    expect(ours.updates[0].patch.name).toBe('Ours');
  });

  it('AC15.3 makes a sprint that exists only here in the service, also without a story, but not a completed one', () => {
    const result = plan([sprint({ id: 's-9', name: 'Sprint 16' }), sprint({ id: 's-8', name: 'Old', state: 'completed' })], []);
    expect(result.creates.map((entry) => entry.fields.name)).toEqual(['Sprint 16']);
    expect(plan([sprint({ name: 'Sprint 16' })], [], false).creates).toEqual([]);
  });

  it('AC15.4 starts a sprint here that the service started, completes one that it completed, and publishes a start and a completion made here', () => {
    expect(plan([linked()], [external({ state: 'running' })]).actions).toEqual([{ sprintId: 's-1', action: 'start' }]);
    expect(plan([linked({ state: 'running' }, { state: 'running' })], [external({ state: 'completed' })]).actions).toEqual([{ sprintId: 's-1', action: 'complete' }]);
    // And here started, in the service still planned
    const started = plan([linked({ state: 'running' })], [external()]);
    expect(started.updates).toEqual([{ sprintId: 's-1', id: '15', patch: { state: 'running', startDate: '2026-11-16', endDate: '2026-11-29' } }]);
    const completed = plan([linked({ state: 'completed' }, { state: 'running' })], [external({ state: 'running' })]);
    expect(completed.updates[0].patch.state).toBe('completed');
  });

  it('AC15.5 lets only one sprint run: the second sprint of the service stays planned and is named', () => {
    const result = plan([sprint({ id: 's-run', name: 'Sprint 14', state: 'running' })], [external({ id: '14', name: 'Sprint 14', state: 'running' }), external({ state: 'running' })]);
    expect(result.actions).toEqual([]);
    expect(result.concurrent).toEqual(['Sprint 15']);
    expect(result.sprints.find((item) => item.name === 'Sprint 15')?.state).toBe('planned');
  });

  it('AC15.7 connects a sprint with the same name instead of making a second one, and takes the service for the first link', () => {
    const result = plan([sprint({ name: 'sprint 15', goal: '' })], [external({ goal: 'Goal' })]);
    expect(result.sprints).toHaveLength(1);
    expect(result.sprints[0]).toMatchObject({ id: 's-1', goal: 'Goal', link: { id: '15' } });
    expect(result.creates).toEqual([]);
  });
});
