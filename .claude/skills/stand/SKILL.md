---
name: stand
description: "The PO asks where an issue stands (/stand #<n>). Short state and next step, read only."
argument-hint: "#<issue>"
---

# /stand: where does it stand? (#43; /status is built into Claude Code)

Arguments: $ARGUMENTS. Without a number, give the state of the issue this conversation is about; if there is none, run the `start` skill instead.

Read the issue, its comments and its pull request (CI, preview). Change nothing. Answer in German in at most five lines:

- **Stand:** the step of the working mode (`docs/working-mode.md`): new, refined, acceptance criteria approved, test cases proposed or approved, in build, pull request open (CI green or red), merged.
- **Offen:** what is still missing or blocking, and who has to act.
- **Nächster Schritt:** the command for the PO, if it is their turn (for example `/freigabe #<n>`), with the preview link when there is one.

Read only, but if a decision is due, ask it with the question tool (selectable options).
