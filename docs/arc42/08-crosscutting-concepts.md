# 8. Crosscutting concepts

## Domain model

```
Epic   1 ──── * Story 1 ──── * Criterion
Sprint 1 ──── * Story          (a story has one sprint or none)
Release 1 ─── * Story          (a story has one release or none)
```

- **Epic**: id, name, colour key from a palette of eight (`blue`, `amber`, `teal`, `violet`, `rose`, `green`, `cyan`, `slate`), position (column order on the story map). An epic that still has stories cannot be deleted.
- **Sprint**: id, name, start date, end date (local calendar days `YYYY-MM-DD`, both included), state (`planned`, `running` or `completed`, #17), the stories at its start (`startItems`: id, key and points, set when it is started) and its result (`result`, set when it is completed: planned, done, not done, added, removed and changed points). At most one sprint runs; the board shows it (`boardSprint`). A sprint runs when it is started, not by its dates. `startItems` and `result` are stored as JSON next to the sprint (columns `start_items` and `result`); a sprint of an earlier version has no state and gets one by its dates when the data is loaded (`settleSprints`).
- **Release** (#10): id, title, description, optional start and end day. Its size is derived from its stories; its state (planned, running, done) is derived too (`releaseState`), never stored. Deleting a release keeps its stories (`deleteRelease`).
- **Story**: id, key (`S-<n>`), title, description, epic, points (1, 2, 3, 5, 8, 13), status (the id of a status value), sprint (one or none), release (one or none), rank.
- **Status value** (#5): id, label (null shows the translated default), category (`not_started`, `in_progress`, `done`). The list order is the board order; categories keep their fixed order and "not started" and "done" are never empty. The defaults are `todo`, `in_progress`, `review` (in progress) and `done`.
- **Criterion**: id, text, done, position within the story.

`rank` is one global priority (0 is the most important). The backlog shows one section per sprint in time order and then the unplanned stories, each by rank (`backlogOrder`); backlog and story map drops store exactly that order, so the ranks stay grouped by sprint. The board shows the stories of the running sprint by rank, grouped by status. A map cell shows the stories of one epic and one sprint by rank. Deleting a story can leave a gap in the ranks; a new story always gets the highest rank plus one.

Release planning decisions (#10, no ADR because the PO no longer reviews them; recorded here and in the issue): a release is its own table with a nullable `stories.release_id`, which enforces "at most one release per story" in the model; "Release" is a system field of stories stored in that native column, not in `field_values` (as ADR 0003 does for epic and sprint); the history for the scope report and the burndown is an append-only event log (`release_events`, entries `baseline`, `added`, `removed`, `points`, `done`, `reopened`, each with the points and done flag of the story after it) that a pure function (`scopeReport`) replays into the state of each day, because a local app does not run every day and snapshots would have gaps; an entry keeps the key of its story, so it stays readable after the story is deleted. "Done" means the status of the story is in the category `done` (`isDoneIn`).

Status value decisions (#5, recorded here and in the issue): status values are their own table `status_values` (id, label, category, position) instead of options of the Status field, because they carry a category and a translated default label that field options do not have; `stories.status` keeps holding the id, so the four former statuses stay valid as the defaults. Functions that need to know whether a story is done take an `IsDone` check built from the status values. When a status value moves to another category, `releaseEventsFor` gets the done check before and after the change and records `done` or `reopened` for the affected stories on that day, so the history is never rewritten. A story whose status no longer exists gets the start status when the data is loaded.

## Persistence

- The `Repository` interface (`src/data/repository.ts`) is the only storage boundary. It offers coarse, intention-revealing operations (`savePositions`, `updateStory`, `setCriterionText`, `saveCriteriaOrder`, `addEpic`, ...) instead of generic CRUD, so each UI action maps to one call.
- SQLite schema: tables `epics`, `sprints`, `releases`, `release_events`, `settings` (key and value), `status_values`, `stories`, `criteria` with foreign keys and indexes on `rank` and `(story_id, position)`. Schema changes are new numbered migrations in `src-tauri/migrations/`, registered in `lib.rs`. Never edit a released migration. Browser data in `localStorage` is migrated in code when it is read (`src/domain/migrate.ts`) and written back at once, so a migrated sprint keeps its dates.
- Keys are generated in the frontend (`src/domain/ids.ts`), so the UI can update before the write finishes.

## Internationalisation

- All user-facing text comes from `src/i18n/<lang>.json`. Every key exists in all four languages.
- Language detection: stored choice, else browser language, else English. The `lang` attribute of the document follows the choice.
- Search ignores case and accents (Unicode decomposition without combining marks), so the same query works in all four languages. Filter suggestions compare with the value names in the current language.
- Screen reader announcements for drag and drop are translated too.

## Accessibility

- Real `button`, `a` and form controls, each at least 44 by 44 px, with a visible focus ring.
- Board cards and backlog rows are dragged as a whole. Each is one keyboard stop (`role="group"` with a translated role description): space picks it up, arrow keys move it, space drops it, Escape cancels, Enter opens the story. The title link is kept for the mouse but taken out of the tab order, so there is no nested interactive element.
- The drop target is shown by a highlighted column, section or map cell and a line at the exact position (in the backlog with the future rank; on the map the epic header and sprint label are highlighted as well). The same domain function computes the preview and the drop.
- Criteria rows contain a checkbox and editable text, so they are dragged by a handle button.
- Text is edited in place: a button shows the text, a click turns it into a field. Focus returns to the button after Enter or Escape.
- Colour never carries meaning alone: epic names, status names and criteria counts are written out.
- Status changes such as "all criteria accepted" are announced through live regions.
- The search follows the combobox pattern: focus stays in the input, `aria-activedescendant` points to the marked option in a grouped listbox, the number of results is announced in a live region. Filters are badges with the field, "=" and the value and a remove button; field and value suggestions are options in the same listbox.

## Interaction conventions (#32)

- **Opening:** one click opens a story, epic, sprint or release everywhere; dragging starts after 4 px, and dnd-kit swallows the click that ends a drag. A click beside a dialog within 400 ms of opening is ignored.
- **Create dialogs** share `Dialog` (props `dirty`, `submitShortcut`) and `DialogFooter`: `Ctrl+Enter` submits the form, Escape or a click beside the dialog asks "Discard input?" when `dirty`.
- **Shortcuts** are always combinations with Ctrl (Cmd on a Mac); there are no single-key shortcuts (PO decision). `Ctrl+N` creates what the page is about (`useNewShortcut`), `Ctrl+/` opens the overview (`Shortcuts.tsx`).
- **Context menu:** `StoryMenuProvider` owns one menu for all cards; cards and rows call `openFor` from `onContextMenu`, which the browser also fires for the menu key and `Shift+F10`. The menu is a portal with a transparent layer behind it.
- **Feedback:** `ToastProvider` (above `AppProvider`) shows notices in a polite live region; `AppState` announces creates and moves and sets `flashed`, which cards read to show the green frame; `App` scrolls the flashed story into view. Without a provider (small tests) notices do nothing.
- **Quick add** (`QuickAdd.tsx`) creates a story with the defaults of its place; with a required custom field without default it hands over to `NewStoryDialog`.
- **Acceptance panel** (`src/acceptance/`): the test cases of a pull request are data (`package<n>.ts`); `Panel.tsx` shows them step by step in previews only (`preview.ts`), keeps marks, comments and the step in `localStorage`, and copies the result as text for the chat with the AI. It is German only because it shows the German test cases for the PO.

## Theming

Colours, spacing and radii are CSS custom properties in `docs/design/tokens.css`. Epic colours are `--epic-<key>`; each reaches at least 3:1 against cards and columns in both themes and is always shown with the epic name. The theme is set with `data-theme="light|dark"` on the root element, stored locally and initialised from the system preference.

## Error handling

Load and save errors are caught in `AppState` and shown as a translated alert with the technical message. The UI does not roll back optimistic changes yet.

## Help

The interactive help (#33) is documentation for users and grows with every feature, like this documentation. To extend it:

1. Add the topic to `TOPICS` in `src/help/topics.ts`: an id, the pages it belongs to (`pages`), `general` for topics of every page, a `show` target (a CSS selector and what to say when it is missing), and `links` to where to find the feature. Places are listed in `LINK_TARGETS`; add a new one there and its label under `help.links.<id>` in all four language files.
2. A place that only exists while a feature is switched on gets `requires: '<feature>'`. It is shown as a link while the feature is on, and as the text "switch the feature on first" otherwise. List the settings page of the features (`settingsFeatures`) before such places, and start the text of the topic with that step.
3. Write `help.topics.<id>` (`title`, `keywords`, `body`; lines of `body` are paragraphs) in DE, EN, FR and IT. `keywords` are extra words that find the topic (also the synonyms users type). `src/help/topics.test.ts` checks that every topic and link has its texts in all languages and that every topic is found by its own title.
4. Add a component test for new behaviour in `src/Help.test.tsx` and, for a journey across pages, in `e2e/help.spec.ts`.
5. The steps of the first steps (`TOUR_STEPS` in `src/domain/helpTour.ts`) are the PO's: no step is added or changed without the PO's approval (see `CLAUDE.md`).

## Testing

Tests are derived from test cases the PO approves per acceptance criterion (see `CLAUDE.md`, "Test cases"). A test name starts with the ID of its test case (`AC2.1`, or `FR-MAP-02.1` for existing requirements).

| Level | Tool | Where |
|---|---|---|
| Unit | Vitest | `src/domain/*.test.ts` |
| Component | Vitest, Testing Library, jsdom | `src/App.test.tsx`, `src/components/search/Search.test.tsx`, `src/Help.test.tsx`, with `LocalStorageRepository` as test double |
| Integration (data, Tauri boundary) | – | Planned |
| End-to-end | Playwright, real Chromium, web build with demo data and a fixed clock; visual checks with `toHaveScreenshot` of new elements (baselines in `e2e/*.spec.ts-snapshots`, Chromium on Linux, tolerance 8 % because CI renders text slightly differently) | `e2e/*.spec.ts`, `npm run test:e2e` (story map since #12, help since #33, usability since #32) |
| Accessibility (axe) | – | Planned |

## Security

- The Tauri capabilities allow only the SQL commands the app needs.
- No network access at runtime, no telemetry, no secrets in the repository.
