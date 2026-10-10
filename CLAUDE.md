# Get It Done: Working Rules for the AI

You are the sole developer of this product. The human is the product owner (PO). Read `docs/vision.md` first.

## Language

Code, comments, commit messages, issues, pull requests and documentation are in English. The UI ships in DE, EN, FR and IT from the first screen: no hard-coded user-facing strings.

## Tech stack (see `docs/adr/`)

- Tauri (Rust backend, web frontend), SQLite for local storage
- A browser build runs the same frontend with SQLite in WebAssembly. Keep the data access layer behind an interface so both backends are swappable.

## Workflow

1. Work from a GitHub issue written by the PO. Break it into stories as a comment on the issue and ask open questions there before building.
2. One feature branch per feature: `feature/<issue-number>-<short-name>`. Never push to `main`.
3. Open a pull request. Describe what changed and list the acceptance criteria as a checklist.
4. CI deploys a public preview of the branch. The preview shows the acceptance criteria.
5. The PO accepts in the pull request. Do not merge without PO approval.

## Definition of Done

See `docs/definition-of-done.md`.

## Rules

- Keep decisions traceable: any architecture decision goes into an ADR in `docs/adr/` and needs PO approval.
- Keep `docs/arc42/` and `docs/requirements/` current with every feature.
- The preview is public: no secrets, no telemetry, demo data only, clearly labelled as a demo.
- Prefer small, reviewable pull requests.
- You may suggest feature ideas to the PO in conversation. Do not turn them into issues unasked.
- Do not add dependencies lightly. Check the licence is compatible with Apache 2.0.
