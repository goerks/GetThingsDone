import type { Route } from '../router';
import type { TourStepId } from '../domain/helpTour';

export type PageKey = Route['name'];

/** What "Show me" highlights: the first element that matches the selector. */
export interface ShowSpec {
  selector: string;
  /** What to say when there is no such element: "story" asks the user to create a story first. */
  missing: 'story' | 'plain';
}

export interface TopicDef {
  id: string;
  /** The pages this topic is about. It is listed first on these pages. */
  pages: readonly PageKey[];
  /** Listed on every page, under "General". */
  general?: boolean;
  show?: ShowSpec;
}

/** The id of the introduction in the search and in the texts: help.topics.tour. */
export const TOUR_TOPIC_ID = 'tour';

const ALL_VIEWS: readonly PageKey[] = ['board', 'backlog', 'map', 'epics', 'releases', 'settings'];

/** The help topics in the order of their lists. Texts are in help.topics.<id> of the translations. */
export const TOPICS: readonly TopicDef[] = [
  { id: 'board.move', pages: ['board'], show: { selector: '.card[data-story-id]', missing: 'story' } },
  { id: 'board.columns', pages: ['board', 'settings'], show: { selector: '.column', missing: 'plain' } },
  { id: 'story.open', pages: ['board', 'backlog'], show: { selector: '.card__title, .backlog__title', missing: 'story' } },
  { id: 'story.create', pages: ['board', 'backlog'], show: { selector: '.page-head__action', missing: 'plain' } },
  { id: 'backlog.order', pages: ['backlog'], show: { selector: '.backlog__row', missing: 'story' } },
  { id: 'backlog.sprints', pages: ['backlog'], show: { selector: '.backlog__heading', missing: 'plain' } },
  { id: 'map.basics', pages: ['map'] },
  { id: 'epics.basics', pages: ['epics'] },
  { id: 'releases.basics', pages: ['releases'] },
  { id: 'settings.basics', pages: ['settings'] },
  { id: 'search.basics', pages: ALL_VIEWS, general: true },
  { id: 'shortcuts', pages: ALL_VIEWS, general: true }
];

/** Where each step of the introduction happens and what "Show me" highlights there. */
export const TOUR_STEP_VIEW: Record<TourStepId, { pages: readonly PageKey[]; show: ShowSpec }> = {
  board: { pages: ['board'], show: { selector: '.column', missing: 'plain' } },
  move: { pages: ['board'], show: { selector: '.card[data-story-id]', missing: 'story' } },
  create: { pages: ['board', 'backlog'], show: { selector: '.page-head__action', missing: 'plain' } },
  order: { pages: ['backlog'], show: { selector: '.backlog__row', missing: 'story' } }
};

/** The page a step needs, used to offer a link when the user is somewhere else. */
export function pageOfStep(id: TourStepId): PageKey {
  return TOUR_STEP_VIEW[id].pages[0];
}
