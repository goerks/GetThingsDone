# 9. Architecture decisions

Decisions are recorded as ADRs in [`docs/adr/`](../adr). An ADR is accepted only after PO approval.

| ADR | Title | Status |
|---|---|---|
| [0001](../adr/0001-initial-technology-decisions.md) | Initial technology decisions (Tauri, SQLite, repository interface, Apache 2.0, GitHub) | Proposed |
| [0002](../adr/0002-visual-direction-focus.md) | Visual direction "Focus" with design tokens and two themes | Proposed |
| [0003](../adr/0003-configurable-fields.md) | Configurable fields data model (field library, assignments, typed value table) | Accepted |
| [0004](../adr/0004-change-log.md) | Change log of the items: versions as states, one generic mechanism | Accepted (#23) |
| [0005](../adr/0005-external-sync.md) | Sync with external trackers (GitHub first): connectors, three-way comparison, writing back, token storage | Accepted |
| [0006](../adr/0006-design-system-catalogue.md) | Design system catalogue with Storybook, tokens in CSS, shared components in `src/ui/`, adherence mandatory | Accepted (#70) |
| [0007](../adr/0007-one-sync-service.md) | One sync service at a time, one general mechanism: neutral model, connector contract, link and settings, keychain per service, the issue key as ID | Proposed (#66) |
| [0008](../adr/0008-jira-cloud-connector.md) | Jira Cloud connector: API token, HTTP through the Rust side, simulation in the browser, ADF, transitions, Jira decides columns, team and sprints | Proposed (#66) |
