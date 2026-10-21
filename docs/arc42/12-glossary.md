# 12. Glossary

| Term | Meaning |
|---|---|
| Acceptance criterion | A checkable condition of a story. A story is accepted when all criteria are ticked. |
| Backlog | All stories, ordered by priority (rank). |
| Sprint (states) | A sprint is planned, running (at most one) or completed (#17). It runs when it is started. Starting keeps its stories and points as the planned scope; completing stores its result and moves the unfinished stories on. |
| Board | Kanban view of the stories in the running sprint (or the next planned one), one column per status value, grouped by category. |
| Status value | A step of the team's process and a column of the board, in one of the fixed categories "Not started", "In progress" or "Done". A story is done when its status is in "Done". |
| Built-in field | A field the app ships with, such as description or points. Can later be hidden and renamed. |
| Custom field | A field a team adds to the field library, for example "Priority". |
| Linked story | A story that is linked to an issue of the chosen service (#30, #66), made from the issue or published as one. It keeps the address, the key and the base of the issue and shows the key (`#31`) as its ID, as a link; its own key (`S-4`) is kept; the sync keeps both sides up to date in both directions (a field that changed on one side goes to the other; if both changed, the conflict rule decides, GitHub by default). |
| Base (sync) | What an issue looked like at the last sync, kept on the story. It tells the next sync who changed what (#30, ADR 0005). |
| Connector | The part of the app that talks to one external service (GitHub first; Jira and GitLab planned); the sync engine knows no service (#30, #66). Only one service is active at a time. |
| Epic | A larger theme that groups stories. Shown as a coloured dot and name. A story may have no epic. |
| Field assignment | Puts a field of the library on an item type, with its position. |
| Field library | All fields of the workspace: system, built-in and custom fields (ADR 0003). |
| Item type | A kind of item that can carry fields: story, epic and release (built-in fields only); later sprint. |
| Rank | Global priority of a story, 0 is the most important. |
| Repository | The storage interface of the frontend (`src/data/repository.ts`). |
| Search badge | A field filter in the search field, typed as `field:value` and shown as `Field = value`. Each field at most once. |
| First steps | The optional introduction in the help: four steps that the app ticks off when the user does them. Never forced. |
| Show me | A button in a help topic that frames the element the topic is about. |
| Highlighting | Showing the results of a search on the current page: matching items marked, the others dimmed. |
| Scope (of a release) | The number of stories and the sum of their points in the release on a day. The scope report shows how it changed after the start. |
| Settings | Choices of the workspace that the whole team shares, for example the rows of the story map (sprints or releases). |
| Snapshot | All epics, sprints, releases, stories, fields and assignments loaded at once. |
| Sprint | A time box with name, start and end date. A story is planned in one sprint or in none. |
| System field | A field the app depends on (key, title, story status, release of a story). Cannot be removed. |
| Velocity | The points a team completes per sprint. The backlog shows planned (at the start) and completed points of the last completed sprints and the average of the last three (#24). |
| History (of a release) | The append-only entries about the stories of a release: joined, left, points changed, done, reopened. The scope report and the burndown are computed from it. |
| Release | A group of stories with a title, a description and optional start and end day (#10). Its size is the points of its stories; planned, running or done is derived. A story has at most one release. |
| Running sprint | The sprint whose dates include today (otherwise the next upcoming, otherwise the last). The board shows it. |
| Story | A unit of work with title, description, points, status and acceptance criteria. Key `S-<n>`. |
| Story map | Grid of epics (columns) and running or future sprints (rows) with the stories in the cells. |
| Not planned | Stories without a sprint. Last section of the backlog and last row of the story map. |
| Tauri | Framework for desktop apps with a Rust shell and the system WebView. |
| PO | Product owner. Sets direction and accepts features. |
