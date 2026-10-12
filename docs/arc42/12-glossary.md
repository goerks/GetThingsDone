# 12. Glossary

| Term | Meaning |
|---|---|
| Acceptance criterion | A checkable condition of a story. A story is accepted when all criteria are ticked. |
| Backlog | All stories, ordered by priority (rank). |
| Board | Kanban view of the stories in the running sprint, one column per status. |
| Built-in field | A field the app ships with, such as description or points. Can later be hidden and renamed. |
| Custom field | A field a team adds to the field library, for example "Priority". |
| Epic | A larger theme that groups stories. Shown as a coloured dot and name. A story may have no epic. |
| Field assignment | Puts a field of the library on an item type, with its position. |
| Field library | All fields of the workspace: system, built-in and custom fields (ADR 0003). |
| Item type | A kind of item that can carry fields: story, epic and release (built-in fields only); later sprint. |
| Rank | Global priority of a story, 0 is the most important. |
| Repository | The storage interface of the frontend (`src/data/repository.ts`). |
| Search badge | A field filter in the search field, typed as `field:value` and shown as `Field = value`. Each field at most once. |
| Highlighting | Showing the results of a search on the current page: matching items marked, the others dimmed. |
| Snapshot | All epics, sprints, releases, stories, fields and assignments loaded at once. |
| Sprint | A time box with name, start and end date. A story is planned in one sprint or in none. |
| System field | A field the app depends on (key, title, story status, release of a story). Cannot be removed. |
| Release | A group of stories with a title, a description and optional start and end day (#10). Its size is the points of its stories; planned, running or done is derived. A story has at most one release. |
| Running sprint | The sprint whose dates include today (otherwise the next upcoming, otherwise the last). The board shows it. |
| Story | A unit of work with title, description, points, status and acceptance criteria. Key `S-<n>`. |
| Story map | Grid of epics (columns) and running or future sprints (rows) with the stories in the cells. |
| Not planned | Stories without a sprint. Last section of the backlog and last row of the story map. |
| Tauri | Framework for desktop apps with a Rust shell and the system WebView. |
| PO | Product owner. Sets direction and accepts features. |
