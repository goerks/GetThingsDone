import { addDays } from './sprints';
import type { ExternalSprint } from './sync';
import type { ConflictRule, ServiceKind, Sprint, SprintFields } from './types';

/*
 * The sprints in both directions (#66, phase 5, AC15): a sprint here is connected to a sprint of the service by its id there.
 * Name, dates, goal and state are compared field by field with what they were at the last sync (the base): what only the
 * service changed is taken, what only we changed is published (when writing is on), what both changed follows the conflict
 * rule. The state is special: starting and completing a sprint here has rules (the scope at the start, the result), so a
 * sprint that the service started or completed is handed back as an action for the app to carry out, and a sprint that was
 * started or completed here is published as a new state. Nothing here deletes a sprint.
 */

export type SprintPatch = Partial<SprintFields>;

export interface SprintCreate {
  sprintId: string;
  fields: SprintFields;
}

export interface SprintUpdate {
  sprintId: string;
  /** The id of the sprint in the service. */
  id: string;
  patch: SprintPatch;
}

/** What the app has to do with a sprint because the service started or completed it. */
export interface SprintAction {
  sprintId: string;
  action: 'start' | 'complete';
}

export interface SprintPlan {
  sprints: Sprint[];
  /** Sprints that exist only here: to be made in the service (when writing is on). */
  creates: SprintCreate[];
  updates: SprintUpdate[];
  actions: SprintAction[];
  /** Names of the sprints that were made here from sprints of the service. */
  created: string[];
  /** Names of sprints the service runs while another one runs here: they stay planned here. */
  concurrent: string[];
}

export interface SprintPlanInput {
  service: ServiceKind;
  sprints: readonly Sprint[];
  /** The sprints of the service: the open ones, and the ones the sprints here point to. */
  external: readonly ExternalSprint[];
  write: boolean;
  rule: ConflictRule;
  newId: () => string;
  today: string;
}

const NAMES = ['name', 'startDate', 'endDate', 'goal', 'state'] as const;

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

export const sprintFieldsOf = (sprint: Sprint): SprintFields => ({ name: sprint.name, startDate: sprint.startDate, endDate: sprint.endDate, goal: sprint.goal ?? '', state: sprint.state });

const remoteFieldsOf = (external: ExternalSprint, today: string): SprintFields => {
  const startDate = external.startDate ?? today;
  return { name: external.name, startDate, endDate: external.endDate ?? addDays(startDate, 13), goal: external.goal, state: external.state };
};

/** The fields of a sprint of the service, with the dates the sprint here has when the service has none. */
export const externalFieldsOf = (external: ExternalSprint, local: SprintFields | null, today: string): SprintFields => {
  const fields = remoteFieldsOf(external, local?.startDate ?? today);
  return { ...fields, startDate: external.startDate ?? local?.startDate ?? fields.startDate, endDate: external.endDate ?? local?.endDate ?? fields.endDate };
};

export function planSprints(input: SprintPlanInput): SprintPlan {
  const { service, write, rule, today } = input;
  const sprints = [...input.sprints];
  const claimed = new Set<string>();
  const creates: SprintCreate[] = [];
  const updates: SprintUpdate[] = [];
  const actions: SprintAction[] = [];
  const created: string[] = [];
  const concurrent: string[] = [];
  /** Whether a sprint runs here, counting the ones that start by an action of this run. */
  const running = (exceptId?: string): boolean => sprints.some((sprint) => sprint.id !== exceptId && sprint.state === 'running') || actions.some((entry) => entry.action === 'start' && entry.sprintId !== exceptId);

  for (const external of input.external) {
    let index = sprints.findIndex((sprint) => sprint.link?.service === service && sprint.link.id === external.id);
    if (index < 0) index = sprints.findIndex((sprint) => !sprint.link && !claimed.has(sprint.id) && same(sprint.name, external.name));

    if (index < 0) {
      // A sprint of the service that we do not have: it is made as a planned sprint (a completed one is history and stays out).
      if (external.state === 'completed') continue;
      const fields = externalFieldsOf(external, null, today);
      const id = input.newId();
      const starts = external.state === 'running' && !running();
      if (external.state === 'running' && !starts) concurrent.push(external.name);
      const sprint: Sprint = {
        id,
        name: fields.name,
        startDate: fields.startDate,
        endDate: fields.endDate,
        state: 'planned',
        startItems: null,
        result: null,
        ...(fields.goal ? { goal: fields.goal } : {}),
        link: { service, id: external.id, base: { ...fields, state: starts ? 'running' : 'planned' } }
      };
      sprints.push(sprint);
      claimed.add(id);
      created.push(sprint.name);
      if (starts) actions.push({ sprintId: id, action: 'start' });
      continue;
    }

    const local = sprints[index];
    claimed.add(local.id);
    const lf = sprintFieldsOf(local);
    const rf = externalFieldsOf(external, lf, today);
    // A sprint that is connected for the first time takes the service as it is: what differs is the service's change.
    const base: SprintFields = local.link?.base ?? lf;
    const nextBase: SprintFields = { ...base };
    const next: Sprint = { ...local };
    const patch: SprintPatch = {};

    const pull = (name: (typeof NAMES)[number]): void => {
      if (name === 'state') {
        if (rf.state === 'running' && lf.state === 'planned') {
          if (running(local.id)) return void concurrent.push(external.name);
          actions.push({ sprintId: local.id, action: 'start' });
        } else if (rf.state === 'completed' && lf.state === 'planned') {
          if (running(local.id)) return void concurrent.push(external.name);
          actions.push({ sprintId: local.id, action: 'start' }, { sprintId: local.id, action: 'complete' });
        } else if (rf.state === 'completed' && lf.state === 'running') {
          actions.push({ sprintId: local.id, action: 'complete' });
        } else {
          // The service cannot go back (a running sprint is not planned again): nothing to take.
          return;
        }
        nextBase.state = rf.state;
        return;
      }
      nextBase[name] = rf[name] as never;
      if (name === 'goal') next.goal = rf.goal === '' ? undefined : rf.goal;
      else (next as unknown as Record<string, string>)[name] = rf[name];
    };
    const push = (name: (typeof NAMES)[number]): void => {
      if (!write) return;
      // A sprint can be started or completed in the service, but not planned again.
      if (name === 'state' && lf.state === 'planned') return;
      (patch as Record<string, string>)[name] = lf[name];
      nextBase[name] = lf[name] as never;
    };

    for (const name of NAMES) {
      const localChanged = lf[name] !== base[name];
      const remoteChanged = rf[name] !== base[name];
      if (!localChanged && !remoteChanged) continue;
      if (!localChanged) pull(name);
      else if (!remoteChanged) push(name);
      else if (lf[name] === rf[name]) nextBase[name] = rf[name] as never;
      else if (rule === 'local') push(name);
      else pull(name);
    }

    // A start or a completion needs the dates in the service, so they go along.
    if (patch.state) {
      patch.startDate ??= lf.startDate;
      patch.endDate ??= lf.endDate;
      nextBase.startDate = lf.startDate;
      nextBase.endDate = lf.endDate;
    }
    if (next.goal === undefined) delete next.goal;
    sprints[index] = { ...next, link: { service, id: external.id, base: nextBase } };
    if (Object.keys(patch).length > 0) updates.push({ sprintId: local.id, id: external.id, patch });
  }

  // A sprint that exists only here is made in the service. A completed one is history.
  if (write) {
    for (const sprint of sprints) {
      if (sprint.link || claimed.has(sprint.id) || sprint.state === 'completed') continue;
      creates.push({ sprintId: sprint.id, fields: sprintFieldsOf(sprint) });
    }
  }
  return { sprints, creates, updates, actions, created, concurrent };
}
