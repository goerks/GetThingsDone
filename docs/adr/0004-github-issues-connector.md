# ADR 0004: GitHub Issues connector (first network access of the app)

Status: Proposed (awaits PO approval with the pull request of #30)
Date: 2026-10-15
Issue: #30

## Context

Until now the app made no network call at runtime (arc42 chapters 3 and 8). #30 asks to import the open issues of one GitHub repository as stories and to keep them up to date. The PO decided in #30:

- The feature is off by default, works by hand only (no background sync) and only reads from GitHub.
- GitHub wins on title, description, labels, the open or closed state and the task list under the heading "Acceptance criteria"; sprint, points, rank and the column of an open story stay local. Milestones and epics are not synchronised.
- The access token lives in the keychain of the operating system on the desktop and only in the memory of the page in the browser. The public preview has no real token.
- Design: variant B (switch in Settings → Features, section "GitHub" for the connection, "Synchronise" in the backlog).

Constraints from ADR 0001: the repository interface between app and storage stays; a browser build and the desktop app run the same frontend.

## Decision

### 1. Where the network code lives

- `src/domain/github.ts` holds all rules without any network: parsing `owner/name`, splitting the text of an issue into description and criteria, and `planSync`, a pure function that turns issues and the current stories into new stories, a summary of changes and the labels field. It is unit tested.
- `src/github/` holds the access: `GithubSource` (`openIssues`, `issue`), implemented by `restSource.ts` (REST API of GitHub, read only: `GET /repos/{owner}/{name}/issues` with pagination, `GET /repos/{owner}/{name}/issues/{n}`) and by `demoSource.ts` (simulation). `TokenStore` keeps the token.
- `AppState` calls source and token store, asks the domain for the plan and writes it through the `Repository` (`persistSync`).
- The request goes straight from the web view to `api.github.com` (CORS is allowed by GitHub), so the Rust side needs no HTTP client. The Tauri CSP is `null` today; it is not tightened in this change.

### 2. Data model

- A story that was imported has `github: { url, state }`: the address of its issue (the identity across syncs: repository and number) and the state the last sync saw. Migration `012_github.sql` adds `stories.github_url` and `stories.github_state` (both NULL for the team's own stories).
- `Settings.github` holds `repo` (`owner/name`) and `lastSyncAt`; the feature switch is `features.github`, which is **off by default** (unlike the other features, which are on until switched off). They are rows of the existing settings table (`github_repo`, `github_last_sync`, `feature_github`).
- Labels are values of a custom multi select field "Labels" (id `field-github-labels`), created by the first sync, so labels can be shown, searched and edited like any other field. Criteria are the existing story criteria.
- The access token is never part of the snapshot, the database, `localStorage` or the settings.

### 3. Token storage

- Desktop app: the Rust commands `github_token_get`, `github_token_set` and `github_token_delete` use the `keyring` crate (3.x, MIT or Apache-2.0) with the credential store of the operating system (Windows Credential Manager). The token is only saved after GitHub accepted it ("Test connection").
- Browser build: the token is kept in memory of the page only; a reload asks for it again. It is never written to `localStorage` or `sessionStorage`.
- The token field never shows a saved token again.

### 4. Browser build and public preview

The browser build only has demo data today, so `createGithubSource()` returns the simulation there: one repository `goerks/GetThingsDone` with a few issues (kept in `localStorage` so the settings page can change them to try a sync), which accepts any token except the text `falsch` (to show the message for a refused token). The preview never sends anything to GitHub and holds no real token. The settings page and the help say "Demo". When the browser build gets real data (ADR 0001, TD-1), the real source can be switched on there with the same token rules.

### 5. Sync rules

- Import: every open issue without a story becomes a story at the end of the backlog (status: the start status, no sprint, 0 points). Pull requests are never imported. Closed issues without a story are not imported.
- Sync: every imported story takes title, description (the text of the issue without the criteria list), labels and criteria from its issue. Criteria are matched by their text (GitHub has no ids for tasks); a changed text is a removed plus a new criterion. Ticks follow GitHub.
- State: a story whose issue is closed gets the first "done" status; a story whose issue was closed at the last sync and is open now, and that is done, goes back to the start status. A story that was finished here while its issue is still open stays done.
- Issues of imported stories that are no longer in the list of open issues are asked for one by one, so a closed issue is noticed.
- Errors are `network`, `auth` (401, 403), `notFound` (404), `rateLimit`, `config` (no repository or token) and `other`; each has a clear message and the local data stays unchanged.

## Consequences

- The app now makes network calls, but only when the feature is on and the user presses a button. Everything else works offline.
- A story deleted here comes back with the next sync as long as its issue is open.
- The text of a criterion decides its identity; renaming it on GitHub loses a local tick (GitHub wins anyway).
- Two ways to compile the Windows app now need the `keyring` crate; CI builds it on every push.
- Writing back to GitHub, other trackers, milestones and epics, sprints and points, label filters and background sync stay out of scope and can follow in new decisions.
