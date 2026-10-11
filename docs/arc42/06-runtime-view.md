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

1. The backlog shows the sprint above the sprint line and the other stories below it, each by rank (`backlogOrder`).
2. Rows are dragged like cards. The drop line shows the rank the story would get.
3. `dropInBacklog` places the story, sets its sprint membership from the side of the sprint line it lands on and reindexes all ranks in the shown order. The board follows because it uses the same ranks.

## Editing

Fields on the story page save on their own: text when the field is left or with Enter (Ctrl+Enter for the description), selects and the sprint checkbox on change. Escape discards a text edit. Deleting a story asks for confirmation on the page and then returns to the board.

## Saving

All writes go through one promise queue in `AppState`, so a fast series of changes is stored in the order it happened. If a write fails, the UI keeps the change and shows a "saving failed" alert. There is no automatic retry yet (see [chapter 11](11-risks-and-technical-debt.md)).
