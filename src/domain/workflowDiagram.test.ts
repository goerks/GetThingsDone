import { describe, expect, it } from 'vitest';
import { DEFAULT_STATUSES } from './statuses';
import { WORKFLOW_END, type StatusValue, type Workflow } from './types';
import { DEFAULT_WORKFLOW, setEnabled, setFree, setStart, setTransition } from './workflow';
import { DIAGRAM_START, layoutDiagram, type DiagramModel, type Orientation } from './workflowDiagram';

/** Demo statuses: todo (Not started), in_progress and review (In progress), done (Done). */
const statuses: StatusValue[] = DEFAULT_STATUSES.map((status) => ({ ...status }));
/** Two statuses in "Not started" for the start. */
const withReady: StatusValue[] = [statuses[0], { id: 'ready', label: 'Ready', category: 'not_started' }, ...statuses.slice(1)];
const on: Workflow = setEnabled(DEFAULT_WORKFLOW, true);

const find = (model: DiagramModel, from: string, to: string) => model.edges.find((edge) => edge.from === from && edge.to === to);

describe('workflow diagram (#49, AC13)', () => {
  it('AC13.1 draws the start, the end, a frame per category and a rounded rectangle per status', () => {
    // Given the demo statuses and the workflow switched on
    // When the diagram is laid out
    const model = layoutDiagram(on, statuses, 'horizontal');
    // Then there are three frames, four states, a start and an end
    expect(model.frames.map((frame) => frame.category)).toEqual(['not_started', 'in_progress', 'done']);
    expect(model.states.map((state) => state.id)).toEqual(['todo', 'in_progress', 'review', 'done']);
    expect(model.start.x).toBeLessThan(model.states[0].x);
    expect(model.end.x).toBeGreaterThan(model.states[3].x);
    // And every state lies inside the frame of its category, and no two states overlap
    for (const state of model.states) {
      const category = statuses.find((status) => status.id === state.id)?.category;
      const frame = model.frames.find((item) => item.category === category);
      expect(frame && state.x >= frame.x && state.x + state.width <= frame.x + frame.width && state.y >= frame.y && state.y + state.height <= frame.y + frame.height).toBe(true);
    }
    for (const a of model.states) for (const b of model.states) if (a !== b) expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
    // And the drawing has real coordinates
    for (const edge of model.edges) expect(edge.d).not.toMatch(/NaN|undefined/);
  });

  it('AC13.2 draws an arrow for every allowed transition and none for a forbidden one', () => {
    // Given "To do" → "Done" is forbidden
    const workflow = setTransition(on, 'todo', 'done', false);
    // When the diagram is laid out
    const model = layoutDiagram(workflow, statuses, 'horizontal');
    // Then there is no arrow from "To do" to "Done", but one from "To do" to "In progress" and a skipping one to "Review"
    expect(find(model, 'todo', 'done')).toBeUndefined();
    expect(find(model, 'todo', 'in_progress')).toBeDefined();
    expect(find(model, 'todo', 'review')?.kind).toBe('forward');
  });

  it('AC13.3 draws the arrows back dashed and the arrows forward solid', () => {
    // Given everything is allowed except "To do" → "Done" and the way back from "Review" to "In progress"
    const workflow = setTransition(setTransition(on, 'todo', 'done', false), 'review', 'in_progress', false);
    // When the diagram is laid out
    const model = layoutDiagram(workflow, statuses, 'horizontal');
    // Then "Done" → "In progress" is a back arrow, "In progress" → "Done" a forward one, and "In progress" → "Review" a single forward arrow
    expect(find(model, 'done', 'in_progress')?.kind).toBe('back');
    expect(find(model, 'in_progress', 'done')?.kind).toBe('forward');
    expect(find(model, 'in_progress', 'review')?.kind).toBe('forward');
  });

  it('AC13.4 leads one arrow from a frame to the end where every status may be deleted, else one per status', () => {
    // Given deleting is allowed from every status but "Done"
    const workflow = setTransition(on, 'done', WORKFLOW_END, false);
    // When the diagram is laid out
    const model = layoutDiagram(workflow, statuses, 'horizontal');
    const ends = (): string[] => model.edges.filter((edge) => edge.kind === 'end').map((edge) => edge.from);
    // Then the frames "Not started" and "In progress" each have one arrow to the end, "Done" has none
    expect(ends()).toEqual(['frame:not_started', 'frame:in_progress']);
    // And when deleting from "Review" is forbidden as well, "In progress" has its own arrow and "Review" none
    const single = layoutDiagram(setTransition(workflow, 'review', WORKFLOW_END, false), statuses, 'horizontal');
    expect(single.edges.filter((edge) => edge.kind === 'end').map((edge) => edge.from)).toEqual(['frame:not_started', 'in_progress']);
    // And the arrows join on a bus: one dot for each arrow after the first
    expect(single.junctions).toHaveLength(1);
  });

  it('AC13.5 draws "free within the category" as one double arrow with a label, and none when the switch is off', () => {
    // Given the switch of "In progress" is on, then off
    const free = layoutDiagram(on, statuses, 'horizontal');
    const notFree = layoutDiagram(setFree(on, statuses, 'in_progress', false), statuses, 'horizontal');
    // Then "In progress" and "Review" share one double arrow with the label, and without the switch it has no label
    const arrow = find(free, 'in_progress', 'review');
    expect(arrow?.kind).toBe('both');
    expect(arrow?.label?.anchor).toBe('middle');
    expect(find(notFree, 'in_progress', 'review')?.label).toBeUndefined();
    // And there is only one arrow between the two
    expect(free.edges.filter((edge) => [edge.from, edge.to].sort().join() === ['in_progress', 'review'].join())).toHaveLength(1);
  });

  it('AC14.3 leads an arrow from the start to every status where a story may start', () => {
    // Given "Not started" has "To do" and "Ready", and both are start statuses
    const workflow = setStart(setStart(on, withReady, 'ready', true), withReady, 'todo', true);
    // When the diagram is laid out
    const model = layoutDiagram(workflow, withReady, 'horizontal');
    // Then there is an arrow from the start to each
    expect(find(model, DIAGRAM_START, 'todo')?.kind).toBe('start');
    expect(find(model, DIAGRAM_START, 'ready')?.kind).toBe('start');
    // And with only "Ready" as start there is none to "To do"
    const only = layoutDiagram(setStart(setStart(on, withReady, 'ready', true), withReady, 'todo', false), withReady, 'horizontal');
    expect(find(only, DIAGRAM_START, 'todo')).toBeUndefined();
    expect(find(only, DIAGRAM_START, 'ready')).toBeDefined();
  });

  it('AC15.2 draws the diagram upright on a narrow screen: taller than wide, the same states, no overlaps', () => {
    // Given the demo statuses
    const draw = (orientation: Orientation): DiagramModel => layoutDiagram(on, withReady, orientation);
    // When it is laid out vertically
    const vertical = draw('vertical');
    const horizontal = draw('horizontal');
    // Then it fits a phone (about 400 points) and is taller than the horizontal one, with the same states
    expect(vertical.width).toBeLessThan(420);
    expect(vertical.height).toBeGreaterThan(horizontal.height);
    expect(vertical.states.map((state) => state.id)).toEqual(horizontal.states.map((state) => state.id));
    // And the start is above the first state and the end below the last
    expect(vertical.start.y).toBeLessThan(vertical.states[0].y);
    expect(vertical.end.y).toBeGreaterThan(vertical.states[vertical.states.length - 1].y);
    for (const a of vertical.states) for (const b of vertical.states) if (a !== b) expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
    for (const edge of vertical.edges) expect(edge.d).not.toMatch(/NaN|undefined/);
  });
});
