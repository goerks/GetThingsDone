---
name: go
description: "The PO gives the go to build an issue (/go #<n>). Builds the feature end to end and opens the pull request with preview link."
argument-hint: "#<issue>"
---

# /go: build (#43)

Arguments: $ARGUMENTS. If no issue number is given, use the issue this conversation is about; if that is unclear, ask.

1. Check the issue: the acceptance criteria and the test cases must be approved. If not, say what is missing (and that `/freigabe #<n>` approves it) and stop.
2. Record "PO gave the go (date, via /go)" in the issue.
3. Build following CLAUDE.md, workflow steps 5 to 7, without intermediate checks: feature branch from the latest `main`, implementation, automated tests per test case, help and documentation, `npm test` and `npm run test:e2e`, push, pull request starting with `Closes #<n>`, acceptance panel, link in the issue.
4. Answer in German with the pull request, the web preview address and, if the app changed, the Windows build link. Next step for the PO: test, then `/abgenommen #<n>` or `/korrektur #<n> <text>`.
