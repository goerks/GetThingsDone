import { describe, expect, it } from 'vitest';
import {
  INITIAL_HELP_STATE,
  TOUR_STEPS,
  activeStep,
  confirmStep,
  dismissInvitation,
  doneCount,
  noteActivity,
  parseHelpState,
  restartTour,
  skipStep,
  startTour
} from './helpTour';

describe('help state', () => {
  it('AC8.1 starts with the invitation pending and nothing started', () => {
    expect(INITIAL_HELP_STATE).toEqual({ invitation: 'pending', tourStarted: false, steps: {} });
    expect(activeStep(INITIAL_HELP_STATE)).toBe('board');
    expect(doneCount(INITIAL_HELP_STATE)).toBe(0);
  });

  it('AC8.2 dismisses the invitation without starting the tour', () => {
    const state = dismissInvitation(INITIAL_HELP_STATE);
    expect(state).toEqual({ invitation: 'dismissed', tourStarted: false, steps: {} });
  });

  it('AC8.3 starting the tour ends the invitation', () => {
    expect(startTour(INITIAL_HELP_STATE)).toEqual({ invitation: 'dismissed', tourStarted: true, steps: {} });
  });

  it('AC6.2 ticks off the step for what the user does after the start', () => {
    let state = startTour(INITIAL_HELP_STATE);
    state = confirmStep(state, 'board');
    state = noteActivity(state, 'moved');
    expect(state.steps).toEqual({ board: 'done', move: 'done' });
    expect(activeStep(state)).toBe('create');
    expect(doneCount(state)).toBe(2);
  });

  it.each([
    ['moved', 'move'],
    ['created', 'create'],
    ['ordered', 'order']
  ] as const)('AC6.2 the activity "%s" completes the step "%s" and no other', (activity, step) => {
    const state = noteActivity(startTour(INITIAL_HELP_STATE), activity);
    expect(Object.keys(state.steps)).toEqual([step]);
  });

  it('AC6.5 ignores what happened before the tour was started', () => {
    const state = noteActivity(INITIAL_HELP_STATE, 'created');
    expect(state.steps).toEqual({});
    expect(state.invitation).toBe('dismissed');
  });

  it('AC8.4 ends the invitation when the user starts working on their own', () => {
    expect(noteActivity(INITIAL_HELP_STATE, 'created').invitation).toBe('dismissed');
    expect(noteActivity(INITIAL_HELP_STATE, 'moved').invitation).toBe('dismissed');
  });

  it('AC6.4 skips a step without doing it, and the next step becomes active', () => {
    let state = startTour(INITIAL_HELP_STATE);
    state = confirmStep(state, 'board');
    state = skipStep(state, 'move');
    expect(state.steps.move).toBe('skipped');
    expect(activeStep(state)).toBe('create');
    expect(doneCount(state)).toBe(1);
  });

  it('AC6.4 ticks off a skipped step when the user does it later', () => {
    let state = skipStep(startTour(INITIAL_HELP_STATE), 'move');
    state = noteActivity(state, 'moved');
    expect(state.steps.move).toBe('done');
  });

  it('AC6.3 is finished when every step is done or skipped', () => {
    let state = startTour(INITIAL_HELP_STATE);
    for (const id of TOUR_STEPS) state = id === 'order' ? skipStep(state, id) : confirmStep(state, id);
    expect(activeStep(state)).toBeNull();
    expect(doneCount(state)).toBe(3);
  });

  it('AC7.2 starts again from the first step', () => {
    let state = startTour(INITIAL_HELP_STATE);
    for (const id of TOUR_STEPS) state = confirmStep(state, id);
    expect(restartTour()).toEqual({ invitation: 'dismissed', tourStarted: true, steps: {} });
    expect(activeStep(restartTour())).toBe('board');
  });

  it('AC7.1 reads back what it stored', () => {
    let state = startTour(INITIAL_HELP_STATE);
    state = confirmStep(state, 'board');
    state = skipStep(state, 'move');
    expect(parseHelpState(JSON.stringify(state))).toEqual(state);
  });

  it('AC7.1 falls back to the start for missing or damaged storage and leaves out unknown parts', () => {
    expect(parseHelpState(null)).toEqual(INITIAL_HELP_STATE);
    expect(parseHelpState('')).toEqual(INITIAL_HELP_STATE);
    expect(parseHelpState('{broken')).toEqual(INITIAL_HELP_STATE);
    expect(parseHelpState('null')).toEqual(INITIAL_HELP_STATE);
    expect(parseHelpState(JSON.stringify({ invitation: 'dismissed', tourStarted: true, steps: { board: 'done', nope: 'done', move: 'weird' } }))).toEqual({
      invitation: 'dismissed',
      tourStarted: true,
      steps: { board: 'done' }
    });
  });
});
