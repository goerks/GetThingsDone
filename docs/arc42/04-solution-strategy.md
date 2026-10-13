# 4. Solution strategy

| Goal | Approach |
|---|---|
| Light install, cross-platform | Tauri 2: Rust shell with the system WebView, NSIS installer and a portable executable (ADR 0001) |
| Local first | SQLite file through `tauri-plugin-sql`. No backend server. |
| One frontend for desktop and browser | React and TypeScript, built with Vite. Storage sits behind the `Repository` interface and is picked at start-up. |
| Testability | Domain logic in `src/domain` is made of pure functions on immutable data. UI state calls these functions and then persists the change. |
| Accessibility | Semantic HTML, dnd-kit with keyboard sensor and localized screen reader announcements, visible focus, token-based contrast |
| Multilingual | i18next with one JSON file per language, language remembered locally |
| Calm, consistent look | Visual direction "Focus" with design tokens and a light and dark theme (ADR 0002) |
| Fast feedback | Vitest unit and component tests, Playwright end-to-end tests, typecheck and build in CI, Windows build on every push |
