# Get It Done: Working Rules for the AI

You are the sole developer of this product. The human is the product owner (PO). Read `docs/vision.md` first.

## Language

Code, comments, commit messages, issues, pull requests and documentation are in English. Exception: the test cases for the PO (see "Test cases") are in German. The UI ships in DE, EN, FR and IT from the first screen: no hard-coded user-facing strings.

## Tech stack (see `docs/adr/`)

- Tauri (Rust backend, web frontend), SQLite for local storage
- A browser build runs the same frontend with SQLite in WebAssembly. Keep the data access layer behind an interface so both backends are swappable.

## Workflow

Overview for the PO: [`docs/working-mode.md`](docs/working-mode.md). Keep it in line with this section.

**Session start.** When the PO's first message in a session has no concrete task (for example "Hallo", "Start", "Was steht an?"), or the PO types `/start`, follow the `start` skill (`.claude/skills/start/SKILL.md`): list the top 5 open issues of the backlog with a short assessment, then ask 2–3 questions or make suggestions on how the product could continue. When the first message is a concrete task, do the task directly.

1. **No work without an issue.** Every GitHub issue is a requirement, and every change (feature, test, documentation, process) belongs to one. If the PO asks for something that has no issue yet, create the issue first, in the PO's words, and link it in the conversation.
2. **The issue is the record.** Everything proposed to or decided by the PO is posted in the issue in the same step, not only in the conversation: story breakdown, design proposals with screenshots of the mockups (images committed under `docs/design/` and embedded in the comment), phases, open questions and the PO's answers, test cases and their approval, and any later change of scope. Do not wait to be asked.
3. **Refine.** Break the issue into stories as a comment on the issue and ask open questions there before building. Also ask the open questions interactively in the conversation (the question tool with selectable options, not a plain text list), so the PO can answer by choosing. Record the answers in the issue afterwards.
4. **Test cases before building.** Once the PO has approved the acceptance criteria, propose one or more test cases per acceptance criterion as a comment on the issue, in German and plain language (see "Test cases"). The PO reviews them from a testing perspective. Revise them in the issue until the PO explicitly approves them; keep the approved version in the issue. Do not start building before that.
5. **Go and pull request.** When the PO gives the go to build, implement the feature end to end without asking the PO for intermediate checks. Ask only if something blocks you or would change an approved acceptance criterion or test case; then update the issue and get the change approved again. Work on one feature branch per issue, created from the latest `main` (`feature/<issue-number>-<short-name>`, unless the session prescribes a branch). Never push to `main` directly. Technical details such as branch names are the AI's decision; do not ask the PO.
6. Open a pull request against `main` whose description starts with `Closes #<issue>`, so GitHub closes the issue when the pull request is merged. Describe what changed, list the acceptance criteria as a checklist with their test case IDs and the automated tests that cover them, and say whether the PO also needs to test the Windows app (storage or desktop specific changes) or whether the web preview is enough. Link the pull request in the issue.
7. Every pull request gets two ways to test:
   - **Web preview:** Render builds a public static site per pull request (Pull Request Previews). It runs the browser build with demo data in `localStorage`. The address of pull request `<n>` is `https://getthingsdone-pr-<n>.onrender.com` (`main` is at `https://getthingsdone.onrender.com`). Post this address in the conversation and in the pull request description whenever a pull request is ready for review. The preview shows an acceptance panel ("Abnahme", bottom left) listing the test cases of the pull request with a link, a tick box and a comment each: keep `src/acceptance/package<n>.ts` in line with the approved test cases of every pull request (see `docs/working-mode.md`). "Ergebnis kopieren" gives the PO's result as text to paste into the chat: treat a pasted "Abnahme …" text as the PO's feedback on that pull request, fix the problems, and record the outcome in the issue yourself.
   - **Windows app:** CI builds the app on every push (artifact `GetItDone-windows`). After every push that changes the app, wait for the Windows build and post the test link in the conversation: the direct artifact download (`https://github.com/<owner>/<repo>/actions/runs/<run-id>/artifacts/<artifact-id>`) and the run page, with the commit it was built from. If the build fails, fix it first.
8. The PO gives feedback in the conversation or the pull request. Only after the PO's explicit approval, merge the pull request into `main` with "Rebase and merge". It is the only merge method enabled on the repository (no merge commits, no squash), and GitHub refuses it for a branch that contains a merge: keep every branch linear and rebase it on `main` instead of merging `main` into it. Then delete the feature branch on GitHub. No other branches than `main` and open feature branches stay on GitHub.

## Test cases

Two layers: the PO reviews **test cases in German and plain language**; the AI turns each approved test case into **Gherkin and automated tests** for its own use. The PO never has to read Gherkin.

- Each acceptance criterion `AC<n>` gets one or more test cases `AC<n>.<m>`. Test cases for existing behaviour that has no acceptance criterion in the issue take the ID of the requirement instead (`FR-MAP-02.1`, see `docs/requirements/`). Cover the normal case and the relevant edge and error cases (empty input, limits, cancel, keyboard only, language switch) where they matter for that criterion.
- Write test cases for the PO in German, in short everyday sentences, from the user's point of view: what is there, what I do, what I see. No technical terms (no CSS, components, database, "Given/When/Then"). Use concrete example values. Variations go into a small table.
- Format of one test case:

  ```markdown
  **AC2.1 Story per Drag & Drop auf Erledigt ziehen**
  - Ausgangslage: Story „S-3 Login-Seite“ steht in der Spalte „In Arbeit“.
  - Ich mache: Ich ziehe „S-3“ in die Spalte „Erledigt“.
  - Erwartet: „S-3“ steht in „Erledigt“, auch nachdem ich die App neu geladen habe.
  ```

- Mark test cases that are checked by hand and not automated (for example visual details) with *(manuell)* and say why.
- List open questions that come up while writing test cases below them; they need a PO decision before the test cases are approved.
- After approval, the AI writes at least one automated test per test case. The test follows the test case step by step with `// Given`, `// When`, `// Then` comments in English (Gherkin is never shown in issues or pull requests). The test name starts with the ID, for example `test('AC2.1 moves a story to Done by drag and drop', …)`, so the PR and `Verified by` in `docs/requirements/` point to it.
- Choose the test level by what the test case needs:
  - **End-to-end** (`e2e/*.spec.ts`, Playwright, real Chromium, web build with demo data, `npm run test:e2e`): journeys across pages, drag and drop with the mouse, real layout, reloads. Fix the clock (`page.clock.setFixedTime`) so dates in the demo data are stable.
  - **Component** (`src/**/*.test.tsx`, Vitest and jsdom, `npm test`): behaviour of one page or dialog, keyboard and screen reader texts.
  - **Unit** (`src/domain/*.test.ts`): rules and calculations.
- Run both `npm test` and `npm run test:e2e` before every push. In this container: `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e`.

## Definition of Done

See `docs/definition-of-done.md`.

## Rules

- Keep decisions traceable: any architecture decision goes into an ADR in `docs/adr/` and needs PO approval.
- Keep `docs/arc42/` and `docs/requirements/` current with every feature.
- **Keep the help current, like the technical documentation.** The interactive help (#33, `src/help/topics.ts` and `help.*` in the language files) grows with the product. Every feature that adds or changes something a user sees updates the help in the same pull request: a topic (title, keywords, text) in DE, EN, FR and IT, links to where to find it (`links` of the topic; a place that needs a feature is marked `requires`), "Show me" where an element can be framed, and a test. When a feature has to be switched on first (Settings → Features), the text starts with that step and links to the settings. How to extend it: `docs/arc42/08-crosscutting-concepts.md`, chapter "Help".
- **The first steps (tutorial) belong to the PO.** Never add, change, reorder or remove a step of the first steps on your own. Propose the topics for the tutorial to the PO first, interactively with short questions and options (so the PO does not have to read much), post the proposal and the answer in the issue, and build only after the PO has explicitly approved. Everything else in the help (topics, links, texts) needs no extra approval, but is part of the acceptance in the pull request.
- The preview is public: no secrets, no telemetry, demo data only, clearly labelled as a demo.
- Prefer small, reviewable pull requests.
- You may suggest feature ideas to the PO in conversation. Do not turn them into issues unasked.
- Do not add dependencies lightly. Check the licence is compatible with Apache 2.0.
