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

Out of scope for release 1: sync between machines, user accounts, connectors to GitHub or GitLab issues. These come later and must build on the repository interface (ADR 0001).

## Technical context

| Channel | Technology |
|---|---|
| UI ↔ user | Native window (Tauri, WebView2 on Windows) or a browser tab |
| Frontend ↔ storage | `Repository` interface; Tauri SQL plugin over IPC in the desktop app, `localStorage` in the browser |
| Development ↔ GitHub | Git, GitHub Actions for CI and the Windows build |

The app makes no network calls at runtime. Fonts are bundled.
