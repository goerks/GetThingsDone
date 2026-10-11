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

## Saving

All writes go through one promise queue in `AppState`, so a fast series of changes is stored in the order it happened. If a write fails, the UI keeps the change and shows a "saving failed" alert. There is no automatic retry yet (see [chapter 11](11-risks-and-technical-debt.md)).
