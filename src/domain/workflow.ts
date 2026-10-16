import { STATUS_CATEGORIES, categoryOf, startStatus, statusesIn } from './statuses';
import { WORKFLOW_END } from './types';
import type { StatusCategory, StatusValue, StoryWorkflow, Workflow, WorkflowVersion } from './types';

export { WORKFLOW_END };

/** Everything allowed, the start in the first "not started" status, the category switches on. */
export const DEFAULT_STORY_WORKFLOW: StoryWorkflow = {
  start: null,
  blocked: {},
  free: { not_started: true, in_progress: true, done: true }
};

/** Off by default (#49): while it is off nothing is restricted. */
export const DEFAULT_WORKFLOW: Workflow = { enabled: false, versions: [], story: DEFAULT_STORY_WORKFLOW };

const isOn = (value: unknown): boolean => value === true || value === 'true' || value === 1 || value === '1';
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const texts = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

function normalizeStory(stored: unknown): StoryWorkflow {
  const story = isRecord(stored) ? stored : {};
  const blocked: Record<string, string[]> = {};
  if (isRecord(story.blocked)) {
    for (const [from, targets] of Object.entries(story.blocked)) {
      const list = [...new Set(texts(targets))].filter((target) => target !== from);
      if (list.length > 0) blocked[from] = list;
    }
  }
  const free = { ...DEFAULT_STORY_WORKFLOW.free };
  if (isRecord(story.free)) for (const category of STATUS_CATEGORIES) if (story.free[category] === false || story.free[category] === 'false') free[category] = false;
  const start = Array.isArray(story.start) ? [...new Set(texts(story.start))] : null;
  return { start: start && start.length > 0 ? start : null, blocked, free };
}

function normalizeVersions(stored: unknown): WorkflowVersion[] {
  if (!Array.isArray(stored)) return [];
  const versions: WorkflowVersion[] = [];
  for (const item of stored) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.at !== 'string') continue;
    const version: WorkflowVersion = { id: item.id, at: item.at, story: normalizeStory(item.story) };
    if (typeof item.name === 'string' && item.name.trim() !== '') version.name = item.name.trim();
    versions.push(version);
  }
  return versions;
}

/** The workflow from stored data; missing or unknown parts get their defaults. */
export function normalizeWorkflow(stored: unknown): Workflow {
  const raw = isRecord(stored) ? stored : {};
  return { enabled: isOn(raw.enabled), versions: normalizeVersions(raw.versions), story: normalizeStory(raw.story) };
}

/**
 * The status values where a new story may start: the chosen ones that are still in "not started", else the first
 * status value of "not started". With the workflow off only the first one counts, as before.
 */
export function startStatuses(workflow: Workflow, statuses: readonly StatusValue[]): string[] {
  const first = startStatus(statuses);
  if (!workflow.enabled) return [first];
  const chosen = workflow.story.start?.filter((id) => categoryOf(statuses, id) === 'not_started') ?? [];
  const valid = statuses.filter((status) => chosen.includes(status.id)).map((status) => status.id);
  return valid.length > 0 ? valid : [first];
}

/** The status a new story gets: the first allowed start in board order. */
export function newStoryStatus(workflow: Workflow, statuses: readonly StatusValue[]): string {
  return startStatuses(workflow, statuses)[0];
}

/** Whether a new story may start in this status. With the workflow off, as before, only the first of "not started" and the status of a board column. */
export function canStartIn(workflow: Workflow, statuses: readonly StatusValue[], id: string): boolean {
  return startStatuses(workflow, statuses).includes(id);
}

/** Whether a story may go from one status to another (or to the end, `WORKFLOW_END`). Staying where it is is always allowed. */
export function canMove(workflow: Workflow, from: string, to: string): boolean {
  if (!workflow.enabled || from === to) return true;
  return !workflow.story.blocked[from]?.includes(to);
}

/** Whether a story in this status may be deleted. */
export function canDelete(workflow: Workflow, from: string): boolean {
  return canMove(workflow, from, WORKFLOW_END);
}

/** The status values a story may move to from `from`, in board order, without `from` itself. */
export function allowedTargets(workflow: Workflow, statuses: readonly StatusValue[], from: string): StatusValue[] {
  return statuses.filter((status) => status.id !== from && canMove(workflow, from, status.id));
}

/** Whether any status value leads to the end. When none does, no story can ever be deleted. */
export function leadsToEnd(workflow: Workflow, statuses: readonly StatusValue[]): boolean {
  return statuses.some((status) => canDelete(workflow, status.id));
}

// ----- editing -----

function withStory(workflow: Workflow, story: StoryWorkflow): Workflow {
  return { ...workflow, story };
}

export function setEnabled(workflow: Workflow, enabled: boolean): Workflow {
  return workflow.enabled === enabled ? workflow : { ...workflow, enabled };
}

/** Allows or forbids one transition; `to` may be `WORKFLOW_END`. */
export function setTransition(workflow: Workflow, from: string, to: string, allowed: boolean): Workflow {
  if (from === to || canMove({ ...workflow, enabled: true }, from, to) === allowed) return workflow;
  const current = workflow.story.blocked[from] ?? [];
  const next = allowed ? current.filter((target) => target !== to) : [...current, to];
  const blocked = { ...workflow.story.blocked };
  if (next.length > 0) blocked[from] = next;
  else delete blocked[from];
  return withStory(workflow, { ...workflow.story, blocked });
}

/** Whether the start may be switched off for this status: at least one start status stays on. */
export function canSwitchOffStart(workflow: Workflow, statuses: readonly StatusValue[], id: string): boolean {
  const starts = startStatuses({ ...workflow, enabled: true }, statuses);
  return !(starts.length === 1 && starts[0] === id);
}

/** Allows or forbids a status as the start of a new story. Refused (unchanged) for the last start and for a status outside "not started". */
export function setStart(workflow: Workflow, statuses: readonly StatusValue[], id: string, allowed: boolean): Workflow {
  if (categoryOf(statuses, id) !== 'not_started') return workflow;
  const starts = startStatuses({ ...workflow, enabled: true }, statuses);
  if (starts.includes(id) === allowed) return workflow;
  if (!allowed && !canSwitchOffStart(workflow, statuses, id)) return workflow;
  const next = statuses.filter((status) => (status.id === id ? allowed : starts.includes(status.id))).map((status) => status.id);
  return withStory(workflow, { ...workflow.story, start: next });
}

/** Whether a category has two or more status values, so the switch "free transitions within the category" has an effect. */
export function canBeFree(statuses: readonly StatusValue[], category: StatusCategory): boolean {
  return statusesIn(statuses, category).length > 1;
}

/** Turns the switch of a category on (all transitions inside the category become allowed) or off (nothing else changes). */
export function setFree(workflow: Workflow, statuses: readonly StatusValue[], category: StatusCategory, on: boolean): Workflow {
  if (!on) return workflow.story.free[category] ? withStory(workflow, { ...workflow.story, free: { ...workflow.story.free, [category]: false } }) : workflow;
  const inside = new Set(statusesIn(statuses, category).map((status) => status.id));
  const blocked: Record<string, string[]> = {};
  for (const [from, targets] of Object.entries(workflow.story.blocked)) {
    const kept = inside.has(from) ? targets.filter((target) => !inside.has(target)) : targets;
    if (kept.length > 0) blocked[from] = kept;
  }
  return withStory(workflow, { ...workflow.story, blocked, free: { ...workflow.story.free, [category]: true } });
}

/** Whether the switch of a category is on but a transition inside the category is forbidden ("with exceptions"). */
export function hasExceptions(workflow: Workflow, statuses: readonly StatusValue[], category: StatusCategory): boolean {
  if (!workflow.story.free[category]) return false;
  const inside = statusesIn(statuses, category).map((status) => status.id);
  return inside.some((from) => inside.some((to) => from !== to && !canMove({ ...workflow, enabled: true }, from, to)));
}

/** Drops what refers to status values that are gone, and starts outside "not started". Returns the same object when nothing changes. */
export function pruneWorkflow(workflow: Workflow, statuses: readonly StatusValue[]): Workflow {
  const known = new Set<string>([...statuses.map((status) => status.id), WORKFLOW_END]);
  const blocked: Record<string, string[]> = {};
  let changed = false;
  for (const [from, targets] of Object.entries(workflow.story.blocked)) {
    if (!known.has(from)) {
      changed = true;
      continue;
    }
    const kept = targets.filter((target) => known.has(target));
    if (kept.length !== targets.length) changed = true;
    if (kept.length > 0) blocked[from] = kept;
  }
  let start = workflow.story.start;
  if (start) {
    const kept = start.filter((id) => categoryOf(statuses, id) === 'not_started');
    if (kept.length !== start.length) {
      changed = true;
      start = kept.length > 0 ? kept : null;
    }
  }
  return changed ? withStory(workflow, { ...workflow.story, blocked, start }) : workflow;
}

// ----- versions (AC12) -----

const sameStory = (a: StoryWorkflow, b: StoryWorkflow): boolean => JSON.stringify(a) === JSON.stringify(b);

/** The versions of the workflow, newest first. */
export function versionsNewestFirst(workflow: Workflow): WorkflowVersion[] {
  return [...workflow.versions].reverse();
}

/** The id of the current version: the last one, as long as it equals the current state. */
export function currentVersionId(workflow: Workflow): string | null {
  const last = workflow.versions[workflow.versions.length - 1];
  return last && sameStory(last.story, workflow.story) ? last.id : null;
}

/**
 * Records a change: when the story workflow differs from `previous`, a version of the new state is added. The first
 * change also keeps the state before it as the first version, so the user can go back to it. Switching the workflow on
 * or off is no change of the workflow and creates no version.
 */
export function recordVersion(previous: Workflow, next: Workflow, at: string, newId: () => string): Workflow {
  if (sameStory(previous.story, next.story)) return next;
  const versions = previous.versions.length > 0 ? [...previous.versions] : [{ id: newId(), at, story: previous.story }];
  versions.push({ id: newId(), at, story: next.story });
  return { ...next, versions };
}

/** Gives a version a name; an empty name removes it. Creates no version. */
export function nameVersion(workflow: Workflow, id: string, name: string): Workflow {
  const trimmed = name.trim();
  const rename = (version: WorkflowVersion): WorkflowVersion => ({ id: version.id, at: version.at, ...(trimmed === '' ? {} : { name: trimmed }), story: version.story });
  return { ...workflow, versions: workflow.versions.map((version) => (version.id === id ? rename(version) : version)) };
}

/** Goes back to a version: its state becomes the current one as a new version. Nothing is deleted. */
export function restoreVersion(workflow: Workflow, id: string, at: string, newId: () => string): Workflow {
  const version = workflow.versions.find((item) => item.id === id);
  if (!version) return workflow;
  return recordVersion(workflow, { ...workflow, story: version.story }, at, newId);
}
