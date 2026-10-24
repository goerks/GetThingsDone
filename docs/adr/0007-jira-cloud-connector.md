# ADR 0007: Jira Cloud connector and the HTTP layer of the desktop app

Status: Proposed (awaits PO approval with the pull request of #66)
Date: 2026-10-21
Issue: #66 (builds on ADR 0005 and ADR 0006)

## Context

Jira is the second service of the sync (#66, phase 1). It differs from GitHub in four ways that matter for the design: the text is a document in the Atlassian Document Format (ADF), not Markdown; the status is a step of a workflow (a transition), not "open or closed"; Jira Cloud does not answer a browser that sends an API token (no CORS), so a real sync cannot run in the web build; and epics, sub-tasks, versions and sprints are issues or objects of their own.

## Decision

1. **Jira Cloud only, API token login.** Site (`https://<name>.atlassian.net`), e-mail address and API token (Basic authentication), one project key, an optional JQL filter. OAuth and Jira Data Center are not part of this phase. The connection is stored in `Settings.sync.connection` (`site`, `email`, `project`, `filter`, optional `statusMap`); the token is the keychain entry `jira-token` (ADR 0006).
2. **The HTTP calls go through the Rust side.** A command `http_request` (`reqwest`, system TLS) sends one request and returns status, headers and body; a 4xx or 5xx answer is an answer, not an error. It only allows `https` to `*.atlassian.net` and `api.atlassian.com`, never follows redirects and times out after 30 seconds, so it cannot be used to reach anything else. The web build and the public preview use a **simulated Jira** (`src/sync/jira/simulation.ts`, issues in `localStorage`, marked "Demo") that speaks the same REST calls, so the connector runs unchanged and its tests need no real Jira. The connector only knows a `JiraTransport` (a function from request to response).
3. **ADF is converted, never guessed.** `src/sync/jira/adf.ts` reads an ADF document into description text and criteria (the task list under the heading "Acceptance criteria", as on GitHub) and writes them back. A document with anything the app cannot show (tables, images, panels, marks such as bold or links, mentions) is **lossy**: it is read, but its description is never written; a change of the criteria only replaces the task list and keeps every other node.
4. **The status is a transition.** The connector reads the status category (new, in progress, done): done is `done`, "in progress" categories name the board column (the Jira status name, or the name in `statusMap`), "new" is the first column. Writing a status reads the transitions of the issue and picks the one that leads to the wanted state; none, or a refusal (for example a required resolution), is the error `transition`, the change stays local and marked.
5. **Epics and sub-tasks are not stories** and are left out of the import; the run counts them (`skipped`, shown in the notice). Epics and fix versions follow in phase 2.
6. **Jira never deletes anything** (decision of the PO in #66): the connector has no `tidy`.
7. Search uses `POST /rest/api/3/search/jql` with `nextPageToken` (the old search is removed). `429` is the error `rateLimit`, `401` `auth`, a refused write `forbidden`, an unknown project `notFound`.

## Consequences

- A real Jira sync only runs in the Windows app; the preview shows the behaviour with the simulation. The real operation is accepted by the PO on a Jira Cloud test site.
- The commands of the Rust side grow by one command with a fixed list of hosts; a new host needs a change of the code, which is deliberate.
- Boards, the table of status names, sprints, points and rank are later phases; the engine and the neutral model do not change for them (ADR 0006).

## Addendum (phase 5): Jira decides columns, team and sprints

Decided by the PO in #66 (2026-10-24). With Jira connected, Jira is the leading side for three things: the **columns** of the board come from the statuses of the workflow (`statusesFromService`, capability `statusesFromService`), the **team** from the people who can be assigned (`membersFromService`, no bots), and the **sprints** are compared with Jira sprints field by field with a three-way base per sprint (`planSprints`, `SprintOps` of the connector, migration 017: goal, service, Jira id and base per sprint). Starting and completing a sprint keep the rules of the app: a sprint that Jira started or completed is handed back as an action (`startSprint`, `completeSprint` with the unfinished stories to the backlog), one started or completed here is published as a new state. Only one sprint runs here, a second running sprint in Jira stays planned and is named. The settings of the status values and the team are locked while Jira is connected; removing the connection unlocks them. Nothing is ever deleted in Jira.
