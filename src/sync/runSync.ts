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
  const open = await connector.open(target, token);
  const skipped = connector.skipped?.() ?? 0;
  const context = { epics: input.epics, releases: input.releases, sprints: input.sprints, members: input.members };
  const catalog = await connector.catalog(target, token);
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
    sprints: input.sprints,
    members: input.members,
    externalSprints: catalog.sprints,
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
  let error: SyncError | null = null;
  const fail = (cause: unknown): void => {
    error = cause instanceof SyncError ? cause : new SyncError('other');
  };

  if (input.write) {
    for (const push of plan.pushes) {
      let result;
      try {
        result = await connector.update(target, token, push.item, push.patch, { epics: plan.epics, releases: plan.releases, sprints: plan.sprints, members: input.members, statuses, catalog, made });
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
    summary: { ...plan.summary, ...(skipped > 0 ? { skipped } : {}), published, labelsCreated: made.labels, milestonesCreated: made.milestones, labelsDeleted: gone.labels, milestonesDeleted: gone.milestones },
    managed,
    statuses,
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
