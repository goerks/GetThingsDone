import type { ExternalItem, ItemPatch, NewItem } from '../../domain/sync';
import type { ExternalFields } from '../../domain/types';

/*
 * What is specific to GitHub (#30, ADR 0005, ADR 0006): the text of an issue (Markdown, the task list under the heading
 * "Acceptance criteria"), the labels with the conventions "epic: <name>" and "status: <name>", milestones for releases,
 * and the repository. The sync engine in `src/domain/sync.ts` knows none of this: `toItem` translates an issue into the
 * compared fields and `toPatch` translates what the engine publishes into what GitHub needs. The calls are in `api.ts`.
 */

/** An issue as the sync needs it. Pull requests never get here. */
export interface GithubIssue {
  number: number;
  title: string;
  /** The text of the issue, Markdown, empty when there is none. */
  body: string;
  state: 'open' | 'closed';
  /** Names of the labels. */
  labels: string[];
  /** The address of the issue on github.com, `https://github.com/<owner>/<name>/issues/<number>`. */
  url: string;
  /** The title of the milestone of the issue, or null/missing when it has none. */
  milestone?: string | null;
}

/** A milestone of the repository: the counterpart of a release (#30). */
export interface ExternalMilestone {
  number: number;
  title: string;
  description: string;
  /** The due date as `YYYY-MM-DD`, or null. */
  dueOn: string | null;
  state: 'open' | 'closed';
}

export interface RepoRef {
  owner: string;
  name: string;
}

const REPO_PART = /^[A-Za-z0-9_.-]+$/;

/** `owner/name` from the text of the settings (a github.com address is accepted too). Null when it is not a repository. */
export function parseRepo(text: string): RepoRef | null {
  const trimmed = text
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '');
  const parts = trimmed.split('/');
  if (parts.length !== 2 || !parts.every((part) => REPO_PART.test(part) && part !== '.' && part !== '..')) return null;
  return { owner: parts[0], name: parts[1] };
}

export const repoText = (repo: RepoRef): string => `${repo.owner}/${repo.name}`;

/** The number of the issue an address names, or null. */
export function issueNumberOf(url: string): number | null {
  const match = /\/issues\/(\d+)$/.exec(url);
  return match ? Number(match[1]) : null;
}

/** The address of an issue; the same text GitHub gives as `html_url`, so it identifies an issue across syncs. */
export const issueUrl = (repo: RepoRef, number: number): string => `https://github.com/${repo.owner}/${repo.name}/issues/${number}`;

/** Whether an address belongs to the repository. */
export const inRepo = (url: string, repo: RepoRef): boolean => url.toLowerCase().startsWith(`https://github.com/${repoText(repo)}/issues/`.toLowerCase());

/* ---------- Epics and statuses as labels ---------- */

const EPIC_LABEL = /^epic:\s*(.+?)\s*$/i;
const STATUS_LABEL = /^status:\s*(.+?)\s*$/i;

/** The epic a label names (`epic: Boards` is the epic "Boards"), or null when it is no epic label. */
export const epicOfLabel = (label: string): string | null => EPIC_LABEL.exec(label)?.[1] ?? null;

/** The status a label names (`status: in progress`), or null when it is no status label. */
export const statusOfLabel = (label: string): string | null => STATUS_LABEL.exec(label)?.[1] ?? null;

export const epicLabelText = (name: string): string => `epic: ${name}`;
export const statusLabelText = (name: string): string => `status: ${name}`;

/** The labels an issue has on GitHub for these fields: the plain labels, the epic and the status. */
export const labelsOf = (plain: readonly string[], epic: string | null | undefined, status: string | null | undefined): string[] => [
  ...plain,
  ...(epic ? [epicLabelText(epic)] : []),
  ...(status ? [statusLabelText(status)] : [])
];

/* ---------- Issue and item ---------- */

/**
 * The compared fields of an issue. The labels "epic: …" and "status: …" are not labels of the story: the first of each
 * is its epic and its status (a closed issue is done, so its status label does not count).
 */
export function toItem(issue: GithubIssue): ExternalItem {
  const { description, criteria } = splitBody(issue.body);
  const done = issue.state === 'closed';
  const plain = issue.labels.filter((label) => epicOfLabel(label) === null && statusOfLabel(label) === null);
  const epicLabels = issue.labels.filter((label) => epicOfLabel(label) !== null);
  const fields: ExternalFields = {
    title: issue.title.trim(),
    description,
    labels: plain,
    criteria,
    release: issue.milestone ?? null,
    epic: issue.labels.map(epicOfLabel).find((name) => name !== null) ?? null,
    done,
    status: done ? null : (issue.labels.map(statusOfLabel).find((name) => name !== null) ?? null)
  };
  return { id: String(issue.number), key: `#${issue.number}`, url: issue.url, state: issue.state, fields, ...(epicLabels.length > 1 ? { warnings: ['multipleEpics' as const] } : {}), raw: issue };
}

/** What to change on one issue on GitHub. */
export interface GithubPatch {
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  labels?: string[];
  /** The number of the milestone, or null for none. */
  milestone?: number | null;
}

/**
 * What GitHub needs for a change in the terms of the app. What is not published stays as the issue has it: the labels of
 * the issue are the plain labels, the epic and the status together. `milestone` is the number of the milestone of the
 * published release (the connector makes it first when there is none).
 */
export function toPatch(item: ExternalItem, patch: ItemPatch, milestone?: number | null): GithubPatch {
  const issue = item.raw as GithubIssue;
  const remote = item.fields;
  const out: GithubPatch = {};
  if (patch.title !== undefined) out.title = patch.title;
  if (patch.labels !== undefined || patch.epic !== undefined || patch.status !== undefined) {
    out.labels = labelsOf(patch.labels ?? remote.labels, patch.epic !== undefined ? patch.epic : remote.epic, patch.status !== undefined ? patch.status : remote.status);
  }
  if (patch.done !== undefined) out.state = patch.done ? 'closed' : 'open';
  if (patch.release !== undefined) out.milestone = milestone ?? null;
  if (patch.description !== undefined) out.body = composeBody(patch.description, patch.criteria ?? remote.criteria);
  else if (patch.criteria !== undefined) out.body = withCriteria(issue.body, patch.criteria);
  return out;
}

/** The text of a new issue, and its labels. */
export function toNewIssue(item: NewItem): { title: string; body: string; labels: string[] } {
  return { title: item.title, body: composeBody(item.description, item.criteria), labels: labelsOf(item.labels, item.epic, item.status) };
}

/* ---------- The text of an issue ---------- */

export interface ParsedCriterion {
  text: string;
  done: boolean;
}

const HEADING = /^ {0,3}#{1,6}\s+(.*?)\s*#*\s*$/;
const CRITERIA_HEADING = /^(acceptance criteria|akzeptanzkriterien|abnahmekriterien)\s*:?$/i;
const TASK = /^\s*[-*+]\s+\[([ xX])\]\s+(.*\S)\s*$/;

/**
 * Splits the text of an issue. The task list under the heading "Acceptance criteria" (or "Akzeptanzkriterien",
 * "Abnahmekriterien") becomes the criteria; the rest is the description, without that heading and those tasks. Without
 * such a heading, or without tasks under it, there are no criteria and the whole text is the description.
 */
export function splitBody(body: string): { description: string; criteria: ParsedCriterion[] } {
  const text = body.replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const start = lines.findIndex((line) => {
    const heading = HEADING.exec(line);
    return heading !== null && CRITERIA_HEADING.test(heading[1]);
  });
  if (start < 0) return { description: text.trim(), criteria: [] };
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (HEADING.test(lines[index])) {
      end = index;
      break;
    }
  }
  const criteria: ParsedCriterion[] = [];
  const kept: string[] = lines.slice(0, start);
  for (const line of lines.slice(start + 1, end)) {
    const task = TASK.exec(line);
    if (task) criteria.push({ text: task[2].trim(), done: task[1] !== ' ' });
    else kept.push(line);
  }
  if (criteria.length === 0) return { description: text.trim(), criteria: [] };
  kept.push(...lines.slice(end));
  return { description: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(), criteria };
}

/* ---------- The text of an issue from description and criteria ---------- */

const CRITERIA_TITLE = 'Acceptance criteria';
const taskLines = (criteria: ReadonlyArray<{ text: string; done: boolean }>): string[] => criteria.map((item) => `- [${item.done ? 'x' : ' '}] ${item.text}`);

/** The text of an issue made from a description and criteria: the description, then the task list under its heading. */
export function composeBody(description: string, criteria: ReadonlyArray<{ text: string; done: boolean }>): string {
  const parts: string[] = [];
  if (description.trim() !== '') parts.push(description.trim());
  if (criteria.length > 0) parts.push(`## ${CRITERIA_TITLE}\n${taskLines(criteria).join('\n')}`);
  return parts.join('\n\n');
}

/** The text with other criteria: the tasks under the heading are replaced and everything else stays; without a heading the section is added. */
export function withCriteria(body: string, criteria: ReadonlyArray<{ text: string; done: boolean }>): string {
  const text = body.replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const start = lines.findIndex((line) => {
    const heading = HEADING.exec(line);
    return heading !== null && CRITERIA_HEADING.test(heading[1]);
  });
  if (start < 0) return composeBody(text, criteria);
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (HEADING.test(lines[index])) {
      end = index;
      break;
    }
  }
  const section = lines.slice(start + 1, end);
  const firstTask = section.findIndex((line) => TASK.test(line));
  const others = section.filter((line) => !TASK.test(line));
  const insertAt = firstTask < 0 ? others.length : firstTask;
  const merged = [...others.slice(0, insertAt), ...taskLines(criteria), ...others.slice(insertAt)];
  const kept = merged.some((line) => line.trim() !== '') ? [lines[start], ...merged] : [];
  return [...lines.slice(0, start), ...kept, ...lines.slice(end)].join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

