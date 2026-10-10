# Get It Done: Vision, Goals and MVP Scope

Working title. Status: draft for product owner approval.

## Vision

A free, fast and friendly tool for agile software development in small teams. It runs locally on the desktop, keeps your data on your machine and does not get in the way. It is also a public showcase of "Level 5 vibe coding": the product is developed end to end by AI, while a human product owner sets vision, features and acceptance.

## Goals

1. **Usable by small teams** (up to roughly 10 people). No ambition to scale to SAFe-sized organisations.
2. **Local first.** Everything works offline with a local database. Network features are optional.
3. **Free and open source** under Apache 2.0.
4. **Light to install.** A single small executable or a minimal installer. Windows first, Linux and macOS from the same codebase.
5. **Accessible and multilingual from day one.** DE, EN, FR, IT. Keyboard operable, screen reader friendly.
6. **Highly tested.** Test pyramid with many unit and component tests, plus integration, UI and user-journey tests.
7. **Documented as a showcase.** Product site, arc42 architecture documentation, requirements documentation, ADRs.

## Non-goals (for now)

- Enterprise scale, complex permissions, portfolio management
- Hosting the whole product as a SaaS
- Configurable hierarchy levels (planned later, MVP has Epic and Story)

## MVP scope (Release 1)

| Area | Included |
|---|---|
| Work items | Epics and Stories with title, description, points, status |
| Acceptance criteria | Checkbox list per story, progress shown, "all accepted" state |
| Board | Kanban board with configurable columns, move cards between columns |
| Backlog | Ordered list with prioritisation, sprint line |
| Storage | Local SQLite database |
| Platforms | Desktop app (Tauri) plus a browser build using SQLite in WebAssembly for public previews |
| Quality | i18n (DE, EN, FR, IT), accessibility checks in CI, full test pyramid |
| Docs | README, arc42 skeleton, requirements, ADRs, product page |

## Release 2

- User story map: activities, activity steps, release and sprint slices
- Sprint planning on the map

## Later

- Configurable fields and content types
- Configurable hierarchy levels
- Connectors for GitHub Issues, GitLab Issues and other trackers
- Hosted sync and collaboration service for a local database

## Working model

- The product owner defines vision, goals, features and release slicing as GitHub issues.
- The AI breaks features into stories, proposes designs, asks questions in the issue, implements on a feature branch and writes tests and documentation.
- Each feature branch gets a public preview deployment that lists the acceptance criteria.
- The product owner accepts in the pull request. Only then is the branch merged into main.
- The AI may suggest new feature ideas as questions to the product owner, not as tickets.
