import { sortSprints } from './sprints';
import type { Sprint } from './types';

/**
 * Velocity (#24): the points a team planned at the start of each completed sprint and the points it completed.
 * Planned is the scope when the sprint was started (#17); done can be more than planned when stories joined later.
 */

/** Sprints shown at first in the chart; "older sprints" adds the same number again. */
export const VELOCITY_PAGE = 8;
/** The average is taken over this many of the latest completed sprints. */
export const VELOCITY_AVERAGE_OF = 3;

export interface VelocityRow {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  completedOn: string;
  planned: number;
  done: number;
  /** Stories and points that joined the sprint after its start. */
  addedStories: number;
  addedPoints: number;
  /** Done as a share of planned, in whole percent; null when nothing was planned. */
  share: number | null;
}

/** The completed sprints that have a result, in time order (oldest first). */
export function velocityRows(sprints: readonly Sprint[]): VelocityRow[] {
  return sortSprints(sprints)
    .filter((sprint) => sprint.state === 'completed' && sprint.result !== null)
    .map((sprint) => {
      const result = sprint.result!;
      return {
        id: sprint.id,
        name: sprint.name,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        completedOn: result.completedOn,
        planned: result.plannedPoints,
        done: result.donePoints,
        addedStories: result.addedStories,
        addedPoints: result.addedPoints,
        share: result.plannedPoints > 0 ? Math.round((result.donePoints / result.plannedPoints) * 100) : null
      };
    });
}

export interface VelocityAverage {
  /** Average done points, rounded to whole points (from 0.5 up). */
  points: number;
  /** The number of sprints it is taken over: at most three. */
  sprints: number;
}

/** The average done points of the latest (up to three) completed sprints, or null without a completed sprint. */
export function averageVelocity(rows: readonly VelocityRow[]): VelocityAverage | null {
  const latest = rows.slice(-VELOCITY_AVERAGE_OF);
  if (latest.length === 0) return null;
  const sum = latest.reduce((total, row) => total + row.done, 0);
  return { points: Math.round(sum / latest.length), sprints: latest.length };
}

/** The rows of the chart: the latest ones, `pages` times the page size, and whether older ones remain. */
export function chartRows(rows: readonly VelocityRow[], pages: number): { rows: VelocityRow[]; hasOlder: boolean } {
  const count = Math.max(1, pages) * VELOCITY_PAGE;
  return { rows: rows.slice(-count), hasOlder: rows.length > count };
}
