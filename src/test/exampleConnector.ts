import { SyncError, type Made, type TrackerConnector, type WriteResult } from '../sync/connector';
import type { Catalog, ExternalItem, FieldName, ItemPatch, NewItem } from '../domain/sync';
import type { ExternalFields } from '../domain/types';

/**
 * A second service for the tests (#66, AC11): a tracker that looks like GitLab and nothing like GitHub. Its issues have a
 * number per project, the text is plain, the epic and the board column are scoped labels ("epic::Boards",
 * "status::doing"), there are no task lists (so no criteria), and it keeps nothing to delete. It shows that a service
 * only needs a connector: the engine, the settings and the screens do not change.
 */

export interface ExampleIssue {
  iid: number;
  title: string;
  text: string;
  closed: boolean;
  labels: string[];
  milestone: string | null;
}

export const EXAMPLE_FIELDS: readonly FieldName[] = ['title', 'description', 'labels', 'release', 'epic', 'done', 'status'];

const scoped = (labels: readonly string[], scope: string): string | null => labels.find((label) => label.startsWith(`${scope}::`))?.slice(scope.length + 2) ?? null;
const plainOf = (labels: readonly string[]): string[] => labels.filter((label) => !label.includes('::'));

export const exampleUrl = (iid: number): string => `https://gitlab.example/team/app/-/issues/${iid}`;

function toItem(issue: ExampleIssue): ExternalItem {
  const fields: ExternalFields = {
    title: issue.title,
    description: issue.text,
    labels: plainOf(issue.labels),
    criteria: [],
    release: issue.milestone,
    epic: scoped(issue.labels, 'epic'),
    done: issue.closed,
    status: issue.closed ? null : scoped(issue.labels, 'status')
  };
  return { id: String(issue.iid), key: `#${issue.iid}`, url: exampleUrl(issue.iid), state: issue.closed ? 'closed' : 'open', fields, raw: issue };
}

/** The tracker with its issues; `canWrite` switches the right to write, `goodToken` is the one token it accepts. */
export function exampleTracker(issues: ExampleIssue[]) {
  const state = { issues, goodToken: 'good', canWrite: true, offline: false };
  const check = (token: string): void => {
    if (state.offline) throw new SyncError('network');
    if (token !== state.goodToken) throw new SyncError('auth');
  };
  const connector: TrackerConnector<{ project: string }> = {
    kind: 'gitlab',
    capabilities: { fields: EXAMPLE_FIELDS, create: true, tidy: false },
    target: (connection) => (connection.project ? { project: connection.project } : null),
    normalize(connection): Record<string, string> | null {
      const project = (connection.project ?? '').trim();
      return project !== '' ? { project } : (connection.project ?? '') === '' ? {} : null;
    },
    async open(_target, token) {
      check(token);
      return state.issues.filter((issue) => !issue.closed).map(toItem);
    },
    async item(_target, token, id) {
      check(token);
      const found = state.issues.find((issue) => String(issue.iid) === id);
      return found ? toItem(found) : null;
    },
    idOf: (_target, link) => (link.url.startsWith('https://gitlab.example/team/app/-/issues/') ? link.url.split('/').pop() ?? null : null),
    async catalog(_target, token): Promise<Catalog> {
      check(token);
      return { releases: [...new Set(state.issues.flatMap((issue) => (issue.milestone ? [issue.milestone] : [])))].map((title, index) => ({ id: String(index + 1), title, description: '', dueOn: null, state: 'open' as const })) };
    },
    lacks: () => null,
    async update(_target, token, item: ExternalItem, patch: ItemPatch): Promise<WriteResult> {
      check(token);
      if (!state.canWrite) throw new SyncError('forbidden');
      const index = state.issues.findIndex((issue) => String(issue.iid) === item.id);
      if (index < 0) throw new SyncError('notFound');
      const issue = state.issues[index];
      const remote = toItem(issue).fields;
      const labels = [
        ...(patch.labels ?? remote.labels),
        ...((patch.epic !== undefined ? patch.epic : remote.epic) ? [`epic::${patch.epic !== undefined ? patch.epic : remote.epic}`] : []),
        ...((patch.status !== undefined ? patch.status : remote.status) ? [`status::${patch.status !== undefined ? patch.status : remote.status}`] : [])
      ];
      const changed: ExampleIssue = {
        ...issue,
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { text: patch.description } : {}),
        ...(patch.done !== undefined ? { closed: patch.done } : {}),
        ...(patch.release !== undefined ? { milestone: patch.release } : {}),
        labels
      };
      state.issues[index] = changed;
      return { item: toItem(changed), skippedLabels: [] };
    },
    async create(_target, token, item: NewItem): Promise<WriteResult> {
      check(token);
      if (!state.canWrite) throw new SyncError('forbidden');
      const iid = state.issues.reduce((max, issue) => Math.max(max, issue.iid), 0) + 1;
      const created: ExampleIssue = { iid, title: item.title, text: item.description, closed: false, labels: [...item.labels, ...(item.epic ? [`epic::${item.epic}`] : []), ...(item.status ? [`status::${item.status}`] : [])], milestone: null };
      state.issues.push(created);
      return { item: toItem(created), skippedLabels: [] };
    },
    async tidy(_target, _token, _needs, managed: Made) {
      return { managed, gone: { labels: [], milestones: [] } };
    }
  };
  return { state, connector };
}
