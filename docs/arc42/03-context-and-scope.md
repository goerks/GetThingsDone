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
| Issue tracker (optional, #30, #66): GitHub Issues or Jira Cloud, one service at a time (GitLab planned) | Open issues of one repository, read, and with a separate switch also written, when the team switched the feature on and presses "Synchronise" (or the automatic sync runs) | Stories with title, description, labels, criteria, done/open and a link to the issue; new issues from stories |
| Credential store of the operating system (desktop) | The access token of the chosen service, one entry per service | – |

Out of scope for release 1: sync between machines, user accounts, connectors to GitLab issues and other trackers. These come later and must build on the repository interface (ADR 0001). The GitHub Issues connector (ADR 0005) is the first one; the sync is one general mechanism with a connector per service, and exactly one service is active at a time (ADR 0006).

## Technical context

| Channel | Technology |
|---|---|
| UI ↔ user | Native window (Tauri, WebView2 on Windows) or a browser tab |
| Frontend ↔ storage | `Repository` interface; Tauri SQL plugin over IPC in the desktop app, `localStorage` in the browser |
| Development ↔ GitHub | Git, GitHub Actions for CI and the Windows build |
| App ↔ GitHub Issues (#30) | HTTPS to `api.github.com` (REST, reading, and writing when the team allows it) from the web view; token in the keychain (desktop) or in memory (browser). The browser build and the public preview use a simulated GitHub |

The app makes no network calls at runtime unless the team switched on the synchronisation (Settings → Synchronisation) and presses "Synchronise" (or switched on the automatic sync). Everything else works offline. Fonts are bundled.
