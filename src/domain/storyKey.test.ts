import { describe, expect, it } from 'vitest';
import { releaseEventsFor } from './history';
import { search } from './search';
import { searchStories } from './storySearch';
import { storyKey } from './storyKey';
import { DEFAULT_STATUSES, isDoneIn } from './statuses';
import type { ExternalLink, SearchSnapshot, Story } from './types';

const link: ExternalLink = { service: 'github', key: '#31', url: 'https://github.com/goerks/GetThingsDone/issues/31', state: 'open' };

function story(id: string, overrides: Partial<Story> = {}): Story {
  return { id, code: 'S-4', title: `Story ${id}`, description: '', epicId: null, points: 3, status: 'todo', sprintId: null, releaseId: null, rank: 1, criteria: [], values: {}, checks: {}, doneItems: null, ...overrides };
}

const snapshot = (stories: Story[], syncOn: boolean): SearchSnapshot => ({ epics: [], sprints: [], stories, statuses: DEFAULT_STATUSES.map((status) => ({ ...status })), fields: [], assignments: [], syncOn });

describe('the ID of a story', () => {
  it('AC12.1 is the key of the issue while the sync is on and the story is linked, else its own key', () => {
    expect(storyKey(story('a', { link }))).toBe('#31');
    expect(storyKey(story('a', { link }), true)).toBe('#31');
    expect(storyKey(story('a', { link }), false)).toBe('S-4');
    expect(storyKey(story('a'), true)).toBe('S-4');
  });

  it('AC12.3 finds a linked story by the issue key and by its own key', () => {
    const stories = [story('a', { link })];
    expect(search(snapshot(stories, true), { text: '#31', filters: [] }).map((result) => result.id)).toEqual(['a']);
    expect(search(snapshot(stories, true), { text: 'S-4', filters: [] }).map((result) => result.id)).toEqual(['a']);
    expect(searchStories(stories, '#31')).toHaveLength(1);
    expect(searchStories(stories, '31')).toHaveLength(1);
    expect(searchStories(stories, 's-4')).toHaveLength(1);
  });

  it('AC12.3 marks the match in the key that is shown', () => {
    const [result] = search(snapshot([story('a', { link })], true), { text: '#31', filters: [] });
    expect(result.kind).toBe('story');
    if (result.kind === 'story') expect(result.codeRanges).toEqual([{ start: 0, end: 3 }]);
    const [own] = search(snapshot([story('a', { link })], false), { text: 'S-4', filters: [] });
    if (own.kind === 'story') expect(own.codeRanges).toEqual([{ start: 0, end: 3 }]);
  });

  it('AC12.6 writes the key a story has now into the history, and leaves earlier entries as they are', () => {
    const isDone = isDoneIn(DEFAULT_STATUSES);
    let counter = 0;
    const events = releaseEventsFor([story('a')], [story('a', { releaseId: 'r1', link })], '2026-10-21T10:00:00.000Z', () => `ev-${(counter += 1)}`, isDone);
    expect(events).toMatchObject([{ kind: 'added', code: '#31' }]);
    const before = releaseEventsFor([story('a')], [story('a', { releaseId: 'r1' })], '2026-10-20T10:00:00.000Z', () => `ev-${(counter += 1)}`, isDone);
    expect(before).toMatchObject([{ kind: 'added', code: 'S-4' }]);
  });
});
