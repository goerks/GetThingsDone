import { isValidDay } from './sprints';
import type { Release, Sprint, Story } from './types';

export interface ReleaseInput {
  title: string;
  description: string;
  /** Optional: a release does not need dates. Empty text counts as no date. */
  startDate: string | null;
  endDate: string | null;
}

export type ReleaseProblem = 'titleRequired' | 'startInvalid' | 'endInvalid' | 'endBeforeStart';

/** Checks a new or changed release. Returns null when it is valid. */
export function validateRelease(input: ReleaseInput): ReleaseProblem | null {
  if (!input.title.trim()) return 'titleRequired';
  const { startDate, endDate } = input;
  if (startDate && !isValidDay(startDate)) return 'startInvalid';
  if (endDate && !isValidDay(endDate)) return 'endInvalid';
  if (startDate && endDate && endDate < startDate) return 'endBeforeStart';
  return null;
}

function clean(input: ReleaseInput): Omit<Release, 'id'> {
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    startDate: input.startDate || null,
    endDate: input.endDate || null
  };
}

/** Adds a release. Returns null when the input is invalid. */
export function createRelease(releases: Release[], input: ReleaseInput, id: string): { releases: Release[]; release: Release } | null {
  if (validateRelease(input) !== null) return null;
  const release: Release = { id, ...clean(input) };
  return { releases: [...releases, release], release };
}

/** Changes a release. An invalid input leaves the list as it is. */
export function updateRelease(releases: Release[], id: string, input: ReleaseInput): Release[] {
  if (validateRelease(input) !== null || !releases.some((release) => release.id === id)) return releases;
  return releases.map((release) => (release.id === id ? { id, ...clean(input) } : release));
}

/** Removes a release. Its stories stay and lose their release. */
export function deleteRelease(releases: Release[], stories: Story[], id: string): { releases: Release[]; stories: Story[] } {
  return {
    releases: releases.filter((release) => release.id !== id),
    stories: stories.map((story) => (story.releaseId === id ? { ...story, releaseId: null } : story))
  };
}

export function storiesInRelease(stories: readonly Story[], releaseId: string): Story[] {
  return stories.filter((story) => story.releaseId === releaseId).sort((a, b) => a.rank - b.rank);
}

export interface ReleaseStats {
  stories: number;
  points: number;
  doneStories: number;
  donePoints: number;
}

/** Size and progress of a release; the points of its stories are its scope. */
export function releaseStats(stories: readonly Story[], releaseId: string): ReleaseStats {
  const own = storiesInRelease(stories, releaseId);
  const done = own.filter((story) => story.status === 'done');
  return {
    stories: own.length,
    points: own.reduce((sum, story) => sum + story.points, 0),
    doneStories: done.length,
    donePoints: done.reduce((sum, story) => sum + story.points, 0)
  };
}

/** A release is done when it has stories and all of them are done. */
export function isReleaseDone(stories: readonly Story[], releaseId: string): boolean {
  const own = storiesInRelease(stories, releaseId);
  return own.length > 0 && own.every((story) => story.status === 'done');
}

export type ReleaseState = 'planned' | 'running' | 'done';

/**
 * Derived, never stored: done when the release has stories and all are done; running when it has started
 * (a start date today or earlier); otherwise planned. A release without a start date stays planned.
 */
export function releaseState(release: Release, stories: readonly Story[], today: string): ReleaseState {
  if (isReleaseDone(stories, release.id)) return 'done';
  if (release.startDate && release.startDate <= today) return 'running';
  return 'planned';
}

/**
 * Releases in the order of the releases page: running and planned ones by start date (releases without a
 * start date after those with one), then the done ones; ties by title.
 */
export function sortReleases(releases: readonly Release[], stories: readonly Story[]): Release[] {
  const done = new Set(releases.filter((release) => isReleaseDone(stories, release.id)).map((release) => release.id));
  return [...releases].sort((a, b) => {
    const byDone = Number(done.has(a.id)) - Number(done.has(b.id));
    if (byDone !== 0) return byDone;
    if (a.startDate && b.startDate) {
      const byStart = a.startDate.localeCompare(b.startDate);
      if (byStart !== 0) return byStart;
    } else if (a.startDate || b.startDate) {
      return a.startDate ? -1 : 1;
    }
    return a.title.localeCompare(b.title);
  });
}

/** Releases a story can be assigned to: those that are not done, and the one it already has. */
export function selectableReleases(releases: readonly Release[], stories: readonly Story[], currentId: string | null): Release[] {
  return sortReleases(releases, stories).filter(
    (release) => release.id === currentId || !isReleaseDone(stories, release.id)
  );
}

/** Stories of a release whose sprint ends after the release does. A hint only; nothing is blocked. */
export function storiesAfterReleaseEnd(release: Release, stories: readonly Story[], sprints: readonly Sprint[]): Story[] {
  const end = release.endDate;
  if (!end) return [];
  const sprintEnd = new Map(sprints.map((sprint) => [sprint.id, sprint.endDate]));
  return storiesInRelease(stories, release.id).filter((story) => {
    const sprintEndDate = story.sprintId ? sprintEnd.get(story.sprintId) : undefined;
    return sprintEndDate !== undefined && sprintEndDate > end;
  });
}

/** The sprint of a story ends after the end of its release (null when it does not). */
export function sprintEndsAfterRelease(story: Story, releases: readonly Release[], sprints: readonly Sprint[]): { release: Release; sprint: Sprint } | null {
  const release = releases.find((item) => item.id === story.releaseId);
  const sprint = sprints.find((item) => item.id === story.sprintId);
  if (!release?.endDate || !sprint || sprint.endDate <= release.endDate) return null;
  return { release, sprint };
}
