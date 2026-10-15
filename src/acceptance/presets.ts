import { LocalStorageRepository } from '../data/localStorageRepository';
import { seedSnapshot } from '../data/seed';
import { DEMO_DEFINITIONS } from '../domain/definitions';
import { startItemsOf } from '../domain/sprintLife';
import { addDays, todayIso } from '../domain/sprints';
import { DEFAULT_STATUSES } from '../domain/statuses';
import { WORKFLOW_END, type Snapshot, type Sprint, type Workflow } from '../domain/types';
import { DEFAULT_WORKFLOW, setEnabled, setFree, setTransition } from '../domain/workflow';

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

/**
 * The demo data with the Definition of Ready and Done switched on or off (#26). With `marks`, the stories are in the situations
 * the test cases of the marks need: S-3 meets the Ready list, S-6 lacks one item, S-7 lacks most (no criteria, no points); S-2
 * is done and was held to a Done list it does not meet (the mark "Not done"); S-5 was done before the lists existed (no mark).
 */
function withDefinitions(today: string, ready: boolean, done: boolean, marks = false): Snapshot {
  const seed = seedSnapshot(today);
  const definitions = { ready: { ...DEMO_DEFINITIONS.ready, enforce: ready }, done: { ...DEMO_DEFINITIONS.done, enforce: done } };
  let stories = seed.stories;
  if (marks) {
    stories = stories.map((story) => {
      if (story.id === 'story-3') return { ...story, checks: { 'def-ready-dependencies': 'checked', 'def-ready-design': 'na', 'def-ready-texts': 'checked' } };
      if (story.id === 'story-6') return { ...story, checks: { 'def-ready-dependencies': 'checked', 'def-ready-design': 'na' } };
      if (story.id === 'story-2') return { ...story, status: 'done', doneItems: ['def-done-accepted', 'def-done-review', 'def-done-docs'], checks: { 'def-done-review': 'checked' } };
      return story;
    });
  }
  return { ...seed, stories, settings: { ...seed.settings, definitions } };
}

/** The demo data with a workflow (#49); with `ready`, "Not started" has a second status, "Ready", for the start rules. */
function withWorkflow(today: string, workflow: Workflow, ready = false): Snapshot {
  const seed = seedSnapshot(today);
  const statuses = ready ? [DEFAULT_STATUSES[0], { id: 'ready', label: 'Ready', category: 'not_started' as const }, ...DEFAULT_STATUSES.slice(1)].map((status) => ({ ...status })) : seed.statuses;
  return { ...seed, statuses, settings: { ...seed.settings, workflow } };
}

/** The workflow switched on with some transitions forbidden: To do → Done, In progress → Done, Review → To do and the end from Done. */
function restrictedWorkflow(enabled: boolean): Workflow {
  const forbidden: Array<[string, string]> = [['todo', 'done'], ['in_progress', 'done'], ['review', 'todo'], ['done', WORKFLOW_END]];
  return forbidden.reduce((workflow, [from, to]) => setTransition(workflow, from, to, false), setEnabled(DEFAULT_WORKFLOW, enabled));
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
    id: 'definitionsOff',
    title: 'Definitionen: beide aus (Standard)',
    description: 'Die Demo-Daten mit den Beispiellisten Definition of Ready und Done, beide ausgeschaltet: Stories zeigen sie nicht, nichts wird gefragt oder markiert.',
    build: (today) => withDefinitions(today, false, false)
  },
  {
    id: 'definitionsOn',
    title: 'Definitionen: beide ein',
    description: 'Die Demo-Daten mit Definition of Ready und Done eingeschaltet. „S-6“ und „S-3“ stehen in „To do“ (S-6 erfüllt 2 von 5 Ready-Punkten), „S-1“ in „In progress“ (Done-Liste 0 von 3).',
    build: (today) => withDefinitions(today, true, true)
  },
  {
    id: 'definitionsReadyOnly',
    title: 'Definitionen: nur Ready ein',
    description: 'Wie „beide ein“, aber nur die Definition of Ready ist eingeschaltet. Nach „Done“ wird nichts gefragt, Stories zeigen nur den Reiter „Definition of Ready“.',
    build: (today) => withDefinitions(today, true, false)
  },
  {
    id: 'definitionsDoneOnly',
    title: 'Definitionen: nur Done ein',
    description: 'Wie „beide ein“, aber nur die Definition of Done ist eingeschaltet. Aus „To do“ nach „In progress“ wird nichts gefragt.',
    build: (today) => withDefinitions(today, false, true)
  },
  {
    id: 'definitionsMarks',
    title: 'Definitionen: Markierungen',
    description: 'Beide ein. „S-3“ ist bereit, „S-6“ fehlt ein Punkt, „S-7“ fehlen die meisten. „S-2“ steht in „Done“ und erfüllt die Done-Liste von damals nicht („Not done 1/3“), „S-5“ war schon vorher erledigt (keine Markierung).',
    build: (today) => withDefinitions(today, true, true, true)
  },
  {
    id: 'definitionsEmpty',
    title: 'Definitionen: leere Listen',
    description: 'Wie die Demo-Daten, aber beide Listen sind leer und eingeschaltet: nichts wird angezeigt, gefragt oder markiert.',
    build: (today) => {
      const seed = seedSnapshot(today);
      return { ...seed, settings: { ...seed.settings, definitions: { ready: { enforce: true, groups: [] }, done: { enforce: true, groups: [] } } } };
    }
  },
  {
    id: 'workflowOn',
    title: 'Workflows: ein, nichts gesperrt',
    description: 'Die Demo-Daten mit eingeschaltetem Workflow, aber noch ohne Sperre: Alle Übergänge sind erlaubt.',
    build: (today) => withWorkflow(today, setEnabled(DEFAULT_WORKFLOW, true))
  },
  {
    id: 'workflowRestricted',
    title: 'Workflows: ein, mit Sperren',
    description: 'Eingeschaltet. Gesperrt sind „To do → Done“, „In progress → Done“, „Review → To do“ und das Löschen aus „Done“. „S-3“ und „S-6“ stehen in „To do“, „S-1“ in „In progress“, „S-2“ in „Review“, „S-5“ in „Done“.',
    build: (today) => withWorkflow(today, restrictedWorkflow(true))
  },
  {
    id: 'workflowSaved',
    title: 'Workflows: aus, aber mit gespeicherten Sperren',
    description: 'Dieselben Sperren wie bei „ein, mit Sperren“, aber der Workflow ist ausgeschaltet: Sie gelten nicht.',
    build: (today) => withWorkflow(today, restrictedWorkflow(false))
  },
  {
    id: 'workflowStarts',
    title: 'Workflows: ein, zwei Start-Status',
    description: 'Eingeschaltet. „Nicht begonnen“ hat zwei Status: „To do“ und „Ready“. Nur „To do“ ist als Start eingestellt.',
    build: (today) => withWorkflow(today, setEnabled(DEFAULT_WORKFLOW, true), true)
  },
  {
    id: 'workflowFreeOff',
    title: 'Workflows: Kategorie-Schalter aus, mit Sperren',
    description: 'Eingeschaltet. Der Schalter „Free transitions within In progress“ ist aus, „In progress → Review“ und „Review → In progress“ sind gesperrt, ebenso „To do → Done“.',
    build: (today) => {
      const seed = seedSnapshot(today);
      let workflow = setFree(setEnabled(DEFAULT_WORKFLOW, true), seed.statuses, 'in_progress', false);
      for (const [from, to] of [['in_progress', 'review'], ['review', 'in_progress'], ['todo', 'done']]) workflow = setTransition(workflow, from, to, false);
      return withWorkflow(today, workflow);
    }
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
