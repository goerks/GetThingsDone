import { startStatus } from '../../domain/statuses';
import { statusName } from '../../domain/sync';
import type { Catalog, ExternalItem, ExternalRelease, ExternalSprint, FieldName, ItemPatch, NewItem } from '../../domain/sync';
import type { ExternalFields, ExternalLink } from '../../domain/types';
import { SyncError, type ServiceBoard, type TidyResult, type TrackerConnector, type WorkflowStatus, type WriteContext, type WriteResult } from '../connector';
import { composeAdf, isAdf, readAdf, withCriteriaAdf, type AdfDoc } from './adf';
import { createClient, isEmail, parseProject, parseSite, type JiraClient, type JiraTarget, type JiraTransport } from './client';

/*
 * The connector of Jira Cloud (#66, ADR 0007), phase 1: title, description, labels, criteria, done and the board column.
 * The status is written as a transition of the workflow, the text as an Atlassian Document, the criteria as the task list
 * under the heading "Acceptance criteria". Epics, versions, sprints and points follow in later phases; epics and sub-tasks
 * are not stories and are left out of the import (and counted).
 */

type StatusCategory = WorkflowStatus['category'];

interface RawIssue {
  key: string;
  fields: {
    summary?: string;
    description?: unknown;
    labels?: string[];
    status?: { name: string; statusCategory?: { key?: string } };
    issuetype?: { name?: string; subtask?: boolean; hierarchyLevel?: number };
    parent?: { key: string; fields?: { summary?: string; issuetype?: { name?: string; hierarchyLevel?: number } } };
    fixVersions?: Array<{ name: string }>;
    assignee?: { accountId: string; displayName?: string } | null;
    [custom: `customfield_${number}`]: unknown;
  };
}

interface RawSprint {
  id: number;
  name: string;
  state?: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
}

interface RawVersion {
  id: string;
  name: string;
  description?: string;
  releaseDate?: string;
  released?: boolean;
}

/** What the connector keeps in the catalog: the epics of the project and the names of its versions. */
interface JiraCatalog {
  epics: Array<{ key: string; name: string }>;
  versions: string[];
  /** The scrum board of the project, or null when there is none (then sprints are not synchronised). */
  boardId: number | null;
  sprints: Array<{ id: number; name: string }>;
}

const extraOf = (catalog: Catalog): JiraCatalog => {
  if (!catalog.extra) {
    const fresh: JiraCatalog = { epics: [], versions: [], boardId: null, sprints: [] };
    catalog.extra = fresh;
  }
  return catalog.extra as JiraCatalog;
};

interface Transition {
  id: string;
  name: string;
  to: { name: string; statusCategory?: { key?: string } };
}

/** What the connector keeps of an issue besides the compared fields. */
interface JiraRaw {
  adf: AdfDoc | null;
  /** The text holds more than the app can show: it is never written. */
  lossy: boolean;
  statusName: string;
  category: StatusCategory;
}

/** The names Jira gives the field of the story points. */
const POINTS_NAMES = ['story point estimate', 'story points'];
const FIELDS = ['summary', 'description', 'labels', 'status', 'issuetype', 'parent', 'fixVersions', 'assignee'];
/** An issue in a sprint that is closed counts as in the backlog. */
const SPRINT_ORDER = ['active', 'future'];
const PAGE = 100;
const MAX_PAGES = 30;

const isEpic = (parent: RawIssue['fields']['parent']): boolean => parent?.fields?.issuetype?.hierarchyLevel === 1 || parent?.fields?.issuetype?.name === 'Epic';

const categoryOf = (raw: RawIssue): StatusCategory => {
  const key = raw.fields.status?.statusCategory?.key;
  return key === 'done' ? 'done' : key === 'indeterminate' ? 'indeterminate' : 'new';
};

const same = (a: string | null | undefined, b: string | null | undefined): boolean => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/** The settings of the connection as a target, or null when something is missing or not valid. */
export function parseTarget(connection: Record<string, string>): JiraTarget | null {
  const site = parseSite(connection.site ?? '');
  const email = (connection.email ?? '').trim();
  const project = parseProject(connection.project ?? '');
  if (!site || !isEmail(email) || !project) return null;
  let statusMap: Record<string, string> = {};
  try {
    const parsed = connection.statusMap ? (JSON.parse(connection.statusMap) as Record<string, unknown>) : {};
    statusMap = Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  } catch {
    statusMap = {};
  }
  return { site, email, project, filter: (connection.filter ?? '').trim(), board: (connection.board ?? '').trim(), statusMap };
}

/** The usual form of the settings, `{}` for none (the connection is removed), or null when they are not valid. */
function normalize(connection: Record<string, string>): Record<string, string> | null {
  const given = ['site', 'email', 'project'].some((key) => (connection[key] ?? '').trim() !== '');
  if (!given) return {};
  const target = parseTarget(connection);
  if (!target) return null;
  return { site: target.site, email: target.email, project: target.project, ...(target.filter ? { filter: target.filter } : {}), ...(target.board ? { board: target.board } : {}), ...(Object.keys(target.statusMap).length > 0 ? { statusMap: JSON.stringify(target.statusMap) } : {}) };
}

/** A name of a Jira status for a name in the board, by the map and then by the names. */
const jiraNameFor = (target: JiraTarget, column: string): string | null => Object.entries(target.statusMap).find(([, value]) => same(value, column))?.[0] ?? null;

export function createJiraConnector(transport: JiraTransport): TrackerConnector<JiraTarget> {
  let skipped = 0;

  /** The ids of the fields of the story points and of the sprint per site, found once with GET /field (they differ per site); null when there is none. */
  const fieldIds = new Map<string, { points: string | null; sprint: string | null }>();
  const fieldIdsOf = async (client: JiraClient, target: JiraTarget): Promise<{ points: string | null; sprint: string | null }> => {
    const known = fieldIds.get(target.site);
    if (known) return known;
    const all = (await client.call<Array<{ id: string; name: string; schema?: { custom?: string } }>>('GET', '/rest/api/3/field')) ?? [];
    const found = {
      points: all.find((entry) => POINTS_NAMES.includes(entry.name.trim().toLowerCase()))?.id ?? null,
      sprint: all.find((entry) => entry.schema?.custom === 'com.pyxis.greenhopper.jira:gh-sprint' || entry.name.trim().toLowerCase() === 'sprint')?.id ?? null
    };
    fieldIds.set(target.site, found);
    return found;
  };
  const pointsIdOf = async (client: JiraClient, target: JiraTarget): Promise<string | null> => (await fieldIdsOf(client, target)).points;
  /** Whether the project has a scrum board; the sprint is only compared then (set by the last `catalog`). */
  let hasBoard = false;

  const toItem = (target: JiraTarget, raw: RawIssue): ExternalItem => {
    const adf = isAdf(raw.fields.description) ? raw.fields.description : null;
    const read = readAdf(adf);
    const category = categoryOf(raw);
    const statusName = raw.fields.status?.name ?? '';
    const ids = fieldIds.get(target.site);
    const pointsValue = ids?.points ? raw.fields[ids.points as `customfield_${number}`] : null;
    const sprints = (ids?.sprint ? raw.fields[ids.sprint as `customfield_${number}`] : null) as Array<{ name: string; state?: string }> | null | undefined;
    const sprint = SPRINT_ORDER.map((state) => (sprints ?? []).find((entry) => entry.state === state)).find((entry) => entry !== undefined);
    const done = category === 'done';
    const fields: ExternalFields = {
      title: (raw.fields.summary ?? '').trim(),
      description: read.description,
      labels: [...(raw.fields.labels ?? [])],
      criteria: read.criteria,
      release: raw.fields.fixVersions?.[0]?.name ?? null,
      epic: isEpic(raw.fields.parent) ? (raw.fields.parent?.fields?.summary ?? null) : null,
      done,
      points: typeof pointsValue === 'number' ? pointsValue : 0,
      sprint: sprint?.name ?? null,
      assignee: raw.fields.assignee?.displayName ?? null,
      // The first column is no column for the engine: it drops a name that is not one of the named columns.
      status: done ? null : (target.statusMap[statusName] ?? statusName)
    };
    const jira: JiraRaw = { adf, lossy: read.lossy, statusName, category };
    return { id: raw.key, key: raw.key, url: `${target.site}/browse/${raw.key}`, state: done ? 'closed' : 'open', fields, raw: jira };
  };

  /** The fields to ask for: the compared ones and the story points. */
  const fieldsOf = async (client: JiraClient, target: JiraTarget): Promise<string[]> => {
    const ids = await fieldIdsOf(client, target);
    return [...FIELDS, ...(ids.points ? [ids.points] : []), ...(ids.sprint ? [ids.sprint] : [])];
  };

  const getIssue = async (client: JiraClient, target: JiraTarget, key: string): Promise<RawIssue | null> => {
    try {
      return await client.call<RawIssue>('GET', `/rest/api/3/issue/${encodeURIComponent(key)}?fields=${(await fieldsOf(client, target)).join(',')}`);
    } catch (cause) {
      if (cause instanceof SyncError && cause.kind === 'notFound') return null;
      throw cause;
    }
  };

  const labelsOf = (wanted: readonly string[]): { labels: string[]; skipped: string[] } => ({
    labels: wanted.filter((label) => !/\s/.test(label)),
    skipped: wanted.filter((label) => /\s/.test(label))
  });

  /**
   * The transition that leads to the state the story is in: done, a board column by its name (or the name of the status in the
   * map), or the first column, which is the status of that name when there is one and else the first status of the category "new".
   */
  const pickTransition = (target: JiraTarget, transitions: readonly Transition[], done: boolean, column: string | null, first: boolean): Transition | null => {
    const category = (transition: Transition): string => transition.to.statusCategory?.key ?? '';
    if (done) return transitions.find((transition) => category(transition) === 'done') ?? null;
    const byName = column ? (transitions.find((transition) => same(transition.to.name, jiraNameFor(target, column) ?? column)) ?? null) : null;
    if (byName || !first) return byName;
    return transitions.find((transition) => category(transition) === 'new') ?? null;
  };

  /** The key of the epic with that name; it is made when the project has none (Jira never deletes, so nothing is ever removed again). */
  const epicKeyOf = async (client: JiraClient, target: JiraTarget, name: string, context: WriteContext): Promise<string> => {
    const jira = extraOf(context.catalog);
    const found = jira.epics.find((epic) => same(epic.name, name));
    if (found) return found.key;
    const created = await client.call<{ key: string }>('POST', '/rest/api/3/issue', { fields: { project: { key: target.project }, summary: name, issuetype: { name: 'Epic' } } });
    if (!created) throw new SyncError('other');
    jira.epics.push({ key: created.key, name });
    return created.key;
  };

  /** The scrum boards of the project; none when the project has no scrum board or the call is refused. */
  const scrumBoards = async (client: JiraClient, target: JiraTarget): Promise<ServiceBoard[]> => {
    const answer = await client.call<{ values?: Array<{ id: number; name?: string }> }>('GET', `/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(target.project)}&type=scrum`).catch(() => null);
    return (answer?.values ?? []).map((board) => ({ id: String(board.id), name: board.name ?? `Board ${board.id}` }));
  };

  /** The account of the user with that name who may be assigned in the project, or null. */
  const accountOf = async (client: JiraClient, target: JiraTarget, name: string): Promise<string | null> => {
    const users = (await client.call<Array<{ accountId: string; displayName?: string }>>('GET', `/rest/api/3/user/assignable/search?project=${encodeURIComponent(target.project)}&query=${encodeURIComponent(name)}`)) ?? [];
    return users.find((user) => same(user.displayName, name))?.accountId ?? null;
  };

  /** Puts an issue into the sprint of that name (made on the board when there is none), or back into the backlog. Needs a scrum board; a sprint is never deleted. */
  const moveToSprint = async (client: JiraClient, key: string, name: string | null, context: WriteContext): Promise<void> => {
    const jira = extraOf(context.catalog);
    if (jira.boardId === null) return;
    if (name === null) {
      await client.call('POST', '/rest/agile/1.0/backlog/issue', { issues: [key] });
      return;
    }
    let sprint = jira.sprints.find((entry) => same(entry.name, name));
    if (!sprint) {
      const local = context.sprints?.find((entry) => same(entry.name, name));
      const made = await client.call<{ id: number }>('POST', '/rest/agile/1.0/sprint', {
        name,
        originBoardId: jira.boardId,
        ...(local ? { startDate: `${local.startDate}T00:00:00.000Z`, endDate: `${local.endDate}T00:00:00.000Z` } : {})
      });
      if (!made) throw new SyncError('other');
      sprint = { id: made.id, name };
      jira.sprints.push(sprint);
    }
    await client.call('POST', `/rest/agile/1.0/sprint/${sprint.id}/issue`, { issues: [key] });
  };

  /** Makes the version of a release (with its dates) when the project has none. */
  const ensureVersion = async (client: JiraClient, target: JiraTarget, title: string, context: WriteContext): Promise<void> => {
    const jira = extraOf(context.catalog);
    if (jira.versions.some((name) => same(name, title))) return;
    const release = context.releases.find((entry) => same(entry.title, title));
    await client.call('POST', '/rest/api/3/version', {
      name: title,
      project: target.project,
      ...(release?.description ? { description: release.description } : {}),
      ...(release?.startDate ? { startDate: release.startDate } : {}),
      ...(release?.endDate ? { releaseDate: release.endDate } : {})
    });
    jira.versions.push(title);
  };

  return {
    kind: 'jira',
    capabilities: {
      // The sprint is only compared when the project has a scrum board.
      get fields(): readonly FieldName[] {
        return ['title', 'description', 'labels', 'criteria', 'release', 'epic', 'done', 'status', 'points', ...(hasBoard ? (['sprint'] as const) : []), 'assignee'];
      },
      create: true,
      tidy: false,
      statusesFromService: true
    },
    target: parseTarget,
    normalize,
    skipped: () => skipped,
    async open(target, token) {
      const client = createClient(transport, target, token);
      // The project is checked first, so a wrong key says "not found" and not "nothing to import".
      await client.call('GET', `/rest/api/3/project/${encodeURIComponent(target.project)}`);
      const where = `project = "${target.project}" AND statusCategory != Done${target.filter ? ` AND (${target.filter})` : ''}`;
      // New stories come in the order of the rank in Jira; a project without a rank is read by its creation.
      let jql = `${where} ORDER BY Rank ASC`;
      const items: ExternalItem[] = [];
      skipped = 0;
      let next: string | undefined;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const search = (): Promise<{ issues?: RawIssue[]; nextPageToken?: string } | null> =>
          fieldsOf(client, target).then((fields) => client.call<{ issues?: RawIssue[]; nextPageToken?: string }>('POST', '/rest/api/3/search/jql', { jql, fields, maxResults: PAGE, ...(next ? { nextPageToken: next } : {}) }));
        let answer;
        try {
          answer = await search();
        } catch (cause) {
          if (page > 0 || !(cause instanceof SyncError) || cause.kind !== 'other') throw cause;
          jql = `${where} ORDER BY created ASC`;
          answer = await search();
        }
        for (const raw of answer?.issues ?? []) {
          const level = raw.fields.issuetype?.hierarchyLevel;
          // Epics and sub-tasks are not stories.
          if (raw.fields.issuetype?.subtask === true || (level !== undefined && level !== 0)) skipped += 1;
          else items.push(toItem(target, raw));
        }
        next = answer?.nextPageToken;
        if (!next) break;
      }
      return items;
    },
    async item(target, token, id) {
      const raw = await getIssue(createClient(transport, target, token), target, id);
      return raw ? toItem(target, raw) : null;
    },
    idOf(target, link: ExternalLink) {
      const prefix = `${target.site}/browse/`;
      return link.url.toLowerCase().startsWith(prefix.toLowerCase()) ? (link.url.slice(prefix.length).split(/[?#]/)[0] || null) : null;
    },
    async catalog(target, token): Promise<Catalog> {
      const client = createClient(transport, target, token);
      const versions = (await client.call<RawVersion[]>('GET', `/rest/api/3/project/${encodeURIComponent(target.project)}/versions`)) ?? [];
      const epics = await client.call<{ issues?: RawIssue[] }>('POST', '/rest/api/3/search/jql', { jql: `project = "${target.project}" AND issuetype = Epic ORDER BY created ASC`, fields: ['summary'], maxResults: PAGE });
      const releases: ExternalRelease[] = versions.map((version) => ({ id: version.id, title: version.name, description: version.description ?? '', dueOn: version.releaseDate ?? null, state: version.released ? 'closed' : 'open' }));
      const boards = await scrumBoards(client, target);
      // The chosen board, or the first one when none is chosen (or the chosen one is gone).
      const boardId = Number((boards.find((board) => board.id === target.board) ?? boards[0])?.id ?? NaN);
      const chosen = Number.isNaN(boardId) ? null : boardId;
      hasBoard = chosen !== null && (await fieldIdsOf(client, target)).sprint !== null;
      const raws =
        chosen === null
          ? []
          : ((await client.call<{ values?: RawSprint[] }>('GET', `/rest/agile/1.0/board/${chosen}/sprint?state=active,future&maxResults=50`).catch(() => null))?.values ?? []);
      const sprints: ExternalSprint[] = raws.map((sprint) => ({
        id: String(sprint.id),
        name: sprint.name,
        goal: sprint.goal ?? '',
        startDate: sprint.startDate ? sprint.startDate.slice(0, 10) : null,
        endDate: sprint.endDate ? sprint.endDate.slice(0, 10) : null,
        state: sprint.state === 'active' ? 'running' : sprint.state === 'closed' ? 'completed' : 'planned'
      }));
      const extra: JiraCatalog = {
        epics: (epics?.issues ?? []).map((issue) => ({ key: issue.key, name: (issue.fields.summary ?? '').trim() })),
        versions: versions.map((version) => version.name),
        boardId: chosen,
        sprints: raws.map((sprint) => ({ id: sprint.id, name: sprint.name }))
      };
      return { releases, sprints, extra };
    },
    // Epics and versions that Jira lacks are made when the sync may write; nothing is "missing" in the sense of a label.
    lacks: () => null,
    async update(target, token, item: ExternalItem, patch: ItemPatch, context): Promise<WriteResult> {
      const client = createClient(transport, target, token);
      const jira = item.raw as JiraRaw;
      const fields: Record<string, unknown> = {};
      let skippedLabels: string[] = [];
      if (patch.title !== undefined) fields.summary = patch.title;
      if (patch.labels !== undefined) {
        const only = labelsOf(patch.labels);
        fields.labels = only.labels;
        skippedLabels = only.skipped;
      }
      if (patch.points !== undefined) {
        const pointsId = await pointsIdOf(client, target);
        if (pointsId) fields[pointsId] = patch.points === 0 ? null : patch.points;
      }
      if (patch.epic !== undefined) fields.parent = patch.epic === null ? null : { key: await epicKeyOf(client, target, patch.epic, context) };
      if (patch.release !== undefined) {
        if (patch.release !== null) await ensureVersion(client, target, patch.release, context);
        fields.fixVersions = patch.release === null ? [] : [{ name: patch.release }];
      }
      if (patch.assignee !== undefined) {
        if (patch.assignee === null) fields.assignee = null;
        else {
          const accountId = await accountOf(client, target, patch.assignee);
          // Nobody in Jira has the name of the member: the assignee stays as it is there.
          if (accountId) fields.assignee = { accountId };
        }
      }
      if (patch.description !== undefined || patch.criteria !== undefined) {
        let doc: AdfDoc | null = null;
        if (patch.description !== undefined) {
          // A text with a table, an image or formatting is never rewritten from the plain text.
          if (!jira.lossy) doc = composeAdf(patch.description, patch.criteria ?? item.fields.criteria);
        } else {
          doc = withCriteriaAdf(jira.adf, patch.criteria ?? []);
        }
        if (doc) fields.description = doc.content.length === 0 ? null : doc;
      }
      if (patch.sprint !== undefined) await moveToSprint(client, item.id, patch.sprint, context);
      if (Object.keys(fields).length > 0) await client.call('PUT', `/rest/api/3/issue/${encodeURIComponent(item.id)}`, { fields });

      if (patch.done !== undefined || patch.status !== undefined) {
        const done = patch.done ?? item.fields.done;
        const column = (patch.status !== undefined ? patch.status : item.fields.status) ?? null;
        const answer = await client.call<{ transitions?: Transition[] }>('GET', `/rest/api/3/issue/${encodeURIComponent(item.id)}/transitions`);
        const transitions = answer?.transitions ?? [];
        // No column means the first one: the status with its name when the app knows it.
        const start = context.statuses.find((entry) => entry.id === startStatus(context.statuses));
        const wantedName = column ?? (start ? statusName(start) : null);
        const wanted = pickTransition(target, transitions, done, wantedName, column === null);
        const alreadyThere = wanted === null && (done ? jira.category === 'done' : wantedName ? same(jira.statusName, jiraNameFor(target, wantedName) ?? wantedName) || (column === null && jira.category === 'new') : jira.category === 'new');
        if (wanted === null && !alreadyThere) throw new SyncError('transition');
        if (wanted) {
          try {
            await client.call('POST', `/rest/api/3/issue/${encodeURIComponent(item.id)}/transitions`, { transition: { id: wanted.id } });
          } catch (cause) {
            // A transition that needs more (a resolution, a field) is answered with a 400.
            if (cause instanceof SyncError && cause.kind === 'other') throw new SyncError('transition');
            throw cause;
          }
        }
      }
      const raw = await getIssue(client, target, item.id);
      if (!raw) throw new SyncError('notFound');
      return { item: toItem(target, raw), skippedLabels };
    },
    async create(target, token, item: NewItem, context): Promise<WriteResult> {
      const client = createClient(transport, target, token);
      const only = labelsOf(item.labels);
      const doc = composeAdf(item.description, item.criteria);
      const parent = item.epic ? await epicKeyOf(client, target, item.epic, context) : null;
      const make = (type: string) =>
        client.call<{ key: string }>('POST', '/rest/api/3/issue', { fields: { project: { key: target.project }, summary: item.title, issuetype: { name: type }, labels: only.labels, ...(parent ? { parent: { key: parent } } : {}), ...(doc.content.length > 0 ? { description: doc } : {}) } });
      let created: { key: string } | null;
      try {
        created = await make('Story');
      } catch (cause) {
        // A project without the type "Story" (a simple one) has "Task".
        if (cause instanceof SyncError && cause.kind === 'other') created = await make('Task');
        else throw cause;
      }
      const raw = created ? await getIssue(client, target, created.key) : null;
      if (!raw) throw new SyncError('other');
      return { item: toItem(target, raw), skippedLabels: only.skipped };
    },
    async tidy(_target, _token, _needs, managed): Promise<TidyResult> {
      return { managed, gone: { labels: [], milestones: [] } };
    },
    async boards(target, token) {
      return scrumBoards(createClient(transport, target, token), target);
    },
    async statuses(target, token) {
      const client = createClient(transport, target, token);
      const answer = await client.call<Array<{ statuses?: Array<{ name: string; statusCategory?: { key?: string } }> }>>('GET', `/rest/api/3/project/${encodeURIComponent(target.project)}/statuses`);
      const found = new Map<string, WorkflowStatus>();
      for (const type of answer ?? []) {
        for (const status of type.statuses ?? []) {
          const key = status.statusCategory?.key;
          if (!found.has(status.name)) found.set(status.name, { name: status.name, category: key === 'done' ? 'done' : key === 'indeterminate' ? 'indeterminate' : 'new' });
        }
      }
      return [...found.values()];
    }
  };
}
