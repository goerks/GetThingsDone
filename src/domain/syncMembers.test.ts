import { describe, expect, it } from 'vitest';
import { initialsOf, membersFromService } from './syncMembers';
import type { Member, Story } from './types';

const story = (id: string, assigneeId: string | null): Story => ({ id, code: id, title: id, description: '', epicId: null, points: 0, status: 'todo', sprintId: null, releaseId: null, rank: 1, criteria: [], values: {}, checks: {}, doneItems: null, assigneeId });
const local: Member[] = [
  { id: 'm-anna', name: 'Anna Meier', initials: 'AMe' },
  { id: 'm-max', name: 'Max Muster', initials: 'MM' }
];
let counter = 0;
const newId = (): string => `new-${(counter += 1)}`;

describe('the team from a service', () => {
  it('AC14.1 makes the people of the service the team: keeps the members it knows, adds the new ones, removes the others and their assignments', () => {
    // Given a team with Anna and Max, and stories assigned to both
    const stories = [story('a', 'm-anna'), story('b', 'm-max')];
    // When the service names Anna and Tom
    const result = membersFromService(local, stories, [{ id: 'u1', name: 'Anna Meier' }, { id: 'u2', name: 'Tom Keller' }], newId);
    // Then Anna keeps id and initials, Tom is new with his initials, Max is gone and his story is not assigned any more
    expect(result.members).toEqual([local[0], { id: 'new-1', name: 'Tom Keller', initials: 'TK' }]);
    expect(result.stories.map((item) => item.assigneeId)).toEqual(['m-anna', null]);
    expect(result.changed).toBe(true);
  });

  it('AC14.1 changes nothing when the service names nobody, or nothing is different', () => {
    expect(membersFromService(local, [], [], newId).changed).toBe(false);
    expect(membersFromService(local, [], [{ id: 'u1', name: 'anna meier' }, { id: 'u2', name: 'Max Muster' }], newId).changed).toBe(false);
  });

  it('AC14.1 takes the first and the last letter of a name as initials', () => {
    expect(initialsOf('Anna Maria Meier')).toBe('AM');
    expect(initialsOf('Cher')).toBe('C');
  });
});
