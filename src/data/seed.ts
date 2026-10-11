import { assignTo, missingBuiltins } from '../domain/fields';
import { addDays } from '../domain/sprints';
import type { FieldDefinition, FieldValue, Snapshot, Story } from '../domain/types';

/** Demo custom fields, so the preview shows what teams can add. */
const DEMO_FIELDS: FieldDefinition[] = [
  {
    id: 'field-demo-priority',
    builtinKey: null,
    kind: 'custom',
    dataType: 'single_select',
    label: 'Priority',
    options: [
      { id: 'opt-must', label: 'Must', colorKey: 'rose' },
      { id: 'opt-should', label: 'Should', colorKey: 'amber' },
      { id: 'opt-could', label: 'Could', colorKey: 'slate' }
    ],
    defaultValue: 'opt-should'
  },
  {
    id: 'field-demo-value',
    builtinKey: null,
    kind: 'custom',
    dataType: 'number',
    label: 'Business value',
    options: [],
    defaultValue: null
  }
];

const DEMO_VALUES: Record<string, Record<string, FieldValue>> = {
  'story-1': { 'field-demo-priority': 'opt-must', 'field-demo-value': 8 },
  'story-2': { 'field-demo-priority': 'opt-must', 'field-demo-value': 5 },
  'story-3': { 'field-demo-priority': 'opt-should', 'field-demo-value': 5 },
  'story-4': { 'field-demo-priority': 'opt-must' },
  'story-6': { 'field-demo-priority': 'opt-could', 'field-demo-value': 2 }
};

/**
 * Demo data shown on the first start so the board is not empty.
 * Sprint 1 runs around `today`, Sprint 2 follows it, so the board and the story map always have content.
 */
export function seedSnapshot(today: string): Snapshot {
  const sprint1Start = addDays(today, -7);
  const builtins = missingBuiltins([], []);
  let assignments = assignTo(builtins.assignments, 'field-demo-priority', ['story', 'epic']);
  assignments = assignTo(assignments, 'field-demo-value', ['story']);
  // Priority shows on story cards and in the new story dialog, so the preview shows the layout settings.
  assignments = assignments.map((item) =>
    item.fieldId === 'field-demo-priority' && item.itemType === 'story' ? { ...item, onCard: true, inCreate: true } : item
  );
  return {
    fields: [...builtins.fields, ...DEMO_FIELDS],
    assignments,
    epics: [
      { id: 'epic-boards', name: 'Boards', colorKey: 'blue', position: 0, values: { 'field-demo-priority': 'opt-must' } },
      { id: 'epic-backlog', name: 'Backlog', colorKey: 'amber', position: 1, values: { 'field-demo-priority': 'opt-should' } },
      { id: 'epic-storage', name: 'Local storage', colorKey: 'teal', position: 2, values: {} },
      { id: 'epic-accessibility', name: 'Accessibility', colorKey: 'violet', position: 3, values: {} }
    ],
    sprints: [
      { id: 'sprint-1', name: 'Sprint 1', startDate: sprint1Start, endDate: addDays(sprint1Start, 13) },
      { id: 'sprint-2', name: 'Sprint 2', startDate: addDays(sprint1Start, 14), endDate: addDays(sprint1Start, 27) }
    ],
    stories: demoStories.map((story) => ({ ...story, values: DEMO_VALUES[story.id] ?? {} }))
  };
}

const demoStories: Omit<Story, 'values'>[] = [
  {
    id: 'story-1',
    code: 'S-1',
    title: 'Create a story with title and description',
    description: 'As a product owner, I want to create a story, so that I can capture a requirement.',
    epicId: 'epic-boards',
    points: 3,
    status: 'in_progress',
    sprintId: 'sprint-1',
    rank: 0,
    criteria: [
      { id: 'c-1-1', text: 'A story needs a title', done: true },
      { id: 'c-1-2', text: 'The description is optional', done: true },
      { id: 'c-1-3', text: 'A new story appears in "To do"', done: false },
      { id: 'c-1-4', text: 'The story gets the next free key', done: false }
    ]
  },
  {
    id: 'story-2',
    code: 'S-2',
    title: 'Tick off acceptance criteria',
    description:
      'As a product owner, I want to tick off each acceptance criterion of a story, so that I can formally accept the work before it is merged.',
    epicId: 'epic-boards',
    points: 2,
    status: 'review',
    sprintId: 'sprint-1',
    rank: 1,
    criteria: [
      { id: 'c-2-1', text: 'Every criterion has its own checkbox', done: true },
      { id: 'c-2-2', text: 'Ticking a box saves immediately', done: true },
      { id: 'c-2-3', text: 'The story shows how many criteria are accepted', done: true },
      { id: 'c-2-4', text: 'A story with all criteria ticked is marked as ready to merge', done: false }
    ]
  },
  {
    id: 'story-3',
    code: 'S-3',
    title: 'Reorder the backlog by priority',
    description: 'As a product owner, I want to change the priority of stories, so that the team works on the most valuable one first.',
    epicId: 'epic-backlog',
    points: 5,
    status: 'todo',
    sprintId: 'sprint-1',
    rank: 2,
    criteria: [
      { id: 'c-3-1', text: 'A story can move up and down', done: false },
      { id: 'c-3-2', text: 'The order is kept after a restart', done: false },
      { id: 'c-3-3', text: 'The board shows the same order', done: false }
    ]
  },
  {
    id: 'story-4',
    code: 'S-4',
    title: 'Keep all data in a local database',
    description: 'As a user, I want my data to stay on my computer, so that I can work offline.',
    epicId: 'epic-storage',
    points: 5,
    status: 'in_progress',
    sprintId: 'sprint-1',
    rank: 3,
    criteria: [
      { id: 'c-4-1', text: 'Data is stored in a SQLite file', done: true },
      { id: 'c-4-2', text: 'The app works without a network', done: false },
      { id: 'c-4-3', text: 'Demo data is only created on the first start', done: false }
    ]
  },
  {
    id: 'story-5',
    code: 'S-5',
    title: 'Switch the UI language (DE, EN, FR, IT)',
    description: 'As a user, I want to use the app in my language.',
    epicId: 'epic-accessibility',
    points: 3,
    status: 'done',
    sprintId: 'sprint-1',
    rank: 4,
    criteria: [
      { id: 'c-5-1', text: 'German, English, French and Italian are available', done: true },
      { id: 'c-5-2', text: 'The choice is remembered', done: true },
      { id: 'c-5-3', text: 'Screen readers use the right language', done: true }
    ]
  },
  {
    id: 'story-6',
    code: 'S-6',
    title: 'Operate the board with the keyboard only',
    description: 'As a keyboard user, I want to move stories without a mouse.',
    epicId: 'epic-accessibility',
    points: 5,
    status: 'todo',
    sprintId: 'sprint-1',
    rank: 5,
    criteria: [
      { id: 'c-6-1', text: 'A story can be picked up with the space key', done: false },
      { id: 'c-6-2', text: 'Arrow keys move it between and within columns', done: false },
      { id: 'c-6-3', text: 'Moves are announced to screen readers', done: false },
      { id: 'c-6-4', text: 'The focus stays visible', done: false }
    ]
  },
  {
    id: 'story-7',
    code: 'S-7',
    title: 'Plan releases on a story map',
    description: 'As a product owner, I want a story map, so that I can slice releases.',
    epicId: 'epic-backlog',
    points: 8,
    status: 'todo',
    sprintId: null,
    rank: 6,
    criteria: []
  }
];
