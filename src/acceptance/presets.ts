import { LocalStorageRepository } from '../data/localStorageRepository';
import { seedSnapshot } from '../data/seed';
import { startItemsOf } from '../domain/sprintLife';
import { addDays, todayIso } from '../domain/sprints';
import type { Snapshot, Sprint } from '../domain/types';

/*
 * Test data for the acceptance in the preview: situations a test case needs that the demo data does not have, such as
 * several completed sprints. They are for the acceptance panel only (never for the product): a preset replaces the data
 * in this browser, like a fresh start with other demo data.
 */

/** Planned at the start, done, and the points that joined during the sprint. */
type SprintFigures = [planned: number, done: number, added: number];

/** The six completed sprints of the test cases of the velocity (#24). */
const SIX: SprintFigures[] = [
  [18, 12, 0],
  [22, 19, 0],
  [25, 17, 0],
  [20, 22, 5],
  [24, 20, 0],
  [26, 22, 0]
];

function completedSprint(index: number, count: number, firstStart: string, [planned, done, added]: SprintFigures): Sprint {
  const startDate = addDays(firstStart, -14 * (count - index));
  const endDate = addDays(startDate, 13);
  return {
    id: `sprint-done-${index + 1}`,
    name: `Sprint ${index + 1}`,
    startDate,
    endDate,
    state: 'completed',
    startItems: [],
    result: {
      completedOn: endDate,
      plannedPoints: planned,
      plannedStories: 3,
      donePoints: done,
      doneStories: 3,
      notDonePoints: 0,
      notDoneStories: 0,
      addedStories: added > 0 ? 2 : 0,
      addedPoints: added,
      removedStories: 0,
      removedPoints: 0,
      changedPoints: 0
    }
  };
}

/**
 * The demo data with completed sprints before it. The running demo sprint becomes "Sprint <n+1>" with 24 points (S-1 gets
 * 4 points) and the planned one "Sprint <n+2>" with S-7 and 30 points; with `running: false` no sprint runs.
 */
function withHistory(today: string, history: SprintFigures[], running = true): Snapshot {
  const seed = seedSnapshot(today);
  const stories = seed.stories.map((story) =>
    story.id === 'story-1' ? { ...story, points: 4 } : story.id === 'story-7' ? { ...story, points: 30, sprintId: 'sprint-2' } : story
  );
  const firstStart = seed.sprints[0].startDate;
  const open = seed.sprints.map((sprint) => {
    if (sprint.id === 'sprint-1') {
      const named = { ...sprint, name: `Sprint ${history.length + 1}` };
      return running ? { ...named, startItems: startItemsOf(stories, 'sprint-1') } : { ...named, state: 'planned' as const, startItems: null };
    }
    return { ...sprint, name: `Sprint ${history.length + 2}` };
  });
  return { ...seed, stories, sprints: [...history.map((figures, index) => completedSprint(index, history.length, firstStart, figures)), ...open] };
}

export interface Preset {
  id: string;
  /** Short name for the choice, in German like the test cases. */
  title: string;
  /** What the data looks like. */
  description: string;
  build: (today: string) => Snapshot;
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'demo',
    title: 'Demo-Daten',
    description: 'Die Demo-Daten wie beim ersten Öffnen: Sprint 1 läuft, Sprint 2 ist geplant, kein Sprint ist abgeschlossen.',
    build: (today) => seedSnapshot(today)
  },
  {
    id: 'velocity6',
    title: 'Velocity: 6 abgeschlossene Sprints',
    description: 'Sprint 1 bis 6 abgeschlossen (geplant/erledigt: 18/12, 22/19, 25/17, 20/22, 24/20, 26/22; bei Sprint 4 kamen 5 Punkte dazu). Sprint 7 läuft mit 24 Punkten und lässt sich abschliessen, Sprint 8 ist mit 30 Punkten geplant.',
    build: (today) => withHistory(today, SIX)
  },
  {
    id: 'velocity10',
    title: 'Velocity: 10 abgeschlossene Sprints',
    description: 'Sprint 1 bis 10 abgeschlossen, je 20 geplant und 20 erledigt. Sprint 11 läuft, Sprint 12 ist geplant.',
    build: (today) => withHistory(today, Array.from({ length: 10 }, () => [20, 20, 0] as SprintFigures))
  },
  {
    id: 'velocity2',
    title: 'Velocity: 2 abgeschlossene Sprints',
    description: 'Sprint 1 (20 geplant, 12 erledigt) und Sprint 2 (30 geplant, 24 erledigt) sind abgeschlossen. Sprint 3 läuft.',
    build: (today) =>
      withHistory(today, [
        [20, 12, 0],
        [30, 24, 0]
      ])
  },
  {
    id: 'velocity1',
    title: 'Velocity: 1 abgeschlossener Sprint',
    description: 'Sprint 1 (20 geplant, 12 erledigt) ist abgeschlossen. Sprint 2 läuft.',
    build: (today) => withHistory(today, [[20, 12, 0]])
  },
  {
    id: 'velocity0',
    title: 'Velocity: kein Sprint abgeschlossen',
    description: 'Wie die Demo-Daten, aber Sprint 1 hat 24 und Sprint 2 hat 30 Punkte. Kein Sprint ist abgeschlossen.',
    build: (today) => withHistory(today, [])
  },
  {
    id: 'velocityStart',
    title: 'Velocity: 6 abgeschlossene Sprints, kein Sprint läuft',
    description: 'Wie „6 abgeschlossene Sprints“, aber Sprint 7 ist nur geplant: Auf dem Board steht „Sprint starten“.',
    build: (today) => withHistory(today, SIX, false)
  }
];

export type PresetId = (typeof PRESETS)[number]['id'];

const REOPEN_KEY = 'getitdone.acceptance.reopen';

/** Replaces the data in this browser with the preset and reloads the page; the acceptance panel opens again. */
export async function applyPreset(id: string, reload: () => void = () => window.location.reload()): Promise<void> {
  const preset = PRESETS.find((item) => item.id === id);
  if (!preset) return;
  await new LocalStorageRepository().replaceAll(preset.build(todayIso()));
  try {
    window.sessionStorage.setItem(REOPEN_KEY, '1');
  } catch {
    // the panel just stays closed after the reload
  }
  reload();
}

/** Whether the panel opens at once because a preset was applied just now; the mark is used up. */
export function takeReopen(): boolean {
  try {
    const reopen = window.sessionStorage.getItem(REOPEN_KEY) === '1';
    window.sessionStorage.removeItem(REOPEN_KEY);
    return reopen;
  } catch {
    return false;
  }
}
