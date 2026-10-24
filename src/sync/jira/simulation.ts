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
  /** The story points (the field "Story point estimate"). */
  points?: number | null;
  /** The id of the sprint the issue is in. */
  sprint?: number | null;
  /** The account id of the assignee. */
  assignee?: string | null;
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

export const DEMO_POINTS_FIELD = 'customfield_10016';
export const DEMO_SPRINT_FIELD = 'customfield_10020';

export interface DemoJiraSprint {
  id: number;
  name: string;
  state: 'active' | 'future' | 'closed';
  goal?: string;
  startDate?: string;
  endDate?: string;
}

export const DEMO_JIRA_SPRINTS: readonly DemoJiraSprint[] = [
  { id: 14, name: 'Sprint 14', state: 'active', goal: 'Login ready', startDate: '2026-11-02T00:00:00.000Z', endDate: '2026-11-15T00:00:00.000Z' },
  { id: 15, name: 'Sprint 15', state: 'future' }
];

/** The people of the simulated Jira who can be assigned. */
export const DEMO_JIRA_USERS: ReadonlyArray<{ accountId: string; displayName: string; accountType: 'atlassian' | 'app' }> = [
  { accountId: 'u-anna', displayName: 'Anna Meier', accountType: 'atlassian' },
  { accountId: 'u-tom', displayName: 'Tom Keller', accountType: 'atlassian' },
  { accountId: 'u-bot', displayName: 'Automation', accountType: 'app' }
];

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
    fixVersions: ['v1.0'],
    points: 5,
    assignee: 'u-anna'
  },
  { key: 'PROJ-2', summary: 'Export as CSV', description: doc(para('Export the backlog as a CSV file.')), labels: ['feature', 'quick'], status: 'In Progress', type: 'Story', parent: 'PROJ-5', sprint: 14 },
  { key: 'PROJ-3', summary: 'Dark mode', description: null, labels: [], status: 'To Do', type: 'Story', sprint: 15 },
  { key: 'PROJ-4', summary: 'Imprint page', description: doc(para('Closed long ago.')), labels: [], status: 'Done', type: 'Task' },
  { key: 'PROJ-5', summary: 'Payments', description: null, labels: [], status: 'To Do', type: 'Epic' },
  { key: 'PROJ-6', summary: 'Fix typo', description: null, labels: [], status: 'To Do', type: 'Sub-task' },
  { key: 'PROJ-7', summary: 'Invoice export', description: doc(para('Needs a resolution to be closed.')), labels: [], status: 'To Do', type: 'Story', needsResolution: true }
];

const KEY = 'getitdone.demoJira';
const VERSIONS_KEY = 'getitdone.demoJiraVersions';
const SPRINTS_KEY = 'getitdone.demoJiraSprints';

export function demoJiraSprints(): DemoJiraSprint[] {
  try {
    const raw = window.localStorage.getItem(SPRINTS_KEY);
    if (raw) return JSON.parse(raw) as DemoJiraSprint[];
  } catch {
    // fall back to the starting data
  }
  return DEMO_JIRA_SPRINTS.map((sprint) => ({ ...sprint }));
}

export function saveDemoJiraSprints(sprints: readonly DemoJiraSprint[]): void {
  try {
    window.localStorage.setItem(SPRINTS_KEY, JSON.stringify(sprints));
  } catch {
    // the simulation then keeps its starting data
  }
}

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
    window.localStorage.removeItem(SPRINTS_KEY);
  } catch {
    // nothing to reset
  }
}

const categoryOf = (status: string): Category => DEMO_STATUSES.find((entry) => entry.name === status)?.category ?? 'new';

const rawIssue = (issue: DemoJiraIssue, all: readonly DemoJiraIssue[] = [], sprints: readonly DemoJiraSprint[] = []) => ({
  key: issue.key,
  fields: {
    parent: issue.parent ? { key: issue.parent, fields: { summary: all.find((entry) => entry.key === issue.parent)?.summary ?? '', issuetype: { name: 'Epic', hierarchyLevel: 1 } } } : undefined,
    fixVersions: (issue.fixVersions ?? []).map((name) => ({ name })),
    [DEMO_POINTS_FIELD]: issue.points ?? null,
    [DEMO_SPRINT_FIELD]: issue.sprint ? sprints.filter((sprint) => sprint.id === issue.sprint).map((sprint) => ({ id: sprint.id, name: sprint.name, state: sprint.state })) : null,
    assignee: issue.assignee ? { accountId: issue.assignee, displayName: DEMO_JIRA_USERS.find((user) => user.accountId === issue.assignee)?.displayName } : null,
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
  saveVersions: (versions: DemoJiraVersion[]) => void = saveDemoJiraVersions,
  loadSprints: () => DemoJiraSprint[] = demoJiraSprints,
  saveSprints: (sprints: DemoJiraSprint[]) => void = saveDemoJiraSprints
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

    if (path === '/rest/api/3/field') {
      return reply(200, [{ id: 'summary', name: 'Summary' }, { id: DEMO_POINTS_FIELD, name: 'Story point estimate' }, { id: DEMO_SPRINT_FIELD, name: 'Sprint', schema: { custom: 'com.pyxis.greenhopper.jira:gh-sprint' } }]);
    }
    if (path === '/rest/api/3/user/assignable/search') {
      const query = (url.searchParams.get('query') ?? '').toLowerCase();
      return reply(200, DEMO_JIRA_USERS.filter((user) => user.displayName.toLowerCase().includes(query)));
    }
    if (path === '/rest/agile/1.0/board') return reply(200, { values: [{ id: 1, name: `${DEMO_PROJECT} Board`, type: 'scrum' }, { id: 2, name: `${DEMO_PROJECT} Team B`, type: 'scrum' }] });
    const boardSprints = /^\/rest\/agile\/1\.0\/board\/(\d+)\/sprint$/.exec(path);
    if (boardSprints) return reply(200, { values: boardSprints[1] === '1' ? loadSprints().filter((sprint) => sprint.state !== 'closed') : [] });
    if (path === '/rest/agile/1.0/sprint' && request.method === 'POST') {
      const fields = body as { name?: string; startDate?: string; endDate?: string; goal?: string };
      const sprints = loadSprints();
      const created: DemoJiraSprint = { id: Math.max(0, ...sprints.map((sprint) => sprint.id)) + 1, name: fields.name ?? '', state: 'future', goal: fields.goal, startDate: fields.startDate, endDate: fields.endDate };
      saveSprints([...sprints, created]);
      return reply(201, created);
    }
    const oneSprint = /^\/rest\/agile\/1\.0\/sprint\/(\d+)$/.exec(path);
    if (oneSprint) {
      const sprints = loadSprints();
      const found = sprints.find((sprint) => sprint.id === Number(oneSprint[1]));
      if (!found) return reply(404);
      if (request.method === 'POST') {
        const fields = body as { name?: string; goal?: string; startDate?: string; endDate?: string; state?: 'active' | 'closed' };
        if (fields.name !== undefined) found.name = fields.name;
        if (fields.goal !== undefined) found.goal = fields.goal;
        if (fields.startDate !== undefined) found.startDate = fields.startDate;
        if (fields.endDate !== undefined) found.endDate = fields.endDate;
        if (fields.state === 'active') found.state = 'active';
        if (fields.state === 'closed') {
          if (found.state !== 'active') return reply(400);
          found.state = 'closed';
        }
        saveSprints(sprints);
      }
      return reply(200, found);
    }
    const intoSprint = /^\/rest\/agile\/1\.0\/sprint\/(\d+)\/issue$/.exec(path);
    if (intoSprint && request.method === 'POST') {
      const keys = ((body.issues ?? []) as string[]);
      save(issues.map((issue) => (keys.includes(issue.key) ? { ...issue, sprint: Number(intoSprint[1]) } : issue)));
      return reply(204);
    }
    if (path === '/rest/agile/1.0/backlog/issue' && request.method === 'POST') {
      const keys = ((body.issues ?? []) as string[]);
      save(issues.map((issue) => (keys.includes(issue.key) ? { ...issue, sprint: null } : issue)));
      return reply(204);
    }
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
      if (jql.includes('issuetype = Epic')) return reply(200, { issues: issues.filter((issue) => issue.type === 'Epic').map((issue) => rawIssue(issue, issues, loadSprints())) });
      const open = jql.includes('statusCategory != Done') ? issues.filter((issue) => categoryOf(issue.status) !== 'done') : issues;
      return reply(200, { issues: open.map((issue) => rawIssue(issue, issues, loadSprints())) });
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
        if (request.method === 'GET') return reply(200, rawIssue(issue, issues, loadSprints()));
        if (request.method === 'PUT') {
          const fields = (body.fields ?? {}) as { summary?: string; labels?: string[]; description?: AdfDoc | null; parent?: { key?: string } | null; fixVersions?: Array<{ name: string }> };
          if (DEMO_POINTS_FIELD in fields) issue.points = (fields as Record<string, number | null>)[DEMO_POINTS_FIELD];
          if ('assignee' in fields) issue.assignee = (fields as { assignee?: { accountId?: string } | null }).assignee?.accountId ?? null;
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
export function createMemoryJira(initial: readonly DemoJiraIssue[] = DEMO_JIRA_ISSUES): { transport: JiraTransport; issues: () => DemoJiraIssue[]; versions: () => DemoJiraVersion[]; sprints: () => DemoJiraSprint[] } {
  let issues = initial.map((issue) => JSON.parse(JSON.stringify(issue)) as DemoJiraIssue);
  let versions = DEMO_JIRA_VERSIONS.map((version) => ({ ...version }));
  let sprints = DEMO_JIRA_SPRINTS.map((sprint) => ({ ...sprint }));
  return {
    transport: createJiraSimulation(() => issues, (next) => (issues = next), () => versions, (next) => (versions = next), () => sprints, (next) => (sprints = next)),
    issues: () => issues,
    versions: () => versions,
    sprints: () => sprints
  };
}
