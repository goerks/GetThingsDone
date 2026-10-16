import type { Epic, EpicSize, SpecialCard, Story } from './types';
import { EPIC_SIZES, POINT_VALUES } from './types';

/**
 * Estimating with cards (#54). A story has a number card, a special card ("?" or "☕") or no card. Only a number
 * card is an estimate: a story without a number card is "not estimated" and counts as no points in sums.
 */

/** What a story is estimated with: a number card, a special card, or nothing. */
export type Estimate = { points: number } | { special: SpecialCard } | null;

/** The points of a story in sums: a story that is not estimated counts as 0 and is counted separately. */
export const pointsOf = (story: Pick<Story, 'points'>): number => story.points ?? 0;

export const isEstimated = (story: Pick<Story, 'points'>): boolean => story.points !== null;

/** How many of the stories are not estimated (no card, "?" or "☕"). */
export const unestimatedCount = (stories: readonly Pick<Story, 'points'>[]): number => stories.filter((story) => !isEstimated(story)).length;

/** The patch of a story that sets an estimate (or clears it with null). */
export function estimatePatch(estimate: Estimate): { points: number | null; special: SpecialCard | null } {
  if (estimate && 'points' in estimate) return { points: estimate.points, special: null };
  if (estimate && 'special' in estimate) return { points: null, special: estimate.special };
  return { points: null, special: null };
}

/** The estimate a story has now. */
export function estimateOf(story: Pick<Story, 'points' | 'special'>): Estimate {
  if (story.points !== null) return { points: story.points };
  if (story.special) return { special: story.special };
  return null;
}

export const sameEstimate = (a: Estimate, b: Estimate): boolean => {
  if (a === null || b === null) return a === b;
  if ('points' in a) return 'points' in b && a.points === b.points;
  return 'special' in b && a.special === b.special;
};

/** The stories that are the reference of a card value, by value. At most one story per value. */
export function referencesByValue(stories: readonly Story[]): Map<number, Story> {
  const map = new Map<number, Story>();
  for (const story of stories) {
    if (story.reference && story.points !== null && !map.has(story.points)) map.set(story.points, story);
  }
  return map;
}

/** The card values that can have a reference: the number cards of the deck. */
export const referenceValues: readonly number[] = POINT_VALUES;

export const EPIC_SIZE_CARDS: readonly EpicSize[] = EPIC_SIZES;

/** Whether the epic is estimated with a T-shirt size. */
export const isEpicEstimated = (epic: Pick<Epic, 'size'>): boolean => epic.size !== null;
