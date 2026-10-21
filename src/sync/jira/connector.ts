import type { Catalog, ExternalItem, ItemPatch, NewItem } from '../../domain/sync';
import type { ExternalFields, ExternalLink } from '../../domain/types';
import { SyncError, type TidyResult, type TrackerConnector, type WorkflowStatus, type WriteResult } from '../connector';
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
  };
}

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

const FIELDS = ['summary', 'description', 'labels', 'status', 'issuetype'];
const PAGE = 100;
const MAX_PAGES = 30;

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
  return { site, email, project, filter: (connection.filter ?? '').trim(), statusMap };
}

/** The usual form of the settings, `{}` for none (the connection is removed), or null when they are not valid. */
function normalize(connection: Record<string, string>): Record<string, string> | null {
  const given = ['site', 'email', 'project'].some((key) => (connection[key] ?? '').trim() !== '');
  if (!given) return {};
  const target = parseTarget(connection);
  if (!target) return null;
  return { site: target.site, email: target.email, project: target.project, ...(target.filter ? { filter: target.filter } : {}), ...(Object.keys(target.statusMap).length > 0 ? { statusMap: JSON.stringify(target.statusMap) } : {}) };
}

/** A name of a Jira status for a name in the board, by the map and then by the names. */
const jiraNameFor = (target: JiraTarget, column: string): string | null => Object.entries(target.statusMap).find(([, value]) => same(value, column))?.[0] ?? null;

export function createJiraConnector(transport: JiraTransport): TrackerConnector<JiraTarget> {
  let skipped = 0;

  const toItem = (target: JiraTarget, raw: RawIssue): ExternalItem => {
    const adf = isAdf(raw.fields.description) ? raw.fields.description : null;
    const read = readAdf(adf);
    const category = categoryOf(raw);
    const statusName = raw.fields.status?.name ?? '';
    const done = category === 'done';
    const fields: ExternalFields = {
      title: (raw.fields.summary ?? '').trim(),
      description: read.description,
      labels: [...(raw.fields.labels ?? [])],
      criteria: read.criteria,
      release: null,
      epic: null,
      done,
      status: !done && category === 'indeterminate' ? (target.statusMap[statusName] ?? statusName) : null
    };
    const jira: JiraRaw = { adf, lossy: read.lossy, statusName, category };
    return { id: raw.key, key: raw.key, url: `${target.site}/browse/${raw.key}`, state: done ? 'closed' : 'open', fields, raw: jira };
  };

  const getIssue = async (client: JiraClient, key: string): Promise<RawIssue | null> => {
    try {
      return await client.call<RawIssue>('GET', `/rest/api/3/issue/${encodeURIComponent(key)}?fields=${FIELDS.join(',')}`);
    } catch (cause) {
      if (cause instanceof SyncError && cause.kind === 'notFound') return null;
      throw cause;
    }
  };

  const labelsOf = (wanted: readonly string[]): { labels: string[]; skipped: string[] } => ({
    labels: wanted.filter((label) => !/\s/.test(label)),
    skipped: wanted.filter((label) => /\s/.test(label))
  });

  /** The transition that leads to the state the story is in: done, a board column, or the first column. */
  const pickTransition = (target: JiraTarget, transitions: readonly Transition[], done: boolean, column: string | null): Transition | null => {
    const category = (transition: Transition): string => transition.to.statusCategory?.key ?? '';
    if (done) return transitions.find((transition) => category(transition) === 'done') ?? null;
    if (column) {
      const wanted = jiraNameFor(target, column);
      return transitions.find((transition) => same(transition.to.name, wanted ?? column)) ?? transitions.find((transition) => category(transition) === 'indeterminate' && same(transition.to.name, column)) ?? null;
    }
    return transitions.find((transition) => category(transition) === 'new') ?? null;
  };

  return {
    kind: 'jira',
    capabilities: { fields: ['title', 'description', 'labels', 'criteria', 'done', 'status'], create: true, tidy: false },
    target: parseTarget,
    normalize,
    skipped: () => skipped,
    async open(target, token) {
      const client = createClient(transport, target, token);
      // The project is checked first, so a wrong key says "not found" and not "nothing to import".
      await client.call('GET', `/rest/api/3/project/${encodeURIComponent(target.project)}`);
      const jql = `project = "${target.project}" AND statusCategory != Done${target.filter ? ` AND (${target.filter})` : ''} ORDER BY created ASC`;
      const items: ExternalItem[] = [];
      skipped = 0;
      let next: string | undefined;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const answer = await client.call<{ issues?: RawIssue[]; nextPageToken?: string }>('POST', '/rest/api/3/search/jql', { jql, fields: FIELDS, maxResults: PAGE, ...(next ? { nextPageToken: next } : {}) });
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
      const raw = await getIssue(createClient(transport, target, token), id);
      return raw ? toItem(target, raw) : null;
    },
    idOf(target, link: ExternalLink) {
      const prefix = `${target.site}/browse/`;
      return link.url.toLowerCase().startsWith(prefix.toLowerCase()) ? (link.url.slice(prefix.length).split(/[?#]/)[0] || null) : null;
    },
    async catalog(): Promise<Catalog> {
      return { releases: [] };
    },
    lacks: () => null,
    async update(target, token, item: ExternalItem, patch: ItemPatch, context): Promise<WriteResult> {
      void context;
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
      if (Object.keys(fields).length > 0) await client.call('PUT', `/rest/api/3/issue/${encodeURIComponent(item.id)}`, { fields });

      if (patch.done !== undefined || patch.status !== undefined) {
        const done = patch.done ?? item.fields.done;
        const column = (patch.status !== undefined ? patch.status : item.fields.status) ?? null;
        const answer = await client.call<{ transitions?: Transition[] }>('GET', `/rest/api/3/issue/${encodeURIComponent(item.id)}/transitions`);
        const transitions = answer?.transitions ?? [];
        const wanted = pickTransition(target, transitions, done, column);
        const alreadyThere = wanted === null && (done ? jira.category === 'done' : column ? same(jira.statusName, jiraNameFor(target, column) ?? column) : jira.category === 'new');
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
      const raw = await getIssue(client, item.id);
      if (!raw) throw new SyncError('notFound');
      return { item: toItem(target, raw), skippedLabels };
    },
    async create(target, token, item: NewItem): Promise<WriteResult> {
      const client = createClient(transport, target, token);
      const only = labelsOf(item.labels);
      const doc = composeAdf(item.description, item.criteria);
      const make = (type: string) =>
        client.call<{ key: string }>('POST', '/rest/api/3/issue', { fields: { project: { key: target.project }, summary: item.title, issuetype: { name: type }, labels: only.labels, ...(doc.content.length > 0 ? { description: doc } : {}) } });
      let created: { key: string } | null;
      try {
        created = await make('Story');
      } catch (cause) {
        // A project without the type "Story" (a simple one) has "Task".
        if (cause instanceof SyncError && cause.kind === 'other') created = await make('Task');
        else throw cause;
      }
      const raw = created ? await getIssue(client, created.key) : null;
      if (!raw) throw new SyncError('other');
      return { item: toItem(target, raw), skippedLabels: only.skipped };
    },
    async tidy(_target, _token, _needs, managed): Promise<TidyResult> {
      return { managed, gone: { labels: [], milestones: [] } };
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
