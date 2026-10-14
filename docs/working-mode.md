# Working mode

How the product owner (PO) and the AI developer work together on a feature. The binding rules for the AI are in [`CLAUDE.md`](../CLAUDE.md); this page is the overview for the PO. Introduced with #12.

## Principles

- **Every GitHub issue is a requirement. No work without an issue.** If the PO asks for something in the conversation that has no issue yet, the AI creates it first.
- **The issue is the record.** Every proposal, design (with screenshots of the mockups), open question, decision, test case and approval is posted in the issue, not only in the conversation.
- **The PO checks twice:** the test cases before building, and the result in the pull request. Nothing in between.

## Steps

| # | Who | What | Where |
|---|---|---|---|
| 1 | PO | Writes the issue: goal, notes, draft acceptance criteria (template "Feature") | Issue |
| 2 | AI | Proposes stories, design and phases, asks open questions | Issue comment |
| 3 | PO | Answers the questions, approves the acceptance criteria | Conversation or issue; the AI records it in the issue |
| 4 | AI | Proposes one or more **test cases per acceptance criterion**, in German and plain language | Issue comment |
| 5 | PO | Reviews the test cases from a testing perspective; they are revised until the PO approves them and gives the go | Conversation or issue; the AI records it in the issue |
| 6 | AI | Builds the feature in one go, without intermediate checks. Turns every test case into at least one automated test with the same ID | Feature branch |
| 7 | AI | Opens a pull request starting with `Closes #<issue>`, with the acceptance checklist, the test case IDs and the tests that cover them, the web preview and the Windows build | Pull request, linked in the issue |
| 8 | PO | Tests in the web preview (and the Windows app if the pull request says so) and approves | Pull request or conversation |
| 9 | AI | Merges with "Rebase and merge", the only merge method enabled (the branch stays linear); GitHub closes the issue; the branch is deleted | GitHub |

If something during building would change an approved acceptance criterion or test case, the AI stops, updates the issue and asks the PO again.

## The help

The interactive help (question mark in the header) grows with every feature, like the technical documentation: every pull request that changes what a user sees also adds or updates its help topics in DE, EN, FR and IT, with links to where to find the feature and, where a feature has to be switched on first, that step first. The topics of the **first steps (tutorial)** are different: the AI never adds or changes a step on its own. It asks the PO first, with short interactive questions, and builds only after an explicit approval.

## A test case

Each test case has an ID (`AC<n>.<m>`, or the requirement ID such as `FR-MAP-02.1` for existing behaviour), a title and three parts in plain German:

```markdown
**AC2.1 Story per Drag & Drop auf Erledigt ziehen**
- Ausgangslage: Story „S-3 Login-Seite“ steht in der Spalte „In Arbeit“.
- Ich mache: Ich ziehe „S-3“ in die Spalte „Erledigt“.
- Erwartet: „S-3“ steht in „Erledigt“, auch nachdem ich die App neu geladen habe.
```

Variations go into a small table. Test cases that are checked by hand are marked *(manuell)* with a reason. Open questions that come up while writing test cases are listed below them.

## How test cases become tests

| Level | When | Where |
|---|---|---|
| End-to-end | Journeys across pages, drag and drop with the mouse, reloads | `e2e/*.spec.ts`, Playwright in a real Chromium, `npm run test:e2e` |
| Component | One page or dialog, keyboard, screen reader texts | `src/**/*.test.tsx`, Vitest, `npm test` |
| Unit | Rules and calculations | `src/domain/*.test.ts`, Vitest |

The name of every test starts with the ID of its test case, and `docs/requirements/` lists it under "Verified by". CI runs all levels on every push.
