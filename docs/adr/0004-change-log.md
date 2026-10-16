# ADR 0004: Change log of the items (versions)

Status: Proposed (PO go in #23, 2026-10-16; reviewed in the pull request)
Date: 2026-10-16
Issue: [#23](https://github.com/goerks/getthingsdone/issues/23)

## Context

The PO wants to see what changed on an item and when, and to compare two versions side by side ("Current" against "V6"). The history must work for stories, epics, sprints and releases, and for the custom item types that the configurable hierarchy (#29) will bring, without new history code per type. Descriptions are stored in full so the comparison can show the text. One save of an item is one version.

Constraints: the repository interface of ADR 0001 hides SQLite and the browser storage; items live in separate tables (ADR 0003: values are keyed by item id, ids are unique across tables); the app has no login yet (who changed something is out of scope until #18); the history is part of the export file (#16).

## Decision

### 1. A version is a state, not a list of field changes

A **version** holds the whole tracked state of one item after a save, as raw values (ids, no translated text). What a version changed is worked out by comparing it with the version before it. This makes the comparison of any two versions a comparison of two states, and the text follows the chosen language at display time.

```ts
interface ChangeVersion {
  id; at /* ISO, UTC */; itemType /* 'story' | 'epic' | 'sprint' | 'release' | a custom type key */;
  itemId; version /* 1, 2, … */; origin /* 'created' | 'baseline' | 'changed' */;
  keys /* what this version changed */; state /* key → value */
}
```

A state is a map from a key (a built-in key such as `title`, or `field:<id>` for a custom field) to a value: text, number, flag, ids of options, a reference `{ id, label }` (the label is the name at that time, so a deleted epic stays readable), or a list of entries (acceptance criteria, stories of a sprint).

### 2. One generic mechanism, one adapter per item type

`src/domain/changeLog.ts` knows no item type. `recordStates(log, before, after, at, newId)` takes the states of all items before and after a change and returns the writes: a new item gets version 1 (`created`), a changed one gets the next version, a deleted one loses its versions. `statesOf(world)` is the adapter for stories, epics, sprints and releases (custom fields are added from `values` for every type). A new item type only adds its adapter; the log, the comparison and the screens are the same. An automated test records and compares a made-up item type.

What counts as a change is decided by the state: rank, the Definition checks and the order of criteria are not part of it, so pure reordering records nothing. A sprint's state lists its stories, so a story joining or leaving also writes a version of the sprint.

### 3. Rules of recording

- Recording happens in one place, the setters of the app state (`update`, `updateEpics`, `updateSprints`, `updateReleases`, release deletion), before the data are replaced. Completing a sprint records the sprint and its moved stories together.
- Edits of the same fields within 60 seconds of the last save replace that version (merged); if they end where the version before it was, the version is dropped.
- Items older than the log get a `baseline` version when the app loads and after an import; their history shows "No changes yet" until the first change. Nothing is invented retroactively.
- Deleting an item deletes its versions. Versions of items that are not in the data (after an import) are dropped.

### 4. Storage (migration `013_change_log.sql`)

```sql
CREATE TABLE change_log (
    id TEXT PRIMARY KEY, at TEXT NOT NULL, item_type TEXT NOT NULL, item_id TEXT NOT NULL,
    version INTEGER NOT NULL, origin TEXT NOT NULL, keys TEXT NOT NULL, state TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_change_log_item ON change_log (item_type, item_id, version);
```

`keys` and `state` are JSON. There is no foreign key: the item types are separate tables, and the app deletes the versions of a deleted item itself. The repository gets one method, `applyChangeLog({ upsert, remove })`; the web build keeps the versions in the snapshot in `localStorage`. `Snapshot.changeLog` makes the history part of the export file; older files without it import with an empty log, so `BACKUP_VERSION` stays 1.

## Consequences

- Storing the whole state per version costs space (a description is stored once per version that changed anything). For teams of up to ten people this is small; there is no limit and no clean-up for now.
- A change of the tracked fields of the field library (a deleted custom field) shows up as a change of the values it held; a field that is gone is shown as "Removed field".
- Restoring an old version is not possible by design (out of scope in #23); the states would allow it later.
- Who made a change can be added to the version when team members exist (#18) without changing the model.

## Alternatives considered

- **One row per field change (old and new value).** Smaller, but the state at any version has to be rebuilt by replaying, and comparing two arbitrary versions gets complicated; rejected.
- **Typed columns like `field_values`.** The state of an item has lists and references; JSON is simpler, and nothing queries inside it.
- **A trigger in SQLite.** Would not work in the browser build and would hide the rules from the tests.
