# 8. Crosscutting concepts

## Domain model

```
Epic 1 ──── * Story 1 ──── * Criterion
```

- **Epic**: id, name, colour key from a palette of eight (`blue`, `amber`, `teal`, `violet`, `rose`, `green`, `cyan`, `slate`). An epic that still has stories cannot be deleted.
- **Story**: id, key (`S-<n>`), title, description, epic, points (1, 2, 3, 5, 8, 13), status (`todo`, `in_progress`, `review`, `done`), sprint membership, rank.
- **Criterion**: id, text, done, position within the story.

`rank` is one global priority (0 is the most important). The backlog shows the sprint stories first and then the others, each by rank; a backlog drop stores exactly that order. The board shows the stories in the sprint by rank, grouped by status. Deleting a story can leave a gap in the ranks; a new story always gets the highest rank plus one.

## Persistence

- The `Repository` interface (`src/data/repository.ts`) is the only storage boundary. It offers coarse, intention-revealing operations (`savePositions`, `updateStory`, `setCriterionText`, `saveCriteriaOrder`, `addEpic`, ...) instead of generic CRUD, so each UI action maps to one call.
- SQLite schema: tables `epics`, `stories`, `criteria` with foreign keys and indexes on `rank` and `(story_id, position)`. Schema changes are new numbered migrations in `src-tauri/migrations/`, registered in `lib.rs`. Never edit a released migration.
- Keys are generated in the frontend (`src/domain/ids.ts`), so the UI can update before the write finishes.

## Internationalisation

- All user-facing text comes from `src/i18n/<lang>.json`. Every key exists in all four languages.
- Language detection: stored choice, else browser language, else English. The `lang` attribute of the document follows the choice.
- Screen reader announcements for drag and drop are translated too.

## Accessibility

- Real `button`, `a` and form controls, each at least 44 by 44 px, with a visible focus ring.
- Board cards and backlog rows are dragged as a whole. Each is one keyboard stop (`role="group"` with a translated role description): space picks it up, arrow keys move it, space drops it, Escape cancels, Enter opens the story. The title link is kept for the mouse but taken out of the tab order, so there is no nested interactive element.
- The drop target is shown by a highlighted column or section and a line at the exact position (in the backlog with the future rank). The same domain function computes the preview and the drop.
- Criteria rows contain a checkbox and editable text, so they are dragged by a handle button.
- Text is edited in place: a button shows the text, a click turns it into a field. Focus returns to the button after Enter or Escape.
- Colour never carries meaning alone: epic names, status names and criteria counts are written out.
- Status changes such as "all criteria accepted" are announced through live regions.

## Theming

Colours, spacing and radii are CSS custom properties in `docs/design/tokens.css`. Epic colours are `--epic-<key>`; each reaches at least 3:1 against cards and columns in both themes and is always shown with the epic name. The theme is set with `data-theme="light|dark"` on the root element, stored locally and initialised from the system preference.

## Error handling

Load and save errors are caught in `AppState` and shown as a translated alert with the technical message. The UI does not roll back optimistic changes yet.

## Testing

| Level | Tool | Where |
|---|---|---|
| Unit | Vitest | `src/domain/*.test.ts` |
| Component | Vitest, Testing Library, jsdom | `src/App.test.tsx`, with `LocalStorageRepository` as test double |
| Integration (data, Tauri boundary) | – | Planned |
| UI and accessibility (axe) | – | Planned |

## Security

- The Tauri capabilities allow only the SQL commands the app needs.
- No network access at runtime, no telemetry, no secrets in the repository.
