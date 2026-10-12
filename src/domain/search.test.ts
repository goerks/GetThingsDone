import { describe, expect, it } from 'vitest';
import {
  viewFor,
  whereShown,
  customFieldKey,
  effectiveQuery,
  fieldToken,
  findRanges,
  fold,
  groupResults,
  isActive,
  makeSnippet,
  matchFields,
  parseQueryText,
  parseTerms,
  relaxations,
  removeFilter,
  resolveField,
  resolveValue,
  sameQuery,
  search,
  setFilter,
  splitFieldToken,
  tokenize,
  NOT_PLANNED,
  NO_EPIC,
  fieldValues,
  type FieldEntry,
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

  it('combines filters of different fields with AND', () => {
    const review: Filter = { field: 'status', value: 'review' };
    expect(ids(search(snapshot, query('', [review])))).toEqual(['story:1']);
    const e2: Filter = { field: 'epic', value: 'e2' };
    const inProgress: Filter = { field: 'status', value: 'in_progress' };
    expect(ids(search(snapshot, query('', [inProgress, e2])))).toEqual(['story:2']);
    expect(ids(search(snapshot, query('', [review, e2])))).toEqual([]);
  });

  it('filters by sprint, including stories that are not planned', () => {
    expect(ids(search(snapshot, query('', [{ field: 'sprint', value: NOT_PLANNED }])))).toEqual(['story:3']);
    expect(ids(search(snapshot, query('', [{ field: 'sprint', value: 's2' }])))).toEqual(['story:12', 'sprint:s2']);
  });

  it('filters stories without an epic', () => {
    const withoutEpic: Snapshot = { ...snapshot, stories: [...snapshot.stories, story('20', { title: 'Loose story', epicId: null })] };
    expect(ids(search(withoutEpic, query('', [{ field: 'epic', value: NO_EPIC }])))).toEqual(['story:20']);
    expect(fieldValues(withoutEpic, 'epic')).toEqual(['e1', 'e2', NO_EPIC]);
    expect(fieldValues(snapshot, 'epic')).toEqual(['e1', 'e2']);
  });

  it('filters by type, points and criteria', () => {
    expect(ids(search(snapshot, query('stor', [{ field: 'type', value: 'epic' }])))).toEqual(['epic:e2']);
    expect(ids(search(snapshot, query('', [{ field: 'points', value: '5' }])))).toEqual(['story:2']);
    expect(ids(search(snapshot, query('', [{ field: 'criteria', value: 'all' }])))).toEqual(['story:1']);
    expect(ids(search(snapshot, query('', [{ field: 'criteria', value: 'none' }])))).toEqual(['story:3', 'story:12']);
  });
});

describe('badges', () => {
  it('keeps one filter per field, replacing its value in place', () => {
    const filters = setFilter(setFilter([], { field: 'epic', value: 'e1' }), { field: 'status', value: 'todo' });
    expect(setFilter(filters, { field: 'epic', value: 'e2' })).toEqual([
      { field: 'epic', value: 'e2' },
      { field: 'status', value: 'todo' }
    ]);
    expect(removeFilter(filters, 'status')).toEqual([{ field: 'epic', value: 'e1' }]);
  });

  it('tells which filter to drop when nothing is found', () => {
    const filters: Filter[] = [
      { field: 'status', value: 'done' },
      { field: 'epic', value: 'e1' }
    ];
    expect(relaxations(snapshot, query('storage', filters))).toEqual([{ field: 'epic', count: 1 }]);
  });

  it('compares queries regardless of case, spaces and filter order', () => {
    const a = query(' Login  error ', [{ field: 'status', value: 'todo' }, { field: 'epic', value: 'e1' }]);
    const b = query('login error', [{ field: 'epic', value: 'e1' }, { field: 'status', value: 'todo' }]);
    expect(sameQuery(a, b)).toBe(true);
    expect(sameQuery(a, query('login error'))).toBe(false);
  });
});

describe('typed field filters', () => {
  const catalog: FieldEntry[] = [
    {
      key: 'status',
      label: 'Status',
      aliases: ['status'],
      values: [
        { value: 'todo', label: 'Offen', aliases: ['To do'] },
        { value: 'in_progress', label: 'In Arbeit', aliases: ['In progress'] },
        { value: 'review', label: 'Review' }
      ],
      freeValue: false
    },
    { key: 'points', label: 'Punkte', aliases: ['points'], values: [{ value: '3', label: '3' }, { value: '5', label: '5' }], freeValue: false },
    { key: 'epic', label: 'Epic', aliases: ['epic'], values: [{ value: 'e2', label: 'Local storage' }], freeValue: false },
    { key: customFieldKey('f-risk'), label: 'Business value', aliases: [], values: [], freeValue: true }
  ];

  it('splits text into words, keeping quoted parts together', () => {
    expect(tokenize('epic:"local storage" export').map((token) => token.raw)).toEqual(['epic:"local storage"', 'export']);
    expect(splitFieldToken('epic:"local storage"')).toEqual({ name: 'epic', value: 'local storage' });
    expect(splitFieldToken('points=5')).toEqual({ name: 'points', value: '5' });
    expect(splitFieldToken('"business value":high')).toEqual({ name: 'business value', value: 'high' });
    expect(splitFieldToken('login')).toBeNull();
  });

  it('suggests fields for the start of their name, in the UI language or English', () => {
    expect(matchFields('Punk', catalog).map((entry) => entry.key)).toEqual(['points']);
    expect(matchFields('poi', catalog).map((entry) => entry.key)).toEqual(['points']);
    expect(resolveField('stat', catalog)?.key).toBe('status');
    expect(resolveField('x', catalog)).toBeNull();
  });

  it('resolves values by name or unique start; free fields take any text', () => {
    const status = catalog[0];
    expect(resolveValue('offen', status)).toBe('todo');
    expect(resolveValue('in prog', status)).toBe('in_progress');
    expect(resolveValue('re', status)).toBe('review');
    expect(resolveValue('xyz', status)).toBeNull();
    expect(resolveValue('high', catalog[3])).toBe('high');
  });

  it('reads filters from the text and leaves the free text', () => {
    const parsed = parseQueryText('punkte:5 export epic:"local storage"', catalog);
    expect(parsed.text).toBe('export');
    expect(parsed.filters).toEqual([
      { field: 'points', value: '5' },
      { field: 'epic', value: 'e2' }
    ]);
    expect(parsed.problems).toEqual([]);
  });

  it('keeps the last value when a field is typed twice', () => {
    expect(parseQueryText('status:offen status=review', catalog).filters).toEqual([{ field: 'status', value: 'review' }]);
  });

  it('reports unknown fields and values and leaves them out, but ignores words still being typed', () => {
    const parsed = parseQueryText('farbe:rot status:xyz @pu punkte: login', catalog);
    expect(parsed.text).toBe('login');
    expect(parsed.filters).toEqual([]);
    expect(parsed.problems.map((problem) => problem.kind)).toEqual(['field', 'value']);
  });

  it('lets a typed filter replace the badge of the same field', () => {
    const { query: effective } = effectiveQuery(query('status:review data', [{ field: 'status', value: 'todo' }, { field: 'points', value: '3' }]), catalog);
    expect(effective).toEqual({
      text: 'data',
      filters: [
        { field: 'status', value: 'review' },
        { field: 'points', value: '3' }
      ]
    });
  });

  it('writes field names to insert in lower case, quoted when they have spaces', () => {
    expect(fieldToken(catalog[1])).toBe('punkte:');
    expect(fieldToken(catalog[3])).toBe('"business value":');
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

  it('does not search checkboxes as text', () => {
    expect(ids(search(withFields, query('true')))).toEqual([]);
  });

  it('filters by custom fields: option, yes or no, contained text', () => {
    expect(ids(search(withFields, query('', [{ field: customFieldKey('f-prio'), value: 'o-must' }])))).toEqual(['story:3']);
    expect(ids(search(withFields, query('', [{ field: customFieldKey('f-done'), value: 'true' }])))).toEqual(['story:3']);
    expect(ids(search(withFields, query('', [{ field: customFieldKey('f-done'), value: 'false' }]))).length).toBe(3);
    expect(ids(search(withFields, query('', [{ field: customFieldKey('f-risk'), value: 'lock' }])))).toEqual(['story:3']);
    expect(fieldValues(withFields, customFieldKey('f-prio'))).toEqual(['o-must']);
    expect(fieldValues(withFields, customFieldKey('f-risk'))).toEqual(['Vendor lock-in']);
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
