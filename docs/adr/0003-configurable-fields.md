# ADR 0003: Configurable fields data model

Status: Accepted (PO approval in #4 and pull request #6, 2026-10-11)
Date: 2026-10-11
Issue: #4

## Context

Every field of epics and stories is hard-coded today (`Story`: title, description, epic, points, status, sprint, rank, criteria; `Epic`: name, colour). Teams want to decide which fields their items have. Only a few fields stay mandatory; they cannot be removed but can be renamed. The same mechanism must later serve sprints (#2) and releases without a second implementation.

Constraints from ADR 0001: SQLite in the desktop app, a browser build with a different storage backend, and a repository interface between the app and storage. Sync and tracker connectors come later and build on the same data.

The PO decided the following in #4 on 2026-10-11:

- A story does not need an epic.
- Points is an optional built-in field, visible by default.
- A renamed field has one label for all languages.
- Fields live in one library shared by all item types.
- Values are stored in a typed value table; epics, stories, sprints and releases keep their own tables.
- Configurable status values are a separate feature (#5).

## Decision

### 1. Concepts

| Concept | Meaning |
|---|---|
| **Item type** | A kind of item that can carry fields, identified by a fixed key: `epic`, `story`; later `sprint`, `release`. |
| **Field definition** | One entry in the workspace's field library: data type, label, type-specific settings. |
| **Field assignment** | Links a field definition to an item type, with position, required, hidden, shown on card, shown in the create dialog. |
| **Field value** | The value of one field for one item. |

Every field definition has a **kind**:

| Kind | Examples | Can be deleted | Can be unassigned or hidden | Can be renamed | Data type fixed |
|---|---|---|---|---|---|
| `system` | Key, Title (all types), Status (story) | No | No | Yes (except Key) | Yes |
| `builtin` | Description, Points, Epic, Acceptance criteria (story); Colour (epic) | No | Yes (hidden) | Yes | Yes |
| `custom` | Anything a team creates | Yes | Yes | Yes | Only lossless conversions |

Rank and sprint membership are positions on the backlog, board and story map. They are not fields and do not appear in the field library.

### 2. Storage (SQLite, migration `004_custom_fields.sql`)

System and built-in fields keep their **native columns** (`stories.title`, `stories.points`, `stories.epic_id`, the `criteria` table, ...). The app's logic (board, backlog, sprint summary) keeps reading them directly. Their field definitions only carry the label, order and visibility.

Custom field values go into a **typed value table**:

```sql
CREATE TABLE field_definitions (
    id          TEXT PRIMARY KEY,
    builtin_key TEXT UNIQUE,          -- 'title', 'status', 'points', ... ; NULL for custom fields
    kind        TEXT NOT NULL,        -- 'system' | 'builtin' | 'custom'
    data_type   TEXT NOT NULL,        -- 'text' | 'long_text' | 'number' | 'single_select' | ...
    label       TEXT                  -- NULL = translated default label (system and built-in only)
);

CREATE TABLE field_options (
    id        TEXT PRIMARY KEY,
    field_id  TEXT NOT NULL REFERENCES field_definitions (id) ON DELETE CASCADE,
    label     TEXT NOT NULL,
    color_key TEXT NOT NULL,
    position  INTEGER NOT NULL
);

CREATE TABLE field_assignments (
    item_type TEXT NOT NULL,          -- 'epic' | 'story' | later 'sprint' | 'release'
    field_id  TEXT NOT NULL REFERENCES field_definitions (id) ON DELETE CASCADE,
    position  INTEGER NOT NULL,
    required  INTEGER NOT NULL DEFAULT 0,
    hidden    INTEGER NOT NULL DEFAULT 0,
    on_card   INTEGER NOT NULL DEFAULT 0,
    in_create INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (item_type, field_id)
);

CREATE TABLE field_values (
    item_id      TEXT NOT NULL,       -- id of an epic, story, ... (ids are unique across tables)
    field_id     TEXT NOT NULL REFERENCES field_definitions (id) ON DELETE CASCADE,
    text_value   TEXT,
    number_value REAL,
    option_id    TEXT REFERENCES field_options (id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, field_id)
);
```

Later data types extend this shape with their own migration: a `date_value` column for dates, a `field_value_options (item_id, field_id, option_id)` table for multi select, and a `settings` column on `field_definitions` for defaults and limits.

The same migration makes `stories.epic_id` nullable. SQLite needs a table rebuild for that; the migration copies `stories` and `criteria`, drops `criteria` first and recreates both, because dropping `stories` while `criteria` references it would delete every criterion through `ON DELETE CASCADE`. The rebuild also drops `stories.in_sprint`, which migration 003 replaced by `sprint_id`.

System and built-in field definitions and their assignments are **not** created by the migration. Both repositories add the missing ones on load (`missingBuiltins` in `src/domain/fields.ts`), so a later release can add a built-in field without a migration.

Rules:

- **Unassigning** a field deletes the assignment only. Values stay and come back when the field is assigned again.
- **Deleting** a custom field cascades to its options, assignments and values.
- **Deleting an item** deletes its values in the same transaction. There is no foreign key from `field_values` to the item tables, because one value table serves all item types.
- A **select value** stores the option id, so renaming an option keeps every value. Removing an option deletes the values that use it.
- A **new item type** (sprint, release) needs new assignment rows only, no schema change.

### 3. Labels

A system or built-in field with `label = NULL` shows its translated default label (DE, EN, FR, IT). Renaming stores one label shown in every language. "Reset to default" sets it back to `NULL`. Custom fields always have a label. Per-language labels can be added later as a separate table without changing this model.

### 4. Repository and domain

- The `Repository` interface gets methods to load and change field definitions, options, assignments and values. Both backends implement them.
- `Snapshot` gains the field library and assignments. Each epic and story carries its custom values as a map from field id to value.
- Validation (required fields, number range, allowed type conversions) is a set of pure domain functions with unit tests, used by both backends and the UI.
- The browser build (currently `localStorage`, see TD-1) stores the same structures in its snapshot and migrates older snapshots on load.

## Consequences

- Board, backlog and sprint logic do not change for system and built-in fields; only their labels and visibility become configurable.
- Custom values are typed, can be indexed, sorted and filtered later, and are changed one field at a time. This suits a later sync and tracker connectors.
- Reading an item needs one more query (or join) for its custom values. At small-team scale this is not noticeable.
- Integrity between `field_values.item_id` and the item tables is the repository's job and needs tests (closes part of TD-3).
- Making `stories.epic_id` nullable touches every view that shows the epic of a story; the story map gets a "No epic" column.

## Alternatives considered

- **One column per custom field (`ALTER TABLE` at runtime):** rejected. Rename, delete and type changes become schema migrations, which is fragile and hard to sync.
- **One JSON column per item:** simpler to build, but untyped, harder to sort and filter, and every change rewrites the whole object, which conflicts more easily with a later sync.
- **Fields per item type instead of a shared library:** "Priority" on epics and on stories would be two unrelated fields, which blocks common filters and reports.
- **One generic `items` table for all item types:** prepares configurable hierarchy levels, but is a large migration of working code with little benefit now. To be reconsidered with the hierarchy feature.
- **Moving system and built-in values into the value table too:** fully uniform, but every board and backlog query would need joins and the existing logic would have to be rewritten. Not worth it now.
