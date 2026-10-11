# 10. Quality requirements

The quality requirements themselves are listed in [`docs/requirements/quality-requirements.md`](../requirements/quality-requirements.md). This chapter shows how they are structured and how the architecture addresses them.

## Quality tree

```
Quality
├── Usability ─────── accessibility (QR-01..QR-04), multilingual (QR-05)
├── Reliability ───── local first (QR-06), no data loss on save (QR-07)
├── Performance ───── fast start and interaction (QR-08)
├── Portability ───── Windows, Linux, macOS (QR-09), light install (QR-10)
└── Maintainability ─ testability (QR-11), traceability (QR-12)
```

## Scenarios

| ID | Scenario | Architecture response |
|---|---|---|
| QS-1 | A keyboard user moves a story from "To do" to "In progress" without a mouse and hears each step. | dnd-kit keyboard sensor, translated announcements |
| QS-2 | The user works without network and restarts the app; all changes are still there. | SQLite file, no network dependency |
| QS-3 | A developer changes the drop logic; a failing unit test shows the regression in seconds. | Pure domain functions with unit tests |
| QS-4 | The PO switches the language to French; every visible text and the document language change. | i18next, keys in all four languages |
| QS-5 | A new storage backend (for example SQLite in WebAssembly) is added without touching UI or domain code. | `Repository` interface, selection only in `createRepository` |
