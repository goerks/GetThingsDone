# ADR 0005: Sync with external trackers (GitHub Issues first)

Status: Proposed (awaits PO approval with the pull request of #30)
Date: 2026-10-16
Issue: #30

## Context

Until now the app made no network call at runtime (arc42 chapters 3 and 8). #30 asks to import the issues of one GitHub repository as stories and to keep both sides in sync in **both directions**, with a mechanism that is general: GitHub is the first service, GitLab, Jira, Trello and others follow as further connectors. The PO decided in #30:

- The feature is off by default and works by hand only: nothing is read or written until the user presses "Sync"; no background sync.
- Writing to GitHub is a separate switch per connection, off by default (the app only reads).
- Conflicts (the same field changed on both sides since the last sync): **GitHub wins** by default; the settings also offer "Local wins" and "I decide" (a dialog shows both versions). Every sync names what it overwrote.
- A story that exists only here is published as a new issue one by one from its menu, never automatically.
- Fields that are compared: title, description, labels, the task list under the heading "Acceptance criteria" (the criteria and their ticks), done/not done (closed/open), and, added on 2026-10-17, the release (milestone), the epic (label "epic: <name>") and the board column between the first and done (label "status: <name>"). Sprint, points and rank stay local.
- The access token lives in the keychain of the operating system on the desktop and only in the memory of the page in the browser. The public preview has no real token.

Constraints from ADR 0001: the repository interface between app and storage stays; the browser build and the desktop app run the same frontend.

## Decision

### 1. One mechanism, one connector per service

- `src/domain/github.ts` holds all rules without any network: the compared fields, the text of an issue (`splitBody`, `composeBody`, `withCriteria`), and `planSync`, a pure function. Given stories, issues, the write switch, the conflict rule and the answers of the user, it returns the new stories, a summary and the list of changes to publish (`pushes`).
- `src/github/source.ts` defines `TrackerConnector`: `openIssues`, `issue`, `updateIssue` and `createIssue`, plus the list of services (`CONNECTOR_KINDS`: GitHub available, GitLab, Jira, Trello planned). The sync engine (`src/github/runSync.ts`) only talks to this interface. A new service is a new connector; it must pass the shared test series `src/github/connector.test.ts`, which already runs against the REST connector of GitHub, the simulated GitHub of the preview and the fake of the tests.
- `restSource.ts` implements GitHub through the REST API (`GET/PATCH/POST /repos/{owner}/{name}/issues`, `GET .../labels`). `demoSource.ts` simulates it for the preview and keeps its changes in `localStorage`, so both directions can be tried out.
- `AppState` calls `runSync`, writes the result through the `Repository` (`persistSync`) and keeps the token store. The request goes straight from the web view to `api.github.com` (CORS is allowed by GitHub), so the Rust side needs no HTTP client. Services that do not allow this (Jira) will need an HTTP layer through the Tauri HTTP plugin; the connector interface is cut so that this can be added later without changing the engine.

### 2. Three-way comparison with a base

- A linked story has `github: { url, state, base }`. `url` is the identity across syncs; `base` holds the compared fields as they were at the last sync (title, description, labels, criteria, done). Migration `014_github.sql` adds `stories.github_url`, `github_state` and `github_base` (JSON), all NULL for the team's own stories.
- For every field, the sync compares the story with the base and the issue with the base. Only the issue changed: the story takes it. Only the story changed: it is published (write switch on) or stays marked as "not on GitHub" and is counted as pending (switch off). Both changed to the same value: the base moves on. Both changed differently: the conflict rule decides; "I decide" leaves the field untouched until the user answers.
- After a successful publish the base takes the values GitHub returned for the published fields, so labels that GitHub does not know stay pending on the story.
- A story without a base (not expected, it is only a safety net) takes the issue as it is.
- This needs no clocks and works offline: local changes simply stay different from the base until the next sync. Compared with a change log of local changes (outbox) it needs no hook in the rest of the app.

### 3. What goes to GitHub

- Title, description, labels (only labels the repository has: the sync only creates epic and status labels (see below), other unknown ones are reported and stay on the story), the criteria as the task list under "Acceptance criteria" (the rest of the text of the issue is kept), closed/open from done/not done.
- A new issue is created from a story with title, text and criteria and labels; the story is linked to it. A deleted story is remembered by the address of its issue (`Settings.github.ignored`), so the sync does not bring it back; the issue itself stays on GitHub.
- A token that may only read gets `403` when it writes: the error `forbidden` says that it needs "Issues: read and write". What was done before the failure stays; the rest remains pending.

### 3b. Story map and board columns (added 2026-10-17)

- Release and milestone are matched by title, epic and label by the name after "epic: ", column and label by the name after "status: " (the id without underscores for the default columns, the label for own ones). No new storage is needed: the base of a story holds the three new fields next to the others. A renamed release or epic is a new one for the sync.
- A milestone or an epic label that is unknown becomes a release or an epic; the colour of an epic made from a label is chosen from its name. While writing is on, the sync makes the milestones, epic labels and status labels that a story needs, and deletes them again once no release, epic, column or linked issue needs them. Only what the app made itself (the registry `managed` in the connection settings) is ever deleted; what someone made on GitHub is never touched. While writing is off nothing is made or deleted. A story whose release or epic has no counterpart stays marked and the result names it.
- The labels "epic: …" and "status: …" are not labels of the story: they are left out of the field "Labels". A closed issue is done whatever its status label says.
- The connector has six more calls for this: `listMilestones`, `createMilestone`, `deleteMilestone`, `listLabels`, `createLabel` and `deleteLabel`; the milestone of an issue is part of `ItemPatch`.

### 4. Settings and data

- `Settings.github` holds `repo`, `lastSyncAt`, `write` (default off), `conflict` (`remote` default, `local`, `ask`) and `ignored`; the feature switch is `features.github`, **off by default**. They are rows of the existing settings table (`github_repo`, `github_last_sync`, `github_write`, `github_conflict`, `github_ignored`, `feature_github`).
- Labels are values of a custom multi select field "Labels" (id `field-github-labels`), created by the first sync. Criteria are the existing story criteria.
- The settings section is called "Connections" (route `settings/github`): it lists the services (GitHub, the others as planned), holds the connection of GitHub and the two options, and removes the connection after asking. Removing it forgets repository, token and ignored issues and unlinks the stories; the stories stay.
- The access token is never part of the snapshot, the database, `localStorage` or the settings.

### 5. Token storage and public preview

- Desktop app: the Rust commands `github_token_get`, `github_token_set` and `github_token_delete` use the `keyring` crate (3.x, MIT or Apache-2.0) with the credential store of the operating system (Windows Credential Manager). The token is only saved after GitHub accepted it ("Test connection"). The token field never shows a saved token again.
- Browser build: the token is kept in memory of the page only; a reload asks for it again.
- The browser build only has demo data today, so it gets the simulation: one repository `goerks/GetThingsDone`, which accepts any token except `falsch` (refused) and `nurlesen` (may not write). The preview never sends anything to GitHub, holds no real token, and says "Demo".

### 6. Errors

`network`, `auth` (401, 403 on reading), `forbidden` (403 on writing), `notFound`, `rateLimit`, `config` (no repository or token) and `other`; each has a clear message and the local data stays as it is.

## Consequences

- The app now makes network calls, but only when the feature is on and the user presses a button or switched on the automatic sync (see "Update 2026-10-21"). Everything else works offline.
- Local changes can reach GitHub only with the write switch on and a sync (by the button or, if switched on, by itself).
- The text of a criterion decides its identity (GitHub has no ids for tasks); renaming it on GitHub counts as a removed plus a new criterion.
- Concurrent edits between reading and writing are not detected (no ETag check): the last write wins on GitHub. Acceptable for a manual, single-user sync; an ETag check can be added in the connector.
- Further services need a connector, a form for their settings and, where the service has real workflows, a mapping of the status categories; the engine does not change.
- The Windows app needs the `keyring` crate; CI builds it on every push.
- Milestones and epics, sprints and points, label filters and background sync stay out of scope and can follow in new decisions.

## Update 2026-10-21: automatic sync and sync log (PO decision in issue #30)

- A sync ends with a short notice, never with a result dialog. Only the conflict choice (rule "I decide", sync by hand) is a dialog.
- The sync can run by itself (switch "Synchronise automatically", off by default, all issues or none): at the start and when the app comes back to the front, and every 15 minutes while it is open. There is no background run with the app closed (the app is local, there is no server). One run at a time; a run waits while the PO types or a dialog is open; after three errors in a row it pauses.
- Every run is logged in the connection settings (`github_log`: at most 100 entries of the last 90 days, runs without changes folded), so changes made without a dialog stay traceable. The switch is `github_auto`. No new table and no migration.
- Load on GitHub: one run lists the open issues (paged) plus the calls for pushes, labels and milestones; every 15 minutes stays far below the limit of 5000 requests per hour.
