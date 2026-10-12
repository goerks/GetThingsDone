import { criteriaProgress, sortByRank } from './board';
import { formatValue } from './fields';
import { mapSprints, runningSprint, sortSprints } from './sprints';
import type { Epic, FieldDefinition, Snapshot, Sprint, Status, Story } from './types';

/** What a result is. The order is the order of the groups in the result list. */
export const RESULT_KINDS = ['story', 'epic', 'sprint'] as const;
export type ResultKind = (typeof RESULT_KINDS)[number];

/** Fields a filter chip can restrict. */
export const FILTER_FIELDS = ['status', 'epic', 'sprint', 'type', 'points', 'criteria', 'scope'] as const;
export type FilterField = (typeof FILTER_FIELDS)[number];

/** Filter value of the sprint field for stories that are not planned in any sprint. */
export const NOT_PLANNED = 'none';

/** Filter value of the epic field for stories without an epic. */
export const NO_EPIC = 'none';

export const CRITERIA_STATES = ['all', 'open', 'none'] as const;
export type CriteriaState = (typeof CRITERIA_STATES)[number];

/** Where free text is looked for when the "Search in" filter is set. Epic and sprint names count as titles. */
export const TEXT_SCOPES = ['title', 'description', 'criteria'] as const;
export type TextScope = (typeof TEXT_SCOPES)[number];

/**
 * One chip: a field and its values. Values of one field are combined with OR,
 * different chips with AND; `negate` turns the chip into "is not".
 */
export interface Filter {
  field: FilterField;
  values: string[];
  negate: boolean;
}

export interface SearchQuery {
  text: string;
  filters: Filter[];
}

export const EMPTY_QUERY: SearchQuery = { text: '', filters: [] };

/** A range in a text, end exclusive. */
export interface Range {
  start: number;
  end: number;
}

export interface Snippet {
  /** Where the match was found. */
  field: 'description' | 'criterion' | 'custom';
  /** Name of the custom field the match is in. */
  fieldName?: string;
  text: string;
  ranges: Range[];
  /** True when text was cut off before or after the snippet. */
  cutStart: boolean;
  cutEnd: boolean;
}

export type SearchResult =
  | { kind: 'story'; id: string; story: Story; codeRanges: Range[]; titleRanges: Range[]; snippet: Snippet | null }
  | { kind: 'epic'; id: string; epic: Epic; nameRanges: Range[] }
  | { kind: 'sprint'; id: string; sprint: Sprint; nameRanges: Range[] };

// ---------- Text ----------

const DIACRITICS = /\p{M}/gu;

/** Lower case without accents, so "Écran" and "ecran" match. Each character of the input maps to its folded form. */
function foldChar(char: string): string {
  return char.normalize('NFD').replace(DIACRITICS, '').toLowerCase();
}

export function fold(text: string): string {
  return Array.from(text, foldChar).join('');
}

/** The folded text and, for each folded position, the position of the character it came from. */
function foldWithMap(text: string): { folded: string; origin: number[] } {
  let folded = '';
  const origin: number[] = [];
  let index = 0;
  for (const char of text) {
    const piece = foldChar(char);
    for (let i = 0; i < piece.length; i += 1) origin.push(index);
    folded += piece;
    index += char.length;
  }
  origin.push(index);
  return { folded, origin };
}

/** Splits the query text into terms: words, and phrases in double quotes. Terms are folded. */
export function parseTerms(text: string): string[] {
  const terms: string[] = [];
  const pattern = /"([^"]*)"?|(\S+)/g;
  for (const match of text.matchAll(pattern)) {
    const term = fold((match[1] ?? match[2] ?? '').trim().replace(/\s+/g, ' '));
    if (term) terms.push(term);
  }
  return terms;
}

/** All ranges in `text` where one of the terms occurs, merged and in order. */
export function findRanges(text: string, terms: readonly string[]): Range[] {
  if (terms.length === 0 || !text) return [];
  const { folded, origin } = foldWithMap(text);
  const ranges: Range[] = [];
  for (const term of terms) {
    let from = folded.indexOf(term);
    while (from !== -1) {
      const end = from + term.length;
      // Map back to the original text: from the first source character to the end of the last one.
      const last = origin[end - 1];
      const lastEnd = origin.find((value) => value > last) ?? text.length;
      ranges.push({ start: origin[from], end: lastEnd });
      from = folded.indexOf(term, from + 1);
    }
  }
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: Range[] = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

const SNIPPET_BEFORE = 30;
const SNIPPET_LENGTH = 90;

/** A short piece of `text` around the first match of the terms, with the matches that fall inside it. */
export function makeSnippet(field: Snippet['field'], text: string, terms: readonly string[]): Snippet {
  const flat = text.replace(/\s+/g, ' ').trim();
  const ranges = findRanges(flat, terms);
  const first = ranges[0] ?? { start: 0, end: 0 };
  let start = Math.max(0, first.start - SNIPPET_BEFORE);
  if (start > 0) {
    // Start at a word boundary.
    const space = flat.indexOf(' ', start);
    if (space !== -1 && space < first.start) start = space + 1;
  }
  let end = Math.min(flat.length, start + SNIPPET_LENGTH);
  if (end < flat.length) {
    const space = flat.lastIndexOf(' ', end);
    if (space > first.end) end = space;
  }
  const inside = ranges
    .filter((range) => range.end > start && range.start < end)
    .map((range) => ({ start: Math.max(range.start, start) - start, end: Math.min(range.end, end) - start }));
  return { field, text: flat.slice(start, end), ranges: inside, cutStart: start > 0, cutEnd: end < flat.length };
}

/** True when every term occurs in at least one of the texts. */
function allTermsIn(texts: readonly string[], terms: readonly string[]): boolean {
  const folded = texts.map(fold);
  return terms.every((term) => folded.some((text) => text.includes(term)));
}

// ---------- Filters ----------

/** The value a story has for a field. */
function storyValues(story: Story, field: FilterField): string[] {
  switch (field) {
    case 'status':
      return [story.status];
    case 'epic':
      return [story.epicId ?? NO_EPIC];
    case 'sprint':
      return [story.sprintId ?? NOT_PLANNED];
    case 'type':
      return ['story'];
    case 'points':
      return [String(story.points)];
    case 'criteria':
      return [criteriaState(story)];
    case 'scope':
      return [];
  }
}

export function criteriaState(story: Pick<Story, 'criteria'>): CriteriaState {
  const progress = criteriaProgress(story);
  if (progress.total === 0) return 'none';
  return progress.done === progress.total ? 'all' : 'open';
}

/** The values an epic or sprint has for a field, or null when the field does not apply to it. */
function itemValues(kind: 'epic' | 'sprint', id: string, field: FilterField): string[] | null {
  if (field === 'type') return [kind];
  if (field === 'scope') return [];
  if (field === kind) return [id];
  return null;
}

function passes(values: string[] | null, filter: Filter): boolean {
  if (filter.field === 'scope' || filter.values.length === 0) return true;
  if (values === null) return false;
  const hit = values.some((value) => filter.values.includes(value));
  return filter.negate ? !hit : hit;
}

function scopes(filters: readonly Filter[]): Set<TextScope> {
  const chosen = filters.find((filter) => filter.field === 'scope' && filter.values.length > 0);
  return new Set((chosen?.values ?? TEXT_SCOPES) as TextScope[]);
}

// ---------- Search ----------

/** True when the query asks for anything: text or at least one filter with values. */
export function isActive(query: SearchQuery): boolean {
  return parseTerms(query.text).length > 0 || query.filters.some((filter) => filter.values.length > 0);
}

interface Ranked {
  result: SearchResult;
  /** Lower comes first: 0 exact code, 1 match in the title, 2 match elsewhere. */
  tier: number;
  order: number;
}

/** Text of the custom field values of an item, with the field name; checkboxes and empty values have no text. */
function customTexts(values: Story['values'], fields: readonly FieldDefinition[]): { name: string; text: string }[] {
  return fields
    .filter((field) => field.kind === 'custom' && field.dataType !== 'checkbox' && values[field.id] !== undefined)
    .map((field) => ({ name: field.label ?? '', text: formatValue(field, values[field.id]) }))
    .filter((item) => item.text.trim() !== '');
}

function matchStory(
  story: Story,
  terms: readonly string[],
  scope: Set<TextScope>,
  text: string,
  fields: readonly FieldDefinition[]
): Ranked | null {
  const titleTexts = scope.has('title') ? [story.code, story.title] : [];
  const descriptionTexts = scope.has('description') ? [story.description] : [];
  const criteriaTexts = scope.has('criteria') ? story.criteria.map((criterion) => criterion.text) : [];
  // Custom fields are content, like the description.
  const custom = scope.has('description') && terms.length > 0 ? customTexts(story.values ?? {}, fields) : [];
  const customValues = custom.map((item) => item.text);
  if (terms.length > 0 && !allTermsIn([...titleTexts, ...descriptionTexts, ...criteriaTexts, ...customValues], terms)) return null;

  const codeRanges = scope.has('title') ? findRanges(story.code, terms) : [];
  const titleRanges = scope.has('title') ? findRanges(story.title, terms) : [];
  const inTitle = terms.length === 0 || allTermsIn(titleTexts, terms);
  let snippet: Snippet | null = null;
  if (!inTitle) {
    const missing = terms.filter((term) => !titleTexts.some((value) => fold(value).includes(term)));
    const candidates: { field: Snippet['field']; text: string; name?: string }[] = [
      ...descriptionTexts.map((value) => ({ field: 'description' as const, text: value })),
      ...criteriaTexts.map((value) => ({ field: 'criterion' as const, text: value })),
      ...custom.map((item) => ({ field: 'custom' as const, text: item.text, name: item.name }))
    ];
    const found = candidates.find((candidate) => findRanges(candidate.text, missing).length > 0);
    if (found) snippet = { ...makeSnippet(found.field, found.text, terms), ...(found.name !== undefined ? { fieldName: found.name } : {}) };
  }
  const exactCode = fold(text.trim()) === fold(story.code);
  return {
    result: { kind: 'story', id: story.id, story, codeRanges, titleRanges, snippet },
    tier: exactCode ? 0 : inTitle ? 1 : 2,
    order: story.rank
  };
}

function matchName(name: string, terms: readonly string[], scope: Set<TextScope>): Range[] | null {
  if (terms.length === 0) return [];
  if (!scope.has('title') || !allTermsIn([name], terms)) return null;
  return findRanges(name, terms);
}

/**
 * Runs a query over everything in the snapshot.
 * Returns the results in display order: grouped by kind, best match first within a group.
 * A query without text and without filters returns nothing.
 */
export function search(snapshot: Snapshot, query: SearchQuery): SearchResult[] {
  if (!isActive(query)) return [];
  const terms = parseTerms(query.text);
  const filters = query.filters.filter((filter) => filter.values.length > 0);
  const scope = scopes(filters);
  const ranked: Ranked[] = [];

  for (const story of sortByRank(snapshot.stories)) {
    if (!filters.every((filter) => passes(storyValues(story, filter.field), filter))) continue;
    const match = matchStory(story, terms, scope, query.text, snapshot.fields ?? []);
    if (match) ranked.push(match);
  }
  const epics = [...snapshot.epics].sort((a, b) => a.position - b.position);
  epics.forEach((epic, index) => {
    if (!filters.every((filter) => passes(itemValues('epic', epic.id, filter.field), filter))) return;
    const nameRanges = matchName(epic.name, terms, scope);
    if (nameRanges) ranked.push({ result: { kind: 'epic', id: epic.id, epic, nameRanges }, tier: 1, order: index });
  });
  sortSprints(snapshot.sprints).forEach((sprint, index) => {
    if (!filters.every((filter) => passes(itemValues('sprint', sprint.id, filter.field), filter))) return;
    const nameRanges = matchName(sprint.name, terms, scope);
    if (nameRanges) ranked.push({ result: { kind: 'sprint', id: sprint.id, sprint, nameRanges }, tier: 1, order: index });
  });

  const kindOrder = (result: SearchResult): number => RESULT_KINDS.indexOf(result.kind);
  ranked.sort((a, b) => kindOrder(a.result) - kindOrder(b.result) || a.tier - b.tier || a.order - b.order);
  return ranked.map((item) => item.result);
}

/** Ids of the stories a query finds; used to highlight them on the board and in the backlog. */
export function matchingStoryIds(snapshot: Snapshot, query: SearchQuery): Set<string> {
  return new Set(search(snapshot, query).filter((result) => result.kind === 'story').map((result) => result.id));
}

/** Results per kind, in the order of the groups. */
export function groupResults(results: readonly SearchResult[]): { kind: ResultKind; results: SearchResult[] }[] {
  return RESULT_KINDS.map((kind) => ({ kind, results: results.filter((result) => result.kind === kind) })).filter(
    (group) => group.results.length > 0
  );
}

// ---------- Chips ----------

/** Adds a value to the chip of its field, or a new chip when the field has none yet. */
export function addFilterValue(filters: readonly Filter[], field: FilterField, value: string): Filter[] {
  const existing = filters.find((filter) => filter.field === field);
  if (!existing) return [...filters, { field, values: [value], negate: false }];
  if (existing.values.includes(value)) return [...filters];
  return filters.map((filter) => (filter === existing ? { ...filter, values: [...filter.values, value] } : filter));
}

/** Sets the values and "is not" of a field; no values removes the chip. The chip keeps its place. */
export function setFilter(filters: readonly Filter[], field: FilterField, values: string[], negate: boolean): Filter[] {
  const index = filters.findIndex((filter) => filter.field === field);
  if (values.length === 0) return filters.filter((filter) => filter.field !== field);
  const next: Filter = { field, values, negate: field === 'scope' ? false : negate };
  if (index === -1) return [...filters, next];
  return filters.map((filter, i) => (i === index ? next : filter));
}

export function removeFilter(filters: readonly Filter[], field: FilterField): Filter[] {
  return filters.filter((filter) => filter.field !== field);
}

/** Possible values of a field, in display order. */
export function fieldValues(snapshot: Snapshot, field: FilterField): string[] {
  switch (field) {
    case 'status':
      return ['todo', 'in_progress', 'review', 'done'] satisfies Status[];
    case 'epic': {
      const epics = [...snapshot.epics].sort((a, b) => a.position - b.position).map((epic) => epic.id);
      return snapshot.stories.some((story) => story.epicId === null) ? [...epics, NO_EPIC] : epics;
    }
    case 'sprint':
      return [...sortSprints(snapshot.sprints).map((sprint) => sprint.id), NOT_PLANNED];
    case 'type':
      return [...RESULT_KINDS];
    case 'points':
      return [...new Set(snapshot.stories.map((story) => story.points))].sort((a, b) => a - b).map(String);
    case 'criteria':
      return [...CRITERIA_STATES];
    case 'scope':
      return [...TEXT_SCOPES];
  }
}

/**
 * Number of results for each value of a field, counting what the query would find
 * if this field's chip were set to just that value. The text and all other chips stay.
 */
export function valueCounts(snapshot: Snapshot, query: SearchQuery, field: FilterField): Map<string, number> {
  const counts = new Map<string, number>();
  const others = query.filters.filter((filter) => filter.field !== field);
  for (const value of fieldValues(snapshot, field)) {
    const filters = [...others, { field, values: [value], negate: false }];
    counts.set(value, search(snapshot, { text: query.text, filters }).length);
  }
  return counts;
}

/** A filter that free text could stand for, such as "review" for Status = Review. */
export interface FilterSuggestion {
  field: FilterField;
  value: string;
  label: string;
}

/**
 * Field values whose name the free text spells out (whole name, or its start with at least three letters).
 * Values already used in a chip are left out. `labels` are the names in the current language.
 */
export function suggestFilters(
  text: string,
  filters: readonly Filter[],
  labels: readonly FilterSuggestion[],
  limit = 3
): FilterSuggestion[] {
  const typed = fold(text.trim());
  if (typed.length < 2) return [];
  const used = (candidate: FilterSuggestion): boolean =>
    filters.some((filter) => filter.field === candidate.field && filter.values.includes(candidate.value));
  const exact: FilterSuggestion[] = [];
  const prefix: FilterSuggestion[] = [];
  for (const candidate of labels) {
    if (used(candidate)) continue;
    const name = fold(candidate.label);
    if (name === typed) exact.push(candidate);
    else if (typed.length >= 3 && name.startsWith(typed)) prefix.push(candidate);
  }
  return [...exact, ...prefix].slice(0, limit);
}

/** For a query without results: how many results there would be without each chip. Only chips that help are listed. */
export function relaxations(snapshot: Snapshot, query: SearchQuery): { field: FilterField; count: number }[] {
  return query.filters
    .map((filter) => ({
      field: filter.field,
      count: search(snapshot, { text: query.text, filters: removeFilter(query.filters, filter.field) }).length
    }))
    .filter((item) => item.count > 0);
}

/** Two queries are the same when text and chips are equal; used to avoid duplicates in the history. */
export function sameQuery(a: SearchQuery, b: SearchQuery): boolean {
  const key = (query: SearchQuery): string =>
    JSON.stringify({
      text: query.text.trim().replace(/\s+/g, ' ').toLowerCase(),
      filters: [...query.filters]
        .map((filter) => ({ ...filter, values: [...filter.values].sort() }))
        .sort((x, y) => x.field.localeCompare(y.field))
    });
  return key(a) === key(b);
}

// ---------- Current page ----------

/** The stories, epics and sprints the current page shows. */
export type PageItems = Record<ResultKind, ReadonlySet<string>>;

export const isOnPage = (result: Pick<SearchResult, 'kind' | 'id'>, page: PageItems): boolean => page[result.kind].has(result.id);

/**
 * Orders results for the current page: within each group, items shown on the page come first.
 * With `onlyPage`, results that are not on the page are left out.
 */
export function arrangeForPage(results: readonly SearchResult[], page: PageItems | null, onlyPage: boolean): SearchResult[] {
  if (!page) return [...results];
  if (onlyPage) return results.filter((result) => isOnPage(result, page));
  return RESULT_KINDS.flatMap((kind) => {
    const group = results.filter((result) => result.kind === kind);
    return [...group.filter((result) => isOnPage(result, page)), ...group.filter((result) => !isOnPage(result, page))];
  });
}

// ---------- Where an item is shown ----------

/** The pages that show stories, epics or sprints. */
export type View = 'board' | 'backlog' | 'map' | 'epics';

/**
 * The pages an item appears on, in the order a result should be shown in when it is not on the current page:
 * a story on the board (running sprint), in the backlog, on the story map (running and future sprints, not planned);
 * an epic on the epics page and the story map; a sprint on the board (running), the story map and in the backlog.
 */
export function whereShown(snapshot: Snapshot, kind: ResultKind, id: string, today: string): View[] {
  const running = runningSprint(snapshot.sprints, today);
  const onMap = new Set(mapSprints(snapshot.sprints, today).map((sprint) => sprint.id));
  if (kind === 'story') {
    const story = snapshot.stories.find((item) => item.id === id);
    if (!story) return [];
    const views: View[] = [];
    if (running && story.sprintId === running.id) views.push('board');
    views.push('backlog');
    if (story.sprintId === null || onMap.has(story.sprintId)) views.push('map');
    return views;
  }
  if (kind === 'epic') return snapshot.epics.some((epic) => epic.id === id) ? ['epics', 'map'] : [];
  if (!snapshot.sprints.some((sprint) => sprint.id === id)) return [];
  const views: View[] = [];
  if (running?.id === id) views.push('board');
  if (onMap.has(id)) views.push('map');
  views.push('backlog');
  return views;
}

/** The page to show a result on: the current page if it shows the item, else the first page that does, else none. */
export function viewFor(current: string, shownOn: readonly View[]): View | null {
  if ((shownOn as readonly string[]).includes(current)) return current as View;
  return shownOn[0] ?? null;
}
