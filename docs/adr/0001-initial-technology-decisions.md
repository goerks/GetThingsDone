# ADR 0001: Initial technology decisions

Status: Proposed (awaiting PO approval)
Date: 2026-10-10

## Context

The product must run locally on Windows, Linux and macOS from one codebase, install with minimal effort, perform well, and also run in a browser so that every feature branch can have a public preview.

## Decision

1. **Tauri** (Rust backend, web frontend) for the desktop app.
2. **SQLite** for local storage.
3. The data access layer sits behind an interface with two implementations: native SQLite via the Tauri backend, and SQLite compiled to WebAssembly for the browser build.
4. **Apache 2.0** licence.
5. **GitHub** hosts code, issues and CI. Previews are deployed as static sites per branch.

## Consequences

- Small binaries and one frontend for desktop and web.
- The data access interface must be designed first, before features depend on it.
- The browser build keeps data in the visitor's browser only. That fits a public preview and avoids server state.
- Sync and tracker connectors come later and must build on the same interface.

## Alternatives considered

- .NET with Avalonia: cross-platform and fast, but larger installers and a weaker web story.
- Electron: easiest to build with, but large and memory hungry, against the "light install" goal.
