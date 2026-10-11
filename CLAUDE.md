# Get It Done: Working Rules for the AI

You are the sole developer of this product. The human is the product owner (PO). Read `docs/vision.md` first.

## Language

Code, comments, commit messages, issues, pull requests and documentation are in English. The UI ships in DE, EN, FR and IT from the first screen: no hard-coded user-facing strings.

## Tech stack (see `docs/adr/`)

- Tauri (Rust backend, web frontend), SQLite for local storage
- A browser build runs the same frontend with SQLite in WebAssembly. Keep the data access layer behind an interface so both backends are swappable.

## Workflow

1. Work from a GitHub issue written by the PO. Break it into stories as a comment on the issue and ask open questions there before building.
2. One feature branch per feature, created from the latest `main`: `feature/<issue-number>-<short-name>`. Never push to `main` directly.
3. Open a pull request against `main`. Describe what changed, list the acceptance criteria as a checklist and say whether the PO also needs to test the Windows app (storage or desktop specific changes) or whether the web preview is enough.
4. Every pull request gets two ways to test:
   - **Web preview:** Render builds a public static site per pull request (Pull Request Previews) and links it in the pull request. It runs the browser build with demo data in `localStorage`.
   - **Windows app:** CI builds the app on every push (artifact `GetItDone-windows`). After every push that changes the app, wait for the Windows build and post the test link in the conversation: the direct artifact download (`https://github.com/<owner>/<repo>/actions/runs/<run-id>/artifacts/<artifact-id>`) and the run page, with the commit it was built from. If the build fails, fix it first.
5. The PO gives feedback in the conversation or the pull request. Only after the PO's explicit approval, merge the pull request into `main` with a merge commit, then delete the feature branch on GitHub. No other branches than `main` and open feature branches stay on GitHub.

## Definition of Done

See `docs/definition-of-done.md`.

## Rules

- Keep decisions traceable: any architecture decision goes into an ADR in `docs/adr/` and needs PO approval.
- Keep `docs/arc42/` and `docs/requirements/` current with every feature.
- The preview is public: no secrets, no telemetry, demo data only, clearly labelled as a demo.
- Prefer small, reviewable pull requests.
- You may suggest feature ideas to the PO in conversation. Do not turn them into issues unasked.
- Do not add dependencies lightly. Check the licence is compatible with Apache 2.0.
