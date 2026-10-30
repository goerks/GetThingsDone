import { describe, expect, it } from 'vitest';
import { seedSnapshot } from '../data/seed';
import { LABELS_FIELD_ID, planSync, type ExternalItem } from './sync';
import type { ExternalFields, Member, Sprint, Story } from './types';

/*
 * What the engine does with sprints and assignees of a service that has them (#66, AC7.3 and AC7.5): they are compared by name,
 * a sprint of the service is made as a planned sprint, and an assignee nobody of the team has is reported and never published back.
 */

const seed = seedSnapshot('2026-10-12');
const members: Member[] = [{ id: 'm-anna', name: 'Anna Meier', initials: 'AM' }];
const item = (extra: Partial<ExternalFields> = {}): ExternalItem => ({
  id: 'PROJ-1',
  key: 'PROJ-1',
  url: 'https://x.atlassian.net/browse/PROJ-1',
  state: 'open',
  fields: { title: 'Login', description: '', labels: [], criteria: [], done: false, points: 0, sprint: null, assignee: null, ...extra }
});
let counter = 0;
const plan = (items: ExternalItem[], stories: Story[] = [], sprints: Sprint[] = []) =>
  planSync({
    service: 'jira',
    compared: ['title', 'description', 'labels', 'criteria', 'done', 'points', 'sprint', 'assignee'],
    stories,
    fields: seed.fields,
    assignments: seed.assignments,
    statuses: seed.statuses,
    items,
    newId: () => `id-${(counter += 1)}`,
    sprints,
    members,
    externalSprints: [{ id: '14', name: 'Sprint 14', goal: '', startDate: '2026-11-02', endDate: '2026-11-15', state: 'running' }]
  });

describe('sprints and assignees of a service', () => {
  it('AC7.3 makes a planned sprint from the sprint of the service and puts the new story into it', () => {
    const result = plan([item({ sprint: 'Sprint 14' })]);
    expect(result.sprints).toHaveLength(1);
    expect(result.sprints[0]).toMatchObject({ name: 'Sprint 14', startDate: '2026-11-02', endDate: '2026-11-15', state: 'planned' });
    expect(result.stories[0].sprintId).toBe(result.sprints[0].id);
    expect(result.summary.sprintsCreated).toEqual(['Sprint 14']);
  });

  it('AC7.3 uses the sprint of the same name that exists here', () => {
    const sprint: Sprint = { id: 's-14', name: 'sprint 14', startDate: '2026-11-02', endDate: '2026-11-15', state: 'running', startItems: [], result: null };
    const result = plan([item({ sprint: 'Sprint 14' })], [], [sprint]);
    expect(result.sprints).toHaveLength(1);
    expect(result.stories[0].sprintId).toBe('s-14');
  });

  it('AC7.5 assigns the member of the team with the name of the assignee', () => {
    const result = plan([item({ assignee: 'Anna Meier' })]);
    expect(result.stories[0].assigneeId).toBe('m-anna');
    expect(result.summary.unmatchedAssignees ?? []).toEqual([]);
  });

  it('AC7.5 reports an assignee nobody of the team has, leaves the story as it is and does not publish it back', () => {
    const first = plan([item({ assignee: 'Tom Keller' })]);
    expect(first.stories[0].assigneeId ?? null).toBeNull();
    expect(first.summary.unmatchedAssignees).toEqual(['Tom Keller']);
    // And a second run with writing on has nothing to publish
    const second = planSync({ ...{ service: 'jira' as const, compared: ['assignee' as const], fields: seed.fields, assignments: seed.assignments, statuses: seed.statuses, newId: () => `id-${(counter += 1)}`, members }, stories: first.stories, items: [item({ assignee: 'Tom Keller' })], write: true });
    expect(second.pushes).toEqual([]);
    expect(second.summary.unmatchedAssignees).toEqual(['Tom Keller']);
  });

  it('AC17.1 offers the labels the service knows as choices, also when no item carries them', () => {
    const result = planSync({ service: 'jira', compared: ['title'], stories: [], fields: seed.fields, assignments: seed.assignments, statuses: seed.statuses, items: [item()], newId: () => `id-${(counter += 1)}`, externalLabels: ['mobil', 'feature'] });
    const labels = result.fields.find((field) => field.id === LABELS_FIELD_ID);
    expect(labels?.options.map((option) => option.label)).toEqual(['mobil', 'feature']);
  });
});
