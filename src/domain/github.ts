import { nextCode } from './board';
import { assignTo } from './fields';
import { startStatus, statusesIn } from './statuses';
import { EPIC_COLOR_KEYS, type ConflictRule, type Criterion, type Epic, type ExternalFields, type FieldAssignment, type FieldDefinition, type FieldOption, type Release, type StatusValue, type Story } from './types';

/*
 * Import and sync with GitHub Issues (#30): the rules, without any network. The access to GitHub is in `src/github/`.
 * A story and its issue are compared field by field against what the issue looked like at the last sync (the base):
 * a field that changed on one side only goes to the other side; a field that changed on both sides follows the conflict
 * rule (GitHub wins by default). Fields: title, description, labels, the task list under the heading "Acceptance
 * criteria", and done or not done (closed or open). Sprint, points, rank and the epic stay with the story.
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
  /** The title of the milestone of the issue, or null/missing when it has none. */
  milestone?: string | null;
}

/** A milestone of the repository: the counterpart of a release (#30). */
export interface ExternalMilestone {
  number: number;
  title: string;
  description: string;
  /** The due date as `YYYY-MM-DD`, or null. */
  dueOn: string | null;
  state: 'open' | 'closed';
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

/* ---------- Epics, statuses and releases as labels and milestones ---------- */

const EPIC_LABEL = /^epic:\s*(.+?)\s*$/i;
const STATUS_LABEL = /^status:\s*(.+?)\s*$/i;

/** The epic a label names (`epic: Boards` is the epic "Boards"), or null when it is no epic label. */
export const epicOfLabel = (label: string): string | null => EPIC_LABEL.exec(label)?.[1] ?? null;

/** The status a label names (`status: in progress`), or null when it is no status label. */
export const statusOfLabel = (label: string): string | null => STATUS_LABEL.exec(label)?.[1] ?? null;

export const epicLabelText = (name: string): string => `epic: ${name}`;
export const statusLabelText = (name: string): string => `status: ${name}`;

/** The name a status has on GitHub: its own label, or its id without underscores ("in_progress" is "in progress"). */
export const statusName = (status: StatusValue): string => (status.label ?? status.id.replace(/_/g, ' ')).trim();

/** The statuses that have a label on GitHub: all that are not done and not the first one. A closed issue is done, an open one without label is in the first status. */
export function labelledStatuses(statuses: readonly StatusValue[]): StatusValue[] {
  const start = startStatus(statuses);
  return statuses.filter((status) => status.category !== 'done' && status.id !== start);
}

const same = (a: string | null | undefined, b: string | null | undefined): boolean => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/* ---------- The fields that are compared ---------- */

export type FieldName = 'title' | 'description' | 'labels' | 'criteria' | 'release' | 'epic' | 'done' | 'status';

/** The order matters: done comes before status, so a closed issue is done whatever its status label says. */
export const FIELD_NAMES: readonly FieldName[] = ['title', 'description', 'labels', 'criteria', 'release', 'epic', 'done', 'status'];

const norm = (text: string): string => text.replace(/\r\n?/g, '\n').trim();
const sameLabels = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((name) => b.some((other) => other.toLowerCase() === name.toLowerCase()));

/** Whether one field is the same in both. */
export function sameField(name: FieldName, a: ExternalFields, b: ExternalFields): boolean {
  switch (name) {
    case 'title':
      return a.title.trim() === b.title.trim();
    case 'description':
      return norm(a.description) === norm(b.description);
    case 'labels':
      return sameLabels(a.labels, b.labels);
    case 'criteria':
      return a.criteria.length === b.criteria.length && a.criteria.every((item, index) => item.text === b.criteria[index].text && item.done === b.criteria[index].done);
    case 'release':
      return same(a.release, b.release);
    case 'epic':
      return same(a.epic, b.epic);
    case 'done':
      return a.done === b.done;
    case 'status':
      return same(a.status, b.status);
  }
}

/**
 * The compared fields of an issue. The labels "epic: …" and "status: …" are not labels of the story: the first of each
 * is its epic and its status (a closed issue is done, so its status label does not count).
 */
export function remoteFields(item: GithubIssue): ExternalFields {
  const { description, criteria } = splitBody(item.body);
  const done = item.state === 'closed';
  const plain = item.labels.filter((label) => epicOfLabel(label) === null && statusOfLabel(label) === null);
  return {
    title: item.title.trim(),
    description,
    labels: plain,
    criteria,
    release: item.milestone ?? null,
    epic: item.labels.map(epicOfLabel).find((name) => name !== null) ?? null,
    done,
    status: done ? null : (item.labels.map(statusOfLabel).find((name) => name !== null) ?? null)
  };
}

/** What a story needs besides its own fields to be compared: the epics and releases it points to. */
export interface LocalContext {
  epics?: readonly Epic[];
  releases?: readonly Release[];
}

/** The compared fields of a story. `field` is the labels field, if there is one. */
export function localFields(story: Story, field: FieldDefinition | undefined, statuses: readonly StatusValue[], context: LocalContext = {}): ExternalFields {
  const ids = field ? asIds(story.values[field.id]) : [];
  const status = statuses.find((item) => item.id === story.status);
  const labelled = status !== undefined && labelledStatuses(statuses).some((item) => item.id === status.id);
  return {
    title: story.title.trim(),
    description: story.description.trim(),
    labels: ids.flatMap((id) => field?.options.find((option) => option.id === id)?.label ?? []),
    criteria: story.criteria.map((item) => ({ text: item.text, done: item.done })),
    release: story.releaseId === null ? null : (context.releases?.find((item) => item.id === story.releaseId)?.title ?? null),
    epic: story.epicId === null ? null : (context.epics?.find((item) => item.id === story.epicId)?.name ?? null),
    done: status?.category === 'done',
    status: labelled && status ? statusName(status) : null
  };
}

/** The fields of a linked story that changed here since the last sync, and so are not on GitHub yet. */
export function pendingFields(story: Story, field: FieldDefinition | undefined, statuses: readonly StatusValue[], context: LocalContext = {}): FieldName[] {
  const base = story.github?.base;
  if (!base) return [];
  const local = localFields(story, field, statuses, context);
  return FIELD_NAMES.filter((name) => !sameField(name, local, base));
}

/** The labels an issue has on GitHub for these fields: the plain labels, the epic and the status. */
export const labelsOf = (fields: Pick<ExternalFields, 'labels' | 'epic' | 'status'>, epic: string | null | undefined, status: string | null | undefined): string[] => [
  ...fields.labels,
  ...(epic ? [epicLabelText(epic)] : []),
  ...(status ? [statusLabelText(status)] : [])
];

/* ---------- The text of an issue from description and criteria ---------- */

const CRITERIA_TITLE = 'Acceptance criteria';
const taskLines = (criteria: ReadonlyArray<{ text: string; done: boolean }>): string[] => criteria.map((item) => `- [${item.done ? 'x' : ' '}] ${item.text}`);

/** The text of an issue made from a description and criteria: the description, then the task list under its heading. */
export function composeBody(description: string, criteria: ReadonlyArray<{ text: string; done: boolean }>): string {
  const parts: string[] = [];
  if (description.trim() !== '') parts.push(description.trim());
  if (criteria.length > 0) parts.push(`## ${CRITERIA_TITLE}\n${taskLines(criteria).join('\n')}`);
  return parts.join('\n\n');
}

/** The text with other criteria: the tasks under the heading are replaced and everything else stays; without a heading the section is added. */
export function withCriteria(body: string, criteria: ReadonlyArray<{ text: string; done: boolean }>): string {
  const text = body.replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const start = lines.findIndex((line) => {
    const heading = HEADING.exec(line);
    return heading !== null && CRITERIA_HEADING.test(heading[1]);
  });
  if (start < 0) return composeBody(text, criteria);
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (HEADING.test(lines[index])) {
      end = index;
      break;
    }
  }
  const section = lines.slice(start + 1, end);
  const firstTask = section.findIndex((line) => TASK.test(line));
  const others = section.filter((line) => !TASK.test(line));
  const insertAt = firstTask < 0 ? others.length : firstTask;
  const merged = [...others.slice(0, insertAt), ...taskLines(criteria), ...others.slice(insertAt)];
  const kept = merged.some((line) => line.trim() !== '') ? [lines[start], ...merged] : [];
  return [...lines.slice(0, start), ...kept, ...lines.slice(end)].join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ---------- Import and sync ---------- */

/** What changed on one story. The sync shows these to the user. */
export type GithubChange =
  | { kind: 'created' }
  | { kind: 'title'; from: string; to: string }
  | { kind: 'description' }
  | { kind: 'labels'; added: string[]; removed: string[] }
  | { kind: 'criteria'; added: number; removed: number; changed: number }
  | { kind: 'release'; from: string | null; to: string | null }
  | { kind: 'epic'; from: string | null; to: string | null }
  | { kind: 'status'; from: string | null; to: string | null }
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

/** A change that went from the story to the issue. */
export interface PublishEntry {
  storyId: string;
  code: string;
  number: number;
  title: string;
  fields: FieldName[];
  /** Labels GitHub does not know (also epic and status labels); they are not created, and the story keeps them. */
  skippedLabels: string[];
}

/** A change that was lost in a conflict: `side` says whose change it was. `value` is the lost title, when the field is the title. */
export interface OverwrittenEntry {
  storyId: string;
  code: string;
  number: number;
  field: FieldName;
  side: 'local' | 'github';
  value?: string;
}

/** The same field changed on both sides and the user has to decide. */
export interface ConflictEntry {
  storyId: string;
  code: string;
  number: number;
  field: FieldName;
  local: ExternalFields;
  remote: ExternalFields;
}

/** What a sync did, for the dialog after it. */
export interface SyncSummary {
  created: SyncEntry[];
  closed: SyncEntry[];
  updated: SyncEntry[];
  published: PublishEntry[];
  overwritten: OverwrittenEntry[];
  /** Open conflicts: the rule is "I decide" and no decision was given yet. Nothing was changed for these fields. */
  conflicts: ConflictEntry[];
  /** Local changes that were not published because writing is off. */
  pending: number;
  /** Titles of releases that were made from milestones. */
  releasesCreated: string[];
  /** Names of epics that were made from labels. */
  epicsCreated: string[];
  /** Releases a story is in that have no milestone on GitHub: the assignment stays here and is not published. */
  missingMilestones: string[];
  /** Issues with more than one epic label: only the first counts. */
  multipleEpics: Array<{ code: string; number: number }>;
  /** Labels and milestones the sync made or deleted on GitHub (#30, AC16); filled in by the run, not by the plan. */
  labelsCreated: string[];
  labelsDeleted: string[];
  milestonesCreated: string[];
  milestonesDeleted: string[];
  /** Labels (epic, status) a story needs that GitHub does not have, while writing is off. */
  missingLabels: string[];
}

export type Decision = 'local' | 'remote';

/** The key of a conflict in the decisions. */
export const decisionKey = (storyId: string, field: FieldName): string => `${storyId}:${field}`;

export interface SyncInput {
  stories: readonly Story[];
  fields: readonly FieldDefinition[];
  assignments: readonly FieldAssignment[];
  statuses: readonly StatusValue[];
  repo: RepoRef;
  /** The issues to bring in: the open issues of the repository, and the issues the stories already point to. */
  issues: readonly GithubIssue[];
  newId: () => string;
  /** The epics and releases of the app; the sync adds those it finds on GitHub (labels "epic: …", milestones). */
  epics?: readonly Epic[];
  releases?: readonly Release[];
  /** The milestones of the repository. */
  milestones?: readonly ExternalMilestone[];
  /** The names of the labels of the repository; with them a sync that may not write can say which label is missing. */
  knownLabels?: readonly string[];
  /** Whether the sync may change issues on GitHub. */
  write?: boolean;
  /** The rule for fields that changed on both sides. */
  conflict?: ConflictRule;
  /** The answers of the user for conflicts, by `decisionKey`. */
  decisions?: Readonly<Record<string, Decision>>;
  /** Addresses of issues whose story was deleted: they are not imported again. */
  ignored?: readonly string[];
}

/** What to change on one issue. */
export interface ItemPatch {
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  labels?: string[];
  /** The number of the milestone, or null for none. */
  milestone?: number | null;
}

/** A change of one story to publish. */
export interface Push {
  storyId: string;
  number: number;
  fields: FieldName[];
  patch: ItemPatch;
  /** The title of a release that has no milestone yet: the run makes it before it publishes, and sets it in the patch. */
  needsMilestone?: string;
}

export interface SyncPlan {
  stories: Story[];
  fields: FieldDefinition[];
  assignments: FieldAssignment[];
  epics: Epic[];
  releases: Release[];
  summary: SyncSummary;
  pushes: Push[];
}

export const emptySummary = (): SyncSummary => ({
  created: [],
  closed: [],
  updated: [],
  published: [],
  overwritten: [],
  conflicts: [],
  pending: 0,
  releasesCreated: [],
  epicsCreated: [],
  missingMilestones: [],
  multipleEpics: [],
  labelsCreated: [],
  labelsDeleted: [],
  milestonesCreated: [],
  milestonesDeleted: [],
  missingLabels: []
});

/** The colour of an epic that was made from a label: the same name always gets the same colour. */
function epicColorFor(name: string): Epic['colorKey'] {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return EPIC_COLOR_KEYS[hash % EPIC_COLOR_KEYS.length];
}

/**
 * Compares stories and issues. An open issue without a story becomes a story at the end of the backlog. For a story that
 * points to an issue every field is compared with the base: what only the issue changed is taken, what only the story
 * changed is published (when writing is on, else it stays and is counted as pending), what both changed follows the
 * conflict rule. Besides title, description, labels and criteria the fields are the release (milestone), the epic
 * (label "epic: <name>"), done (closed) and the board column between the first and done (label "status: <name>"). A
 * closed issue puts the story into the first "done" status, an issue that is open again puts a done story back to the
 * start status. Everything else of a story stays as it is.
 */
export function planSync(input: SyncInput): SyncPlan {
  const { repo, statuses, newId } = input;
  const write = input.write ?? false;
  const rule: ConflictRule = input.conflict ?? 'remote';
  const ignored = input.ignored ?? [];
  const milestones = input.milestones ?? [];
  const epics = [...(input.epics ?? [])];
  const releases = [...(input.releases ?? [])];
  const issues = input.issues.filter((issue) => inRepo(issue.url, repo));
  const labelNames = [...new Set(issues.flatMap((issue) => issue.labels).filter((label) => epicOfLabel(label) === null && statusOfLabel(label) === null))];
  const hadField = input.fields.find((field) => field.id === LABELS_FIELD_ID);
  const field = withLabelOptions(hadField, labelNames);
  const fieldChanged = field !== hadField;
  const fields = !hadField ? [...input.fields, field] : fieldChanged ? input.fields.map((item) => (item.id === field.id ? field : item)) : [...input.fields];
  const assignments = hadField || input.assignments.some((item) => item.fieldId === field.id) ? [...input.assignments] : assignTo(input.assignments, field.id, ['story']);

  const doneStatus = statusesIn(statuses, 'done')[0]?.id;
  const start = startStatus(statuses);
  const labelled = labelledStatuses(statuses);
  const summary = emptySummary();
  const pushes: Push[] = [];
  const stories = [...input.stories];

  /** The epic of that name, made when there is none. */
  const epicNamed = (name: string): Epic => {
    const found = epics.find((epic) => same(epic.name, name));
    if (found) return found;
    const created: Epic = { id: newId(), name, colorKey: epicColorFor(name), position: epics.reduce((max, epic) => Math.max(max, epic.position), -1) + 1, values: {} };
    epics.push(created);
    summary.epicsCreated.push(name);
    return created;
  };
  /** The release of that title, made from its milestone when there is none. */
  const releaseTitled = (title: string): Release => {
    const found = releases.find((release) => same(release.title, title));
    if (found) return found;
    const milestone = milestones.find((item) => same(item.title, title));
    const created: Release = { id: newId(), title: milestone?.title ?? title, description: milestone?.description ?? '', startDate: null, endDate: milestone?.dueOn ?? null };
    releases.push(created);
    summary.releasesCreated.push(created.title);
    return created;
  };
  /** The status a label names, or the start status. */
  const statusNamed = (name: string | null | undefined): string => (name ? (labelled.find((status) => same(statusName(status), name))?.id ?? start) : start);

  for (const issue of issues) {
    const remote = remoteFields(issue);
    // A label of a status this app does not have counts as no label: the story stays in the first column.
    if (remote.status && !labelled.some((status) => same(statusName(status), remote.status))) remote.status = null;
    const index = stories.findIndex((story) => story.github?.url === issue.url);
    const epicLabels = issue.labels.filter((label) => epicOfLabel(label) !== null);

    if (index < 0) {
      if (issue.state !== 'open' || ignored.includes(issue.url)) continue;
      const optionIds = optionIdsOf(field, remote.labels);
      const story: Story = {
        id: newId(),
        code: nextCode(stories),
        title: remote.title,
        description: remote.description,
        epicId: remote.epic ? epicNamed(remote.epic).id : null,
        points: 0,
        status: statusNamed(remote.status),
        sprintId: null,
        releaseId: remote.release ? releaseTitled(remote.release).id : null,
        rank: stories.reduce((max, item) => Math.max(max, item.rank), -1) + 1,
        criteria: remote.criteria.map((item) => ({ id: newId(), text: item.text, done: item.done })),
        values: optionIds.length > 0 ? { [field.id]: optionIds } : {},
        checks: {},
        doneItems: null,
        github: { url: issue.url, state: 'open', base: remote }
      };
      stories.push(story);
      if (epicLabels.length > 1) summary.multipleEpics.push({ code: story.code, number: issue.number });
      summary.created.push({ storyId: story.id, code: story.code, number: issue.number, title: story.title, changes: [{ kind: 'created' }] });
      continue;
    }

    const story = stories[index];
    const context: LocalContext = { epics, releases };
    const local = localFields(story, field, statuses, context);
    // A story from a version without a base takes the issue as it is: the base is the story, so every difference is the issue's.
    const base = story.github?.base ?? local;
    const nextBase: ExternalFields = { ...base };
    const changes: GithubChange[] = [];
    const pushFields: FieldName[] = [];
    let needsMilestone: string | undefined;
    let next: Story = story;
    let closed = false;
    if (epicLabels.length > 1) summary.multipleEpics.push({ code: story.code, number: issue.number });

    const pull = (name: FieldName): void => {
      nextBase[name] = remote[name] as never;
      switch (name) {
        case 'title':
          changes.push({ kind: 'title', from: next.title, to: remote.title });
          next = { ...next, title: remote.title };
          return;
        case 'description':
          changes.push({ kind: 'description' });
          next = { ...next, description: remote.description };
          return;
        case 'labels': {
          const optionIds = optionIdsOf(field, remote.labels);
          const oldIds = asIds(next.values[field.id]);
          const nameOf = (id: string): string => field.options.find((option) => option.id === id)?.label ?? id;
          changes.push({ kind: 'labels', added: optionIds.filter((id) => !oldIds.includes(id)).map(nameOf), removed: oldIds.filter((id) => !optionIds.includes(id)).map(nameOf) });
          const values = { ...next.values };
          if (optionIds.length > 0) values[field.id] = optionIds;
          else delete values[field.id];
          next = { ...next, values };
          return;
        }
        case 'criteria': {
          const free = [...next.criteria];
          let ticked = 0;
          const criteria: Criterion[] = remote.criteria.map((item) => {
            const at = free.findIndex((old) => old.text === item.text);
            if (at < 0) return { id: newId(), text: item.text, done: item.done };
            const [old] = free.splice(at, 1);
            if (old.done !== item.done) ticked += 1;
            return { ...old, done: item.done };
          });
          const before = next.criteria;
          const added = criteria.filter((item) => !before.some((old) => old.id === item.id)).length;
          changes.push({ kind: 'criteria', added, removed: free.length, changed: ticked });
          next = { ...next, criteria };
          return;
        }
        case 'release': {
          const releaseId = remote.release ? releaseTitled(remote.release).id : null;
          changes.push({ kind: 'release', from: localFields(next, field, statuses, { epics, releases }).release ?? null, to: remote.release ?? null });
          next = { ...next, releaseId };
          return;
        }
        case 'epic': {
          const epicId = remote.epic ? epicNamed(remote.epic).id : null;
          changes.push({ kind: 'epic', from: localFields(next, field, statuses, { epics, releases }).epic ?? null, to: remote.epic ?? null });
          next = { ...next, epicId };
          return;
        }
        case 'done':
          if (remote.done && doneStatus) {
            changes.push({ kind: 'closed' });
            next = { ...next, status: doneStatus };
            closed = true;
          } else if (!remote.done) {
            changes.push({ kind: 'reopened' });
            next = { ...next, status: start };
          }
          return;
        case 'status':
          // A closed issue is done whatever its label says: only the base moves on.
          if (remote.done) return;
          changes.push({ kind: 'status', from: localFields(next, field, statuses, { epics, releases }).status ?? null, to: remote.status ?? null });
          next = { ...next, status: statusNamed(remote.status) };
          return;
      }
    };

    for (const name of FIELD_NAMES) {
      const localChanged = !sameField(name, local, base);
      const remoteChanged = !sameField(name, remote, base);
      if (!localChanged && !remoteChanged) continue;
      // A release without a milestone and a label that GitHub does not have are made by the run when it may write (#30, AC16).
      const missingMilestone = name === 'release' && local.release && !milestones.some((item) => same(item.title, local.release));
      const publish = (): void => {
        pushFields.push(name);
        if (missingMilestone && local.release) needsMilestone = local.release;
      };
      // When it may not write, the change stays here and the result says what is missing.
      const pend = (): void => {
        summary.pending += 1;
        if (missingMilestone && local.release && !summary.missingMilestones.includes(local.release)) summary.missingMilestones.push(local.release);
        const label = name === 'epic' && local.epic ? epicLabelText(local.epic) : name === 'status' && local.status ? statusLabelText(local.status) : null;
        if (label && input.knownLabels && !input.knownLabels.some((item) => same(item, label)) && !summary.missingLabels.includes(label)) summary.missingLabels.push(label);
      };
      if (!localChanged) {
        pull(name);
      } else if (!remoteChanged) {
        if (write) publish();
        else pend();
      } else if (sameField(name, local, remote)) {
        nextBase[name] = remote[name] as never;
      } else {
        const chosen: Decision | null = input.decisions?.[decisionKey(story.id, name)] ?? (rule === 'ask' ? null : rule);
        const entry = { storyId: story.id, code: story.code, number: issue.number, field: name };
        if (chosen === null) {
          summary.conflicts.push({ ...entry, local, remote });
        } else if (chosen === 'remote') {
          pull(name);
          summary.overwritten.push({ ...entry, side: 'local', ...(name === 'title' ? { value: local.title } : {}) });
        } else if (write) {
          publish();
          summary.overwritten.push({ ...entry, side: 'github', ...(name === 'title' ? { value: remote.title } : {}) });
        } else {
          pend();
        }
      }
    }

    if (pushFields.length > 0) {
      const after = localFields(next, field, statuses, { epics, releases });
      const patch: ItemPatch = {};
      if (pushFields.includes('title')) patch.title = after.title;
      if (pushFields.includes('labels') || pushFields.includes('epic') || pushFields.includes('status')) {
        // The labels of the issue are plain labels, epic and status together: what is not pushed stays as GitHub has it.
        patch.labels = labelsOf(
          { labels: pushFields.includes('labels') ? after.labels : remote.labels, epic: null, status: null },
          pushFields.includes('epic') ? after.epic : remote.epic,
          pushFields.includes('status') ? after.status : remote.status
        );
      }
      if (pushFields.includes('done')) patch.state = after.done ? 'closed' : 'open';
      if (pushFields.includes('release') && !needsMilestone) patch.milestone = after.release ? (milestones.find((item) => same(item.title, after.release))?.number ?? null) : null;
      if (pushFields.includes('description')) patch.body = composeBody(after.description, after.criteria);
      else if (pushFields.includes('criteria')) patch.body = withCriteria(issue.body, after.criteria);
      pushes.push({ storyId: story.id, number: issue.number, fields: pushFields, patch, ...(needsMilestone ? { needsMilestone } : {}) });
    }

    if (JSON.stringify(nextBase) !== JSON.stringify(story.github?.base) || story.github?.state !== issue.state) {
      next = { ...next, github: { url: issue.url, state: issue.state, base: nextBase } };
    }
    if (next !== story) stories[index] = next;
    if (changes.length > 0) {
      const entry: SyncEntry = { storyId: story.id, code: story.code, number: issue.number, title: next.title, changes };
      (closed ? summary.closed : summary.updated).push(entry);
    }
  }

  return { stories, fields, assignments, epics, releases, summary, pushes };
}

/**
 * The numbers of the issues the stories point to that are not in the list, so the sync can ask GitHub for them (they
 * may be closed now). A story whose issue is closed is only asked for when it has local changes to publish.
 */
export function linkedNumbersMissingIn(stories: readonly Story[], repo: RepoRef, issues: readonly GithubIssue[], isPending: (story: Story) => boolean = () => false): number[] {
  const known = new Set(issues.map((issue) => issue.url));
  return stories.flatMap((story) => {
    const url = story.github?.url;
    if (!url || !inRepo(url, repo) || known.has(url) || (story.github?.state === 'closed' && !isPending(story))) return [];
    const number = issueNumberOf(url);
    return number === null ? [] : [number];
  });
}

/** What a new issue is made of: the title, the text with the criteria, and the labels with the epic and the status. */
export function newIssueOf(
  story: Story,
  field: FieldDefinition | undefined,
  statuses: readonly StatusValue[],
  context: LocalContext = {}
): { title: string; body: string; labels: string[] } {
  const fields = localFields(story, field, statuses, context);
  return { title: fields.title, body: composeBody(fields.description, fields.criteria), labels: labelsOf(fields, fields.epic, fields.status) };
}

/** The link of a story to the issue it was just published as. */
export const linkTo = (item: GithubIssue): NonNullable<Story['github']> => ({ url: item.url, state: item.state, base: remoteFields(item) });

/** A story takes the compared fields of an issue as its new base, for the given fields only. */
export function withBase(story: Story, item: GithubIssue, names: readonly FieldName[]): Story {
  if (!story.github) return story;
  const fresh = remoteFields(item);
  const base: ExternalFields = { ...(story.github.base ?? localFieldsFallback(story)) };
  for (const name of names) base[name] = fresh[name] as never;
  return { ...story, github: { ...story.github, state: item.state, base } };
}

const localFieldsFallback = (story: Story): ExternalFields => ({
  title: story.title,
  description: story.description,
  labels: [],
  criteria: story.criteria.map((item) => ({ text: item.text, done: item.done })),
  done: false
});

/** Whether nothing changed. */
export const isEmptySummary = (summary: SyncSummary): boolean =>
  summary.created.length +
    summary.closed.length +
    summary.updated.length +
    summary.published.length +
    summary.overwritten.length +
    summary.conflicts.length +
    summary.releasesCreated.length +
    summary.epicsCreated.length +
    summary.labelsCreated.length +
    summary.labelsDeleted.length +
    summary.milestonesCreated.length +
    summary.milestonesDeleted.length ===
  0;
