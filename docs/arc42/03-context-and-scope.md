# 3. Context and scope

## Business context

```
            ┌──────────────────────────┐
 Team  ───▶ │       Get It Done        │ ───▶  local SQLite file
 member     │  board, backlog, stories │       (desktop app)
            └──────────────────────────┘
                       ▲
 Product owner ────────┘  accepts features via GitHub pull requests
```

| Partner | Input | Output |
|---|---|---|
| Team member | Creates stories, moves cards, orders the backlog, ticks criteria | Board, backlog, story detail |
| Local file system | – | SQLite database in the app data directory |
| GitHub Issues (optional, #30) | Open issues of one repository, read only, when the team switched the feature on and presses "Synchronise" | Stories with title, description, labels, criteria and a link to the issue |
| Credential store of the operating system (desktop) | The access token for GitHub | – |

Out of scope for release 1: sync between machines, user accounts, connectors to GitLab issues and other trackers. These come later and must build on the repository interface (ADR 0001). The GitHub Issues connector (ADR 0004) is the first one.

## Technical context

| Channel | Technology |
|---|---|
| UI ↔ user | Native window (Tauri, WebView2 on Windows) or a browser tab |
| Frontend ↔ storage | `Repository` interface; Tauri SQL plugin over IPC in the desktop app, `localStorage` in the browser |
| Development ↔ GitHub | Git, GitHub Actions for CI and the Windows build |
| App ↔ GitHub Issues (#30) | HTTPS to `api.github.com` (REST, read only) from the web view; token in the keychain (desktop) or in memory (browser). The browser build and the public preview use a simulated GitHub |

The app makes no network calls at runtime unless the team switched on the GitHub connection (Settings → Features) and presses "Synchronise". Everything else works offline. Fonts are bundled.
