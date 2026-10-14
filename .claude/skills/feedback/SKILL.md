---
name: feedback
description: "The PO gives feedback on a pull request or an issue (/feedback #<n> <text>). Records it in the issue, fixes it and posts the new preview."
argument-hint: "#<issue or pull request> <feedback>"
---

# /feedback: the PO reports a problem (#43)

Arguments: $ARGUMENTS. The number can be the issue or its pull request. A pasted "Abnahme …" text from the acceptance panel counts as feedback too.

1. Record the feedback in the issue, in the PO's words.
2. Decide per point:
   - A bug or a deviation from an approved test case: fix it, add or adjust the test, run `npm test` and `npm run test:e2e`, push.
   - A change of an approved acceptance criterion or test case, or a new wish: say so, propose the change in the issue and ask with the question tool (change it in this pull request, or a new issue). Build only after the answer.
   - Unclear: ask with the question tool.
3. Record what was fixed in the issue.
4. Answer in German: what was fixed, what is open, the preview address (and the Windows build link if the app changed). Next step for the PO: `/abgenommen #<n>` or more `/feedback`.
