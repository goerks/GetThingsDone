# 11. Risks and technical debt

## Technical debt

| ID | Debt | Impact | Planned handling |
|---|---|---|---|
| TD-1 | The browser build uses `localStorage` instead of SQLite in WebAssembly as ADR 0001 describes. | Browser and desktop behave the same for the user, but the browser backend does not exercise SQL. | Implement a WebAssembly SQLite repository, or change ADR 0001. PO decision. |
| TD-2 | No public preview deployment per branch yet. | The PO tests only via the Windows build. | Add a static preview deployment (for example GitHub Pages) in a later feature. |
| TD-3 | No tests across the Tauri boundary itself and no UI tests with axe. Drag and drop with real layout is covered by end-to-end tests in CI for the story map since #12; the board and the backlog are still checked by hand. `SqliteRepository` and the migrations are tested against an in-memory SQLite (`src/data/sqliteRepository.test.ts`) since #4. | Definition of done is not fully met. | Add with the next UI or desktop feature. |
| TD-5 | Failed writes are reported but not retried or rolled back. | UI and database can differ until restart. | Retry or reload on error. |
| TD-6 | Several SQL statements per operation run without a transaction (for example `replaceAll`, `savePositions`, `deleteStory`, `saveCriteriaOrder`, `saveField`, `deleteField`, migration 003). | A crash mid-way can leave partial data. | Wrap in transactions. |

## Risks

| Risk | Mitigation |
|---|---|
| WebView differences between Windows, macOS and Linux | Test builds on all three before release 1 |
| Unsigned Windows executables trigger SmartScreen warnings | Document for testers; code signing before a public release |
| Fast-moving major versions of the toolchain (React 19, Vite 8, TypeScript 7) | Lockfile, CI on every push |
