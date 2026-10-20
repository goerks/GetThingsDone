import { epicLabelText, epicOfLabel, labelledStatuses, linkTo, linkedNumbersMissingIn, newIssueOf, pendingFields, planSync, statusLabelText, statusName, statusOfLabel, withBase, LABELS_FIELD_ID, type Decision, type GithubIssue, type PublishEntry, type RepoRef, type SyncPlan, type SyncSummary } from '../domain/github';
import type { ConflictRule, Epic, FieldAssignment, FieldDefinition, Release, StatusValue, Story } from '../domain/types';
import { GithubError, type TrackerConnector } from './source';

export interface RunSyncInput {
  connector: TrackerConnector;
  token: string;
  repo: RepoRef;
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
  /** What earlier syncs made on GitHub: only these labels and milestones are ever deleted again. */
  managed: { labels: readonly string[]; milestones: readonly string[] };
}

export interface RunSyncResult {
  /** The stories, fields and assignments after the sync, with what was published already counted in. */
  plan: SyncPlan;
  summary: SyncSummary;
  /** The labels and milestones the app has made, after this run. */
  managed: { labels: string[]; milestones: string[] };
  /** The first call that failed while publishing. What was done before it is in `plan`; the rest stays for the next sync. */
  error: GithubError | null;
}

/** The colours of labels made for epics and statuses, as hex without the hash. */
const EPIC_HEX: Record<Epic['colorKey'], string> = { blue: '3b82f6', amber: 'f59e0b', teal: '14b8a6', violet: '8b5cf6', rose: 'f43f5e', green: '22c55e', cyan: '06b6d4', slate: '64748b' };
const STATUS_HEX: Record<StatusValue['category'], string> = { not_started: '64748b', in_progress: '3b82f6', done: '22c55e' };

const same = (a: string | null | undefined, b: string | null | undefined): boolean => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/**
 * One sync with a connector: reads the open items and the ones the stories point to, compares them with the stories,
 * then, when writing is on, makes the labels and milestones the changes need, publishes the local changes one story at a
 * time, and deletes the labels and milestones it made that nothing needs any more (#30, AC16). Nothing of this knows
 * GitHub; the connector does.
 */
export async function runSync(input: RunSyncInput): Promise<RunSyncResult> {
  const { connector, token, repo, statuses } = input;
  const labelsField = input.fields.find((field) => field.id === LABELS_FIELD_ID);
  const open = await connector.openIssues(repo, token);
  const context = { epics: input.epics, releases: input.releases };
  const milestones = await connector.listMilestones(repo, token);
  const knownLabels = await connector.listLabels(repo, token);
  // A story whose issue is no longer in the list of open issues may have been closed: ask for those.
  const missing = linkedNumbersMissingIn(input.stories, repo, open, (story) => pendingFields(story, labelsField, statuses, context).length > 0);
  const linked = await Promise.all(missing.map((number) => connector.issue(repo, token, number)));
  const issues: GithubIssue[] = [...open, ...linked.flatMap((issue) => (issue ? [issue] : []))];

  const plan = planSync({
    stories: input.stories,
    fields: input.fields,
    assignments: input.assignments,
    statuses,
    repo,
    issues,
    milestones,
    knownLabels,
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
  const managed = { labels: [...input.managed.labels], milestones: [...input.managed.milestones] };
  const known = [...knownLabels];
  const knownMilestones = [...milestones];
  const made = { labels: [] as string[], milestones: [] as string[] };
  const gone = { labels: [] as string[], milestones: [] as string[] };
  let error: GithubError | null = null;
  const fail = (cause: unknown): void => {
    error = cause instanceof GithubError ? cause : new GithubError('other');
  };

  if (input.write) {
    for (const push of plan.pushes) {
      try {
        // The milestone of a release and the labels of an epic and a column are made before the issue gets them.
        if (push.needsMilestone) {
          const release = input.releases.find((item) => same(item.title, push.needsMilestone));
          let milestone = knownMilestones.find((item) => same(item.title, push.needsMilestone));
          if (!milestone && release) {
            milestone = await connector.createMilestone(repo, token, { title: release.title, description: release.description, dueOn: release.endDate });
            knownMilestones.push(milestone);
            managed.milestones.push(milestone.title);
            made.milestones.push(milestone.title);
          }
          push.patch.milestone = milestone?.number ?? null;
        }
        for (const label of push.patch.labels ?? []) {
          if (known.some((item) => same(item, label))) continue;
          const epic = epicOfLabel(label);
          const status = statusOfLabel(label);
          if (epic === null && status === null) continue;
          const color = epic !== null ? (EPIC_HEX[plan.epics.find((item) => same(item.name, epic))?.colorKey ?? 'slate'] ?? EPIC_HEX.slate) : STATUS_HEX[statuses.find((item) => same(statusName(item), status))?.category ?? 'in_progress'];
          await connector.createLabel(repo, token, { name: label, color });
          known.push(label);
          managed.labels.push(label);
          made.labels.push(label);
        }
      } catch (cause) {
        fail(cause);
        break;
      }
      let result;
      try {
        result = await connector.updateIssue(repo, token, push.number, push.patch);
      } catch (cause) {
        fail(cause);
        break;
      }
      stories = stories.map((story) => (story.id === push.storyId ? withBase(story, result.item, push.fields) : story));
      const story = stories.find((item) => item.id === push.storyId) as Story;
      published.push({ storyId: story.id, code: story.code, number: push.number, title: story.title, fields: push.fields, skippedLabels: result.skippedLabels });
    }

    // What the app made and nothing needs any more is deleted: the epic, column or release is gone here, and no linked story
    // carries it after this sync. What somebody else made is never touched.
    if (!error) {
      try {
        const labelsNeeded = (label: string): boolean => {
          const epic = epicOfLabel(label);
          if (epic !== null) return plan.epics.some((item) => same(item.name, epic)) || stories.some((story) => same(story.github?.base?.epic, epic));
          const status = statusOfLabel(label);
          if (status !== null) return labelledStatuses(statuses).some((item) => same(statusName(item), status)) || stories.some((story) => same(story.github?.base?.status, status));
          return true;
        };
        for (const label of [...managed.labels]) {
          if (!known.some((item) => same(item, label))) {
            managed.labels = managed.labels.filter((item) => item !== label);
          } else if (!labelsNeeded(label)) {
            await connector.deleteLabel(repo, token, label);
            managed.labels = managed.labels.filter((item) => item !== label);
            gone.labels.push(label);
          }
        }
        for (const title of [...managed.milestones]) {
          const milestone = knownMilestones.find((item) => same(item.title, title));
          if (!milestone) {
            managed.milestones = managed.milestones.filter((item) => item !== title);
          } else if (!plan.releases.some((item) => same(item.title, title)) && !stories.some((story) => same(story.github?.base?.release, title))) {
            await connector.deleteMilestone(repo, token, milestone.number);
            managed.milestones = managed.milestones.filter((item) => item !== title);
            gone.milestones.push(title);
          }
        }
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

/** Publishes a story that exists only here as a new issue and links it. Resolves with the linked story, the labels GitHub does not know and the labels (epic, column) that were made for it. */
export async function createOnGithub(input: {
  connector: TrackerConnector;
  token: string;
  repo: RepoRef;
  story: Story;
  fields: readonly FieldDefinition[];
  statuses: readonly StatusValue[];
  epics?: readonly Epic[];
  releases?: readonly Release[];
}): Promise<{ story: Story; skippedLabels: string[]; madeLabels: string[] }> {
  const { connector, token, repo } = input;
  const labelsField = input.fields.find((field) => field.id === LABELS_FIELD_ID);
  const issue = newIssueOf(input.story, labelsField, input.statuses, { epics: input.epics, releases: input.releases });
  // The labels of its epic and its column are made first, so the new issue carries them from the start.
  const known = await connector.listLabels(repo, token);
  const madeLabels: string[] = [];
  for (const label of issue.labels) {
    if (known.some((item) => same(item, label))) continue;
    const epic = epicOfLabel(label);
    const status = statusOfLabel(label);
    if (epic === null && status === null) continue;
    const color = epic !== null ? EPIC_HEX[input.epics?.find((item) => same(item.name, epic))?.colorKey ?? 'slate'] : STATUS_HEX[input.statuses.find((item) => same(statusName(item), status))?.category ?? 'in_progress'];
    await connector.createLabel(repo, token, { name: label, color });
    madeLabels.push(label);
  }
  const result = await connector.createIssue(repo, token, issue);
  return { story: { ...input.story, github: linkTo(result.item) }, skippedLabels: result.skippedLabels, madeLabels };
}
