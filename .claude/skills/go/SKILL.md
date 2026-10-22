---
name: go
description: "The PO gives the go to build an issue (/go #<n>). Builds the feature end to end and opens the pull request with preview link."
argument-hint: "#<issue>"
---

# /go: build (#43)

Arguments: $ARGUMENTS. If no issue number is given, use the issue this conversation is about; if that is unclear, ask with the question tool (the open issues as options).

1. Check the issue: the acceptance criteria and the test cases must be approved. If not, say what is missing and ask with the question tool whether to run the approval now (`/freigabe #<n>`); stop until it is given.
2. Record "PO gave the go (date, via /go)" in the issue.
3. Build following CLAUDE.md, workflow steps 5 to 7 and the design system rule (tokens and `src/ui/` components only, extend the design system with a story where something is missing, `docs/design-system.md`), without intermediate checks: feature branch from the latest `main`, implementation, automated tests per test case, help and documentation, `npm test` and `npm run test:e2e`, push, pull request starting with `Closes #<n>` and the entry "Design system adherence", acceptance panel, link in the issue.
4. Answer in German with the pull request, the web preview address and, if the app changed, the Windows build link. Next step for the PO: test, then `/abgenommen #<n>` or `/korrektur #<n> <text>`.
