# 8. Crosscutting concepts

## Domain model

```
Epic   1 ──── * Story 1 ──── * Criterion
Sprint 1 ──── * Story          (a story has one sprint or none)
Release 1 ─── * Story          (a story has one release or none)
```

- **Epic**: id, name, colour key from a palette of eight (`blue`, `amber`, `teal`, `violet`, `rose`, `green`, `cyan`, `slate`), position (column order on the story map). An epic that still has stories cannot be deleted.
- **Sprint**: id, name, start date, end date (local calendar days `YYYY-MM-DD`, both included). The running sprint is computed from today's date (`runningSprint`).
- **Release** (#10): id, title, description, optional start and end day. Its size is derived from its stories; its state (planned, running, done) is derived too (`releaseState`), never stored. Deleting a release keeps its stories (`deleteRelease`).
- **Story**: id, key (`S-<n>`), title, description, epic, points (1, 2, 3, 5, 8, 13), status (`todo`, `in_progress`, `review`, `done`), sprint (one or none), release (one or none), rank.
- **Criterion**: id, text, done, position within the story.

`rank` is one global priority (0 is the most important). The backlog shows one section per sprint in time order and then the unplanned stories, each by rank (`backlogOrder`); backlog and story map drops store exactly that order, so the ranks stay grouped by sprint. The board shows the stories of the running sprint by rank, grouped by status. A map cell shows the stories of one epic and one sprint by rank. Deleting a story can leave a gap in the ranks; a new story always gets the highest rank plus one.

Release planning decisions (#10, no ADR because the PO no longer reviews them; recorded here and in the issue): a release is its own table with a nullable `stories.release_id`, which enforces "at most one release per story" in the model; "Release" is a system field of stories stored in that native column, not in `field_values` (as ADR 0003 does for epic and sprint); the history for the scope report and the burndown will be an append-only event log computed into states by a pure function (phase 3), because a local app does not run every day and snapshots would have gaps. "Done" is `status === 'done'` until configurable statuses (#5) define a done category.

## Persistence

- The `Repository` interface (`src/data/repository.ts`) is the only storage boundary. It offers coarse, intention-revealing operations (`savePositions`, `updateStory`, `setCriterionText`, `saveCriteriaOrder`, `addEpic`, ...) instead of generic CRUD, so each UI action maps to one call.
- SQLite schema: tables `epics`, `sprints`, `releases`, `settings` (key and value), `stories`, `criteria` with foreign keys and indexes on `rank` and `(story_id, position)`. Schema changes are new numbered migrations in `src-tauri/migrations/`, registered in `lib.rs`. Never edit a released migration. Browser data in `localStorage` is migrated in code when it is read (`src/domain/migrate.ts`) and written back at once, so a migrated sprint keeps its dates.
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

## Theming

Colours, spacing and radii are CSS custom properties in `docs/design/tokens.css`. Epic colours are `--epic-<key>`; each reaches at least 3:1 against cards and columns in both themes and is always shown with the epic name. The theme is set with `data-theme="light|dark"` on the root element, stored locally and initialised from the system preference.

## Error handling

Load and save errors are caught in `AppState` and shown as a translated alert with the technical message. The UI does not roll back optimistic changes yet.

## Testing

| Level | Tool | Where |
|---|---|---|
| Unit | Vitest | `src/domain/*.test.ts` |
| Component | Vitest, Testing Library, jsdom | `src/App.test.tsx`, `src/components/search/Search.test.tsx`, with `LocalStorageRepository` as test double |
| Integration (data, Tauri boundary) | – | Planned |
| UI and accessibility (axe) | – | Planned |

## Security

- The Tauri capabilities allow only the SQL commands the app needs.
- No network access at runtime, no telemetry, no secrets in the repository.
