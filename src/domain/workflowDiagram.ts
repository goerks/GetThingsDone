import { STATUS_CATEGORIES, statusesIn } from './statuses';
import type { StatusCategory, StatusValue, Workflow } from './types';
import { WORKFLOW_END, canDelete, canMove, startStatuses } from './workflow';

/**
 * The workflow as a UML state diagram (#49, AC13): initial state, final state, one frame per category (a composite state),
 * one rounded rectangle per status and an arrow per allowed transition. This file only computes the drawing as plain data;
 * `WorkflowDiagram.tsx` renders it. The layout is worked out along the flow (`u`) and across it (`v`) and then mapped to the
 * screen: horizontal puts the flow left to right, vertical puts it top to bottom (for narrow screens).
 */

export type Orientation = 'horizontal' | 'vertical';

/** The start of a transition in `Edge.from` for the arrow that leaves the initial state. */
export const DIAGRAM_START = '~start';

export type EdgeKind = 'forward' | 'back' | 'both' | 'start' | 'end';

export interface DiagramEdge {
  id: string;
  kind: EdgeKind;
  /** A status id, `DIAGRAM_START`, or for an arrow that leaves a whole frame `frame:<category>`. */
  from: string;
  /** A status id or `WORKFLOW_END`. */
  to: string;
  /** SVG path of the arrow. */
  d: string;
  /** Whether the end of the path carries an arrowhead (the stubs that join the end bus do not). */
  head: boolean;
  /** "Free within the category": a double arrow with this label at the given spot. */
  label?: { x: number; y: number; anchor: 'start' | 'middle' };
}

export interface DiagramFrame {
  category: StatusCategory;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Where the name of the category goes, and the line under it. */
  title: { x: number; y: number };
  divider: { x1: number; y1: number; x2: number; y2: number };
}

export interface DiagramState {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DiagramModel {
  orientation: Orientation;
  width: number;
  height: number;
  frames: DiagramFrame[];
  states: DiagramState[];
  start: { x: number; y: number; r: number };
  end: { x: number; y: number; r: number };
  edges: DiagramEdge[];
  /** Every transition between the statuses is allowed: the skipping and returning arrows are left out, they would only be clutter. */
  complete: boolean;
  /** Small dots where an arrow to the end joins the bus. */
  junctions: Array<{ x: number; y: number }>;
}

const GAP = 54;
const LANE = 18;
const TITLE = 36;
const PAD = 16;
const STATE_LONG = 110;
const STATE_SHORT = 44;
const DOT = 9;
const FINAL = 13;

type Point = [number, number];

interface Arc {
  from: number;
  to: number;
  kind: 'forward' | 'back' | 'start';
  lane: number;
}

/** The layout of the workflow. Only meaningful for a workflow that is switched on; the caller decides. */
export function layoutDiagram(workflow: Workflow, statuses: readonly StatusValue[], orientation: Orientation): DiagramModel {
  const vertical = orientation === 'vertical';
  const ordered = STATUS_CATEGORIES.flatMap((category) => statusesIn(statuses, category));
  const indexOf = new Map(ordered.map((status, index) => [status.id, index] as const));
  const startIds = startStatuses(workflow, statuses);

  // Size of a state along the flow (su) and across it (sv).
  const su = vertical ? STATE_SHORT : STATE_LONG;
  const sv = vertical ? STATE_LONG : STATE_SHORT;
  // The name of a category sits at the top of its frame: across the flow when horizontal, along it when vertical.
  const padU0 = vertical ? TITLE : PAD;
  const padU1 = PAD;
  const padV0 = vertical ? PAD : TITLE;
  const padV1 = PAD;

  const map = ([u, v]: Point): Point => (vertical ? [v, u] : [u, v]);
  const path = (points: Point[]): string => points.map((point, index) => `${index === 0 ? 'M' : 'L'}${map(point)[0]} ${map(point)[1]}`).join(' ');

  // ----- arcs: every transition that is not between neighbours, drawn on lanes beside the frames -----
  const arcs: Arc[] = [];
  const straight = new Map<string, { forward: boolean; back: boolean }>();
  for (let i = 0; i < ordered.length; i += 1) {
    for (let j = 0; j < ordered.length; j += 1) {
      if (i === j || !canMove(workflow, ordered[i].id, ordered[j].id)) continue;
      if (Math.abs(i - j) === 1) {
        const key = `${Math.min(i, j)}`;
        const entry = straight.get(key) ?? { forward: false, back: false };
        if (j > i) entry.forward = true;
        else entry.back = true;
        straight.set(key, entry);
      } else {
        arcs.push({ from: i, to: j, kind: j > i ? 'forward' : 'back', lane: 0 });
      }
    }
  }
  // With nothing forbidden the arrows between statuses that are not neighbours would cross everywhere; they are left out.
  const complete = ordered.every((a) => ordered.every((b) => a.id === b.id || canMove(workflow, a.id, b.id)));
  if (complete) arcs.length = 0;
  for (const id of startIds) {
    const to = indexOf.get(id);
    if (to !== undefined && to > 0) arcs.push({ from: -1, to, kind: 'start', lane: 0 });
  }
  // Lanes: short arcs first, each on the lowest lane where it does not overlap another arc.
  const sorted = [...arcs].sort((a, b) => Math.abs(a.to - a.from) - Math.abs(b.to - b.from) || Math.min(a.from, a.to) - Math.min(b.from, b.to));
  const lanes: Array<Array<[number, number]>> = [];
  for (const arc of sorted) {
    const lo = Math.min(arc.from, arc.to);
    const hi = Math.max(arc.from, arc.to);
    let lane = lanes.findIndex((list) => list.every(([a, b]) => !(lo < b && a < hi)));
    if (lane < 0) {
      lanes.push([]);
      lane = lanes.length - 1;
    }
    lanes[lane].push([lo, hi]);
    arc.lane = lane;
  }
  const laneCount = lanes.length;

  // ----- across the flow -----
  const frameTop = 14 + laneCount * LANE;
  const vc = frameTop + padV0 + sv / 2;
  const frameBottom = vc + sv / 2 + padV1;
  const busV = frameBottom + 28;
  const stateTop = vc - sv / 2;
  const stateBottom = vc + sv / 2;

  // ----- along the flow -----
  const dotU = DOT + 6;
  let cursor = dotU + DOT + GAP;
  const frames: DiagramFrame[] = [];
  const states: DiagramState[] = [];
  const centerU = new Map<string, number>();
  const frameSpan = new Map<StatusCategory, [number, number]>();
  for (const category of STATUS_CATEGORIES) {
    const inside = statusesIn(statuses, category);
    if (inside.length === 0) continue;
    const start = cursor;
    let u = start + padU0;
    for (const status of inside) {
      centerU.set(status.id, u + su / 2);
      const [x, y] = map([u, stateTop]);
      states.push({ id: status.id, x, y, width: vertical ? sv : su, height: vertical ? su : sv });
      u += su + GAP;
    }
    const end = u - GAP + padU1;
    frameSpan.set(category, [start, end]);
    const [fx, fy] = map([start, frameTop]);
    const width = vertical ? frameBottom - frameTop : end - start;
    const height = vertical ? end - start : frameBottom - frameTop;
    frames.push({
      category,
      x: fx,
      y: fy,
      width,
      height,
      title: { x: fx + 14, y: fy + 19 },
      divider: { x1: fx, y1: fy + 28, x2: fx + width, y2: fy + 28 }
    });
    cursor = end + GAP;
  }
  const finalU = cursor - GAP + 56;
  const totalU = finalU + FINAL + 14;
  const totalV = busV + 14;

  const edges: DiagramEdge[] = [];
  const nodeCenter = (index: number): number => (index < 0 ? dotU : (centerU.get(ordered[index].id) as number));
  const nodeId = (index: number): string => (index < 0 ? DIAGRAM_START : ordered[index].id);

  // ----- arrows between neighbours -----
  const edgeStart = (index: number): number => nodeCenter(index) + su / 2;
  const edgeEnd = (index: number): number => nodeCenter(index) - su / 2;
  const freeOn = (index: number): boolean => {
    const a = ordered[index];
    const b = ordered[index + 1];
    return a.category === b.category && workflow.story.free[a.category];
  };
  for (const [key, entry] of straight) {
    const i = Number(key);
    const a = ordered[i];
    const b = ordered[i + 1];
    const from = edgeStart(i);
    const to = edgeEnd(i + 1);
    if (entry.forward && entry.back) {
      const label = freeOn(i)
        ? vertical
          ? { x: map([0, vc])[0] + 14, y: map([(from + to) / 2, 0])[1] + 4, anchor: 'start' as const }
          : { x: (from + to) / 2, y: vc - 8, anchor: 'middle' as const }
        : undefined;
      edges.push({ id: `${a.id}>${b.id}`, kind: 'both', from: a.id, to: b.id, d: path([[from, vc], [to, vc]]), head: true, label });
    } else if (entry.forward) {
      edges.push({ id: `${a.id}>${b.id}`, kind: 'forward', from: a.id, to: b.id, d: path([[from, vc], [to, vc]]), head: true });
    } else {
      edges.push({ id: `${b.id}>${a.id}`, kind: 'back', from: b.id, to: a.id, d: path([[to, vc], [from, vc]]), head: true });
    }
  }
  // The arrow from the initial state to the first status.
  if (ordered.length > 0 && startIds.includes(ordered[0].id)) {
    edges.push({ id: `${DIAGRAM_START}>${ordered[0].id}`, kind: 'start', from: DIAGRAM_START, to: ordered[0].id, d: path([[dotU + DOT, vc], [edgeEnd(0), vc]]), head: true });
  }

  // ----- arcs, with their ends spread along the top of a state so they do not meet -----
  const ends = new Map<number, Array<{ arc: Arc; side: -1 | 1 }>>();
  for (const arc of arcs) {
    for (const [node, other] of [[arc.from, arc.to], [arc.to, arc.from]] as const) {
      const list = ends.get(node) ?? [];
      list.push({ arc, side: other < node ? -1 : 1 });
      ends.set(node, list);
    }
  }
  const slot = new Map<string, number>();
  for (const [node, list] of ends) {
    const left = list.filter((item) => item.side < 0).sort((a, b) => b.arc.lane - a.arc.lane);
    const right = list.filter((item) => item.side > 0).sort((a, b) => a.arc.lane - b.arc.lane);
    const all = [...left, ...right];
    const spacing = all.length > 1 ? Math.min(14, (su - 16) / (all.length - 1)) : 0;
    all.forEach((item, index) => slot.set(`${node}:${item.arc.from}:${item.arc.to}`, nodeCenter(node) + (index - (all.length - 1) / 2) * spacing));
  }
  for (const arc of arcs) {
    const laneV = frameTop - 14 - arc.lane * LANE;
    const fromV = arc.from < 0 ? vc - DOT : stateTop;
    const u1 = slot.get(`${arc.from}:${arc.from}:${arc.to}`) as number;
    const u2 = slot.get(`${arc.to}:${arc.from}:${arc.to}`) as number;
    edges.push({
      id: `${nodeId(arc.from)}>${nodeId(arc.to)}`,
      kind: arc.kind === 'back' ? 'back' : arc.kind === 'start' ? 'start' : 'forward',
      from: nodeId(arc.from),
      to: nodeId(arc.to),
      d: path([[u1, fromV], [u1, laneV], [u2, laneV], [u2, stateTop]]),
      head: true
    });
  }

  // ----- the end: a frame where every status may be deleted, else the single statuses, joined on a bus -----
  const stubs: Array<{ id: string; from: string; u: number; v: number }> = [];
  for (const category of STATUS_CATEGORIES) {
    const inside = statusesIn(statuses, category);
    if (inside.length === 0) continue;
    if (inside.every((status) => canDelete(workflow, status.id))) {
      const [a, b] = frameSpan.get(category) as [number, number];
      stubs.push({ id: `frame:${category}>${WORKFLOW_END}`, from: `frame:${category}`, u: (a + b) / 2, v: frameBottom });
    } else {
      for (const status of inside) if (canDelete(workflow, status.id)) stubs.push({ id: `${status.id}>${WORKFLOW_END}`, from: status.id, u: centerU.get(status.id) as number, v: stateBottom });
    }
  }
  stubs.sort((a, b) => a.u - b.u);
  const junctions: Array<{ x: number; y: number }> = [];
  stubs.forEach((stub, index) => {
    if (index === 0) {
      edges.push({ id: stub.id, kind: 'end', from: stub.from, to: WORKFLOW_END, d: path([[stub.u, stub.v], [stub.u, busV], [finalU, busV], [finalU, vc + FINAL]]), head: true });
    } else {
      edges.push({ id: stub.id, kind: 'end', from: stub.from, to: WORKFLOW_END, d: path([[stub.u, stub.v], [stub.u, busV]]), head: false });
      const [x, y] = map([stub.u, busV]);
      junctions.push({ x, y });
    }
  });

  const [width, height] = vertical ? [totalV, totalU] : [totalU, totalV];
  const [sx, sy] = map([dotU, vc]);
  const [ex, ey] = map([finalU, vc]);
  return { orientation, width, height, frames, states, start: { x: sx, y: sy, r: DOT }, end: { x: ex, y: ey, r: FINAL }, edges, complete, junctions };
}
