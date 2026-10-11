# 11. Risks and technical debt

## Technical debt

| ID | Debt | Impact | Planned handling |
|---|---|---|---|
| TD-1 | The browser build uses `localStorage` instead of SQLite in WebAssembly as ADR 0001 describes. | Browser and desktop behave the same for the user, but the browser backend does not exercise SQL. | Implement a WebAssembly SQLite repository, or change ADR 0001. PO decision. |
| TD-2 | No public preview deployment per branch yet. | The PO tests only via the Windows build. | Add a static preview deployment (for example GitHub Pages) in a later feature. |
| TD-3 | No integration tests for `SqliteRepository` and the Tauri boundary, no UI tests with axe. Drag and drop with real layout was checked in Chromium by hand, not in CI. | Definition of done is not fully met for the skeleton. | Add with the next storage or UI feature. |
| TD-4 | Board columns are fixed to four statuses; the MVP scope asks for configurable columns. | Requirement FR-BOARD-06 is open. | Own feature issue. |
| TD-5 | Failed writes are reported but not retried or rolled back. | UI and database can differ until restart. | Retry or reload on error. |
| TD-6 | Several SQL statements per operation run without a transaction (for example `replaceAll`, `savePositions`, `deleteStory`, `saveCriteriaOrder`, migration 003). | A crash mid-way can leave partial data. | Wrap in transactions. |

## Risks

| Risk | Mitigation |
|---|---|
| WebView differences between Windows, macOS and Linux | Test builds on all three before release 1 |
| Unsigned Windows executables trigger SmartScreen warnings | Document for testers; code signing before a public release |
| Fast-moving major versions of the toolchain (React 19, Vite 8, TypeScript 7) | Lockfile, CI on every push |
