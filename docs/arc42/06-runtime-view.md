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

An upcoming sprint is reordered by dragging its label on the map: `moveSprint` places it before or after another upcoming sprint and recalculates the dates of all upcoming sprints (each keeps its length, start dates follow each other from the end of the running sprint). Only changed sprints are saved. A sprint is created or edited in `SprintDialog` (from the map). The dialog prefills a new sprint with `newSprintDefaults` and checks the input with `validateSprint`. The board, the backlog and the map compute the running sprint and the visible sprints from today's date on every render, so a new day needs no stored state.

## Editing

Stories, epics and sprints open in dialogs over the current page (`DetailsProvider`). Fields on the story page save on their own: text when the field is left or with Enter (Ctrl+Enter for the description), selects and the sprint checkbox on change. Escape discards a text edit. Deleting a story asks for confirmation in the dialog and then closes it.

## Searching

1. `Ctrl+F` (or a click) focuses the `SearchBox` in the header; an open detail dialog is closed first, because the page behind a modal dialog cannot take focus.
2. Every change of text or badges sets the query in `SearchProvider`. `effectiveQuery` reads typed `field:value` filters from the text with the field catalog of `useSearchLabels` (names in the UI language and English, values, free-text custom fields), merges them with the badges (a typed filter replaces the badge of its field) and leaves the free text. `search(snapshot, effective)` runs on the snapshot the app already holds in memory, so the search works the same with SQLite and localStorage and needs no storage call. Unknown fields and values are reported, not applied.
3. `SearchBox` looks at the word at the cursor: `@…`, a word that starts like a field name, or `Ctrl+Space` lists fields (`matchFields`); `field:…` lists the values of that field (`matchValues`). Taking a field writes `field:` into the text; taking a value, or a space after a complete `field:value`, moves it from the text into a badge. Without results, `relaxations` lists the filters that could be dropped.
4. `Enter` calls `openResult`: the query goes into the history and the dropdown closes. `whereShown` lists the pages that show the item and `viewFor` picks the current page if it is one of them, else the first; the hash changes if needed. `locate` waits for the item's element (`data-story-id`, `data-epic-id`, `data-sprint-id`), marks it with `data-located`, scrolls it into view and focuses it, so the dialog returns focus to it. Then `DetailsProvider` opens the item with a `DetailNav`. Previous and next open the neighbouring result in the same way; "Back to search" closes the dialog and focuses the field, which marks the result again (`returnKey`).
5. Each page registers what it shows with `useSearchPage` (board: running sprint; backlog: all stories and sprints; map: shown stories, epics and sprints; epics page: epics). Results stay in order of relevance; those on the page are only marked. While a query is active, cards and rows ask `useMatchClass` whether they match; the matches are recomputed from the current snapshot, so moving or editing a story updates the highlighting at once. `Ctrl+Enter` closes the list and scrolls to the first match.
6. The history (last 5 searches and opened items) is written to the webview's `localStorage` on every change. `DetailsProvider` exposes the open item, so items opened from anywhere are remembered.

## Saving

All writes go through one promise queue in `AppState`, so a fast series of changes is stored in the order it happened. If a write fails, the UI keeps the change and shows a "saving failed" alert. There is no automatic retry yet (see [chapter 11](11-risks-and-technical-debt.md)).

## Releases

`ReleasesPage` lists the releases in `sortReleases` order with `releaseStats` and the derived `releaseState`. A release is created in `NewReleaseDialog` (checked by `validateRelease`; opened by the last card or by Ctrl+N through `useNewShortcut`, which ignores the key while a dialog is open) and edited in `ReleaseDialog`, which saves each change at once through `updateRelease`. A story gets or loses its release through `updateStory({ releaseId })`; the repository stores it in `stories.release_id`. Ctrl+N: every page that creates something registers its create action with `useNewShortcut` (board, backlog, story map: a story; epics: an epic; releases: a release); the hook ignores the key while a dialog is open. `deleteRelease` clears the release of the stories in memory, and the repository does the same in storage before it removes the row.

## Story map with releases as rows

`MapPage` reads `settings.mapRows`. In `releases` mode the rows are the releases that are not done (`sortReleases`) plus "No release", each cell has the id `rcell:<epic>::<release>`, and a drop runs `dropOnReleaseMap`: the story takes the epic and the release of the target and keeps its sprint, so the ranks stay grouped by sprint (`backlogOrder`). `changedPositions` saves the release together with status, rank, sprint and epic. The setting is chosen in `MapSection` (`#/settings/map`), saved at once through `setMapRows` and `saveSettings`; the map head links there.
