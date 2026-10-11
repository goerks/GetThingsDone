# 7. Deployment view

## Desktop app (Windows, release 0.1)

| Artifact | Built by | Notes |
|---|---|---|
| `GetItDone-portable.exe` | `npm run tauri build`, copied from `src-tauri/target/release/get-it-done.exe` | Runs without installation. Needs the WebView2 runtime, which is part of Windows 10 and 11. |
| `Get It Done_<version>_x64-setup.exe` | NSIS bundle | Installs for the current user, no admin rights. |

The database is created on first start as `getitdone.db` in the app config directory of the identifier `io.github.goerks.getitdone` (on Windows `%APPDATA%\io.github.goerks.getitdone\`).

## Browser build

`npm run build` creates a static site in `dist/`. Data is kept in the visitor's `localStorage`. A public preview per branch is planned but not deployed yet.

## CI (GitHub Actions)

| Workflow | Trigger | Steps |
|---|---|---|
| `ci.yml` | Every push, every pull request | `npm ci`, typecheck, tests, web build (Ubuntu) |
| `windows-build.yml` | Every push, every pull request, manual | Tauri build on `windows-latest`, uploads the artifact `GetItDone-windows` with portable exe and installer |

The PO downloads the artifact from the workflow run (GitHub login required) to test locally.
