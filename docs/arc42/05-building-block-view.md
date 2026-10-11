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
| Router | `src/router.ts` | Hash routes `#/board`, `#/backlog`, `#/epics`, `#/story/<id>` |
| Pages | `src/pages/` | `BoardPage` (drag and drop), `BacklogPage` (drag and drop, sprint line), `StoryPage` (edit story and criteria, delete), `EpicsPage` (create, rename, recolour, delete epics) |
| Components | `src/components/` | `Header`, `BoardColumn`, `StoryCard`, `NewStoryForm`, `EpicTag`, `EpicSelect` (with "new epic"), `EditableText` (click to edit), icons |
| Drag and drop | `src/dnd/dnd.ts` | Shared sensors (whole card, Enter left free), placement from the pointer, drop target from the resulting list |
| State | `src/state/AppState.tsx` | React context. Holds the snapshot, applies domain functions, queues writes to the repository in order, reports load and save errors |
| Domain | `src/domain/` | Types (`Epic`, `Story`, `Criterion`, `Status`) and pure operations: board drop, backlog drop across the sprint line, editing and deleting stories and criteria, criteria order, new story key (`board.ts`); epics with colour palette (`epics.ts`) |
| Data | `src/data/` | `Repository` interface, `SqliteRepository`, `LocalStorageRepository`, `createRepository` (picks one), demo `seed` |
| i18n | `src/i18n/` | i18next set-up and the four language files |
| Theme | `src/theme.ts`, `src/styles/app.css`, `docs/design/tokens.css` | Light and dark theme via `data-theme` and CSS custom properties |

## Level 2: Tauri shell

| Part | Path | Responsibility |
|---|---|---|
| Entry | `src-tauri/src/main.rs`, `lib.rs` | Starts the window, registers the SQL plugin and the migrations |
| Migrations | `src-tauri/migrations/` | Schema of the SQLite database (`001_init.sql`), epic palette (`002_epic_palette.sql`) |
| Capabilities | `src-tauri/capabilities/default.json` | Allows only the SQL commands load, select, execute and close |
| Config | `src-tauri/tauri.conf.json` | Window, bundle (NSIS, current user, four installer languages) |

## Dependency rule

`domain` depends on nothing. `state` depends on `domain` and the `Repository` interface. UI depends on `state` and `domain`. Only `createRepository` knows the concrete repositories.
