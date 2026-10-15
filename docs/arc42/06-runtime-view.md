# 6. Runtime view

## Start-up

1. `main.tsx` initialises i18n (stored language, else browser language, else English) and applies the theme (stored, else system preference).
2. `App` calls `createRepository()`: inside Tauri it opens `SqliteRepository`, the Tauri SQL plugin runs pending migrations; in a plain browser it uses `LocalStorageRepository`.
3. `AppProvider` loads the snapshot. If the database is empty, it writes the demo data from `seed.ts` and shows it.
4. While loading, a status message is shown. A load error is shown as an alert.

## Moving a card on the board

1. The user drags the whole card with the mouse (after 4 px), by touch (150 ms hold) or with the keyboard (focus the card, space, arrow keys, space). Enter and double click open the story instead. dnd-kit announces each step in the current language.
2. While dragging, `BoardPage` keeps the item under the pointer and whether the pointer is in its upper or lower half (`placementOf`). It runs `dropStory` on a copy of the list and derives the target column and the card the story would land in front of (`dropTargetIn`). The column is highlighted and a line marks the position. Cards do not move during the drag, so the layout does not jump.
3. On drop, `BoardPage` calls `drop(activeId, overId, placement)` on the state. The same `dropStory` computes the new list: status of the target column, position before or after the target card or at the end of the column, ranks reindexed without gaps. The board order is the backlog order filtered by column.
3a. With the workflow on (#49), `drop` first asks `canMove` for the move from the story's status to the target status. A forbidden move changes nothing and shows the notice "stays in …"; only an allowed move continues to the Definition gates (#26). While dragging, `BoardPage` locks the columns the story may not go to (`BoardColumn` with `locked`) and the quick add of a column that is not a start disappears.
4. The state updates the UI at once, then `changedPositions` finds the stories whose status, rank or sprint membership changed, and only those are saved.

## Moving a story in the backlog

1. The backlog shows one section per sprint in time order and the unplanned stories last, each by rank (`backlogOrder`).
2. Rows are dragged like cards. The drop line shows the rank the story would get.
3. `dropInBacklog` places the story, sets its sprint from the section it lands in and reindexes all ranks in the shown order. The board follows because it uses the same ranks.

## Planning on the story map

1. `MapPage` shows the epics (by position) as columns and the running and future sprints (`mapSprints`) plus "Not planned" as rows. Each cell is a drop target with the id `cell:<epic>::<sprint>`.
2. While dragging, the page runs `dropOnMap` on a copy and derives the target cell and the card the story would land in front of. The cell, its epic header and its sprint label are highlighted; a line marks the position.
3. On drop, `dropOnMap` sets the story's epic and sprint, inserts it next to the target card (or at the end of the cell, or of its sprint when the cell is empty) and reindexes all ranks in backlog order. `changedPositions` saves status, rank, sprint and epic of the changed stories.

## Sprints

An upcoming sprint is reordered by dragging its label on the map: `moveSprint` places it before or after another upcoming sprint and recalculates the dates of all upcoming sprints (each keeps its length, start dates follow each other from the end of the running sprint). Only changed sprints are saved. A sprint is created or edited in `SprintDialog` (from the map). The dialog prefills a new sprint with `newSprintDefaults` and checks the input with `validateSprint`. The board shows the running sprint (`boardSprint`); the backlog and the map show the sprints that are not completed (`mapSprints`).

### Start and complete a sprint (#17)

A sprint is planned, running or completed. `startSprint` (`sprintLife.ts`) runs a planned sprint when none runs, optionally from today (the end moves along so the length stays), and keeps its stories and points as `startItems`. `StartSprintDialog` shows them and asks about the date only when today is not the planned start day. `summarizeSprint` compares the stories now in a running sprint with `startItems`: planned, done, not done, added, removed and changed points. `completeSprint` stores that as the `result`, sets the state to completed (and the end date to today when the user chose so) and moves the unfinished stories to the top of the target section (`moveStoriesToSprint` in `board.ts`): the next planned sprint, a new sprint created with `newSprintDefaults`, or the backlog. `CompleteSprintDialog` calls the same function on a copy to show the new sprint and the sprint that could start next, so preview and result agree. `AppState` saves the changed sprints and the moved stories through the repository in one write queue. A running sprint whose end date has passed is marked ended (`isEnded`) and stays on the board until it is completed.

## Editing

Stories, epics and sprints open in dialogs over the current page (`DetailsProvider`). Fields on the story page save on their own: text when the field is left or with Enter (Ctrl+Enter for the description), selects and the sprint checkbox on change. Escape discards a text edit. Deleting a story asks for confirmation in the dialog and then closes it.

## Searching

1. `Ctrl+F` (or a click) focuses the `SearchBox` in the header; an open detail dialog is closed first, because the page behind a modal dialog cannot take focus.
2. Every change of text or badges sets the query in `SearchProvider`. `effectiveQuery` reads typed `field:value` filters from the text with the field catalog of `useSearchLabels` (names in the UI language and English, values, free-text custom fields), merges them with the badges (a typed filter replaces the badge of its field) and leaves the free text. `search(snapshot, effective)` runs on the snapshot the app already holds in memory, so the search works the same with SQLite and localStorage and needs no storage call. Unknown fields and values are reported, not applied.
3. `SearchBox` looks at the word at the cursor: `@…`, a word that starts like a field name, or `Ctrl+Space` lists fields (`matchFields`); `field:…` lists the values of that field (`matchValues`). Taking a field writes `field:` into the text; taking a value, or a space after a complete `field:value`, moves it from the text into a badge. Without results, `relaxations` lists the filters that could be dropped.
4. `Enter` calls `openResult`: the query goes into the history and the dropdown closes. `whereShown` lists the pages that show the item and `viewFor` picks the current page if it is one of them, else the first; the hash changes if needed. `locate` waits for the item's element (`data-story-id`, `data-epic-id`, `data-sprint-id`), marks it with `data-located`, scrolls it into view and focuses it, so the dialog returns focus to it. Then `DetailsProvider` opens the item with a `DetailNav`. Previous and next open the neighbouring result in the same way; "Back to search" closes the dialog and focuses the field, which marks the result again (`returnKey`).
5. Each page registers what it shows with `useSearchPage` (board: running sprint; backlog: all stories and sprints; map: shown stories, epics and sprints; epics page: epics). Results stay in order of relevance; those on the page are only marked. While a query is active, cards and rows ask `useMatchClass` whether they match; the matches are recomputed from the current snapshot, so moving or editing a story updates the highlighting at once. `Ctrl+Enter` closes the list and scrolls to the first match.
6. The history (last 5 searches and opened items) is written to the webview's `localStorage` on every change. `DetailsProvider` exposes the open item, so items opened from anywhere are remembered.

## Help and first steps (#33)

1. `?` (or the header button) calls `toggleHelp`; `HelpPanel` is rendered next to the page, the app gets the class `app--help` and the main area makes room.
2. The home view lists `TOPICS` for the current route (`pages`), then the general ones. Typing calls `searchHelp` on the entries of the current language (`useHelpEntries`); the result is ranked by title, keywords, text.
3. "Show me" looks up the selector of the topic and sets `data-help-highlight` on the first match; a capture listener removes it on the next pointer, key or `hashchange`.
4. `startTour` sets `tourStarted`. `AppState` calls its activity listeners after a drop that changes a story's status (`moved`), `createStory` (`created`) and a backlog drop (`ordered`); `HelpProvider` passes them to `noteActivity`, which ticks off the matching step only when the tour is started and always ends the invitation.
5. Every change of `HelpState` is written to `localStorage` (`getitdone.help`).

## Saving

All writes go through one promise queue in `AppState`, so a fast series of changes is stored in the order it happened. If a write fails, the UI keeps the change and shows a "saving failed" alert. There is no automatic retry yet (see [chapter 11](11-risks-and-technical-debt.md)).

## Releases

`ReleasesPage` lists the releases in `sortReleases` order with `releaseStats` and the derived `releaseState`. A release is created in `NewReleaseDialog` (checked by `validateRelease`; opened by the last card or by Ctrl+N through `useNewShortcut`, which ignores the key while a dialog is open) and edited in `ReleaseDialog`, which saves each change at once through `updateRelease`. A story gets or loses its release through `updateStory({ releaseId })`; the repository stores it in `stories.release_id`. Ctrl+N: every page that creates something registers its create action with `useNewShortcut` (board, backlog, story map: a story; epics: an epic; releases: a release); the hook ignores the key while a dialog is open. `deleteRelease` clears the release of the stories in memory, and the repository does the same in storage before it removes the row.

## Story map with releases as rows

`MapPage` reads `settings.mapRows`. In `releases` mode the rows are the releases that are not done (`sortReleases`) plus "No release", each cell has the id `rcell:<epic>::<release>`, and a drop runs `dropOnReleaseMap`: the story takes the epic and the release of the target and keeps its sprint, so the ranks stay grouped by sprint (`backlogOrder`). `changedPositions` saves the release together with status, rank, sprint and epic. The setting is chosen in `MapSection` (`#/settings/map`), saved at once through `setMapRows` and `saveSettings`; the map head links there. the feature toggle `settings.features.releases` (`featureOn`, `useFeature`, `FeaturesSection` at `#/settings/features`, `setFeature`) switches releases off: `effectiveMapRows` then gives `sprints`, the header hides the link, `App` redirects `#/releases` to the board, and the story dialog, the create dialog and the cards skip the release field. The story map settings and the map page warn that releases are unavailable. Only the view changes; releases, assignments and history are kept.

## History and scope report

Every change of the stories goes through one function in `AppProvider` (`update`). It compares the stories before and after with `releaseEventsFor` and appends the entries (joined or left a release, points, done or reopened) to the history in memory and, through the queue, to the repository (`addReleaseEvents`). When the app loads, `baselineEvents` records the stories of every release that has stories but no history, so the history of an old release starts at its first record. `ScopeReport` calls `scopeReport(release, events, today)`: it replays the entries of the release in order, day by day, to the scope and the done amount of each day; the start is the state on the start day (or on the first day of the history), later added or removed stories and changes of points are the increase and the decrease. Deleting a release deletes its entries (`deleteRelease`).

## Burndown

`BurndownReport` calls `burndownReport(release, events, today)`. It takes the days of `scopeReport` (scope and done per calendar day up to today), subtracts done from scope to get what is left, and extends the days to the end date when that is later than today (those days have no value). With a start and an end date it adds the target line: linear from what was left on the start day (or on the first recorded day when the history starts later) to nothing on the end day, in both units. The difference between what is left today and the line today is shown as behind or ahead. The chart is drawn like the scope chart, with the same units, markers for the changes of the scope and a table for screen readers.

## Velocity (#24)

Completing a sprint (#17) stores its result in the sprint (`result`: planned at the start, done, added). `VelocityButton` and `SprintPlan` read the sprints from the app state and call `velocityRows` (completed sprints with a result, in time order, with the share done of planned), `averageVelocity` (the done points of the last three rows, rounded to whole points, with the number of sprints it covers) and `chartRows` (the last 8 rows, 8 more per "Older sprints"). No new data is stored: the chart is computed from the results of the sprints, so it works the same in the browser build and in the desktop app. The chart is hand-drawn SVG like the release reports; each sprint is a focusable group that shows its details on hover or focus. The chart and the table are shown together in a window under the button in the head of the board; it is not modal, closes with Esc, its close button or a click next to it, and nothing about it is remembered. The demo data has no completed sprint; in the preview the acceptance panel loads test data with completed sprints (`acceptance/presets.ts`, `applyPreset` replaces the snapshot in `localStorage` and reloads).

## Change the status of a story across a Definition list (#26)

1. A change of status comes from the board (`drop`), the context menu (`changeStory`) or the story dialog (`updateStory`). Each first calls `gate`, which asks `gatesToAsk` which lists the change crosses (`gatesCrossed`: leaving "not started" is Ready, entering "done" is Done) and whether they are in use and not met.
2. If there is such a list, the change waits in `pending`; `AppApi.transition` shows it and `TransitionDialog` (rendered by the shell) asks. The checkboxes in the dialog call `setCheck`, the same call as in the story dialog.
3. "Move" (all items resolved) and the deliberate override ("Override the gate…", then "Override and move", a second step with the items that stay open) call `resolveTransition('move')`, which runs the held change again with the gate bypassed; "Cancel", Escape and "Open story" drop it. The override is a quality-gate exception: a later story logs it.
4. `update` gives a story that enters "done" its `doneItems` (`withDoneSnapshots`) and saves changed checks through `saveStoryChecks`.

## Change the status values (#5)

1. `StatusValuesSection` turns a drop (or Alt+Arrow up/down in a name field) into a new order with categories (`moveStatus`, `stepStatus`) and checks it with `reorderStatuses`: categories in their fixed order, "not started" and "done" not empty. An invalid order is refused with a message.
2. If stories change between open and done (`storiesChangingDone`), a confirmation names them; otherwise the order is applied at once.
3. `reorderStatuses` on the state calls `update(stories, statuses)`, which compares the done check before and after and appends `done` or `reopened` entries for stories in releases, then saves the status values (`saveStatuses`).
4. Removing a status value with stories moves them to the chosen target (`removeStatus`); the state saves the changed stories first (`savePositions`) and then the status values, so no story is left with a status that is gone.

