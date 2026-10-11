# Get It Done

A free, local-first tool for agile software development in small teams: board, backlog and acceptance criteria today, user story map next.

This project is a showcase for "level 5 vibe coding". The product is built end to end by AI, a human product owner sets vision and features and accepts the result. See [docs/vision.md](docs/vision.md) and [CLAUDE.md](CLAUDE.md).

## Status

Early prototype (0.1). Working today:

- Board with drag and drop of whole cards (mouse, touch and keyboard), highlighted target column and drop line
- Backlog with drag and drop, sprint line, rank preview and new stories
- Story page with in-place editing of story and acceptance criteria, delete with confirmation
- Epics page: create, rename, recolour, delete
- Story detail with acceptance criteria you can tick off
- Light and dark theme, German, English, French and Italian
- Local SQLite storage in the desktop app

## Try it

Every push builds a Windows app. In the repository, open **Actions → Windows build**, pick the run for your branch, download the `GetItDone-windows` artifact at the bottom of the run page (GitHub login required) and unzip it. Start `GetItDone-portable.exe` directly, or run the installer `Get It Done_<version>_x64-setup.exe` (installs for the current user, no admin rights). The build is not code-signed yet, so Windows SmartScreen may warn: choose "More info" and "Run anyway".

## Develop

Requirements: Node.js 22, Rust (stable) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/).

```bash
npm install
npm run dev          # browser, data in localStorage
npm run tauri dev    # desktop app, data in SQLite
npm test             # unit and component tests
npm run typecheck
npm run tauri build  # installer and executable
```

## Documentation

- [Vision and scope](docs/vision.md)
- [Requirements](docs/requirements/README.md)
- [Architecture (arc42)](docs/arc42/README.md)
- [Definition of done](docs/definition-of-done.md)
- [Architecture decisions](docs/adr)
- [Design system](docs/design/design-system.md)

## Licence

Apache License 2.0, see [LICENSE](LICENSE).
