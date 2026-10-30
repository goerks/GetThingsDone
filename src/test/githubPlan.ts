import { planSync, type ExternalRelease, type FieldName, type SyncInput, type SyncPlan } from '../domain/sync';
import { epicLabelText, inRepo, statusLabelText, toItem, toPatch, type ExternalMilestone, type GithubIssue, type GithubPatch, type RepoRef } from '../sync/github/format';

/** The input of a sync as the tests of the GitHub rules write it: issues and milestones as GitHub has them, and the repository. */
export type GithubSyncInput = Omit<SyncInput, 'service' | 'items' | 'externalReleases' | 'lacks' | 'compared'> & {
  repo: RepoRef;
  /** The issues to bring in: the open issues of the repository, and the issues the stories already point to. */
  issues: readonly GithubIssue[];
  milestones?: readonly ExternalMilestone[];
  /** The names of the labels of the repository; with them a sync that may not write can say which label is missing. */
  knownLabels?: readonly string[];
};

/** One change to publish as GitHub gets it. */
export interface GithubPush {
  storyId: string;
  number: number;
  fields: FieldName[];
  patch: GithubPatch;
  /** The title of a release that has no milestone yet: the run makes it before it publishes. */
  needsMilestone?: string;
}

export type GithubPlan = Omit<SyncPlan, 'pushes'> & { pushes: GithubPush[] };

const same = (a: string | null | undefined, b: string | null | undefined): boolean => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/** Plans a sync of stories with GitHub issues: the neutral plan of the engine, with its changes written the way GitHub gets them. */
export function planGithub(input: GithubSyncInput): GithubPlan {
  const { repo, issues, milestones = [], knownLabels, ...rest } = input;
  const externalReleases: ExternalRelease[] = milestones.map((item) => ({ id: String(item.number), title: item.title, description: item.description, dueOn: item.dueOn, state: item.state }));
  const plan = planSync({
    ...rest,
    service: 'github',
    items: issues.filter((issue) => inRepo(issue.url, repo)).map(toItem),
    externalReleases,
    lacks: knownLabels
      ? (kind, name) => {
          const label = kind === 'epic' ? epicLabelText(name) : statusLabelText(name);
          return knownLabels.some((item) => same(item, label)) ? null : label;
        }
      : undefined
  });
  const pushes = plan.pushes.map((push): GithubPush => {
    const release = push.patch.release;
    const found = release ? milestones.find((item) => same(item.title, release)) : undefined;
    const needsMilestone = release && !found ? release : undefined;
    const patch = toPatch(push.item, push.patch, release === undefined ? undefined : release === null ? null : (found?.number ?? null));
    if (needsMilestone) delete patch.milestone;
    return { storyId: push.storyId, number: Number(push.item.id), fields: push.fields, patch, ...(needsMilestone ? { needsMilestone } : {}) };
  });
  return { ...plan, pushes };
}
