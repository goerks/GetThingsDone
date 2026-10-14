---
name: freigabe
description: "The PO approves the acceptance criteria or the test cases of an issue (/freigabe #<n>). Records the approval in the issue and takes the next step of the working mode."
argument-hint: "#<issue> [notes]"
---

# /freigabe: the PO approves (#43)

Arguments: $ARGUMENTS. If no issue number is given, use the issue this conversation is about; if that is unclear, ask.

1. Read the issue and its comments and find out what is waiting for approval:
   - **Acceptance criteria** (no approved test cases yet): record "PO approved the acceptance criteria (date, via /freigabe)" in the issue, with any notes the PO gave. Then propose the test cases per acceptance criterion as a comment (CLAUDE.md, "Test cases") and show them in the chat in short form. Next step for the PO: `/freigabe #<n>` again for the test cases.
   - **Test cases**: record "PO approved the test cases (date, via /freigabe)" and keep the approved version in the issue. Then ask with the question tool whether to start building now (`/go`).
   - If it is unclear which of the two is meant, or nothing is waiting for approval, say so and ask.
2. Notes the PO adds ("ja, aber AC3 ohne …") are changes: apply them to the issue first and say what changed.
3. Answer in German: what was approved and what happens next.
