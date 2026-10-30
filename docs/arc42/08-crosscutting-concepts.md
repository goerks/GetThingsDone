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
- **Definitions** (#26): `Settings.definitions` holds two lists (`ready`, `done`); a list has `enforce` and groups with items (id, text, `rule` for an automatic item, `mayBeIrrelevant`). SQLite stores them as JSON in the settings table (key `definitions`). A story has `checks` (item id → `checked` or `na`; no entry is open) and `doneItems` (the ids of the Done items at the moment it entered "done", null otherwise); both are columns of `stories` (JSON, migration 012) and are saved through `saveStoryChecks`, never through `updateStory` or `savePositions`. Automatic items are computed from the story (`ruleMet`), never stored.
- **Status value** (#5): id, label (null shows the translated default), category (`not_started`, `in_progress`, `done`). The list order is the board order; categories keep their fixed order and "not started" and "done" are never empty. The defaults are `todo`, `in_progress`, `review` (in progress) and `done`.
- **Criterion**: id, text, done, position within the story.
- **Change log** (#23, ADR 0004): `Snapshot.changeLog` holds versions of stories, epics, sprints and releases. A version is one save and keeps the whole tracked state of the item as raw values (`src/domain/changeLog.ts`); what it changed is found by comparing it with the version before. `recordStates` is generic (an adapter turns an item into a state, so custom item types need no new history code); the app state records in `update`, `updateEpics`, `updateSprints`, `updateReleases` before the data are replaced. Edits of the same fields within 60 seconds are merged; items older than the log get a baseline version at start; deleting an item deletes its versions. The screens (`src/components/history/`: panel, list, comparison) turn states into text at display time, so a language switch changes the whole history; the comparison of descriptions is `src/domain/textDiff.ts`.

`rank` is one global priority (0 is the most important). The backlog shows one section per sprint in time order and then the unplanned stories, each by rank (`backlogOrder`); backlog and story map drops store exactly that order, so the ranks stay grouped by sprint. The board shows the stories of the running sprint by rank, grouped by status. A map cell shows the stories of one epic and one sprint by rank. Deleting a story can leave a gap in the ranks; a new story always gets the highest rank plus one.

Team decisions (#18, recorded in the issue): a team member is a plain entry (`members`: id, name, initials, position), not a user account, and a story has at most one assignee in the native column `stories.assignee_id` without a foreign key; the app unassigns the stories of a deleted member itself, like it does for releases. `Story.assigneeId` is optional and missing means nobody, so old data and fixtures need no change. Initials are derived, unique and at most three characters (`src/domain/members.ts`). The change log tracks the assignee as the key `assignee` only for assigned stories, so the stored versions of older items stay valid. The team is a feature toggle (`FeatureKey` `team`, switch in Settings › Team, #61): off by default, on in the demo data; the search gets no member list while it is off, and the history keeps showing assignments. The member list is part of the snapshot, thus of export and import; `migrateSnapshot` gives older data an empty team and drops assignments to unknown members.

Release planning decisions (#10, no ADR because the PO no longer reviews them; recorded here and in the issue): a release is its own table with a nullable `stories.release_id`, which enforces "at most one release per story" in the model; "Release" is a system field of stories stored in that native column, not in `field_values` (as ADR 0003 does for epic and sprint); the history for the scope report and the burndown is an append-only event log (`release_events`, entries `baseline`, `added`, `removed`, `points`, `done`, `reopened`, each with the points and done flag of the story after it) that a pure function (`scopeReport`) replays into the state of each day, because a local app does not run every day and snapshots would have gaps; an entry keeps the key of its story, so it stays readable after the story is deleted. "Done" means the status of the story is in the category `done` (`isDoneIn`).

Status value decisions (#5, recorded here and in the issue): status values are their own table `status_values` (id, label, category, position) instead of options of the Status field, because they carry a category and a translated default label that field options do not have; `stories.status` keeps holding the id, so the four former statuses stay valid as the defaults. Functions that need to know whether a story is done take an `IsDone` check built from the status values. When a status value moves to another category, `releaseEventsFor` gets the done check before and after the change and records `done` or `reopened` for the affected stories on that day, so the history is never rewritten. A story whose status no longer exists gets the start status when the data is loaded.

## Persistence

- The `Repository` interface (`src/data/repository.ts`) is the only storage boundary. It offers coarse, intention-revealing operations (`savePositions`, `updateStory`, `setCriterionText`, `saveCriteriaOrder`, `addEpic`, ...) instead of generic CRUD, so each UI action maps to one call.
- SQLite schema: tables `epics`, `sprints`, `releases`, `members` (#18), `release_events`, `change_log` (#23), `settings` (key and value), `status_values`, `stories`, `criteria` with foreign keys and indexes on `rank` and `(story_id, position)`. Schema changes are new numbered migrations in `src-tauri/migrations/`, registered in `lib.rs`. Never edit a released migration. Browser data in `localStorage` is migrated in code when it is read (`src/domain/migrate.ts`) and written back at once, so a migrated sprint keeps its dates.
- Keys are generated in the frontend (`src/domain/ids.ts`), so the UI can update before the write finishes.
- Export and import (#16): the export file is the whole `Snapshot` as indented JSON under `data`, next to `format` (`getitdone-backup`), `version` (`BACKUP_VERSION`, raised only when an older app could no longer read a file) and `exportedAt` (`src/domain/backup.ts`). It is independent of the storage, so SQLite and the browser build exchange files. Import checks the shape first (`parseBackup`), brings older data to the current shape with `migrateSnapshot`, and only then calls `Repository.replaceAll`, after the user confirmed. A file that does not fit never reaches the storage. `replaceAll` of SQLite is not one transaction (the SQL plugin has none across calls), so a failure in the middle of an import can leave partial data: the app then says so and the user imports the file again. Saving and reading files uses the web view (a download and a file field, `src/data/files.ts`), so no plugin was added.

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

## Cards and inline points (#55)

`StoryCard.tsx` builds a card from `useCardFields`: single-select card fields become letters (first letter of the option, full text as title and `sr-only`), all other card field values become chips, of which `MAX_CHIPS` (2) are shown and the rest is "+n". The same component renders the compact line (`compact` prop, set by the "Compact" toggle of `BoardPage`, stored in `localStorage` under `getitdone.boardCompact`). The story map keeps `CardFieldValues`.

`PointsEdit.tsx` edits the points of a backlog row in place. It stops pointer and key events from reaching the sortable row (no drag, no open). `parsePoints` in `domain/board.ts` decides what is valid (0 to 100, empty is 0). Shortcut hints are no longer rendered anywhere; shortcuts are announced with `aria-keyshortcuts` only.

## Theming

Colours, type scale, spacing, radii, elevation, layers, motion and icon sizes are CSS custom properties in `docs/design/tokens.css` (see "Design system" below). Epic colours are `--epic-<key>`; each reaches at least 3:1 against cards and columns in both themes and is always shown with the epic name. The theme is set with `data-theme="light|dark"` on the root element, stored locally and initialised from the system preference.

## Design system (#70, ADR 0006)

The design system has three parts. **Tokens**: `docs/design/tokens.css`, the only place for raw colours, font sizes, line heights, weights, spacings (`--space-*`, a 4 px grid with half steps), radii, shadows (`--elevation-*`), layers (`--z-*`), durations and icon sizes. Breakpoints cannot be custom properties; media queries use 640 px (small) and 760 px (medium). **Components**: `src/ui/` (`Button`, `IconButton`, `TextButton`, `TextInput`, `Textarea`, `Select`, `Check`, `Badge`, `Pill`) and the `Dialog`; they render the class names of `src/styles/app.css`. Feature specific parts (cards, chips, drag handles) are built from the tokens in `app.css`. **Catalogue**: Storybook, `*.stories.tsx` next to the code, foundations in `src/design-system/`, light and dark switch in the toolbar, reachable at `<preview>/design-system/`. How to extend it: use an existing token or component; if none fits, add the token to `tokens.css` or the component to `src/ui/` with a story in the same change. How to use it: `docs/design-system.md`.

## Error handling

Load and save errors are caught in `AppState` and shown as a translated alert with the technical message. The UI does not roll back optimistic changes yet.

## Help

The interactive help (#33) is documentation for users and grows with every feature, like this documentation. To extend it:

1. Add the topic to `TOPICS` in `src/help/topics.ts`: an id, the pages it belongs to (`pages`), `general` for topics of every page, a `show` target (a CSS selector and what to say when it is missing), and `links` to where to find the feature. Places are listed in `LINK_TARGETS`; add a new one there and its label under `help.links.<id>` in all four language files.
2. A place that only exists while a feature is switched on gets `requires: '<feature>'`. It is shown as a link while the feature is on, and as the text "switch the feature on first" otherwise. List the settings tab of the feature (`settingsReleases` or `settingsTeam`, the feature is switched on there, #61) before such places, and start the text of the topic with that step.
3. Write `help.topics.<id>` (`title`, `keywords`, `body`; lines of `body` are paragraphs) in DE, EN, FR and IT. `keywords` are extra words that find the topic (also the synonyms users type). `src/help/topics.test.ts` checks that every topic and link has its texts in all languages and that every topic is found by its own title.
4. Add a component test for new behaviour in `src/Help.test.tsx` and, for a journey across pages, in `e2e/help.spec.ts`.
5. The steps of the first steps (`TOUR_STEPS` in `src/domain/helpTour.ts`) are the PO's: no step is added or changed without the PO's approval (see `CLAUDE.md`).

## Synchronisation with an issue tracker (#30, #66, ADR 0005, ADR 0007)

The only feature that reaches out of the app. It is off by default and runs only on a button (or the automatic sync the team switched on). Exactly one service is active at a time; GitHub and Jira have a connector (Jira in the Windows app through the Rust command `http_request`, in the browser a simulated Jira, ADR 0008), GitLab is planned. Reading and writing are separate: the app only reads until the team switches on "Also write to <service>". Rules: the token never enters the snapshot, a database, `localStorage` or the settings (keychain on the desktop with one entry per service, memory of the page in the browser); the domain (`src/domain/sync.ts`) decides what a sync changes, is pure and knows no service; the network and the conventions of a service (GitHub: text, task list, labels "epic: …" and "status: …", milestones) are behind `TrackerConnector`, so tests and the preview use a fake or the simulation and a further service only needs a connector that passes `src/sync/connector.test.ts`; every failure is a `SyncError` with a kind and a translated message (`sync.errors.<kind>`) and leaves the local data unchanged. A linked story keeps its link (`Story.link`: service, key, address, state and the base of the last sync), which makes the comparison three-way: only what a side changed since then goes to the other, and a field changed on both sides follows the conflict rule. The address is the identity of the issue across syncs; the key (`#31`, `PROJ-123`) is the ID of the story on every screen (`storyKey`), while the own key (`S-4`) stays stored, is found by the search and comes back when the connection is removed.

## Testing

Tests are derived from test cases the PO approves per acceptance criterion (see `CLAUDE.md`, "Test cases"). A test name starts with the ID of its test case (`AC2.1`, or `FR-MAP-02.1` for existing requirements).

| Level | Tool | Where |
|---|---|---|
| Unit | Vitest | `src/domain/*.test.ts` |
| Component | Vitest, Testing Library, jsdom | `src/App.test.tsx`, `src/components/search/Search.test.tsx`, `src/Help.test.tsx`, `src/Github.test.tsx`, `src/GithubRoundtrip.test.tsx`, `src/Sync.test.tsx`, with `LocalStorageRepository` as test double |
| Integration (data, Tauri boundary) | – | Planned |
| End-to-end | Playwright, real Chromium, web build with demo data and a fixed clock; visual checks with `toHaveScreenshot` of new elements (baselines in `e2e/*.spec.ts-snapshots`, Chromium on Linux, tolerance 8 % because CI renders text slightly differently) | `e2e/*.spec.ts`, `npm run test:e2e` (story map since #12, help since #33, usability since #32) |
| Accessibility (axe) | – | Planned |

## Security

- The Tauri capabilities allow only the SQL commands the app needs.
- No network access at runtime except the synchronisation with the chosen service when the team switched it on (ADR 0005, ADR 0007): read, and write only when switched on, token in the keychain or in memory, never stored with the data. No telemetry, no secrets in the repository. The public preview only has a simulated GitHub.
