import { linkTo, linkedNumbersMissingIn, newIssueOf, pendingFields, planSync, withBase, LABELS_FIELD_ID, type Decision, type GithubIssue, type PublishEntry, type RepoRef, type SyncPlan, type SyncSummary } from '../domain/github';
import type { ConflictRule, FieldAssignment, FieldDefinition, StatusValue, Story } from '../domain/types';
import { GithubError, type TrackerConnector } from './source';

export interface RunSyncInput {
  connector: TrackerConnector;
  token: string;
  repo: RepoRef;
  stories: readonly Story[];
  fields: readonly FieldDefinition[];
  assignments: readonly FieldAssignment[];
  statuses: readonly StatusValue[];
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
  const missing = linkedNumbersMissingIn(input.stories, repo, open, (story) => pendingFields(story, labelsField, statuses).length > 0);
  const linked = await Promise.all(missing.map((number) => connector.issue(repo, token, number)));
  const issues: GithubIssue[] = [...open, ...linked.flatMap((issue) => (issue ? [issue] : []))];

  const plan = planSync({
    stories: input.stories,
    fields: input.fields,
    assignments: input.assignments,
    statuses,
    repo,
    issues,
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
}): Promise<{ story: Story; skippedLabels: string[] }> {
  const labelsField = input.fields.find((field) => field.id === LABELS_FIELD_ID);
  const result = await input.connector.createIssue(input.repo, input.token, newIssueOf(input.story, labelsField, input.statuses));
  return { story: { ...input.story, github: linkTo(result.item) }, skippedLabels: result.skippedLabels };
}
