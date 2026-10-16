import { nextCode } from './board';
import { assignTo } from './fields';
import { startStatus, statusesIn } from './statuses';
import { EPIC_COLOR_KEYS, type Criterion, type FieldAssignment, type FieldDefinition, type FieldOption, type StatusValue, type Story } from './types';

/*
 * Import and sync from GitHub Issues (#30): the rules, without any network. The access to GitHub is in `src/github/`.
 * GitHub wins: title, description, labels, the open or closed state and the task list under the heading "Acceptance
 * criteria" come from the issue. Sprint, points, rank and the epic stay with the story.
 */

/** An issue as the sync needs it. Pull requests never get here. */
export interface GithubIssue {
  number: number;
  title: string;
  /** The text of the issue, Markdown, empty when there is none. */
  body: string;
  state: 'open' | 'closed';
  /** Names of the labels. */
  labels: string[];
  /** The address of the issue on github.com, `https://github.com/<owner>/<name>/issues/<number>`. */
  url: string;
}

export interface RepoRef {
  owner: string;
  name: string;
}

const REPO_PART = /^[A-Za-z0-9_.-]+$/;

/** `owner/name` from the text of the settings (a github.com address is accepted too). Null when it is not a repository. */
export function parseRepo(text: string): RepoRef | null {
  const trimmed = text
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '');
  const parts = trimmed.split('/');
  if (parts.length !== 2 || !parts.every((part) => REPO_PART.test(part) && part !== '.' && part !== '..')) return null;
  return { owner: parts[0], name: parts[1] };
}

export const repoText = (repo: RepoRef): string => `${repo.owner}/${repo.name}`;

/** The number of the issue an address names, or null. */
export function issueNumberOf(url: string): number | null {
  const match = /\/issues\/(\d+)$/.exec(url);
  return match ? Number(match[1]) : null;
}

/** The address of an issue; the same text GitHub gives as `html_url`, so it identifies an issue across syncs. */
export const issueUrl = (repo: RepoRef, number: number): string => `https://github.com/${repo.owner}/${repo.name}/issues/${number}`;

/** Whether an address belongs to the repository. */
export const inRepo = (url: string, repo: RepoRef): boolean => url.toLowerCase().startsWith(`https://github.com/${repoText(repo)}/issues/`.toLowerCase());

/* ---------- The text of an issue ---------- */

export interface ParsedCriterion {
  text: string;
  done: boolean;
}

const HEADING = /^ {0,3}#{1,6}\s+(.*?)\s*#*\s*$/;
const CRITERIA_HEADING = /^(acceptance criteria|akzeptanzkriterien|abnahmekriterien)\s*:?$/i;
const TASK = /^\s*[-*+]\s+\[([ xX])\]\s+(.*\S)\s*$/;

/**
 * Splits the text of an issue. The task list under the heading "Acceptance criteria" (or "Akzeptanzkriterien",
 * "Abnahmekriterien") becomes the criteria; the rest is the description, without that heading and those tasks. Without
 * such a heading, or without tasks under it, there are no criteria and the whole text is the description.
 */
export function splitBody(body: string): { description: string; criteria: ParsedCriterion[] } {
  const text = body.replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const start = lines.findIndex((line) => {
    const heading = HEADING.exec(line);
    return heading !== null && CRITERIA_HEADING.test(heading[1]);
  });
  if (start < 0) return { description: text.trim(), criteria: [] };
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (HEADING.test(lines[index])) {
      end = index;
      break;
    }
  }
  const criteria: ParsedCriterion[] = [];
  const kept: string[] = lines.slice(0, start);
  for (const line of lines.slice(start + 1, end)) {
    const task = TASK.exec(line);
    if (task) criteria.push({ text: task[2].trim(), done: task[1] !== ' ' });
    else kept.push(line);
  }
  if (criteria.length === 0) return { description: text.trim(), criteria: [] };
  kept.push(...lines.slice(end));
  return { description: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(), criteria };
}

/* ---------- Labels as a field ---------- */

/** The field that holds the labels of an issue. A custom field of the team, so labels can be shown, searched and changed like any other. */
export const LABELS_FIELD_ID = 'field-github-labels';

const slug = (label: string): string => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function colorFor(label: string): FieldOption['colorKey'] {
  let hash = 0;
  for (const char of label) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return EPIC_COLOR_KEYS[hash % EPIC_COLOR_KEYS.length];
}

/** The labels field with an option for every label. Existing options keep their id; a label that is new gets one. */
function withLabelOptions(field: FieldDefinition | undefined, labels: readonly string[]): FieldDefinition {
  const base: FieldDefinition = field ?? {
    id: LABELS_FIELD_ID,
    builtinKey: null,
    kind: 'custom',
    dataType: 'multi_select',
    label: 'Labels',
    options: [],
    defaultValue: null
  };
  const options = [...base.options];
  for (const label of labels) {
    if (options.some((option) => option.label.toLowerCase() === label.toLowerCase())) continue;
    let id = `gh-label-${slug(label) || 'label'}`;
    for (let suffix = 2; options.some((option) => option.id === id); suffix += 1) id = `gh-label-${slug(label) || 'label'}-${suffix}`;
    options.push({ id, label, colorKey: colorFor(label) });
  }
  return options.length === base.options.length ? base : { ...base, options };
}

const optionIdsOf = (field: FieldDefinition, labels: readonly string[]): string[] =>
  labels.flatMap((label) => field.options.find((option) => option.label.toLowerCase() === label.toLowerCase())?.id ?? []);

const asIds = (value: unknown): string[] => (Array.isArray(value) ? (value as string[]) : []);

/* ---------- Import and sync ---------- */

/** What changed on one story. The sync shows these to the user. */
export type GithubChange =
  | { kind: 'created' }
  | { kind: 'title'; from: string; to: string }
  | { kind: 'description' }
  | { kind: 'labels'; added: string[]; removed: string[] }
  | { kind: 'criteria'; added: number; removed: number; changed: number }
  | { kind: 'closed' }
  | { kind: 'reopened' };

export interface SyncEntry {
  storyId: string;
  code: string;
  number: number;
  /** The title after the sync. */
  title: string;
  changes: GithubChange[];
}

/** What a sync did, for the dialog after it: new stories, stories that were closed on GitHub, and other changes. */
export interface SyncSummary {
  created: SyncEntry[];
  closed: SyncEntry[];
  updated: SyncEntry[];
}

export interface SyncInput {
  stories: readonly Story[];
  fields: readonly FieldDefinition[];
  assignments: readonly FieldAssignment[];
  statuses: readonly StatusValue[];
  repo: RepoRef;
  /** The issues to bring in: the open issues of the repository, and the issues the stories already point to. */
  issues: readonly GithubIssue[];
  newId: () => string;
}

export interface SyncPlan {
  stories: Story[];
  fields: FieldDefinition[];
  assignments: FieldAssignment[];
  summary: SyncSummary;
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((item) => b.includes(item));

/**
 * Brings the issues into the stories. An open issue without a story becomes a story at the end of the backlog; a
 * story that points to an issue takes title, description, labels, criteria and ticks from it. A closed issue puts the
 * story into the first "done" status, an issue that was closed at the last sync and is open now puts a done story back
 * to the start status. Everything else of a story stays as it is.
 */
export function planSync(input: SyncInput): SyncPlan {
  const { repo, statuses, newId } = input;
  const issues = input.issues.filter((issue) => inRepo(issue.url, repo));
  const labelNames = [...new Set(issues.flatMap((issue) => issue.labels))];
  const hadField = input.fields.find((field) => field.id === LABELS_FIELD_ID);
  const field = withLabelOptions(hadField, labelNames);
  const fieldChanged = field !== hadField;
  const fields = !hadField ? [...input.fields, field] : fieldChanged ? input.fields.map((item) => (item.id === field.id ? field : item)) : [...input.fields];
  const assignments = hadField || input.assignments.some((item) => item.fieldId === field.id) ? [...input.assignments] : assignTo(input.assignments, field.id, ['story']);

  const doneStatus = statusesIn(statuses, 'done')[0]?.id;
  const start = startStatus(statuses);
  const isDoneStatus = (status: string): boolean => statuses.some((item) => item.id === status && item.category === 'done');
  const summary: SyncSummary = { created: [], closed: [], updated: [] };
  const stories = [...input.stories];

  for (const issue of issues) {
    const { description, criteria: parsed } = splitBody(issue.body);
    const title = issue.title.trim();
    const optionIds = optionIdsOf(field, issue.labels);
    const index = stories.findIndex((story) => story.github?.url === issue.url);

    if (index < 0) {
      if (issue.state !== 'open') continue;
      const story: Story = {
        id: newId(),
        code: nextCode(stories),
        title,
        description,
        epicId: null,
        points: 0,
        status: start,
        sprintId: null,
        releaseId: null,
        rank: stories.reduce((max, item) => Math.max(max, item.rank), -1) + 1,
        criteria: parsed.map((item) => ({ id: newId(), text: item.text, done: item.done })),
        values: optionIds.length > 0 ? { [field.id]: optionIds } : {},
        checks: {},
        doneItems: null,
        github: { url: issue.url, state: 'open' }
      };
      stories.push(story);
      summary.created.push({ storyId: story.id, code: story.code, number: issue.number, title: story.title, changes: [{ kind: 'created' }] });
      continue;
    }

    const story = stories[index];
    const changes: GithubChange[] = [];
    let next: Story = story;

    if (title !== story.title) {
      changes.push({ kind: 'title', from: story.title, to: title });
      next = { ...next, title };
    }
    if (description !== story.description.trim()) {
      changes.push({ kind: 'description' });
      next = { ...next, description };
    }

    const oldIds = asIds(story.values[field.id]);
    if (!sameSet(oldIds, optionIds)) {
      const name = (id: string): string => field.options.find((option) => option.id === id)?.label ?? id;
      changes.push({
        kind: 'labels',
        added: optionIds.filter((id) => !oldIds.includes(id)).map(name),
        removed: oldIds.filter((id) => !optionIds.includes(id)).map(name)
      });
      const values = { ...next.values };
      if (optionIds.length > 0) values[field.id] = optionIds;
      else delete values[field.id];
      next = { ...next, values };
    }

    const free = [...story.criteria];
    let ticked = 0;
    const criteria: Criterion[] = parsed.map((item) => {
      const at = free.findIndex((old) => old.text === item.text);
      if (at < 0) return { id: newId(), text: item.text, done: item.done };
      const [old] = free.splice(at, 1);
      if (old.done !== item.done) ticked += 1;
      return { ...old, done: item.done };
    });
    const added = criteria.filter((item) => !story.criteria.some((old) => old.id === item.id)).length;
    const removed = free.length;
    const reordered = criteria.some((item, position) => story.criteria[position]?.id !== item.id);
    if (added > 0 || removed > 0 || ticked > 0 || reordered) {
      changes.push({ kind: 'criteria', added, removed, changed: ticked });
      next = { ...next, criteria };
    }

    let closed = false;
    if (issue.state === 'closed' && !isDoneStatus(story.status) && doneStatus) {
      changes.push({ kind: 'closed' });
      next = { ...next, status: doneStatus };
      closed = true;
    } else if (issue.state === 'open' && story.github?.state === 'closed' && isDoneStatus(story.status)) {
      changes.push({ kind: 'reopened' });
      next = { ...next, status: start };
    }
    if (next.github?.state !== issue.state) next = { ...next, github: { url: issue.url, state: issue.state } };

    if (next !== story) stories[index] = next;
    if (changes.length > 0) {
      const entry: SyncEntry = { storyId: story.id, code: story.code, number: issue.number, title: next.title, changes };
      (closed ? summary.closed : summary.updated).push(entry);
    }
  }

  return { stories, fields, assignments, summary };
}

/** The numbers of the issues the stories point to that are not in the list, so the sync can ask GitHub for them (they may be closed now). */
export function linkedNumbersMissingIn(stories: readonly Story[], repo: RepoRef, issues: readonly GithubIssue[]): number[] {
  const known = new Set(issues.map((issue) => issue.url));
  return stories.flatMap((story) => {
    const url = story.github?.url;
    if (!url || !inRepo(url, repo) || known.has(url) || story.github?.state === 'closed') return [];
    const number = issueNumberOf(url);
    return number === null ? [] : [number];
  });
}

/** Whether nothing changed. */
export const isEmptySummary = (summary: SyncSummary): boolean => summary.created.length + summary.closed.length + summary.updated.length === 0;
