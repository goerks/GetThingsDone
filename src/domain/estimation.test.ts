import { describe, expect, it } from 'vitest';
import { createStory, totalPoints, updateStory } from './board';
import { estimatePatch, referencesByValue, unestimatedCount } from './estimation';
import { seedSnapshot } from '../data/seed';
import { contentsOf } from './sprintLife';
import type { Story } from './types';

const { stories } = seedSnapshot('2026-10-13');
const find = (list: Story[], id: string): Story => {
  const story = list.find((item) => item.id === id);
  if (!story) throw new Error(id);
  return story;
};

describe('a new story (AC1)', () => {
  it('AC1.1 is not estimated when no points are given', () => {
    const { story } = createStory(stories, { title: 'Profile picture', description: '', epicId: null, sprintId: null }, 'new');
    expect(story).toMatchObject({ points: null, special: null, reference: false });
  });
});

describe('estimating with cards (AC2)', () => {
  it('AC2.1 sets a number card and clears a special card', () => {
    const unsure = updateStory(stories, 'story-3', estimatePatch({ special: 'unsure' }));
    expect(find(unsure, 'story-3')).toMatchObject({ points: null, special: 'unsure' });
    const three = updateStory(unsure, 'story-3', estimatePatch({ points: 3 }));
    expect(find(three, 'story-3')).toMatchObject({ points: 3, special: null });
  });

  it('AC2.2 takes the estimate back', () => {
    const next = updateStory(stories, 'story-3', estimatePatch(null));
    expect(find(next, 'story-3')).toMatchObject({ points: null, special: null });
  });
});

describe('reference stories (AC3)', () => {
  it('AC3.1 finds the reference of each value', () => {
    expect([...referencesByValue(stories)].map(([value, story]) => [value, story.code])).toEqual([[3, 'S-1']]);
  });

  it('AC3.2 takes the mark from the story that had it when another story with the same value is marked', () => {
    const next = updateStory(stories, 'story-5', { reference: true });
    expect(find(next, 'story-5').reference).toBe(true);
    expect(find(next, 'story-1').reference).toBe(false);
  });

  it('AC3.2 keeps the reference of another value', () => {
    const next = updateStory(stories, 'story-3', { reference: true });
    expect(find(next, 'story-3').reference).toBe(true);
    expect(find(next, 'story-1').reference).toBe(true);
  });

  it('AC3.5 removes the mark when the story gets another estimate or none', () => {
    expect(find(updateStory(stories, 'story-1', { points: 5 }), 'story-1').reference).toBe(false);
    expect(find(updateStory(stories, 'story-1', estimatePatch({ special: 'break' })), 'story-1').reference).toBe(false);
    expect(find(updateStory(stories, 'story-1', estimatePatch(null)), 'story-1').reference).toBe(false);
  });

  it('AC3.5 cannot mark a story without a number card', () => {
    const next = updateStory(updateStory(stories, 'story-3', estimatePatch({ special: 'unsure' })), 'story-3', { reference: true });
    expect(find(next, 'story-3').reference).toBe(false);
  });
});

describe('sums (AC5)', () => {
  const some = (change: (story: Story) => Story): Story[] => stories.map(change);

  it('AC5.1 counts a story without a number card as no points and counts it separately', () => {
    const list = some((story) => (story.id === 'story-3' ? { ...story, points: null } : story.id === 'story-2' ? { ...story, points: null, special: 'break' } : story));
    expect(totalPoints(list.filter((story) => story.sprintId === 'sprint-1'))).toBe(23 - 5 - 2);
    expect(unestimatedCount(list.filter((story) => story.sprintId === 'sprint-1'))).toBe(2);
  });

  it('AC5.2 names the stories of a sprint without estimate and does not plan points for them', () => {
    const list = some((story) => (story.id === 'story-2' ? { ...story, points: null } : story));
    const contents = contentsOf(list, 'sprint-1');
    expect(contents.points).toBe(21);
    expect(contents.withoutPoints.map((story) => story.code)).toEqual(['S-2']);
  });
});
