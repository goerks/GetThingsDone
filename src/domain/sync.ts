import { nextCode } from './board';
import { assignTo } from './fields';
import { startStatus, statusesIn } from './statuses';
import { EPIC_COLOR_KEYS, type ConflictRule, type Criterion, type Epic, type ExternalFields, type ExternalLink, type FieldAssignment, type FieldDefinition, type FieldOption, type Release, type ServiceKind, type StatusValue, type Story } from './types';

/*
 * Import and sync with an external tracker (#30, #66): the rules, without any network and without knowing a service.
 * A service is reached through a connector (`src/sync/`), which turns its issues into `ExternalItem`s and a neutral
 * `ItemPatch` into its own calls. A story and its item are compared field by field against what the item looked like at
 * the last sync (the base): a field that changed on one side only goes to the other side; a field that changed on both
 * sides follows the conflict rule (the service wins by default). Fields: title, description, labels, criteria, release,
 * epic, done and the board column between the first and done. Sprint, points and rank stay with the story.
 */

/**
 * An issue of a service as the sync sees it: already translated into the compared fields. The connector keeps in `raw`
 * what only it understands (for GitHub the text and the labels as they are), so it can change the issue later.
 */
export interface ExternalItem {
  /** How the service names the issue inside itself (GitHub: the number as text). */
  id: string;
  /** How people call it, shown as the ID of the story: `#31` on GitHub, `PROJ-123` on Jira. */
  key: string;
  /** The address of the issue; it identifies the issue across syncs. */
  url: string;
  state: 'open' | 'closed';
  /** The compared fields. `done` is true for a closed issue; `labels` are the plain labels only. */
  fields: ExternalFields;
  /** Things the sync should tell the user about this item. */
  warnings?: Array<'multipleEpics'>;
  /** For the connector only. */
  raw?: unknown;
}

/** A release of the service (GitHub: a milestone): the counterpart of a release here. */
export interface ExternalRelease {
  id: string;
  title: string;
  description: string;
  /** The due date as `YYYY-MM-DD`, or null. */
  dueOn: string | null;
  state: 'open' | 'closed';
}

/** What a service holds besides its issues that the issues refer to, read once per sync. `extra` is for the connector only. */
export interface Catalog {
  releases: ExternalRelease[];
  extra?: unknown;
}

/** What to change on one issue, in the terms of the app. Only the fields that are published are set. */
export interface ItemPatch {
  title?: string;
  description?: string;
  /** Set when the criteria or the description are published; the criteria are those after the sync. */
  criteria?: ReadonlyArray<{ text: string; done: boolean }>;
  labels?: string[];
  done?: boolean;
  /** The title of the release, or null for none. */
  release?: string | null;
  /** The name of the epic, or null for none. */
  epic?: string | null;
  /** The name of the board column, or null for the first column. */
  status?: string | null;
}

/** What a new issue is made of. */
export interface NewItem {
  title: string;
  description: string;
  criteria: ReadonlyArray<{ text: string; done: boolean }>;
  labels: string[];
  epic: string | null;
  status: string | null;
}

/* ---------- Labels as a field ---------- */

/** The field that holds the labels of an issue. A custom field of the team, so labels can be shown, searched and changed like any other. The id is kept from before the sync was general (#30). */
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

/* ---------- Statuses ---------- */

/** The name a status has in a service: its own label, or its id without underscores ("in_progress" is "in progress"). */
export const statusName = (status: StatusValue): string => (status.label ?? status.id.replace(/_/g, ' ')).trim();

/**
 * The statuses a service has to name: all that are not done and not the first one. A closed issue is done, an open one
 * without a column is in the first status.
 */
export function middleStatuses(statuses: readonly StatusValue[]): StatusValue[] {
  const start = startStatus(statuses);
  return statuses.filter((status) => status.category !== 'done' && status.id !== start);
}

const same = (a: string | null | undefined, b: string | null | undefined): boolean => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/* ---------- The fields that are compared ---------- */

export type FieldName = 'title' | 'description' | 'labels' | 'criteria' | 'release' | 'epic' | 'done' | 'status';

/** The order matters: done comes before status, so a closed issue is done whatever its column says. */
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

/** What a story needs besides its own fields to be compared: the epics and releases it points to. */
export interface LocalContext {
  epics?: readonly Epic[];
  releases?: readonly Release[];
}

/** The compared fields of a story. `field` is the labels field, if there is one. */
export function localFields(story: Story, field: FieldDefinition | undefined, statuses: readonly StatusValue[], context: LocalContext = {}): ExternalFields {
  const ids = field ? asIds(story.values[field.id]) : [];
  const status = statuses.find((item) => item.id === story.status);
  const named = status !== undefined && middleStatuses(statuses).some((item) => item.id === status.id);
  return {
    title: story.title.trim(),
    description: story.description.trim(),
    labels: ids.flatMap((id) => field?.options.find((option) => option.id === id)?.label ?? []),
    criteria: story.criteria.map((item) => ({ text: item.text, done: item.done })),
    release: story.releaseId === null ? null : (context.releases?.find((item) => item.id === story.releaseId)?.title ?? null),
    epic: story.epicId === null ? null : (context.epics?.find((item) => item.id === story.epicId)?.name ?? null),
    done: status?.category === 'done',
    status: named && status ? statusName(status) : null
  };
}

/** The fields of a linked story that changed here since the last sync, and so are not in the service yet. */
export function pendingFields(story: Story, field: FieldDefinition | undefined, statuses: readonly StatusValue[], context: LocalContext = {}, compared: readonly FieldName[] = FIELD_NAMES): FieldName[] {
  const base = story.link?.base;
  if (!base) return [];
  const local = localFields(story, field, statuses, context);
  return compared.filter((name) => !sameField(name, local, base));
}

/* ---------- Import and sync ---------- */

/** What changed on one story. The sync shows these to the user. */
export type SyncChange =
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
  /** The own key of the story (`S-4`). */
  code: string;
  /** The key of the issue in the service (`#31`). */
  key: string;
  /** The title after the sync. */
  title: string;
  changes: SyncChange[];
}

/** A change that went from the story to the issue. */
export interface PublishEntry {
  storyId: string;
  code: string;
  key: string;
  title: string;
  fields: FieldName[];
  /** Labels the service does not know (also epic and status labels); they are not created, and the story keeps them. */
  skippedLabels: string[];
}

/** A change that was lost in a conflict: `side` says whose change it was. `value` is the lost title, when the field is the title. */
export interface OverwrittenEntry {
  storyId: string;
  code: string;
  key: string;
  field: FieldName;
  side: 'local' | 'remote';
  value?: string;
}

/** The same field changed on both sides and the user has to decide. */
export interface ConflictEntry {
  storyId: string;
  code: string;
  key: string;
  field: FieldName;
  local: ExternalFields;
  remote: ExternalFields;
}

/** What a sync did, for the notice and the log. */
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
  /** Titles of releases that were made from the releases of the service. */
  releasesCreated: string[];
  /** Names of epics that were made from the epics of the service. */
  epicsCreated: string[];
  /** Releases a story is in that the service does not have: the assignment stays here and is not published. */
  missingMilestones: string[];
  /** Issues with more than one epic: only the first counts. */
  multipleEpics: Array<{ code: string; key: string }>;
  /** Labels and milestones the sync made or deleted in the service (#30, AC16); filled in by the run, not by the plan. */
  labelsCreated: string[];
  labelsDeleted: string[];
  milestonesCreated: string[];
  milestonesDeleted: string[];
  /** What a story needs for its epic or column that the service does not have, while writing is off. */
  missingLabels: string[];
}

export type Decision = 'local' | 'remote';

/** The key of a conflict in the decisions. */
export const decisionKey = (storyId: string, field: FieldName): string => `${storyId}:${field}`;

export interface SyncInput {
  service: ServiceKind;
  /** The fields the service can hold; only these are compared. */
  compared?: readonly FieldName[];
  stories: readonly Story[];
  fields: readonly FieldDefinition[];
  assignments: readonly FieldAssignment[];
  statuses: readonly StatusValue[];
  /** The items to bring in: the open items of the service, and the items the stories already point to. */
  items: readonly ExternalItem[];
  newId: () => string;
  /** The epics and releases of the app; the sync adds those it finds in the service. */
  epics?: readonly Epic[];
  releases?: readonly Release[];
  /** The releases of the service. */
  externalReleases?: readonly ExternalRelease[];
  /** What the service lacks for an epic or a column, while writing is off: its text for the notice, or null when it has it. */
  lacks?: (kind: 'epic' | 'status', name: string) => string | null;
  /** Whether the sync may change issues in the service. */
  write?: boolean;
  /** The rule for fields that changed on both sides. */
  conflict?: ConflictRule;
  /** The answers of the user for conflicts, by `decisionKey`. */
  decisions?: Readonly<Record<string, Decision>>;
  /** Addresses of issues whose story was deleted: they are not imported again. */
  ignored?: readonly string[];
}

/** A change of one story to publish. */
export interface Push {
  storyId: string;
  item: ExternalItem;
  fields: FieldName[];
  patch: ItemPatch;
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

/** The colour of an epic that was made from the service: the same name always gets the same colour. */
function epicColorFor(name: string): Epic['colorKey'] {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return EPIC_COLOR_KEYS[hash % EPIC_COLOR_KEYS.length];
}

/** The link of a story to the item it points to. */
export const linkTo = (service: ServiceKind, item: ExternalItem): ExternalLink => ({ service, key: item.key, url: item.url, state: item.state, base: { ...item.fields } });

/**
 * Compares stories and items. An open item without a story becomes a story at the end of the backlog. For a story that
 * points to an item every field is compared with the base: what only the item changed is taken, what only the story
 * changed is published (when writing is on, else it stays and is counted as pending), what both changed follows the
 * conflict rule. A closed item puts the story into the first "done" status, an item that is open again puts a done story
 * back to the start status. Everything else of a story stays as it is.
 */
export function planSync(input: SyncInput): SyncPlan {
  const { service, statuses, newId } = input;
  const compared = input.compared ?? FIELD_NAMES;
  const write = input.write ?? false;
  const rule: ConflictRule = input.conflict ?? 'remote';
  const ignored = input.ignored ?? [];
  const externalReleases = input.externalReleases ?? [];
  const epics = [...(input.epics ?? [])];
  const releases = [...(input.releases ?? [])];
  const items = input.items;
  const labelNames = [...new Set(items.flatMap((item) => item.fields.labels))];
  const hadField = input.fields.find((field) => field.id === LABELS_FIELD_ID);
  const field = withLabelOptions(hadField, labelNames);
  const fieldChanged = field !== hadField;
  const fields = !hadField ? [...input.fields, field] : fieldChanged ? input.fields.map((entry) => (entry.id === field.id ? field : entry)) : [...input.fields];
  const assignments = hadField || input.assignments.some((entry) => entry.fieldId === field.id) ? [...input.assignments] : assignTo(input.assignments, field.id, ['story']);

  const doneStatus = statusesIn(statuses, 'done')[0]?.id;
  const start = startStatus(statuses);
  const named = middleStatuses(statuses);
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
  /** The release of that title, made from the release of the service when there is none. */
  const releaseTitled = (title: string): Release => {
    const found = releases.find((release) => same(release.title, title));
    if (found) return found;
    const external = externalReleases.find((entry) => same(entry.title, title));
    const created: Release = { id: newId(), title: external?.title ?? title, description: external?.description ?? '', startDate: null, endDate: external?.dueOn ?? null };
    releases.push(created);
    summary.releasesCreated.push(created.title);
    return created;
  };
  /** The status a name stands for, or the start status. */
  const statusNamed = (name: string | null | undefined): string => (name ? (named.find((status) => same(statusName(status), name))?.id ?? start) : start);

  for (const item of items) {
    const remote: ExternalFields = { ...item.fields };
    // A column this app does not have counts as no column: the story stays in the first one.
    if (remote.status && !named.some((status) => same(statusName(status), remote.status))) remote.status = null;
    const index = stories.findIndex((story) => story.link?.service === service && story.link.url === item.url);

    if (index < 0) {
      if (item.state !== 'open' || ignored.includes(item.url)) continue;
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
        rank: stories.reduce((max, entry) => Math.max(max, entry.rank), -1) + 1,
        criteria: remote.criteria.map((entry) => ({ id: newId(), text: entry.text, done: entry.done })),
        values: optionIds.length > 0 ? { [field.id]: optionIds } : {},
        checks: {},
        doneItems: null,
        link: { service, key: item.key, url: item.url, state: 'open', base: remote }
      };
      stories.push(story);
      if (item.warnings?.includes('multipleEpics')) summary.multipleEpics.push({ code: story.code, key: item.key });
      summary.created.push({ storyId: story.id, code: story.code, key: item.key, title: story.title, changes: [{ kind: 'created' }] });
      continue;
    }

    const story = stories[index];
    const context: LocalContext = { epics, releases };
    const local = localFields(story, field, statuses, context);
    // A story from a version without a base takes the item as it is: the base is the story, so every difference is the item's.
    const base = story.link?.base ?? local;
    const nextBase: ExternalFields = { ...base };
    const changes: SyncChange[] = [];
    const pushFields: FieldName[] = [];
    let next: Story = story;
    let closed = false;
    if (item.warnings?.includes('multipleEpics')) summary.multipleEpics.push({ code: story.code, key: item.key });

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
          const criteria: Criterion[] = remote.criteria.map((entry) => {
            const at = free.findIndex((old) => old.text === entry.text);
            if (at < 0) return { id: newId(), text: entry.text, done: entry.done };
            const [old] = free.splice(at, 1);
            if (old.done !== entry.done) ticked += 1;
            return { ...old, done: entry.done };
          });
          const before = next.criteria;
          const added = criteria.filter((entry) => !before.some((old) => old.id === entry.id)).length;
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
          // A closed item is done whatever its column says: only the base moves on.
          if (remote.done) return;
          changes.push({ kind: 'status', from: localFields(next, field, statuses, { epics, releases }).status ?? null, to: remote.status ?? null });
          next = { ...next, status: statusNamed(remote.status) };
          return;
      }
    };

    for (const name of compared) {
      const localChanged = !sameField(name, local, base);
      const remoteChanged = !sameField(name, remote, base);
      if (!localChanged && !remoteChanged) continue;
      // A release the service does not have, and an epic or a column it lacks, are made by the run when it may write (#30, AC16).
      const missingRelease = name === 'release' && local.release && !externalReleases.some((entry) => same(entry.title, local.release));
      const publish = (): void => {
        pushFields.push(name);
      };
      // When it may not write, the change stays here and the result says what is missing.
      const pend = (): void => {
        summary.pending += 1;
        if (missingRelease && local.release && !summary.missingMilestones.includes(local.release)) summary.missingMilestones.push(local.release);
        const lacking = name === 'epic' && local.epic ? input.lacks?.('epic', local.epic) : name === 'status' && local.status ? input.lacks?.('status', local.status) : null;
        if (lacking && !summary.missingLabels.includes(lacking)) summary.missingLabels.push(lacking);
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
        const entry = { storyId: story.id, code: story.code, key: item.key, field: name };
        if (chosen === null) {
          summary.conflicts.push({ ...entry, local, remote });
        } else if (chosen === 'remote') {
          pull(name);
          summary.overwritten.push({ ...entry, side: 'local', ...(name === 'title' ? { value: local.title } : {}) });
        } else if (write) {
          publish();
          summary.overwritten.push({ ...entry, side: 'remote', ...(name === 'title' ? { value: remote.title } : {}) });
        } else {
          pend();
        }
      }
    }

    if (pushFields.length > 0) {
      const after = localFields(next, field, statuses, { epics, releases });
      const patch: ItemPatch = {};
      if (pushFields.includes('title')) patch.title = after.title;
      if (pushFields.includes('labels')) patch.labels = after.labels;
      if (pushFields.includes('epic')) patch.epic = after.epic ?? null;
      if (pushFields.includes('status')) patch.status = after.status ?? null;
      if (pushFields.includes('release')) patch.release = after.release ?? null;
      if (pushFields.includes('done')) patch.done = after.done;
      if (pushFields.includes('description')) {
        patch.description = after.description;
        patch.criteria = after.criteria;
      } else if (pushFields.includes('criteria')) {
        patch.criteria = after.criteria;
      }
      pushes.push({ storyId: story.id, item, fields: pushFields, patch });
    }

    if (JSON.stringify(nextBase) !== JSON.stringify(story.link?.base) || story.link?.state !== item.state || story.link?.key !== item.key) {
      next = { ...next, link: { service, key: item.key, url: item.url, state: item.state, base: nextBase } };
    }
    if (next !== story) stories[index] = next;
    if (changes.length > 0) {
      const entry: SyncEntry = { storyId: story.id, code: story.code, key: item.key, title: next.title, changes };
      (closed ? summary.closed : summary.updated).push(entry);
    }
  }

  return { stories, fields, assignments, epics, releases, summary, pushes };
}

/**
 * The links of the stories that point into the service but are not in the list of items, so the sync can ask the service
 * for them (they may be closed now). `idOf` gives the id of the item a link points to, or null when it is not one of the
 * connected target. A story whose item is closed is only asked for when it has local changes to publish.
 */
export function linkedIdsMissingIn(
  stories: readonly Story[],
  service: ServiceKind,
  idOf: (link: ExternalLink) => string | null,
  items: readonly ExternalItem[],
  isPending: (story: Story) => boolean = () => false
): string[] {
  const known = new Set(items.map((item) => item.url));
  return stories.flatMap((story) => {
    const link = story.link;
    if (!link || link.service !== service || known.has(link.url) || (link.state === 'closed' && !isPending(story))) return [];
    const id = idOf(link);
    return id === null ? [] : [id];
  });
}

/** What a new issue is made of: the title, the description, the criteria, the plain labels, the epic and the column. */
export function newItemOf(story: Story, field: FieldDefinition | undefined, statuses: readonly StatusValue[], context: LocalContext = {}): NewItem {
  const fields = localFields(story, field, statuses, context);
  return { title: fields.title, description: fields.description, criteria: fields.criteria, labels: fields.labels, epic: fields.epic ?? null, status: fields.status ?? null };
}

/** A story takes the compared fields of an item as its new base, for the given fields only. */
export function withBase(story: Story, item: ExternalItem, names: readonly FieldName[]): Story {
  if (!story.link) return story;
  const base: ExternalFields = { ...(story.link.base ?? localFieldsFallback(story)) };
  for (const name of names) base[name] = item.fields[name] as never;
  return { ...story, link: { ...story.link, key: item.key, state: item.state, base } };
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
