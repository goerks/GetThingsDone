import { membersFromService } from '../domain/syncMembers';
import { externalFieldsOf, planSprints, type SprintAction } from '../domain/syncSprints';
import { todayIso } from '../domain/sprints';
import { statusesFromService } from '../domain/syncStatuses';
import { linkedIdsMissingIn, LABELS_FIELD_ID, linkTo, middleStatuses, newItemOf, pendingFields, planSync, statusName, withBase, type Decision, type PublishEntry, type SyncPlan, type SyncSummary } from '../domain/sync';
import type { ConflictRule, Epic, FieldAssignment, FieldDefinition, Member, Release, Sprint, StatusValue, Story } from '../domain/types';
import { SyncError, type Made, type Needs, type TrackerConnector } from './connector';

export interface RunSyncInput {
  connector: TrackerConnector;
  /** What the connector reads from the settings of the connection (`connector.target`). */
  target: unknown;
  token: string;
  stories: readonly Story[];
  fields: readonly FieldDefinition[];
  assignments: readonly FieldAssignment[];
  statuses: readonly StatusValue[];
  epics: readonly Epic[];
  releases: readonly Release[];
  /** The sprints and the members of the team (for the services that have them); the sync adds the sprints it finds, as planned ones. */
  sprints?: readonly Sprint[];
  members?: readonly Member[];
  newId: () => string;
  write: boolean;
  conflict: ConflictRule;
  decisions?: Readonly<Record<string, Decision>>;
  ignored: readonly string[];
  /** What earlier syncs made in the service: only these labels and milestones are ever deleted again. */
  managed: Made;
}

export interface RunSyncResult {
  /** The stories, fields and assignments after the sync, with what was published already counted in. */
  plan: SyncPlan;
  summary: SyncSummary;
  /** The labels and milestones the app has made, after this run. */
  managed: Made;
  /** The columns of the board after this run; they differ from the input when the service decides them. */
  statuses: StatusValue[];
  /** The sprints after this run, with their links. A sprint that the service started or completed is still as it was: `sprintActions` says what the app has to do. */
  sprints: Sprint[];
  sprintActions: SprintAction[];
  /** The team after this run; it differs from the input when the service decides it. */
  members: Member[];
  /** The first call that failed while publishing. What was done before it is in `plan`; the rest stays for the next sync. */
  error: SyncError | null;
}

const same = (a: string | null | undefined, b: string | null | undefined): boolean => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/**
 * One sync with a connector: reads the open items and the ones the stories point to, compares them with the stories,
 * then, when writing is on, publishes the local changes one story at a time (the connector makes what a change needs),
 * and deletes what it made and nothing needs any more (#30, AC16). Nothing of this knows a service; the connector does.
 */
export async function runSync(input: RunSyncInput): Promise<RunSyncResult> {
  const { connector, target, token } = input;
  let statuses: StatusValue[] = [...input.statuses];
  let inputStories: readonly Story[] = input.stories;
  let members: Member[] = [...(input.members ?? [])];
  const labelsField = input.fields.find((field) => field.id === LABELS_FIELD_ID);
  // The service decides the columns: they are taken over first, so every story is compared with the new columns.
  if (connector.capabilities.statusesFromService && connector.statuses) {
    const workflow = await connector.statuses(target, token);
    const taken = statusesFromService(statuses, inputStories, workflow, input.newId);
    if (taken.changed) {
      statuses = taken.statuses;
      inputStories = taken.stories;
    }
  }
  // The service decides the team too: the people who can be assigned become the members.
  if (connector.capabilities.membersFromService && connector.members) {
    const taken = membersFromService(members, inputStories, await connector.members(target, token), input.newId);
    if (taken.changed) {
      members = taken.members;
      inputStories = taken.stories;
    }
  }
  const open = await connector.open(target, token);
  const skipped = connector.skipped?.() ?? 0;
  const context = { epics: input.epics, releases: input.releases, sprints: input.sprints, members };
  const catalog = await connector.catalog(target, token);
  // The sprints themselves: compared and connected before the stories, so a story finds its sprint.
  let sprints: Sprint[] = [...(input.sprints ?? [])];
  let sprintActions: SprintAction[] = [];
  const sprintSummary: { created: string[]; published: string[]; concurrent: string[] } = { created: [], published: [], concurrent: [] };
  const ops = connector.capabilities.fields.includes('sprint') ? connector.sprintOps : undefined;
  let sprintError: SyncError | null = null;
  if (ops) {
    const listed = [...(catalog.sprints ?? [])];
    // A sprint here that the list of the service does not hold may be completed there: ask for it.
    const absent = sprints.filter((sprint) => sprint.link?.service === connector.kind && sprint.state !== 'completed' && !listed.some((entry) => entry.id === sprint.link?.id));
    for (const sprint of absent) {
      const found = await ops.fetch(target, token, sprint.link?.id as string);
      if (found) listed.push(found);
    }
    const today = todayIso();
    const planned = planSprints({ service: connector.kind, sprints, external: listed, write: input.write, rule: input.conflict, newId: input.newId, today });
    sprints = planned.sprints;
    sprintActions = planned.actions;
    sprintSummary.created = planned.created;
    sprintSummary.concurrent = planned.concurrent;
    if (input.write) {
      try {
        for (const make of planned.creates) {
          const made = await ops.create(target, token, make.fields, catalog);
          listed.push(made);
          sprints = sprints.map((sprint) => (sprint.id === make.sprintId ? { ...sprint, link: { service: connector.kind, id: made.id, base: externalFieldsOf(made, make.fields, today) } } : sprint));
          sprintSummary.published.push(make.fields.name);
        }
        for (const change of planned.updates) {
          const updated = await ops.update(target, token, change.id, change.patch, catalog);
          const at = listed.findIndex((entry) => entry.id === change.id);
          if (at >= 0) listed[at] = updated;
          sprintSummary.published.push(sprints.find((sprint) => sprint.id === change.sprintId)?.name ?? updated.name);
        }
      } catch (cause) {
        sprintError = cause instanceof SyncError ? cause : new SyncError('other');
      }
    }
    catalog.sprints = listed;
  }
  // A story whose item is no longer in the list of open items may have been closed: ask for those.
  const missing = linkedIdsMissingIn(
    inputStories,
    connector.kind,
    (link) => connector.idOf(target, link),
    open,
    (story) => pendingFields(story, labelsField, statuses, context, connector.capabilities.fields).length > 0
  );
  const linked = await Promise.all(missing.map((id) => connector.item(target, token, id)));
  const items = [...open, ...linked.flatMap((item) => (item ? [item] : []))];

  const plan = planSync({
    service: connector.kind,
    compared: connector.capabilities.fields,
    stories: inputStories,
    fields: input.fields,
    assignments: input.assignments,
    statuses,
    items,
    externalReleases: catalog.releases,
    sprints,
    members,
    externalSprints: catalog.sprints,
    externalLabels: catalog.labels,
    lacks: (kind, name) => connector.lacks(catalog, kind, name),
    epics: input.epics,
    releases: input.releases,
    newId: input.newId,
    write: input.write,
    conflict: input.conflict,
    decisions: input.decisions,
    ignored: input.ignored
  });

  let stories = plan.stories;
  const published: PublishEntry[] = [];
  let managed: Made = { labels: [...input.managed.labels], milestones: [...input.managed.milestones] };
  const made: Made = { labels: [], milestones: [] };
  let gone: Made = { labels: [], milestones: [] };
  let error: SyncError | null = sprintError;
  const fail = (cause: unknown): void => {
    error = cause instanceof SyncError ? cause : new SyncError('other');
  };

  if (input.write && !error) {
    for (const push of plan.pushes) {
      let result;
      try {
        result = await connector.update(target, token, push.item, push.patch, { epics: plan.epics, releases: plan.releases, sprints: plan.sprints, members, statuses, catalog, made });
      } catch (cause) {
        fail(cause);
        break;
      }
      // A column the app does not name as its own (the first one) is no column in the base.
      const named = middleStatuses(statuses);
      const item = result.item.fields.status && !named.some((status) => same(statusName(status), result.item.fields.status)) ? { ...result.item, fields: { ...result.item.fields, status: null } } : result.item;
      stories = stories.map((story) => (story.id === push.storyId ? withBase(story, item, push.fields) : story));
      const story = stories.find((item) => item.id === push.storyId) as Story;
      published.push({ storyId: story.id, code: story.code, key: push.item.key, title: story.title, fields: push.fields, skippedLabels: result.skippedLabels });
    }
    managed = { labels: [...managed.labels, ...made.labels], milestones: [...managed.milestones, ...made.milestones] };

    // What the app made and nothing needs any more is deleted: the epic, column or release is gone here, and no linked story
    // carries it after this sync. What somebody else made is never touched.
    if (!error && connector.capabilities.tidy) {
      const needs: Needs = {
        epic: (name) => plan.epics.some((item) => same(item.name, name)) || stories.some((story) => same(story.link?.base?.epic, name)),
        status: (name) => middleStatuses(statuses).some((item) => same(statusName(item), name)) || stories.some((story) => same(story.link?.base?.status, name)),
        release: (title) => plan.releases.some((item) => same(item.title, title)) || stories.some((story) => same(story.link?.base?.release, title))
      };
      try {
        const tidied = await connector.tidy(target, token, needs, managed, catalog);
        managed = tidied.managed;
        gone = tidied.gone;
      } catch (cause) {
        fail(cause);
      }
    }
  }
  return {
    plan: { ...plan, stories },
    sprints: plan.sprints,
    sprintActions,
    summary: { ...plan.summary, ...(skipped > 0 ? { skipped } : {}), published, labelsCreated: made.labels, milestonesCreated: made.milestones, labelsDeleted: gone.labels, milestonesDeleted: gone.milestones, ...(sprintSummary.published.length > 0 ? { sprintsPublished: sprintSummary.published } : {}), ...(sprintSummary.concurrent.length > 0 ? { sprintsConcurrent: sprintSummary.concurrent } : {}), ...(sprintSummary.created.length > 0 ? { sprintsCreated: [...sprintSummary.created, ...(plan.summary.sprintsCreated ?? [])] } : {}) },
    managed,
    statuses,
    members,
    error
  };
}

/** Publishes a story that exists only here as a new issue and links it. Resolves with the linked story, the labels the service does not know and what was made for it (labels of its epic and column). */
export async function createInService(input: {
  connector: TrackerConnector;
  target: unknown;
  token: string;
  story: Story;
  fields: readonly FieldDefinition[];
  statuses: readonly StatusValue[];
  epics?: readonly Epic[];
  releases?: readonly Release[];
  sprints?: readonly Sprint[];
  members?: readonly Member[];
}): Promise<{ story: Story; skippedLabels: string[]; made: Made }> {
  const { connector, target, token } = input;
  const labelsField = input.fields.find((field) => field.id === LABELS_FIELD_ID);
  const item = newItemOf(input.story, labelsField, input.statuses, { epics: input.epics, releases: input.releases, sprints: input.sprints, members: input.members });
  const catalog = await connector.catalog(target, token);
  const made: Made = { labels: [], milestones: [] };
  const result = await connector.create(target, token, item, { epics: input.epics ?? [], releases: input.releases ?? [], sprints: input.sprints, members: input.members, statuses: input.statuses, catalog, made });
  return { story: { ...input.story, link: linkTo(connector.kind, result.item) }, skippedLabels: result.skippedLabels, made };
}
