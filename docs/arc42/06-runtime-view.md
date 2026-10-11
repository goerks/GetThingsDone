# 6. Runtime view

## Start-up

1. `main.tsx` initialises i18n (stored language, else browser language, else English) and applies the theme (stored, else system preference).
2. `App` calls `createRepository()`: inside Tauri it opens `SqliteRepository`, the Tauri SQL plugin runs pending migrations; in a plain browser it uses `LocalStorageRepository`.
3. `AppProvider` loads the snapshot. If the database is empty, it writes the demo data from `seed.ts` and shows it.
4. While loading, a status message is shown. A load error is shown as an alert.

## Moving a card on the board

1. The user drags a card with the mouse, by touch (150 ms hold) or with the keyboard (space, arrow keys, space). dnd-kit announces each step in the current language.
2. `BoardPage` calls `drop(activeId, overId)` on the state.
3. `dropStory` in the domain computes the new list: status of the target column, position next to the target card or at the end of the column, ranks reindexed without gaps. The board order is the backlog order filtered by column.
4. The state updates the UI at once, then `changedPositions` finds the stories whose status or rank changed, and only those are saved.

## Saving

All writes go through one promise queue in `AppState`, so a fast series of changes is stored in the order it happened. If a write fails, the UI keeps the change and shows a "saving failed" alert. There is no automatic retry yet (see [chapter 11](11-risks-and-technical-debt.md)).
