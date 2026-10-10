import type { Snapshot } from '../domain/types';

/** Demo data shown on the first start so the board is not empty. */
export function seedSnapshot(): Snapshot {
  return {
    epics: [
      { id: 'epic-boards', name: 'Boards', colorKey: 'boards' },
      { id: 'epic-backlog', name: 'Backlog', colorKey: 'backlog' },
      { id: 'epic-storage', name: 'Local storage', colorKey: 'storage' },
      { id: 'epic-accessibility', name: 'Accessibility', colorKey: 'accessibility' }
    ],
    stories: [
      {
        id: 'story-1',
        code: 'S-1',
        title: 'Create a story with title and description',
        description: 'As a product owner, I want to create a story, so that I can capture a requirement.',
        epicId: 'epic-boards',
        points: 3,
        status: 'in_progress',
        inSprint: true,
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
        inSprint: true,
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
        inSprint: true,
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
        inSprint: true,
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
        inSprint: true,
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
        inSprint: true,
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
        inSprint: false,
        rank: 6,
        criteria: []
      }
    ]
  };
}
