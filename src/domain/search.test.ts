import { describe, expect, it } from 'vitest';
import {
  addFilterValue,
  viewFor,
  whereShown,
  arrangeForPage,
  findRanges,
  fold,
  groupResults,
  isActive,
  makeSnippet,
  matchingStoryIds,
  parseTerms,
  relaxations,
  removeFilter,
  sameQuery,
  search,
  setFilter,
  suggestFilters,
  valueCounts,
  NOT_PLANNED,
  NO_EPIC,
  fieldValues,
  type Filter,
  type SearchResult
} from './search';
import type { Snapshot, Story } from './types';

function story(id: string, overrides: Partial<Story> = {}): Story {
  return {
    id,
    code: `S-${id}`,
    title: `Story ${id}`,
    description: '',
    epicId: 'e1',
    points: 3,
    status: 'todo',
    sprintId: 's1',
    rank: Number(id),
    criteria: [],
    values: {},
    ...overrides
  };
}

const snapshot: Snapshot = {
  epics: [
    { id: 'e1', name: 'Boards', colorKey: 'blue', position: 0, values: {} },
    { id: 'e2', name: 'Local storage', colorKey: 'teal', position: 1, values: {} }
  ],
  sprints: [
    { id: 's2', name: 'Sprint 2', startDate: '2026-10-20', endDate: '2026-11-02' },
    { id: 's1', name: 'Sprint 1', startDate: '2026-10-06', endDate: '2026-10-19' }
  ],
  stories: [
    story('1', { title: 'Tick off acceptance criteria', status: 'review', criteria: [{ id: 'c1', text: 'Every criterion has a box', done: true }] }),
    story('2', {
      title: 'Keep all data in a local database',
      description: 'As a user, I want my data to stay on my computer, so that I can work offline without a network.',
      epicId: 'e2',
      status: 'in_progress',
      points: 5,
      criteria: [
        { id: 'c2', text: 'Data is stored in a SQLite file', done: true },
        { id: 'c3', text: 'The app works offline', done: false }
      ]
    }),
    story('3', { title: 'Écran de démarrage', sprintId: null, points: 1 }),
    story('12', { title: 'Report storage errors', epicId: 'e2', status: 'done', sprintId: 's2' })
  ],
  fields: [],
  assignments: []
};

const ids = (results: SearchResult[]): string[] => results.map((result) => `${result.kind}:${result.id}`);
const query = (text: string, filters: Filter[] = []) => ({ text, filters });

describe('text folding', () => {
  it('ignores case and accents', () => {
    expect(fold('Écran DÉMARRAGE ä ö ü')).toBe('ecran demarrage a o u');
  });

  it('splits words and keeps quoted phrases together', () => {
    expect(parseTerms('Login  "beim Fehler" Öl')).toEqual(['login', 'beim fehler', 'ol']);
  });

  it('ignores an empty phrase and an unclosed quote', () => {
    expect(parseTerms('"" "open phrase')).toEqual(['open phrase']);
  });

  it('finds ranges in the original text, also around accents', () => {
    expect(findRanges('Écran de démarrage', ['ecran', 'demar'])).toEqual([
      { start: 0, end: 5 },
      { start: 9, end: 14 }
    ]);
  });

  it('merges overlapping ranges', () => {
    expect(findRanges('database', ['data', 'tab'])).toEqual([{ start: 0, end: 5 }]);
  });
});

describe('snippets', () => {
  it('cuts long text around the first match at word boundaries', () => {
    const text = 'As a user, I want my data to stay on my computer, so that I can work offline without a network connection at all.';
    const snippet = makeSnippet('description', text, ['offline']);
    expect(snippet.cutStart).toBe(true);
    expect(snippet.text.startsWith(' ')).toBe(false);
    const range = snippet.ranges[0];
    expect(snippet.text.slice(range.start, range.end)).toBe('offline');
  });

  it('keeps short text whole', () => {
    const snippet = makeSnippet('criterion', 'The app works offline', ['works']);
    expect(snippet).toMatchObject({ text: 'The app works offline', cutStart: false, cutEnd: false, ranges: [{ start: 8, end: 13 }] });
  });
});

describe('search', () => {
  it('returns nothing for an empty query', () => {
    expect(isActive(query('  '))).toBe(false);
    expect(search(snapshot, query(''))).toEqual([]);
  });

  it('finds stories by title, description and criteria, ignoring case and accents', () => {
    expect(ids(search(snapshot, query('ECRAN')))).toEqual(['story:3']);
    expect(ids(search(snapshot, query('offline')))).toEqual(['story:2']);
    expect(ids(search(snapshot, query('criterion has')))).toEqual(['story:1']);
  });

  it('needs every word, in any order and any field', () => {
    expect(ids(search(snapshot, query('sqlite local')))).toEqual(['story:2']);
    expect(ids(search(snapshot, query('sqlite boards')))).toEqual([]);
  });

  it('searches a quoted phrase as a whole', () => {
    expect(ids(search(snapshot, query('"local database"')))).toEqual(['story:2']);
    expect(ids(search(snapshot, query('"database local"')))).toEqual([]);
  });

  it('shows where a match outside the title was found', () => {
    const [result] = search(snapshot, query('offline'));
    expect(result.kind === 'story' && result.snippet?.field).toBe('description');
    const [title] = search(snapshot, query('database'));
    expect(title.kind === 'story' && title.snippet).toBeNull();
  });

  it('puts an exact code first, then title matches, then other matches', () => {
    expect(ids(search(snapshot, query('s-12'))).slice(0, 1)).toEqual(['story:12']);
    expect(ids(search(snapshot, query('storage')))).toEqual(['story:12', 'epic:e2']);
    expect(ids(search(snapshot, query('data')))).toEqual(['story:2']);
  });

  it('finds epics and sprints by name and groups results by kind', () => {
    const results = search(snapshot, query('sprint'));
    expect(ids(results)).toEqual(['sprint:s1', 'sprint:s2']);
    const groups = groupResults(search(snapshot, query('o')));
    expect(groups.map((group) => group.kind)).toEqual(['story', 'epic']);
  });

  it('combines different fields with AND and values of one field with OR', () => {
    const status: Filter = { field: 'status', values: ['review', 'in_progress'], negate: false };
    expect(ids(search(snapshot, query('', [status])))).toEqual(['story:1', 'story:2']);
    const epic: Filter = { field: 'epic', values: ['e2'], negate: false };
    expect(ids(search(snapshot, query('', [status, epic])))).toEqual(['story:2']);
  });

  it('excludes values with "is not"', () => {
    const notDone: Filter = { field: 'status', values: ['done'], negate: true };
    expect(ids(search(snapshot, query('storage', [notDone])))).toEqual([]);
  });

  it('filters by sprint, including stories that are not planned', () => {
    const notPlanned: Filter = { field: 'sprint', values: [NOT_PLANNED], negate: false };
    expect(ids(search(snapshot, query('', [notPlanned])))).toEqual(['story:3']);
    const sprint2: Filter = { field: 'sprint', values: ['s2'], negate: false };
    expect(ids(search(snapshot, query('', [sprint2])))).toEqual(['story:12', 'sprint:s2']);
  });

  it('filters stories without an epic', () => {
    const withoutEpic: Snapshot = { ...snapshot, stories: [...snapshot.stories, story('20', { title: 'Loose story', epicId: null })] };
    expect(ids(search(withoutEpic, query('', [{ field: 'epic', values: [NO_EPIC], negate: false }])))).toEqual(['story:20']);
    expect(fieldValues(withoutEpic, 'epic')).toEqual(['e1', 'e2', NO_EPIC]);
    expect(fieldValues(snapshot, 'epic')).toEqual(['e1', 'e2']);
  });

  it('filters by type, points and criteria', () => {
    expect(ids(search(snapshot, query('stor', [{ field: 'type', values: ['epic'], negate: false }])))).toEqual(['epic:e2']);
    expect(ids(search(snapshot, query('', [{ field: 'points', values: ['5', '1'], negate: false }])))).toEqual(['story:2', 'story:3']);
    expect(ids(search(snapshot, query('', [{ field: 'criteria', values: ['all'], negate: false }])))).toEqual(['story:1']);
    expect(ids(search(snapshot, query('', [{ field: 'criteria', values: ['none'], negate: false }])))).toEqual(['story:3', 'story:12']);
  });

  it('restricts the text to the chosen fields with "Search in"', () => {
    const titleOnly: Filter = { field: 'scope', values: ['title'], negate: false };
    expect(ids(search(snapshot, query('offline', [titleOnly])))).toEqual([]);
    const criteriaOnly: Filter = { field: 'scope', values: ['criteria'], negate: false };
    expect(ids(search(snapshot, query('offline', [criteriaOnly])))).toEqual(['story:2']);
  });

  it('lists the ids of matching stories for highlighting', () => {
    expect(matchingStoryIds(snapshot, query('storage'))).toEqual(new Set(['12']));
  });
});

describe('chips', () => {
  it('adds a value to the chip of its field', () => {
    const one = addFilterValue([], 'status', 'review');
    const two = addFilterValue(one, 'status', 'done');
    expect(two).toEqual([{ field: 'status', values: ['review', 'done'], negate: false }]);
    expect(addFilterValue(two, 'status', 'done')).toEqual(two);
  });

  it('sets and removes a chip, keeping its place', () => {
    const filters = setFilter(setFilter([], 'epic', ['e1'], false), 'status', ['todo'], false);
    expect(setFilter(filters, 'epic', ['e2'], true).map((filter) => filter.field)).toEqual(['epic', 'status']);
    expect(setFilter(filters, 'epic', [], false).map((filter) => filter.field)).toEqual(['status']);
    expect(removeFilter(filters, 'status').map((filter) => filter.field)).toEqual(['epic']);
  });

  it('never negates "Search in"', () => {
    expect(setFilter([], 'scope', ['title'], true)[0].negate).toBe(false);
  });

  it('counts results per value with the other chips and the text applied', () => {
    const counts = valueCounts(snapshot, query('', [{ field: 'epic', values: ['e2'], negate: false }]), 'status');
    expect(Object.fromEntries(counts)).toEqual({ todo: 0, in_progress: 1, review: 0, done: 1 });
  });

  it('suggests a filter when the text is the name of a value', () => {
    const labels = [
      { field: 'status' as const, value: 'review', label: 'Review' },
      { field: 'epic' as const, value: 'e1', label: 'Boards' },
      { field: 'epic' as const, value: 'e2', label: 'Local storage' }
    ];
    expect(suggestFilters('review', [], labels)).toEqual([labels[0]]);
    expect(suggestFilters('loc', [], labels)).toEqual([labels[2]]);
    expect(suggestFilters('lo', [], labels)).toEqual([]);
    expect(suggestFilters('review', [{ field: 'status', values: ['review'], negate: false }], labels)).toEqual([]);
  });

  it('tells which chip to drop when nothing is found', () => {
    const filters: Filter[] = [
      { field: 'status', values: ['done'], negate: false },
      { field: 'epic', values: ['e1'], negate: false }
    ];
    expect(relaxations(snapshot, query('storage', filters))).toEqual([{ field: 'epic', count: 1 }]);
  });

  it('compares queries regardless of case, spaces and value order', () => {
    const a = query(' Login  error ', [{ field: 'status', values: ['todo', 'done'], negate: false }]);
    const b = query('login error', [{ field: 'status', values: ['done', 'todo'], negate: false }]);
    expect(sameQuery(a, b)).toBe(true);
    expect(sameQuery(a, query('login error'))).toBe(false);
  });
});

describe('current page', () => {
  const page = { story: new Set(['3']), epic: new Set<string>(), sprint: new Set(['s1']) };

  it('puts results on the page first within their group', () => {
    const results = search(snapshot, query('', [{ field: 'points', values: ['1', '3', '5'], negate: false }]));
    expect(ids(results)).toEqual(['story:1', 'story:2', 'story:3', 'story:12']);
    expect(ids(arrangeForPage(results, page, false))).toEqual(['story:3', 'story:1', 'story:2', 'story:12']);
  });

  it('keeps only results on the page when asked', () => {
    expect(ids(arrangeForPage(search(snapshot, query('sprint')), page, true))).toEqual(['sprint:s1']);
  });

  it('leaves the order alone without a page', () => {
    const results = search(snapshot, query('sprint'));
    expect(arrangeForPage(results, null, true)).toEqual(results);
  });
});

describe('custom fields', () => {
  const withFields: Snapshot = {
    ...snapshot,
    fields: [
      { id: 'f-risk', builtinKey: null, kind: 'custom', dataType: 'text', label: 'Risk', options: [], defaultValue: null },
      {
        id: 'f-prio',
        builtinKey: null,
        kind: 'custom',
        dataType: 'single_select',
        label: 'Priority',
        options: [{ id: 'o-must', label: 'Must', colorKey: 'rose' }],
        defaultValue: null
      },
      { id: 'f-done', builtinKey: null, kind: 'custom', dataType: 'checkbox', label: 'Checked', options: [], defaultValue: null }
    ],
    stories: snapshot.stories.map((item) =>
      item.id === '3' ? { ...item, values: { 'f-risk': 'Vendor lock-in', 'f-prio': 'o-must', 'f-done': true } } : item
    )
  };

  it('finds stories by the text of custom field values and names the field', () => {
    const [result] = search(withFields, query('vendor'));
    expect(result.id).toBe('3');
    expect(result.kind === 'story' && result.snippet).toMatchObject({ field: 'custom', fieldName: 'Risk', text: 'Vendor lock-in' });
  });

  it('finds the label of a selected option, not its id', () => {
    expect(ids(search(withFields, query('must')))).toEqual(['story:3']);
    expect(ids(search(withFields, query('o-must')))).toEqual([]);
  });

  it('does not search checkboxes and leaves custom fields out when only titles are searched', () => {
    expect(ids(search(withFields, query('true')))).toEqual([]);
    expect(ids(search(withFields, query('vendor', [{ field: 'scope', values: ['title'], negate: false }])))).toEqual([]);
  });
});

describe('where a result is shown', () => {
  // Sprint 1 runs from 6 to 19 October, Sprint 2 follows.
  const today = '2026-10-10';

  it('shows a story of the running sprint on the board first, then backlog and map', () => {
    expect(whereShown(snapshot, 'story', '1', today)).toEqual(['board', 'backlog', 'map']);
  });

  it('shows a story of a later sprint or without sprint in the backlog and on the map', () => {
    expect(whereShown(snapshot, 'story', '12', today)).toEqual(['backlog', 'map']);
    expect(whereShown(snapshot, 'story', '3', today)).toEqual(['backlog', 'map']);
  });

  it('keeps stories of past sprints to the backlog', () => {
    expect(whereShown(snapshot, 'story', '1', '2026-10-25')).toEqual(['backlog']);
  });

  it('shows epics on the epics page and the map, sprints on board, map and backlog', () => {
    expect(whereShown(snapshot, 'epic', 'e1', today)).toEqual(['epics', 'map']);
    expect(whereShown(snapshot, 'sprint', 's1', today)).toEqual(['board', 'map', 'backlog']);
    expect(whereShown(snapshot, 'sprint', 's2', today)).toEqual(['map', 'backlog']);
  });

  it('knows nothing about items that do not exist', () => {
    expect(whereShown(snapshot, 'story', 'gone', today)).toEqual([]);
  });

  it('prefers the current page, then the first page that shows the item, else none', () => {
    expect(viewFor('backlog', ['board', 'backlog'])).toBe('backlog');
    expect(viewFor('epics', ['board', 'backlog'])).toBe('board');
    expect(viewFor('settings', [])).toBeNull();
  });
});
