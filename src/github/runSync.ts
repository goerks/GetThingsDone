import { epicLabelText, labelledStatuses, linkTo, linkedNumbersMissingIn, newIssueOf, pendingFields, planSync, statusLabelText, statusName, withBase, LABELS_FIELD_ID, type Decision, type GithubIssue, type PublishEntry, type RepoRef, type SyncPlan, type SyncSummary } from '../domain/github';
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
}

export interface RunSyncResult {
  /** The stories, fields and assignments after the sync, with what was published already counted in. */
  plan: SyncPlan;
  summary: SyncSummary;
  /** The first call that failed while publishing. What was done before it is in `plan`; the rest stays for the next sync. */
  error: GithubError | null;
}

/**
 * One sync with a connector: reads the open items and the ones the stories point to, compares them with the stories,
 * then publishes the local changes one story at a time when writing is on. Nothing of this knows GitHub; the connector does.
 */
export async function runSync(input: RunSyncInput): Promise<RunSyncResult> {
  const { connector, token, repo, statuses } = input;
  const labelsField = input.fields.find((field) => field.id === LABELS_FIELD_ID);
  const open = await connector.openIssues(repo, token);
  // A story whose issue is no longer in the list of open issues may have been closed: ask for those.
  const context = { epics: input.epics, releases: input.releases };
  const milestones = await connector.listMilestones(repo, token);
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
  let error: GithubError | null = null;
  if (input.write) {
    for (const push of plan.pushes) {
      let result;
      try {
        result = await connector.updateIssue(repo, token, push.number, push.patch);
      } catch (cause) {
        error = cause instanceof GithubError ? cause : new GithubError('other');
        break;
      }
      stories = stories.map((story) => (story.id === push.storyId ? withBase(story, result.item, push.fields) : story));
      const story = stories.find((item) => item.id === push.storyId) as Story;
      published.push({ storyId: story.id, code: story.code, number: push.number, title: story.title, fields: push.fields, skippedLabels: result.skippedLabels });
    }
  }
  return { plan: { ...plan, stories }, summary: { ...plan.summary, published }, error };
}

/** Publishes a story that exists only here as a new issue and links it. Resolves with the linked story and the labels GitHub does not know. */
export async function createOnGithub(input: {
  connector: TrackerConnector;
  token: string;
  repo: RepoRef;
  story: Story;
  fields: readonly FieldDefinition[];
  statuses: readonly StatusValue[];
  epics?: readonly Epic[];
  releases?: readonly Release[];
}): Promise<{ story: Story; skippedLabels: string[] }> {
  const labelsField = input.fields.find((field) => field.id === LABELS_FIELD_ID);
  const issue = newIssueOf(input.story, labelsField, input.statuses, { epics: input.epics, releases: input.releases });
  const result = await input.connector.createIssue(input.repo, input.token, issue);
  return { story: { ...input.story, github: linkTo(result.item) }, skippedLabels: result.skippedLabels };
}

/** The colours of labels made for epics and statuses, as hex without the hash. */
const EPIC_HEX: Record<Epic['colorKey'], string> = { blue: '3b82f6', amber: 'f59e0b', teal: '14b8a6', violet: '8b5cf6', rose: 'f43f5e', green: '22c55e', cyan: '06b6d4', slate: '64748b' };
const STATUS_HEX: Record<StatusValue['category'], string> = { not_started: '64748b', in_progress: '3b82f6', done: '22c55e' };

/** Makes the milestone of a release, unless the repository has one of that title. Resolves with true when it was made. */
export async function createMilestoneFor(input: { connector: TrackerConnector; token: string; repo: RepoRef; release: Release }): Promise<boolean> {
  const { connector, token, repo, release } = input;
  const known = await connector.listMilestones(repo, token);
  if (known.some((item) => item.title.toLowerCase() === release.title.toLowerCase())) return false;
  await connector.createMilestone(repo, token, { title: release.title, description: release.description, dueOn: release.endDate });
  return true;
}

/** Makes the label "epic: <name>" of an epic, unless the repository has it. Resolves with true when it was made. */
export async function createEpicLabelFor(input: { connector: TrackerConnector; token: string; repo: RepoRef; epic: Epic }): Promise<boolean> {
  const { connector, token, repo, epic } = input;
  const name = epicLabelText(epic.name);
  const known = await connector.listLabels(repo, token);
  if (known.some((item) => item.toLowerCase() === name.toLowerCase())) return false;
  await connector.createLabel(repo, token, { name, color: EPIC_HEX[epic.colorKey] });
  return true;
}

/** Makes the missing labels "status: <name>" of the board columns between the first and done. Resolves with the names that were made. */
export async function createStatusLabels(input: { connector: TrackerConnector; token: string; repo: RepoRef; statuses: readonly StatusValue[] }): Promise<string[]> {
  const { connector, token, repo } = input;
  const known = await connector.listLabels(repo, token);
  const made: string[] = [];
  for (const status of labelledStatuses(input.statuses)) {
    const name = statusLabelText(statusName(status));
    if (known.some((item) => item.toLowerCase() === name.toLowerCase())) continue;
    await connector.createLabel(repo, token, { name, color: STATUS_HEX[status.category] });
    made.push(name);
  }
  return made;
}
