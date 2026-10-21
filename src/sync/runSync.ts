import { linkedIdsMissingIn, LABELS_FIELD_ID, linkTo, middleStatuses, newItemOf, pendingFields, planSync, statusName, withBase, type Decision, type PublishEntry, type SyncPlan, type SyncSummary } from '../domain/sync';
import type { ConflictRule, Epic, FieldAssignment, FieldDefinition, Release, StatusValue, Story } from '../domain/types';
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
  const { connector, target, token, statuses } = input;
  const labelsField = input.fields.find((field) => field.id === LABELS_FIELD_ID);
  const open = await connector.open(target, token);
  const context = { epics: input.epics, releases: input.releases };
  const catalog = await connector.catalog(target, token);
  // A story whose item is no longer in the list of open items may have been closed: ask for those.
  const missing = linkedIdsMissingIn(
    input.stories,
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
    stories: input.stories,
    fields: input.fields,
    assignments: input.assignments,
    statuses,
    items,
    externalReleases: catalog.releases,
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
        result = await connector.update(target, token, push.item, push.patch, { epics: plan.epics, releases: plan.releases, statuses, catalog, made });
      } catch (cause) {
        fail(cause);
        break;
      }
      stories = stories.map((story) => (story.id === push.storyId ? withBase(story, result.item, push.fields) : story));
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
    summary: { ...plan.summary, published, labelsCreated: made.labels, milestonesCreated: made.milestones, labelsDeleted: gone.labels, milestonesDeleted: gone.milestones },
    managed,
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
}): Promise<{ story: Story; skippedLabels: string[]; made: Made }> {
  const { connector, target, token } = input;
  const labelsField = input.fields.find((field) => field.id === LABELS_FIELD_ID);
  const item = newItemOf(input.story, labelsField, input.statuses, { epics: input.epics, releases: input.releases });
  const catalog = await connector.catalog(target, token);
  const made: Made = { labels: [], milestones: [] };
  const result = await connector.create(target, token, item, { epics: input.epics ?? [], releases: input.releases ?? [], statuses: input.statuses, catalog, made });
  return { story: { ...input.story, link: linkTo(connector.kind, result.item) }, skippedLabels: result.skippedLabels, made };
}
