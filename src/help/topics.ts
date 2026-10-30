import type { Route } from '../router';
import type { TourStepId } from '../domain/helpTour';
import type { FeatureKey } from '../domain/types';
import { hrefs } from '../router';

export type PageKey = Route['name'];

/** What "Show me" highlights: the first element that matches the selector. */
export interface ShowSpec {
  selector: string;
  /** What to say when there is no such element: "story" asks the user to create a story first. */
  missing: 'story' | 'plain';
}

/** The places a topic can point to. Texts: help.links.<id>. */
export const LINK_TARGETS = {
  board: hrefs.board,
  backlog: hrefs.backlog,
  map: hrefs.map,
  epics: hrefs.epics,
  releases: hrefs.releases,
  settingsFields: hrefs.settings,
  settingsStatuses: hrefs.settingsStatuses,
  settingsMap: hrefs.settingsMap,
  settingsDefinitions: hrefs.settingsDefinitions,
  settingsReleases: hrefs.settingsReleases,
  settingsTeam: hrefs.settingsTeam,
  settingsSync: hrefs.settingsSync,
  settingsData: hrefs.settingsData
} as const;
export type LinkId = keyof typeof LINK_TARGETS;

/** A link of a topic. With `requires`, the place only exists while that feature is switched on (Settings → Releases, Settings → Team). */
export interface HelpLinkDef {
  id: LinkId;
  requires?: FeatureKey;
  /** A short line under the name of the button: help.linkHints.<hint>. */
  hint?: 'featureFirst' | 'releaseRows' | 'syncConnect';
}

export interface TopicDef {
  id: string;
  /** The pages this topic is about. It is listed first on these pages. */
  pages: readonly PageKey[];
  /** Listed on every page, under "General". */
  general?: boolean;
  show?: ShowSpec;
  /** Where to find what the topic talks about. A feature that must be switched on first is linked before the places that need it. */
  links?: readonly HelpLinkDef[];
}

/** The id of the introduction in the search and in the texts: help.topics.tour. */
export const TOUR_TOPIC_ID = 'tour';

const ALL_VIEWS: readonly PageKey[] = ['board', 'backlog', 'map', 'epics', 'releases', 'settings'];

/** The help topics in the order of their lists. Texts are in help.topics.<id> of the translations. */
export const TOPICS: readonly TopicDef[] = [
  { id: 'board.move', pages: ['board'], show: { selector: '.card[data-story-id]', missing: 'story' }, links: [{ id: 'board' }] },
  { id: 'board.card', pages: ['board'], show: { selector: '.card[data-story-id]', missing: 'story' }, links: [{ id: 'board' }] },
  { id: 'board.columns', pages: ['board', 'settings'], show: { selector: '.column', missing: 'plain' }, links: [{ id: 'settingsStatuses' }, { id: 'board' }] },
  { id: 'story.open', pages: ['board', 'backlog'], show: { selector: '.card__title, .backlog__title', missing: 'story' }, links: [{ id: 'board' }, { id: 'backlog' }, { id: 'settingsFields' }] },
  { id: 'story.create', pages: ['board', 'backlog'], show: { selector: '.page-head__action', missing: 'plain' }, links: [{ id: 'board' }, { id: 'backlog' }, { id: 'settingsFields' }] },
  { id: 'story.menu', pages: ['board', 'backlog', 'map'], show: { selector: '.card[data-story-id], .backlog__row, .map-card', missing: 'story' }, links: [{ id: 'board' }, { id: 'backlog' }, { id: 'map' }] },
  { id: 'story.quickAdd', pages: ['board', 'backlog', 'map'], show: { selector: '.quick-add, .map-cell__add', missing: 'plain' }, links: [{ id: 'board' }, { id: 'backlog' }, { id: 'map' }] },
  { id: 'backlog.order', pages: ['backlog'], show: { selector: '.backlog__row', missing: 'story' }, links: [{ id: 'backlog' }] },
  { id: 'backlog.points', pages: ['backlog'], show: { selector: '.pill--edit', missing: 'story' }, links: [{ id: 'backlog' }] },
  { id: 'backlog.sprints', pages: ['backlog'], show: { selector: '.backlog__heading', missing: 'plain' }, links: [{ id: 'backlog' }] },
  { id: 'board.velocity', pages: ['board'], show: { selector: '.velocity-button', missing: 'plain' }, links: [{ id: 'board' }, { id: 'backlog' }] },
  { id: 'sprint.lifecycle', pages: ['board', 'backlog', 'map'], show: { selector: '.page-head__actions', missing: 'plain' }, links: [{ id: 'board' }, { id: 'backlog' }, { id: 'map' }] },
  { id: 'map.basics', pages: ['map'], links: [{ id: 'map' }, { id: 'settingsReleases', hint: 'featureFirst' }, { id: 'settingsMap', requires: 'releases', hint: 'releaseRows' }] },
  { id: 'epics.basics', pages: ['epics'], links: [{ id: 'epics' }] },
  { id: 'releases.basics', pages: ['releases'], links: [{ id: 'settingsReleases', hint: 'featureFirst' }, { id: 'releases', requires: 'releases' }, { id: 'settingsMap', requires: 'releases', hint: 'releaseRows' }, { id: 'map', requires: 'releases' }] },
  { id: 'definitions.basics', pages: ['board', 'backlog', 'settings'], show: { selector: '.definition-chip, .definitions-settings, .card[data-story-id]', missing: 'plain' }, links: [{ id: 'settingsDefinitions' }, { id: 'backlog' }, { id: 'board' }] },
  { id: 'history.compare', pages: ['board', 'backlog', 'epics', 'releases'], show: { selector: '.card__title, .backlog__title', missing: 'story' }, links: [{ id: 'board' }, { id: 'backlog' }, { id: 'epics' }, { id: 'settingsReleases', hint: 'featureFirst' }, { id: 'releases', requires: 'releases' }] },
  { id: 'settings.basics', pages: ['settings'], links: [{ id: 'settingsFields' }, { id: 'settingsStatuses' }, { id: 'settingsMap' }, { id: 'settingsDefinitions' }, { id: 'settingsReleases' }, { id: 'settingsTeam' }, { id: 'settingsSync' }, { id: 'settingsData' }] },
  { id: 'team.assign', pages: ['board', 'backlog', 'map', 'settings'], show: { selector: '.member-filter, .team, .assignee', missing: 'plain' }, links: [{ id: 'settingsTeam', hint: 'featureFirst' }, { id: 'board' }, { id: 'backlog' }] },
  { id: 'data.backup', pages: ['settings'], show: { selector: '.data-settings', missing: 'plain' }, links: [{ id: 'settingsData' }] },
  { id: 'sync.basics', pages: ['backlog', 'settings'], show: { selector: '.github-sync, .github-settings', missing: 'plain' }, links: [{ id: 'settingsSync', hint: 'featureFirst' }, { id: 'backlog' }] },
  { id: 'sync.jira', pages: ['backlog', 'settings'], show: { selector: '.github-settings', missing: 'plain' }, links: [{ id: 'settingsSync', hint: 'featureFirst' }, { id: 'backlog' }] },
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
