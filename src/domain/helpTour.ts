/** The steps of the optional introduction ("First steps"), in order. */
export const TOUR_STEPS = ['board', 'move', 'create', 'order'] as const;
export type TourStepId = (typeof TOUR_STEPS)[number];

/** What the user did in the app that can complete a step. */
export type Activity = 'moved' | 'created' | 'ordered';

/** Steps the app ticks off by itself when the user does the thing. The other steps are confirmed by the user. */
export const STEP_ACTIVITY: Partial<Record<TourStepId, Activity>> = { move: 'moved', create: 'created', order: 'ordered' };

export type StepResult = 'done' | 'skipped';

/** What is remembered about the help on this device. */
export interface HelpState {
  /** The card that offers the introduction on the first start. */
  invitation: 'pending' | 'dismissed';
  /** Only what the user does after this is true counts for the steps. */
  tourStarted: boolean;
  steps: Partial<Record<TourStepId, StepResult>>;
}

export const INITIAL_HELP_STATE: HelpState = { invitation: 'pending', tourStarted: false, steps: {} };

export const HELP_STORAGE_KEY = 'getitdone.help';

/** The state from its stored text. Anything unreadable gives the initial state; unknown parts are left out. */
export function parseHelpState(raw: string | null | undefined): HelpState {
  if (!raw) return INITIAL_HELP_STATE;
  try {
    const stored = JSON.parse(raw) as Partial<HelpState> | null;
    if (typeof stored !== 'object' || stored === null) return INITIAL_HELP_STATE;
    const steps: HelpState['steps'] = {};
    for (const id of TOUR_STEPS) {
      const result = stored.steps?.[id];
      if (result === 'done' || result === 'skipped') steps[id] = result;
    }
    return { invitation: stored.invitation === 'dismissed' ? 'dismissed' : 'pending', tourStarted: stored.tourStarted === true, steps };
  } catch {
    return INITIAL_HELP_STATE;
  }
}

/** Starts the introduction. Nothing that happened before counts. */
export function startTour(state: HelpState): HelpState {
  if (state.tourStarted) return state.invitation === 'dismissed' ? state : { ...state, invitation: 'dismissed' };
  return { ...state, invitation: 'dismissed', tourStarted: true };
}

export function dismissInvitation(state: HelpState): HelpState {
  return state.invitation === 'dismissed' ? state : { ...state, invitation: 'dismissed' };
}

/** Starts again from the first step. */
export function restartTour(): HelpState {
  return { invitation: 'dismissed', tourStarted: true, steps: {} };
}

/** The user says the step is done (the steps that cannot be noticed by the app). */
export function confirmStep(state: HelpState, id: TourStepId): HelpState {
  return state.steps[id] === 'done' ? state : { ...state, steps: { ...state.steps, [id]: 'done' } };
}

export function skipStep(state: HelpState, id: TourStepId): HelpState {
  return state.steps[id] ? state : { ...state, steps: { ...state.steps, [id]: 'skipped' } };
}

/**
 * The user did something in the app. Whoever works on their own does not need the invitation any more. While the
 * introduction runs, the step for this activity is ticked off, also one that was skipped before.
 */
export function noteActivity(state: HelpState, activity: Activity): HelpState {
  let next = dismissInvitation(state);
  if (!state.tourStarted) return next;
  for (const id of TOUR_STEPS) {
    if (STEP_ACTIVITY[id] === activity && next.steps[id] !== 'done') next = { ...next, steps: { ...next.steps, [id]: 'done' } };
  }
  return next;
}

/** The first step that is neither done nor skipped, or null when all are through. */
export function activeStep(state: HelpState): TourStepId | null {
  return TOUR_STEPS.find((id) => !state.steps[id]) ?? null;
}

export function doneCount(state: HelpState): number {
  return TOUR_STEPS.filter((id) => state.steps[id] === 'done').length;
}
