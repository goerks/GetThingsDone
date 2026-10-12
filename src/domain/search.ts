import { criteriaProgress, sortByRank } from './board';
import { formatValue } from './fields';
import { mapSprints, runningSprint, sortSprints } from './sprints';
import type { Epic, FieldDefinition, FieldValue, SearchSnapshot, Sprint, Status, Story } from './types';

/** What a result is. The order is the order of the groups in the result list. */
export const RESULT_KINDS = ['story', 'epic', 'sprint'] as const;
export type ResultKind = (typeof RESULT_KINDS)[number];

/** Built-in fields a filter can restrict. Custom fields use the key `field:<id>`. */
export const BUILTIN_FILTER_FIELDS = ['description', 'status', 'epic', 'sprint', 'points', 'type', 'criteria'] as const;

/** Built-in fields whose value is any typed text the field must contain. Key and title are left to the free text (PO decision in #7). */
export const TEXT_FILTER_FIELDS: readonly BuiltinFilterField[] = ['description'];
export type BuiltinFilterField = (typeof BUILTIN_FILTER_FIELDS)[number];

/** Key of a filter field: a built-in field, or `field:<id>` for a custom field. */
export type FilterField = string;

const CUSTOM_PREFIX = 'field:';
export const customFieldKey = (fieldId: string): FilterField => `${CUSTOM_PREFIX}${fieldId}`;
export const customFieldId = (key: FilterField): string | null =>
  key.startsWith(CUSTOM_PREFIX) ? key.slice(CUSTOM_PREFIX.length) : null;

/** Filter value of the sprint field for stories that are not planned in any sprint. */
export const NOT_PLANNED = 'none';

/** Filter value of the epic field for stories without an epic. */
export const NO_EPIC = 'none';

export const CRITERIA_STATES = ['all', 'open', 'none'] as const;
export type CriteriaState = (typeof CRITERIA_STATES)[number];

/** One filter, shown as a badge: a field and one value. Filters are combined with AND; each field at most once. */
export interface Filter {
  field: FilterField;
  value: string;
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

export function criteriaState(story: Pick<Story, 'criteria'>): CriteriaState {
  const progress = criteriaProgress(story);
  if (progress.total === 0) return 'none';
  return progress.done === progress.total ? 'all' : 'open';
}

/** Whether a custom field value matches a filter value: the option for selects, yes or no, the number, or contained text. */
function customMatches(field: FieldDefinition, raw: FieldValue | undefined, value: string): boolean {
  if (field.dataType === 'checkbox') return String(raw === true) === value;
  if (raw === undefined || raw === null || raw === '') return false;
  switch (field.dataType) {
    case 'single_select':
      return raw === value;
    case 'multi_select':
      return Array.isArray(raw) && raw.includes(value);
    case 'number':
      return Number(raw) === Number(value);
    default:
      return fold(formatValue(field, raw)).includes(fold(value));
  }
}

type Item = { kind: 'story'; story: Story } | { kind: 'epic'; epic: Epic } | { kind: 'sprint'; sprint: Sprint };

/** Whether a custom field is on an item type; without any assignments a field counts as a story field. */
function hasField(snapshot: SearchSnapshot, fieldId: string, kind: ResultKind): boolean {
  const assignments = (snapshot.assignments ?? []).filter((assignment) => assignment.fieldId === fieldId);
  if (assignments.length === 0) return kind === 'story';
  return assignments.some((assignment) => assignment.itemType === kind);
}

/** Whether an item passes a filter. A filter on a field the item does not have excludes the item. */
function passes(item: Item, filter: Filter, snapshot: SearchSnapshot): boolean {
  const customId = customFieldId(filter.field);
  if (customId !== null) {
    const field = (snapshot.fields ?? []).find((candidate) => candidate.id === customId);
    if (!field || !hasField(snapshot, customId, item.kind)) return false;
    if (item.kind === 'story') return customMatches(field, item.story.values?.[customId], filter.value);
    if (item.kind === 'epic') return customMatches(field, item.epic.values?.[customId], filter.value);
    return false;
  }
  if (filter.field === 'type') return item.kind === filter.value;
  const contains = (text: string): boolean => fold(text).includes(fold(filter.value));
  if (item.kind === 'epic') return filter.field === 'epic' && item.epic.id === filter.value;
  if (item.kind === 'sprint') return filter.field === 'sprint' && item.sprint.id === filter.value;
  const story = item.story;
  switch (filter.field) {
    case 'description':
      return contains(story.description);
    case 'status':
      return story.status === filter.value;
    case 'epic':
      return (story.epicId ?? NO_EPIC) === filter.value;
    case 'sprint':
      return (story.sprintId ?? NOT_PLANNED) === filter.value;
    case 'points':
      return String(story.points) === filter.value;
    case 'criteria':
      return criteriaState(story) === filter.value;
    default:
      return false;
  }
}

// ---------- Search ----------

/** True when the query asks for anything: text or at least one filter. */
export function isActive(query: SearchQuery): boolean {
  return parseTerms(query.text).length > 0 || query.filters.length > 0;
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

function matchStory(story: Story, terms: readonly string[], text: string, fields: readonly FieldDefinition[]): Ranked | null {
  const titleTexts = [story.code, story.title];
  const criteriaTexts = story.criteria.map((criterion) => criterion.text);
  const custom = terms.length > 0 ? customTexts(story.values ?? {}, fields) : [];
  if (terms.length > 0 && !allTermsIn([...titleTexts, story.description, ...criteriaTexts, ...custom.map((item) => item.text)], terms))
    return null;

  const codeRanges = findRanges(story.code, terms);
  const titleRanges = findRanges(story.title, terms);
  const inTitle = terms.length === 0 || allTermsIn(titleTexts, terms);
  let snippet: Snippet | null = null;
  if (!inTitle) {
    const missing = terms.filter((term) => !titleTexts.some((value) => fold(value).includes(term)));
    const candidates: { field: Snippet['field']; text: string; name?: string }[] = [
      { field: 'description', text: story.description },
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

function matchName(name: string, terms: readonly string[]): Range[] | null {
  if (terms.length === 0) return [];
  if (!allTermsIn([name], terms)) return null;
  return findRanges(name, terms);
}

/**
 * Runs a query over everything in the snapshot. `query.text` is free text only; field filters are in `query.filters`
 * (see `parseQueryText` for typed filters). Returns the results grouped by kind, best match first within a group.
 * A query without text and without filters returns nothing.
 */
export function search(snapshot: SearchSnapshot, query: SearchQuery): SearchResult[] {
  if (!isActive(query)) return [];
  const terms = parseTerms(query.text);
  const fields = snapshot.fields ?? [];
  const ok = (item: Item): boolean => query.filters.every((filter) => passes(item, filter, snapshot));
  const ranked: Ranked[] = [];

  for (const story of sortByRank(snapshot.stories)) {
    if (!ok({ kind: 'story', story })) continue;
    const match = matchStory(story, terms, query.text, fields);
    if (match) ranked.push(match);
  }
  [...snapshot.epics]
    .sort((a, b) => a.position - b.position)
    .forEach((epic, index) => {
      if (!ok({ kind: 'epic', epic })) return;
      const nameRanges = matchName(epic.name, terms);
      if (nameRanges) ranked.push({ result: { kind: 'epic', id: epic.id, epic, nameRanges }, tier: 1, order: index });
    });
  sortSprints(snapshot.sprints).forEach((sprint, index) => {
    if (!ok({ kind: 'sprint', sprint })) return;
    const nameRanges = matchName(sprint.name, terms);
    if (nameRanges) ranked.push({ result: { kind: 'sprint', id: sprint.id, sprint, nameRanges }, tier: 1, order: index });
  });

  const kindOrder = (result: SearchResult): number => RESULT_KINDS.indexOf(result.kind);
  ranked.sort((a, b) => kindOrder(a.result) - kindOrder(b.result) || a.tier - b.tier || a.order - b.order);
  return ranked.map((item) => item.result);
}

/** Results per kind, in the order of the groups. */
export function groupResults(results: readonly SearchResult[]): { kind: ResultKind; results: SearchResult[] }[] {
  return RESULT_KINDS.map((kind) => ({ kind, results: results.filter((result) => result.kind === kind) })).filter(
    (group) => group.results.length > 0
  );
}

// ---------- Badges ----------

/** Sets the filter of a field; a field that already has a filter gets the new value in its place. */
export function setFilter(filters: readonly Filter[], filter: Filter): Filter[] {
  const index = filters.findIndex((item) => item.field === filter.field);
  if (index === -1) return [...filters, filter];
  return filters.map((item, i) => (i === index ? filter : item));
}

export function removeFilter(filters: readonly Filter[], field: FilterField): Filter[] {
  return filters.filter((filter) => filter.field !== field);
}

/** Possible values of a field, in display order. Free-text custom fields offer the values used so far. */
export function fieldValues(snapshot: SearchSnapshot, field: FilterField): string[] {
  const customId = customFieldId(field);
  if (customId !== null) {
    const definition = (snapshot.fields ?? []).find((item) => item.id === customId);
    if (!definition) return [];
    if (definition.dataType === 'single_select' || definition.dataType === 'multi_select')
      return definition.options.map((option) => option.id);
    if (definition.dataType === 'checkbox') return ['true', 'false'];
    const used = [...snapshot.stories, ...snapshot.epics]
      .map((item) => item.values?.[customId])
      .filter((value): value is FieldValue => value !== undefined && value !== '')
      .map((value) => formatValue(definition, value));
    const distinct = [...new Set(used)];
    return definition.dataType === 'number' ? distinct.sort((a, b) => Number(a) - Number(b)) : distinct.sort().slice(0, 10);
  }
  switch (field as BuiltinFilterField) {
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
    default:
      return [];
  }
}

/** For a query without results: how many results there would be without each filter. Only filters that help are listed. */
export function relaxations(snapshot: SearchSnapshot, query: SearchQuery): { field: FilterField; count: number }[] {
  return query.filters
    .map((filter) => ({
      field: filter.field,
      count: search(snapshot, { text: query.text, filters: removeFilter(query.filters, filter.field) }).length
    }))
    .filter((item) => item.count > 0);
}

/** Two queries are the same when text and filters are equal; used to avoid duplicates in the history. */
export function sameQuery(a: SearchQuery, b: SearchQuery): boolean {
  const key = (query: SearchQuery): string =>
    JSON.stringify({
      text: query.text.trim().replace(/\s+/g, ' ').toLowerCase(),
      filters: [...query.filters].sort((x, y) => x.field.localeCompare(y.field))
    });
  return key(a) === key(b);
}

// ---------- Typed filters: field:value ----------

/** A field as the search text knows it: names to type and the values it accepts. */
export interface FieldEntry {
  key: FilterField;
  /** Shown name in the current language. */
  label: string;
  /** Other names that work too, such as the English name. */
  aliases: string[];
  values: { value: string; label: string; aliases?: string[] }[];
  /** True when any typed value is accepted (text fields); the value is then contained text. */
  freeValue: boolean;
}

/** A word of the search text with its position. Quoted parts stay inside the word. */
export interface Token {
  raw: string;
  start: number;
  end: number;
}

/** Splits text into words at spaces outside double quotes. */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let start = -1;
  let quoted = false;
  for (let i = 0; i <= text.length; i += 1) {
    const char = text[i];
    const end = i === text.length || (!quoted && /\s/.test(char));
    if (end) {
      if (start !== -1) tokens.push({ raw: text.slice(start, i), start, end: i });
      start = -1;
      continue;
    }
    if (start === -1) start = i;
    if (char === '"') quoted = !quoted;
  }
  return tokens;
}

const unquote = (value: string): string => value.replace(/^"/, '').replace(/"$/, '');

/** Splits `name:value` or `name=value`; null for words without a separator. Names and values may be quoted. */
export function splitFieldToken(raw: string): { name: string; value: string } | null {
  const match = /^("[^"]*"|[^:="\s]+)[:=](.*)$/.exec(raw);
  if (!match) return null;
  return { name: unquote(match[1]), value: unquote(match[2]) };
}

/** The name to insert for a field: lower case, quoted when it has spaces. */
export function fieldToken(entry: FieldEntry): string {
  const name = entry.label.toLowerCase();
  return /\s/.test(name) ? `"${name}":` : `${name}:`;
}

const names = (entry: { label: string; aliases?: string[] }): string[] => [entry.label, ...(entry.aliases ?? [])].map(fold);

/** Fields whose name starts with the typed text, exact names first. */
export function matchFields(typed: string, catalog: readonly FieldEntry[]): FieldEntry[] {
  const folded = fold(typed);
  const exact = catalog.filter((entry) => names(entry).includes(folded));
  const prefix = catalog.filter((entry) => !exact.includes(entry) && names(entry).some((name) => name.startsWith(folded)));
  return [...exact, ...prefix];
}

/** Values of a field whose name starts with the typed text, or all values for empty text. */
export function matchValues(typed: string, entry: FieldEntry): FieldEntry['values'] {
  const folded = fold(typed);
  if (!folded) return entry.values;
  const exact = entry.values.filter((value) => names(value).includes(folded));
  const prefix = entry.values.filter((value) => !exact.includes(value) && names(value).some((name) => name.startsWith(folded)));
  return [...exact, ...prefix];
}

/** The field a typed name stands for: an exact name, else the only field it is the start of. */
export function resolveField(name: string, catalog: readonly FieldEntry[]): FieldEntry | null {
  const found = matchFields(name, catalog);
  if (found.length === 0) return null;
  if (names(found[0]).includes(fold(name))) return found[0];
  return found.length === 1 ? found[0] : null;
}

/** The value a typed text stands for: an exact name, else the only value it is the start of; any text for free fields. */
export function resolveValue(typed: string, entry: FieldEntry): string | null {
  if (!typed.trim()) return null;
  const found = matchValues(typed, entry);
  if (found.length > 0 && (names(found[0]).includes(fold(typed)) || found.length === 1)) return found[0].value;
  return entry.freeValue ? typed.trim() : null;
}

/** Something in the search text that could not be used as a filter. */
export type TextProblem = { kind: 'field'; name: string } | { kind: 'value'; field: FieldEntry; value: string };

/** A typed `field:value` that was understood. */
export interface ResolvedToken {
  token: Token;
  filter: Filter;
}

export interface ParsedText {
  /** The free text, without the field filters. */
  text: string;
  /** Field filters typed in the text, in order; a field typed twice keeps the last value. */
  filters: Filter[];
  resolved: ResolvedToken[];
  problems: TextProblem[];
}

/**
 * Reads typed filters from the search text. `name:value` (or `name=value`) becomes a filter when name and value are known.
 * Unknown ones are reported and left out of the search; so are words that are still being typed (`@sta`, `status:`).
 */
export function parseQueryText(text: string, catalog: readonly FieldEntry[]): ParsedText {
  const free: string[] = [];
  let filters: Filter[] = [];
  const resolved: ResolvedToken[] = [];
  const problems: TextProblem[] = [];
  for (const token of tokenize(text)) {
    if (token.raw.startsWith('@')) continue;
    const parts = splitFieldToken(token.raw);
    if (!parts) {
      free.push(token.raw);
      continue;
    }
    const entry = resolveField(parts.name, catalog);
    if (!entry) {
      problems.push({ kind: 'field', name: parts.name });
      continue;
    }
    if (!parts.value.trim()) continue;
    const value = resolveValue(parts.value, entry);
    if (value === null) {
      problems.push({ kind: 'value', field: entry, value: parts.value });
      continue;
    }
    const filter = { field: entry.key, value };
    filters = setFilter(filters, filter);
    resolved.push({ token, filter });
  }
  return { text: free.join(' '), filters, resolved, problems };
}

/** Badges and typed filters together; a typed filter replaces the badge of the same field. */
export function effectiveQuery(query: SearchQuery, catalog: readonly FieldEntry[]): { query: SearchQuery; parsed: ParsedText } {
  const parsed = parseQueryText(query.text, catalog);
  const filters = parsed.filters.reduce((all, filter) => setFilter(all, filter), [...query.filters]);
  return { query: { text: parsed.text, filters }, parsed };
}

// ---------- Current page ----------

/** The stories, epics and sprints the current page shows. */
export type PageItems = Record<ResultKind, ReadonlySet<string>>;

export const isOnPage = (result: Pick<SearchResult, 'kind' | 'id'>, page: PageItems): boolean => page[result.kind].has(result.id);

// ---------- Where an item is shown ----------

/** The pages that show stories, epics or sprints. */
export type View = 'board' | 'backlog' | 'map' | 'epics';

/**
 * The pages an item appears on, in the order a result should be shown in when it is not on the current page:
 * a story on the board (running sprint), in the backlog, on the story map (running and future sprints, not planned);
 * an epic on the epics page and the story map; a sprint on the board (running), the story map and in the backlog.
 */
export function whereShown(snapshot: SearchSnapshot, kind: ResultKind, id: string, today: string): View[] {
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
