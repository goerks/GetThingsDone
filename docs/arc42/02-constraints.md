# 2. Constraints

## Technical

| Constraint | Background |
|---|---|
| Windows first, Linux and macOS from the same codebase | Vision, goal 4 |
| Runs offline with a local database | Vision, goal 2 |
| No server state, no telemetry | Local first, public previews must not collect data |
| UI in DE, EN, FR and IT, no hard-coded user-facing strings | Vision, goal 5 |
| Dependencies must be compatible with Apache 2.0 | Licence |

## Organisational

| Constraint | Background |
|---|---|
| The AI is the sole developer, the human is the product owner | Working model in `CLAUDE.md` |
| Code, comments, commits and documentation in English | `CLAUDE.md` |
| Features start from a GitHub issue and go through a pull request | `CLAUDE.md`, workflow |
| Architecture decisions need an ADR and PO approval | `CLAUDE.md` |
| Licence Apache 2.0 | ADR 0001 |

## Conventions

- Feature branches: `feature/<issue-number>-<short-name>`.
- Design tokens from `docs/design/tokens.css`, never hard-coded colours (ADR 0002).
- TypeScript in strict mode.
