# 5. Building block view

## Level 1: system

```
┌──────────────────────── Get It Done ────────────────────────┐
│  Frontend (React, TypeScript)          src/                 │
│    UI ─▶ State ─▶ Domain                                    │
│              └──▶ Data (Repository) ─┬─▶ SqliteRepository ──┼─▶ Tauri shell (Rust)  src-tauri/
│                                      └─▶ LocalStorageRepo   │      └─▶ SQLite file
└─────────────────────────────────────────────────────────────┘
```

## Level 2: frontend modules

| Module | Path | Responsibility |
|---|---|---|
| Entry | `src/main.tsx`, `src/App.tsx` | Loads fonts and tokens, initialises i18n and theme, renders the shell |
| Router | `src/router.ts` | Hash routes `#/board`, `#/backlog`, `#/map`, `#/epics`, `#/settings/fields` (`#/settings` and the former `#/fields` lead there too). Stories, epics and sprints have no route; they open in dialogs over the current page |
| Pages | `src/pages/` | `BoardPage` (running sprint, drag and drop), `BacklogPage` (one section per sprint, drag and drop), `MapPage` (story map: epics × sprints, drag and drop of stories and upcoming sprints, compact switch, create dialogs), `EpicsPage` (list of epics, new-epic dialog), `SettingsPage` (list of sections, status values shown as planned) with `FieldsSection` (tabs "Assignment": field matrix with hide switches for built-in fields, field dialog with options and default value, `RenameFieldDialog` for system and built-in fields, delete with confirmation; "Layout": `FieldLayout`, order per item type by drag and drop, required, in create dialog, on card) |
| Detail dialogs | `src/state/Details.tsx`, `src/state/detailNav.ts`, `src/components/StoryDialog.tsx`, `EpicDialog.tsx`, `SprintDialog.tsx` | `DetailsProvider` keeps which item is open and renders its dialog over any page; `useDetails()` opens a story, epic or sprint, optionally with a `DetailNav` ("Result n of m") that `Dialog` shows above its content |
| Search | `src/state/Search.tsx`, `src/state/searchLabels.ts`, `src/components/search/` | `SearchProvider` keeps query, results, history and highlighting, handles `Ctrl+F` and opens results with a `DetailNav`. `SearchBox` (combobox, chips, dropdown), `FilterMenu` and `FieldMenu` (values with counts, is / is not), `ResultRow`, `Highlighted`, `HighlightBar` and `useMatchClass` (live highlighting on board, backlog, map and epics page). Pages register their visible items with `useSearchPage` |
| Components | `src/components/` | `Header`, `BoardColumn`, `StoryCard`, `EpicTag`, `EpicDialogs` (colour picker, new epic), `SprintDialog`, `SprintSelect`, `sprintFormat` (date ranges), `EpicSelect` (with "new epic"), `EditableText` (click to edit), `Dialog` (native modal dialog), `NewStoryDialog`, `StoryDialog`, `FieldControl` (edits a custom field value by data type, marks required fields), `CreateFields` (custom fields of the create dialogs with defaults and required check), `fieldLabel`, `useBuiltin` (label, visibility and points summary of system and built-in fields for every view), icons |
| Drag and drop | `src/dnd/dnd.ts` | Shared sensors (whole card, Enter left free), placement from the pointer, drop target from the resulting list |
| State | `src/state/AppState.tsx` | React context. Holds the snapshot, applies domain functions, queues writes to the repository in order, reports load and save errors |
| Domain | `src/domain/` | Types (`Epic`, `Sprint`, `Story`, `Criterion`, `Status`) and pure operations: board drop, backlog drop between sprint sections, story map drop and cells, editing and deleting stories and criteria, criteria order, new story key (`board.ts`); epics with colour palette and order (`epics.ts`); sprint dates, running sprint, map rows, new-sprint defaults (`sprints.ts`); migration of stored older data (`migrate.ts`); field library, assignments, validation and values of custom fields, renaming and hiding of built-in fields (`fields.ts`, ADR 0003); search over the snapshot: folding of case and accents, terms and phrases, filters, ranking, snippets, value counts and suggestions, ordering for the current page (`search.ts`); search history (`searchHistory.ts`) |
| Data | `src/data/` | `Repository` interface, `SqliteRepository`, `LocalStorageRepository`, `createRepository` (picks one), demo `seed` |
| i18n | `src/i18n/` | i18next set-up and the four language files |
| Theme | `src/theme.ts`, `src/styles/app.css`, `docs/design/tokens.css` | Light and dark theme via `data-theme` and CSS custom properties |

## Level 2: Tauri shell

| Part | Path | Responsibility |
|---|---|---|
| Entry | `src-tauri/src/main.rs`, `lib.rs` | Starts the window, registers the SQL plugin and the migrations |
| Migrations | `src-tauri/migrations/` | Schema of the SQLite database (`001_init.sql`), epic palette (`002_epic_palette.sql`), sprints and epic order (`003_sprints.sql`), configurable fields and optional epic (`004_custom_fields.sql`), default values of fields (`005_field_defaults.sql`), dates and multi select values (`006_more_field_types.sql`) |
| Capabilities | `src-tauri/capabilities/default.json` | Allows only the SQL commands load, select, execute and close |
| Config | `src-tauri/tauri.conf.json` | Window, bundle (NSIS, current user, four installer languages) |

## Dependency rule

`domain` depends on nothing. `state` depends on `domain` and the `Repository` interface. UI depends on `state` and `domain`. Only `createRepository` knows the concrete repositories.
