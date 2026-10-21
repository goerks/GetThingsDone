import { SyncError } from '../connector';
import type { AdfDoc } from './adf';
import type { JiraRequest, JiraResponse, JiraTransport } from './client';

/*
 * The simulated Jira of the public preview and the tests (#66): one site with one project and a few issues, kept in this
 * browser. It speaks the same REST calls as Jira Cloud (the ones the connector uses), so the connector runs unchanged.
 * Nothing is sent anywhere. The settings page offers buttons that change the issues, so that a sync can be tried out.
 */

export const DEMO_SITE = 'https://demo.atlassian.net';
export const DEMO_PROJECT = 'PROJ';
export const DEMO_EMAIL = 'demo@example.com';

/** The token the simulation refuses, to try the message for a wrong token. Any other text is accepted. */
export const DEMO_WRONG_TOKEN = 'falsch';
/** The token that may read but not write. */
export const DEMO_READONLY_TOKEN = 'nurlesen';

type Category = 'new' | 'indeterminate' | 'done';

export const DEMO_STATUSES: ReadonlyArray<{ name: string; category: Category }> = [
  { name: 'To Do', category: 'new' },
  { name: 'In Progress', category: 'indeterminate' },
  { name: 'In Review', category: 'indeterminate' },
  { name: 'Done', category: 'done' }
];

export interface DemoJiraIssue {
  key: string;
  summary: string;
  description: AdfDoc | null;
  labels: string[];
  status: string;
  /** `Story`, `Task`, `Epic` or `Sub-task`. */
  type: string;
  /** The key of the epic the issue belongs to. */
  parent?: string | null;
  /** The names of the fix versions. */
  fixVersions?: string[];
  /** The workflow refuses the transition to Done (it needs a resolution), to try the message for it. */
  needsResolution?: boolean;
}

const doc = (...content: AdfDoc['content']): AdfDoc => ({ version: 1, type: 'doc', content });
const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const task = (text: string, done: boolean, id: string) => ({ type: 'taskItem', attrs: { localId: id, state: done ? 'DONE' : 'TODO' }, content: [{ type: 'text', text }] });

export interface DemoJiraVersion {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  releaseDate?: string;
  released?: boolean;
}

export const DEMO_JIRA_VERSIONS: readonly DemoJiraVersion[] = [
  { id: '10001', name: 'v1.0', description: 'First version', releaseDate: '2026-12-31', released: false },
  { id: '10002', name: 'v2.0', description: 'Second version', releaseDate: '2027-06-30', released: false }
];

export const DEMO_JIRA_ISSUES: readonly DemoJiraIssue[] = [
  {
    key: 'PROJ-1',
    summary: 'Login',
    description: doc(para('Users log in with e-mail and password.'), { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Acceptance criteria' }] }, {
      type: 'taskList',
      attrs: { localId: 'l1' },
      content: [task('Login possible', false, 't1'), task('Error message for a wrong password', true, 't2')]
    }),
    labels: ['feature'],
    status: 'To Do',
    type: 'Story',
    fixVersions: ['v1.0']
  },
  { key: 'PROJ-2', summary: 'Export as CSV', description: doc(para('Export the backlog as a CSV file.')), labels: ['feature', 'quick'], status: 'In Progress', type: 'Story', parent: 'PROJ-5' },
  { key: 'PROJ-3', summary: 'Dark mode', description: null, labels: [], status: 'To Do', type: 'Story' },
  { key: 'PROJ-4', summary: 'Imprint page', description: doc(para('Closed long ago.')), labels: [], status: 'Done', type: 'Task' },
  { key: 'PROJ-5', summary: 'Payments', description: null, labels: [], status: 'To Do', type: 'Epic' },
  { key: 'PROJ-6', summary: 'Fix typo', description: null, labels: [], status: 'To Do', type: 'Sub-task' },
  { key: 'PROJ-7', summary: 'Invoice export', description: doc(para('Needs a resolution to be closed.')), labels: [], status: 'To Do', type: 'Story', needsResolution: true }
];

const KEY = 'getitdone.demoJira';
const VERSIONS_KEY = 'getitdone.demoJiraVersions';

export function demoJiraVersions(): DemoJiraVersion[] {
  try {
    const raw = window.localStorage.getItem(VERSIONS_KEY);
    if (raw) return JSON.parse(raw) as DemoJiraVersion[];
  } catch {
    // fall back to the starting data
  }
  return DEMO_JIRA_VERSIONS.map((version) => ({ ...version }));
}

export function saveDemoJiraVersions(versions: readonly DemoJiraVersion[]): void {
  try {
    window.localStorage.setItem(VERSIONS_KEY, JSON.stringify(versions));
  } catch {
    // the simulation then keeps its starting data
  }
}

export function demoJiraIssues(): DemoJiraIssue[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DemoJiraIssue[];
  } catch {
    // fall back to the starting data
  }
  return DEMO_JIRA_ISSUES.map((issue) => ({ ...issue }));
}

export function saveDemoJiraIssues(issues: readonly DemoJiraIssue[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(issues));
  } catch {
    // the simulation then keeps its starting data
  }
}

export function resetDemoJira(): void {
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(VERSIONS_KEY);
  } catch {
    // nothing to reset
  }
}

const categoryOf = (status: string): Category => DEMO_STATUSES.find((entry) => entry.name === status)?.category ?? 'new';

const rawIssue = (issue: DemoJiraIssue, all: readonly DemoJiraIssue[] = []) => ({
  key: issue.key,
  fields: {
    parent: issue.parent ? { key: issue.parent, fields: { summary: all.find((entry) => entry.key === issue.parent)?.summary ?? '', issuetype: { name: 'Epic', hierarchyLevel: 1 } } } : undefined,
    fixVersions: (issue.fixVersions ?? []).map((name) => ({ name })),
    summary: issue.summary,
    description: issue.description,
    labels: issue.labels,
    status: { name: issue.status, statusCategory: { key: categoryOf(issue.status) } },
    issuetype: { name: issue.type, subtask: issue.type === 'Sub-task', hierarchyLevel: issue.type === 'Epic' ? 1 : issue.type === 'Sub-task' ? -1 : 0 }
  }
});

const reply = (status: number, body?: unknown): JiraResponse => ({ status, headers: {}, body: body === undefined ? '' : JSON.stringify(body) });

function tokenOf(request: JiraRequest): string {
  const header = request.headers.Authorization ?? '';
  try {
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(header.replace(/^Basic /, '')), (char) => char.charCodeAt(0)));
    return decoded.slice(decoded.indexOf(':') + 1);
  } catch {
    return '';
  }
}

/** A simulated Jira Cloud. `load` and `save` hold the issues (the page keeps them in `localStorage`, a test in memory). */
export function createJiraSimulation(
  load: () => DemoJiraIssue[] = demoJiraIssues,
  save: (issues: DemoJiraIssue[]) => void = saveDemoJiraIssues,
  loadVersions: () => DemoJiraVersion[] = demoJiraVersions,
  saveVersions: (versions: DemoJiraVersion[]) => void = saveDemoJiraVersions
): JiraTransport {
  return async (request) => {
    const url = new URL(request.url);
    if (url.origin !== DEMO_SITE) throw new SyncError('network');
    const token = tokenOf(request);
    if (token === DEMO_WRONG_TOKEN) return reply(401);
    const read = request.method === 'GET' || url.pathname === '/rest/api/3/search/jql';
    if (token === DEMO_READONLY_TOKEN && !read) return reply(403);
    const body = request.body ? (JSON.parse(request.body) as Record<string, unknown>) : {};
    const path = url.pathname;
    const issues = load();
    const find = (key: string): DemoJiraIssue | undefined => issues.find((issue) => issue.key === key);

    if (path === '/rest/api/3/myself') return reply(200, { emailAddress: DEMO_EMAIL });

    const project = /^\/rest\/api\/3\/project\/([^/]+)(\/statuses)?$/.exec(path);
    const versionsOf = /^\/rest\/api\/3\/project\/([^/]+)\/versions$/.exec(path);
    if (versionsOf) return versionsOf[1] === DEMO_PROJECT ? reply(200, loadVersions()) : reply(404);
    if (path === '/rest/api/3/version' && request.method === 'POST') {
      const fields = body as { name?: string; description?: string; startDate?: string; releaseDate?: string };
      const versions = loadVersions();
      const created: DemoJiraVersion = { id: String(10001 + versions.length), name: fields.name ?? '', description: fields.description, startDate: fields.startDate, releaseDate: fields.releaseDate, released: false };
      saveVersions([...versions, created]);
      return reply(201, created);
    }
    if (project) {
      if (project[1] !== DEMO_PROJECT) return reply(404);
      if (!project[2]) return reply(200, { key: DEMO_PROJECT });
      return reply(200, [{ name: 'Story', statuses: DEMO_STATUSES.map((status) => ({ name: status.name, statusCategory: { key: status.category } })) }]);
    }

    if (path === '/rest/api/3/search/jql' && request.method === 'POST') {
      const jql = String(body.jql ?? '');
      if (!jql.includes(`project = "${DEMO_PROJECT}"`)) return reply(200, { issues: [] });
      if (jql.includes('issuetype = Epic')) return reply(200, { issues: issues.filter((issue) => issue.type === 'Epic').map((issue) => rawIssue(issue, issues)) });
      const open = jql.includes('statusCategory != Done') ? issues.filter((issue) => categoryOf(issue.status) !== 'done') : issues;
      return reply(200, { issues: open.map((issue) => rawIssue(issue, issues)) });
    }

    if (path === '/rest/api/3/issue' && request.method === 'POST') {
      const fields = (body.fields ?? {}) as { summary?: string; labels?: string[]; description?: AdfDoc | null; issuetype?: { name?: string }; parent?: { key?: string } | null; fixVersions?: Array<{ name: string }> };
      const type = fields.issuetype?.name ?? 'Story';
      // The project is a simple one in the second case: it has no "Story" in the demo when the type is unknown.
      if (type !== 'Story' && type !== 'Task' && type !== 'Epic') return reply(400);
      const number = Math.max(0, ...issues.map((issue) => Number(issue.key.split('-')[1]) || 0)) + 1;
      const created: DemoJiraIssue = { key: `${DEMO_PROJECT}-${number}`, summary: fields.summary ?? '', description: fields.description ?? null, labels: fields.labels ?? [], status: 'To Do', type, parent: fields.parent?.key ?? null, fixVersions: (fields.fixVersions ?? []).map((entry) => entry.name) };
      save([...issues, created]);
      return reply(201, { key: created.key });
    }

    const one = /^\/rest\/api\/3\/issue\/([^/]+)(\/transitions)?$/.exec(path);
    if (one) {
      const issue = find(decodeURIComponent(one[1]));
      if (!issue) return reply(404);
      if (!one[2]) {
        if (request.method === 'GET') return reply(200, rawIssue(issue, issues));
        if (request.method === 'PUT') {
          const fields = (body.fields ?? {}) as { summary?: string; labels?: string[]; description?: AdfDoc | null; parent?: { key?: string } | null; fixVersions?: Array<{ name: string }> };
          if ('parent' in fields) issue.parent = fields.parent?.key ?? null;
          if (fields.fixVersions !== undefined) issue.fixVersions = fields.fixVersions.map((entry) => entry.name);
          if (fields.summary !== undefined) issue.summary = fields.summary;
          if (fields.labels !== undefined) issue.labels = fields.labels;
          if ('description' in fields) issue.description = fields.description ?? null;
          save(issues);
          return reply(204);
        }
      } else if (request.method === 'GET') {
        return reply(200, {
          transitions: DEMO_STATUSES.filter((status) => status.name !== issue.status).map((status) => ({ id: status.name, name: status.name, to: { name: status.name, statusCategory: { key: status.category } } }))
        });
      } else if (request.method === 'POST') {
        const id = String((body.transition as { id?: string } | undefined)?.id ?? '');
        const target = DEMO_STATUSES.find((status) => status.name === id);
        if (!target || target.name === issue.status) return reply(400);
        if (target.category === 'done' && issue.needsResolution) return reply(400);
        issue.status = target.name;
        save(issues);
        return reply(204);
      }
    }
    return reply(404);
  };
}

/** A simulation that keeps its issues in memory, for tests. */
export function createMemoryJira(initial: readonly DemoJiraIssue[] = DEMO_JIRA_ISSUES): { transport: JiraTransport; issues: () => DemoJiraIssue[]; versions: () => DemoJiraVersion[] } {
  let issues = initial.map((issue) => JSON.parse(JSON.stringify(issue)) as DemoJiraIssue);
  let versions = DEMO_JIRA_VERSIONS.map((version) => ({ ...version }));
  return { transport: createJiraSimulation(() => issues, (next) => (issues = next), () => versions, (next) => (versions = next)), issues: () => issues, versions: () => versions };
}
