import { describe, expect, it } from 'vitest';
import type { ExternalItem } from '../../domain/sync';
import { SyncError } from '../connector';
import { composeAdf, readAdf, withCriteriaAdf, type AdfDoc } from './adf';
import { isEmail, parseProject, parseSite, type JiraTransport } from './client';
import { createJiraConnector } from './connector';
import { createMemoryJira, DEMO_EMAIL, DEMO_JIRA_ISSUES, DEMO_SITE, type DemoJiraIssue } from './simulation';

const target = { site: DEMO_SITE, email: DEMO_EMAIL, project: 'PROJ', filter: '', statusMap: {} as Record<string, string> };
const context = { epics: [], releases: [], statuses: [], catalog: { releases: [] }, made: { labels: [], milestones: [] } };

function setup(issues: readonly DemoJiraIssue[] = DEMO_JIRA_ISSUES, wrap: (transport: JiraTransport) => JiraTransport = (transport) => transport) {
  const memory = createMemoryJira(issues);
  const connector = createJiraConnector(wrap(memory.transport));
  const find = async (key: string): Promise<ExternalItem> => (await connector.item(target, 'good', key)) as ExternalItem;
  return { memory, connector, find };
}

const doc = (...content: AdfDoc['content']): AdfDoc => ({ version: 1, type: 'doc', content });

describe('the text of an issue (ADF)', () => {
  it('AC8.1 reads the task list under "Acceptance criteria" as criteria and keeps it out of the description', () => {
    // Given a document with a text and a task list under the heading
    const read = readAdf(composeAdf('Users log in.', [{ text: 'Login possible', done: false }, { text: 'Error message for a wrong password', done: true }]));
    // Then the criteria are in this order with their ticks, and the description is only the text
    expect(read.criteria).toEqual([
      { text: 'Login possible', done: false },
      { text: 'Error message for a wrong password', done: true }
    ]);
    expect(read.description).toBe('Users log in.');
    expect(read.lossy).toBe(false);
  });

  it('AC8.1 reads the German heading, and a list without the heading stays in the description', () => {
    const german = readAdf(doc({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Akzeptanzkriterien' }] }, { type: 'taskList', attrs: { localId: 'a' }, content: [{ type: 'taskItem', attrs: { localId: 'b', state: 'DONE' }, content: [{ type: 'text', text: 'Fertig' }] }] }));
    expect(german.criteria).toEqual([{ text: 'Fertig', done: true }]);
    const plain = readAdf(doc({ type: 'taskList', attrs: { localId: 'a' }, content: [{ type: 'taskItem', attrs: { localId: 'b', state: 'TODO' }, content: [{ type: 'text', text: 'Loose task' }] }] }));
    expect(plain.criteria).toEqual([]);
    expect(plain.description).toContain('Loose task');
  });

  it('AC8.2 keeps every other node when only the criteria change', () => {
    // Given a document with a table, a text and a task list
    const table = { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'cell' }] }] }] }] };
    const original = doc(table, ...composeAdf('Intro', [{ text: 'Old', done: false }]).content);
    // When the criteria are replaced
    const next = withCriteriaAdf(original, [{ text: 'Old', done: true }, { text: 'New', done: false }]);
    // Then the table and the text stay and the list holds the new criteria
    expect(next.content[0]).toEqual(table);
    expect(readAdf(next).criteria).toEqual([
      { text: 'Old', done: true },
      { text: 'New', done: false }
    ]);
    expect(readAdf(next).description).toContain('Intro');
  });

  it('AC8.3 calls a text with a table, an image or formatting lossy', () => {
    expect(readAdf(doc({ type: 'table', content: [] })).lossy).toBe(true);
    expect(readAdf(doc({ type: 'mediaSingle', content: [] })).lossy).toBe(true);
    expect(readAdf(doc({ type: 'paragraph', content: [{ type: 'text', text: 'bold', marks: [{ type: 'strong' }] }] })).lossy).toBe(true);
    expect(readAdf(doc({ type: 'paragraph', content: [{ type: 'text', text: 'plain' }] })).lossy).toBe(false);
  });

  it('AC5.1 writes a text with a list and a quote and reads it back unchanged', () => {
    const source = 'Intro\n\n- one\n- two\n\n> quoted';
    expect(readAdf(composeAdf(source, [])).description).toBe(source);
  });
});

describe('what the settings say about Jira', () => {
  it('AC3.2 accepts the usual forms of the address, the project and the e-mail address, and refuses the rest', () => {
    expect(parseSite('https://beispiel.atlassian.net')).toBe('https://beispiel.atlassian.net');
    expect(parseSite('Beispiel.atlassian.net/jira/software')).toBe('https://beispiel.atlassian.net');
    expect(parseSite('beispiel')).toBeNull();
    expect(parseSite('https://example.com')).toBeNull();
    expect(parseSite('')).toBeNull();
    expect(parseProject('proj')).toBe('PROJ');
    expect(parseProject('1ABC')).toBeNull();
    expect(parseProject('')).toBeNull();
    expect(isEmail('anna@beispiel.ch')).toBe(true);
    expect(isEmail('anna')).toBe(false);
    expect(isEmail('')).toBe(false);
  });

  it('AC3.2 keeps nothing for an empty connection and refuses an incomplete one', () => {
    const { connector } = setup();
    expect(connector.normalize({})).toEqual({});
    expect(connector.normalize({ site: 'demo.atlassian.net', email: 'a@b.ch', project: 'proj' })).toEqual({ site: DEMO_SITE, email: 'a@b.ch', project: 'PROJ' });
    expect(connector.normalize({ site: 'demo.atlassian.net', email: 'nope', project: 'PROJ' })).toBeNull();
  });
});

describe('reading from Jira', () => {
  it('AC4.1 imports the open issues with key, address, title, text and labels, and not the done one', async () => {
    const { connector } = setup();
    const open = await connector.open(target, 'good');
    expect(open.map((item) => item.key)).toEqual(['PROJ-1', 'PROJ-2', 'PROJ-3', 'PROJ-7']);
    expect(open[0]).toMatchObject({ url: `${DEMO_SITE}/browse/PROJ-1`, fields: { title: 'Login', description: 'Users log in with e-mail and password.', labels: ['feature'], done: false } });
    expect(open[0].fields.criteria).toEqual([
      { text: 'Login possible', done: false },
      { text: 'Error message for a wrong password', done: true }
    ]);
  });

  it('AC4.3 sends the filter as part of the search', async () => {
    const sent: string[] = [];
    const { connector } = setup(DEMO_JIRA_ISSUES, (transport) => async (request) => {
      if (request.url.endsWith('/search/jql')) sent.push(JSON.parse(request.body ?? '{}').jql);
      return transport(request);
    });
    await connector.open({ ...target, filter: 'labels = mobil' }, 'good');
    expect(sent[0]).toContain('project = "PROJ"');
    expect(sent[0]).toContain('AND (labels = mobil)');
  });

  it('AC4.4 leaves out epics and sub-tasks and counts them', async () => {
    const { connector } = setup();
    const open = await connector.open(target, 'good');
    expect(open.map((item) => item.key)).not.toContain('PROJ-5');
    expect(open.map((item) => item.key)).not.toContain('PROJ-6');
    expect(connector.skipped?.()).toBe(2);
  });

  it('AC6.2 takes the name of the workflow status for a column in progress, and the first column for "To Do"', async () => {
    const { find } = setup();
    expect((await find('PROJ-2')).fields.status).toBe('In Progress');
    expect((await find('PROJ-1')).fields.status).toBeNull();
  });

  it('AC6.5 sees an issue in the category done as done', async () => {
    const { find } = setup();
    expect(await find('PROJ-4')).toMatchObject({ state: 'closed', fields: { done: true, status: null } });
  });

  it('AC12.2 uses the issue key as the key of the story and tells which issue an address points to', async () => {
    const { connector, find } = setup();
    const item = await find('PROJ-1');
    expect(item.key).toBe('PROJ-1');
    expect(connector.idOf(target, { service: 'jira', key: 'PROJ-1', url: `${DEMO_SITE}/browse/PROJ-1`, state: 'open' })).toBe('PROJ-1');
    expect(connector.idOf(target, { service: 'jira', key: 'X-1', url: 'https://other.atlassian.net/browse/X-1', state: 'open' })).toBeNull();
  });
});

describe('writing to Jira', () => {
  it('AC5.2 changes the title and the labels, and says which labels Jira cannot hold', async () => {
    const { connector, find, memory } = setup();
    const { item, skippedLabels } = await connector.update(target, 'good', await find('PROJ-1'), { title: 'Login-Seite', labels: ['feature', 'good first issue'] }, context);
    expect(item.fields).toMatchObject({ title: 'Login-Seite', labels: ['feature'] });
    expect(skippedLabels).toEqual(['good first issue']);
    expect(memory.issues().find((issue) => issue.key === 'PROJ-1')?.summary).toBe('Login-Seite');
  });

  it('AC8.2 writes the criteria and leaves the rest of the text as it is', async () => {
    const { connector, find } = setup();
    const { item } = await connector.update(target, 'good', await find('PROJ-1'), { criteria: [{ text: 'Login possible', done: true }, { text: 'Error message for a wrong password', done: true }, { text: 'Password reset', done: false }] }, context);
    expect(item.fields.criteria).toEqual([
      { text: 'Login possible', done: true },
      { text: 'Error message for a wrong password', done: true },
      { text: 'Password reset', done: false }
    ]);
    expect(item.fields.description).toBe('Users log in with e-mail and password.');
  });

  it('AC8.3 never rewrites a description it cannot show completely', async () => {
    // Given an issue whose text holds a table
    const table = { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'cell' }] }] }] }] };
    const withTable: DemoJiraIssue = { key: 'PROJ-9', summary: 'With table', description: doc({ type: 'paragraph', content: [{ type: 'text', text: 'Intro' }] }, table), labels: [], status: 'To Do', type: 'Story' };
    const { connector, find, memory } = setup([withTable]);
    // When the title changes, and then the description
    await connector.update(target, 'good', await find('PROJ-9'), { title: 'New title' }, context);
    await connector.update(target, 'good', await find('PROJ-9'), { description: 'Rewritten' }, context);
    // Then the table is still there and the text was not written
    const stored = memory.issues()[0];
    expect(stored.summary).toBe('New title');
    expect(stored.description?.content).toContainEqual(table);
    expect(readAdf(stored.description).description).not.toContain('Rewritten');
  });

  it('AC6.3 moves an issue to a column by a transition of the workflow', async () => {
    const { connector, find } = setup();
    const { item } = await connector.update(target, 'good', await find('PROJ-2'), { status: 'In Review' }, context);
    expect(item.fields.status).toBe('In Review');
  });

  it('AC6.3 uses the map of statuses for a column with another name', async () => {
    const { connector, find } = setup();
    const mapped = { ...target, statusMap: { 'In Review': 'Review' } };
    const { item } = await connector.update(mapped, 'good', await find('PROJ-2'), { status: 'Review' }, context);
    expect(item.fields.status).toBe('Review');
  });

  it('AC6.5 closes an issue and opens it again', async () => {
    const { connector, find } = setup();
    const closed = await connector.update(target, 'good', await find('PROJ-3'), { done: true }, context);
    expect(closed.item).toMatchObject({ state: 'closed', fields: { done: true } });
    const reopened = await connector.update(target, 'good', closed.item, { done: false }, context);
    expect(reopened.item).toMatchObject({ state: 'open', fields: { done: false } });
  });

  it('AC6.4 says "transition" when the workflow does not allow the status, and changes nothing', async () => {
    const { connector, find, memory } = setup();
    await expect(connector.update(target, 'good', await find('PROJ-7'), { done: true }, context)).rejects.toMatchObject({ kind: 'transition' });
    expect(memory.issues().find((issue) => issue.key === 'PROJ-7')?.status).toBe('To Do');
  });

  it('AC6.4 says "transition" for a column the workflow does not have', async () => {
    const { connector, find } = setup();
    await expect(connector.update(target, 'good', await find('PROJ-2'), { status: 'Waiting' }, context)).rejects.toMatchObject({ kind: 'transition' });
  });

  it('AC5.9 creates a story that is then in the list of open issues, with its criteria', async () => {
    const { connector } = setup();
    const { item } = await connector.create(target, 'good', { title: 'Export as CSV', description: 'Text', criteria: [{ text: 'Header row', done: false }], labels: ['feature'], epic: null, status: null }, context);
    expect(item).toMatchObject({ key: 'PROJ-8', fields: { title: 'Export as CSV', description: 'Text', labels: ['feature'] } });
    expect(item.fields.criteria).toEqual([{ text: 'Header row', done: false }]);
    expect((await connector.open(target, 'good')).map((entry) => entry.key)).toContain('PROJ-8');
  });

  it('AC5.2 never deletes anything: the connector has nothing to tidy', async () => {
    const { connector } = setup();
    expect(connector.capabilities.tidy).toBe(false);
  });

  it('AC6.1 lists the statuses of the workflow with their category', async () => {
    const { connector } = setup();
    expect(await connector.statuses?.(target, 'good')).toEqual([
      { name: 'To Do', category: 'new' },
      { name: 'In Progress', category: 'indeterminate' },
      { name: 'In Review', category: 'indeterminate' },
      { name: 'Done', category: 'done' }
    ]);
  });
});

describe('epics and fix versions', () => {
  const catalogOf = (connector: ReturnType<typeof setup>['connector']) => connector.catalog(target, 'good');

  it('AC7.1 reads the epic of an issue as its epic', async () => {
    const { find } = setup();
    expect((await find('PROJ-2')).fields.epic).toBe('Payments');
    expect((await find('PROJ-1')).fields.epic).toBeNull();
  });

  it('AC7.1 puts an issue into another epic, makes the epic when the project has none, and takes it out again', async () => {
    const { connector, find, memory } = setup();
    const catalog = await catalogOf(connector);
    const withCatalog = { ...context, catalog };
    const moved = await connector.update(target, 'good', await find('PROJ-1'), { epic: 'Payments' }, withCatalog);
    expect(moved.item.fields.epic).toBe('Payments');
    const made = await connector.update(target, 'good', moved.item, { epic: 'Login & Account' }, withCatalog);
    expect(made.item.fields.epic).toBe('Login & Account');
    expect(memory.issues().filter((issue) => issue.type === 'Epic').map((issue) => issue.summary)).toEqual(['Payments', 'Login & Account']);
    const none = await connector.update(target, 'good', made.item, { epic: null }, withCatalog);
    expect(none.item.fields.epic).toBeNull();
  });

  it('AC7.1 puts the epic of a new issue into its parent', async () => {
    const { connector } = setup();
    const catalog = await catalogOf(connector);
    const { item } = await connector.create(target, 'good', { title: 'New', description: '', criteria: [], labels: [], epic: 'Payments', status: null }, { ...context, catalog });
    expect(item.fields.epic).toBe('Payments');
  });

  it('AC7.2 reads the fix version as the release and the versions with their due date as the releases of the service', async () => {
    const { connector, find } = setup();
    expect((await find('PROJ-1')).fields.release).toBe('v1.0');
    const catalog = await catalogOf(connector);
    expect(catalog.releases).toEqual([
      { id: '10001', title: 'v1.0', description: 'First version', dueOn: '2026-12-31', state: 'open' },
      { id: '10002', title: 'v2.0', description: 'Second version', dueOn: '2027-06-30', state: 'open' }
    ]);
  });

  it('AC7.2 sets another version, makes a missing one with its dates, and never deletes one', async () => {
    const { connector, find, memory } = setup();
    const catalog = await catalogOf(connector);
    const release = { id: 'r3', title: 'v3.0', description: 'Third', startDate: '2027-01-01', endDate: '2027-09-30' };
    const withCatalog = { ...context, catalog, releases: [release] };
    const other = await connector.update(target, 'good', await find('PROJ-1'), { release: 'v2.0' }, withCatalog);
    expect(other.item.fields.release).toBe('v2.0');
    const made = await connector.update(target, 'good', other.item, { release: 'v3.0' }, withCatalog);
    expect(made.item.fields.release).toBe('v3.0');
    expect(memory.versions().find((version) => version.name === 'v3.0')).toMatchObject({ description: 'Third', startDate: '2027-01-01', releaseDate: '2027-09-30' });
    const none = await connector.update(target, 'good', made.item, { release: null }, withCatalog);
    expect(none.item.fields.release).toBeNull();
    expect(memory.versions().map((version) => version.name)).toEqual(['v1.0', 'v2.0', 'v3.0']);
  });

  it('AC7.6 never deletes: nothing is removed from Jira by a write', async () => {
    const { connector, find, memory } = setup();
    const before = memory.issues().length;
    const catalog = await catalogOf(connector);
    await connector.update(target, 'good', await find('PROJ-1'), { epic: null, release: null, labels: [] }, { ...context, catalog });
    expect(memory.issues()).toHaveLength(before);
    expect(connector.capabilities.tidy).toBe(false);
  });
});

describe('story points', () => {
  it('AC7.4 reads the story points of an issue, and 0 when it has none', async () => {
    const { find } = setup();
    expect((await find('PROJ-1')).fields.points).toBe(5);
    expect((await find('PROJ-3')).fields.points).toBe(0);
  });

  it('AC7.4 writes the story points, and clears them with 0', async () => {
    const { connector, find, memory } = setup();
    const written = await connector.update(target, 'good', await find('PROJ-1'), { points: 8 }, context);
    expect(written.item.fields.points).toBe(8);
    expect(memory.issues().find((issue) => issue.key === 'PROJ-1')?.points).toBe(8);
    const cleared = await connector.update(target, 'good', written.item, { points: 0 }, context);
    expect(cleared.item.fields.points).toBe(0);
  });
});

describe('sprints', () => {
  const withBoard = async (connector: ReturnType<typeof setup>['connector']) => ({ ...context, catalog: await connector.catalog(target, 'good'), sprints: [{ id: 's3', name: 'Sprint 16', startDate: '2026-11-30', endDate: '2026-12-13', state: 'planned' as const, startItems: null, result: null }] });

  it('AC7.3 reads the sprint of an issue and the open sprints of the board with their dates and goal', async () => {
    const { connector, find } = setup();
    expect((await find('PROJ-2')).fields.sprint).toBe('Sprint 14');
    expect((await find('PROJ-1')).fields.sprint).toBeNull();
    const catalog = await connector.catalog(target, 'good');
    expect(catalog.sprints).toEqual([
      { id: '14', name: 'Sprint 14', goal: 'Login ready', startDate: '2026-11-02', endDate: '2026-11-15', state: 'running' },
      { id: '15', name: 'Sprint 15', goal: '', startDate: null, endDate: null, state: 'planned' }
    ]);
    expect(connector.capabilities.fields).toContain('sprint');
  });

  it('AC7.3 puts an issue into another sprint, makes a missing sprint, and back into the backlog', async () => {
    const { connector, find, memory } = setup();
    const withCatalog = await withBoard(connector);
    const moved = await connector.update(target, 'good', await find('PROJ-2'), { sprint: 'Sprint 15' }, withCatalog);
    expect(moved.item.fields.sprint).toBe('Sprint 15');
    const made = await connector.update(target, 'good', moved.item, { sprint: 'Sprint 16' }, withCatalog);
    expect(made.item.fields.sprint).toBe('Sprint 16');
    expect(memory.sprints().find((sprint) => sprint.name === 'Sprint 16')).toMatchObject({ startDate: '2026-11-30T00:00:00.000Z', endDate: '2026-12-13T00:00:00.000Z' });
    const none = await connector.update(target, 'good', made.item, { sprint: null }, withCatalog);
    expect(none.item.fields.sprint).toBeNull();
    expect(memory.sprints().map((sprint) => sprint.name)).toEqual(['Sprint 14', 'Sprint 15', 'Sprint 16']);
  });

  it('AC7.3 compares no sprint when the project has no scrum board', async () => {
    const { connector } = setup(DEMO_JIRA_ISSUES, (transport) => async (request) => (request.url.includes('/rest/agile/1.0/board?') ? { status: 400, headers: {}, body: '' } : transport(request)));
    await connector.catalog(target, 'good');
    expect(connector.capabilities.fields).not.toContain('sprint');
  });
});

describe('assignees', () => {
  it('AC7.5 reads the name of the assignee', async () => {
    const { find } = setup();
    expect((await find('PROJ-1')).fields.assignee).toBe('Anna Meier');
    expect((await find('PROJ-2')).fields.assignee).toBeNull();
  });

  it('AC7.5 assigns a person by name and takes the assignment away again', async () => {
    const { connector, find } = setup();
    const assigned = await connector.update(target, 'good', await find('PROJ-2'), { assignee: 'Tom Keller' }, context);
    expect(assigned.item.fields.assignee).toBe('Tom Keller');
    const cleared = await connector.update(target, 'good', assigned.item, { assignee: null }, context);
    expect(cleared.item.fields.assignee).toBeNull();
  });

  it('AC7.5 changes nothing for a name that nobody has in Jira', async () => {
    const { connector, find } = setup();
    const { item } = await connector.update(target, 'good', await find('PROJ-1'), { assignee: 'Nobody Known' }, context);
    expect(item.fields.assignee).toBe('Anna Meier');
  });
});

describe('errors', () => {
  it('AC9.1 tells a wrong token, a project that is not there, a refused write and a missing network apart', async () => {
    const { connector, find } = setup();
    await expect(connector.open(target, 'falsch')).rejects.toMatchObject({ kind: 'auth' });
    await expect(connector.open({ ...target, project: 'GIBTSNICHT' }, 'good')).rejects.toMatchObject({ kind: 'notFound' });
    await expect(connector.update(target, 'nurlesen', await find('PROJ-1'), { title: 'x' }, context)).rejects.toMatchObject({ kind: 'forbidden' });
    const offline = createJiraConnector(async () => {
      throw new TypeError('offline');
    });
    await expect(offline.open(target, 'good')).rejects.toBeInstanceOf(SyncError);
    await expect(offline.open(target, 'good')).rejects.toMatchObject({ kind: 'network' });
  });

  it('AC9.1 tells that Jira asks to slow down', async () => {
    const { connector } = setup(DEMO_JIRA_ISSUES, () => async () => ({ status: 429, headers: {}, body: '' }));
    await expect(connector.open(target, 'good')).rejects.toMatchObject({ kind: 'rateLimit' });
  });
});
