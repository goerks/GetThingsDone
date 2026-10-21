# ADR 0006: One sync service at a time, one general mechanism

Status: Proposed (awaits PO approval with the pull request of #66, step 0)
Date: 2026-10-21
Issue: #66 (builds on #30 and ADR 0005)

## Context

ADR 0005 made the sync a general mechanism with a connector per service, but the GitHub sync that shipped with #30 still has GitHub in its names, its data and its rules: `Settings.github`, `Story.github`, the columns `stories.github_*`, the feature `github`, one keychain entry, and the conventions of GitHub (labels "epic: …" and "status: …", milestones, the task list in the text) inside the shared rules (`src/domain/github.ts`). #66 adds Jira as an alternative to GitHub, and GitLab is planned. Decisions of the PO in #66 (2026-10-21):

- **Only one service is active at a time.** The team chooses GitHub or Jira (later GitLab). Trello is dropped.
- Switching the service **disconnects** the old one: its connection and token are removed, the stories stay without link.
- Jira never deletes anything in Jira (the GitHub behaviour of AC16 in #30 stays for GitHub).
- Design 1.A: one tab "Synchronisation" with the choice of the service and the connection of the chosen one.
- **Order:** generalise the shipped sync first (this ADR, step 0), then Jira in phases, each its own pull request.
- The issue number is the ID of a linked story (`#31`, `PROJ-123`), also for GitHub. The own key (`S-4`) is kept.

## Decision

### 1. A neutral model between the engine and a service

- `src/domain/sync.ts` has the rules and knows no service. An issue is an `ExternalItem`: `id`, `key` (how people call it), `url` (its identity across syncs), `state` and `fields` (the compared fields: title, description, plain labels, criteria, release, epic, done, board column). What only the connector understands stays in `raw`.
- What the engine publishes is an `ItemPatch` in the terms of the app (title, description, criteria, labels, done, release title, epic name, column name). Only published fields are set.
- `planSync` compares stories and items against the base, field by field (ADR 0005, unchanged). Which fields are compared is a capability of the connector (`ConnectorCapabilities.fields`).

### 2. A connector per service

`TrackerConnector` (`src/sync/connector.ts`): `capabilities`, `target`, `normalize`, `open`, `item`, `idOf`, `catalog`, `lacks`, `update`, `create`, `tidy`. The connector turns its issues into items and a patch into its own calls, and makes what a change needs (GitHub: the milestone of a release, the labels of an epic and a column) before it changes an issue. `tidy` deletes what the sync made and nothing needs any more (GitHub only; `capabilities.tidy`). The engine (`src/sync/runSync.ts`) only talks to this interface. A service needs a connector that passes the series in `src/sync/connector.test.ts`, which runs against GitHub on the fake, GitHub on the simulation of the preview and a second service that looks like GitLab and nothing like GitHub (`src/test/exampleConnector.ts`).

The GitHub conventions live in `src/sync/github/format.ts` (text, task list, labels, milestones; `toItem`, `toPatch`), the calls in `src/sync/github/api.ts` (REST in `restApi.ts`, simulation in `demoApi.ts`), the connector in `src/sync/github/connector.ts`.

### 3. Data and settings

- A story has one link: `Story.link = { service, key, url, state, base }`. Stories of the team have none.
- `Settings.sync = { service, connection, lastSyncAt, write, conflict, ignored, managed, auto, log }`. `service` is the chosen service (`github` by default); `connection` holds the text values the service needs (GitHub: `repo`). The feature switch is `features.sync`.
- SQLite: migration 016 renames the columns to `sync_url`, `sync_state`, `sync_base`, adds `sync_service` and `sync_key` and fills them for existing links (GitHub, key `#<number>`), and renames the settings rows `github_*` to `sync_*` (the repository becomes `sync_connection`, `feature_github` becomes `feature_sync`). Browser storage and the export of the data read the old shape too (`migrateSnapshot`, `normalizeSettings`), and old sync logs (`number`, side `github`) are read with keys and `remote` (`normalizeLog`).
- The route `#/settings/github` stays as an alias of `#/settings/sync`.

### 4. One keychain entry per service

The Rust commands are `sync_token_get`, `sync_token_set` and `sync_token_delete`, each with the service. GitHub keeps the entry it has always had (`github-token`), so no token is lost. The browser keeps one token per service in memory. The token of one service never reaches another.

### 5. Choosing and switching the service

Settings → Synchronisation shows the services as one choice (radio group); services without a connector are planned and cannot be chosen. Choosing another service asks first (what is removed, what stays, what the first sync does) unless nothing is connected. Confirming runs `switchService`: token deleted, connection and links removed, options reset (read only, the service wins), the stories stay unchanged.

### 6. The ID of a story

`storyKey(story, syncOn)` is the key of the issue while the sync is on and the story is linked, else its own key. It is shown on the cards, in the backlog, on the story map, in the story dialog, in the search (which finds a linked story by both keys), in the history and in the dialogs. The own key stays stored; the story dialog shows it small ("Local ID S-4"). It comes back when the connection is removed. Entries of the history keep the key they had when they were written.

## Consequences

- The GitHub behaviour does not change; its tests stay (their texts and files moved).
- Jira needs a connector, a form for its connection, a mapping of its workflow to the board columns and an HTTP layer for the desktop app (Jira Cloud does not allow browser requests with a token; ADR for that comes with phase 1). The engine, the settings and the screens do not change.
- GitLab fits the same way (issues with numbers, scoped labels, milestones, a token).
- The migration touches data that has shipped; it is covered by a test that runs it on a database of the earlier version and starts the app twice.
- A story linked in another service than the chosen one cannot exist: switching removes the links.
