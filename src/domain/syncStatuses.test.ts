import { describe, expect, it } from 'vitest';
import { DEFAULT_STATUSES } from './statuses';
import { statusesFromService, type ServiceStatus } from './syncStatuses';
import type { Story } from './types';

const story = (id: string, status: string): Story => ({ id, code: id, title: id, description: '', epicId: null, points: 0, status, sprintId: null, releaseId: null, rank: 1, criteria: [], values: {}, checks: {}, doneItems: null });
const workflow: ServiceStatus[] = [
  { name: 'To Do', category: 'new' },
  { name: 'In Progress', category: 'indeterminate' },
  { name: 'In Review', category: 'indeterminate' },
  { name: 'Done', category: 'done' }
];
let counter = 0;
const newId = (): string => `new-${(counter += 1)}`;

describe('the columns of the board from a service', () => {
  it('AC13.1 takes names, categories and order from the service and keeps the ids of the columns it can reuse', () => {
    // Given the default columns, a column of our own and a story in each
    const local = [...DEFAULT_STATUSES.map((status) => ({ ...status })), { id: 'blocked', label: 'Blocked', category: 'in_progress' as const }];
    const stories = [story('a', 'todo'), story('b', 'blocked'), story('c', 'done')];
    // When the service names its four statuses
    const result = statusesFromService(local, stories, workflow, newId);
    // Then the board has exactly these columns in this order, and the ids of the default columns stay
    expect(result.statuses.map((status) => status.label)).toEqual(['To Do', 'In Progress', 'In Review', 'Done']);
    expect(result.statuses.map((status) => status.id)).toEqual(['todo', 'in_progress', 'review', 'done']);
    // And the story of the column that is gone is in the first column of its category
    expect(result.stories.find((item) => item.id === 'b')?.status).toBe('in_progress');
    expect(result.changed).toBe(true);
  });

  it('AC13.2 adds a column for a new status of the service at its place, and a second run changes nothing', () => {
    const first = statusesFromService(DEFAULT_STATUSES, [], workflow, newId);
    const next = [...workflow.slice(0, 3), { name: 'Testing', category: 'indeterminate' as const }, ...workflow.slice(3)];
    const result = statusesFromService(first.statuses, [story('a', 'review')], next, newId);
    expect(result.statuses.map((status) => status.label)).toEqual(['To Do', 'In Progress', 'In Review', 'Testing', 'Done']);
    expect(result.stories[0].status).toBe('review');
    expect(statusesFromService(result.statuses, result.stories, next, newId).changed).toBe(false);
  });

  it('AC13.1 changes nothing when the service names no status', () => {
    expect(statusesFromService(DEFAULT_STATUSES, [], [], newId).changed).toBe(false);
  });
});
