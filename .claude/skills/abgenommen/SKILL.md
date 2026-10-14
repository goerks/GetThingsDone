---
name: abgenommen
description: "The PO accepts a pull request (/abgenommen #<n>). Records the acceptance, merges with \"Rebase and merge\", deletes the branch."
argument-hint: "#<issue or pull request>"
---

# /abgenommen: the PO accepts (#43)

Arguments: $ARGUMENTS. The number can be the issue or its pull request. The command is the PO's explicit approval to merge (CLAUDE.md, workflow step 8): do not ask again. Without a number, ask; never guess which pull request to merge.

1. Find the open pull request (`Closes #<n>`). If there is none, or more than one, say so and stop.
2. Check it can be merged: CI green on the latest commit, no merge conflict, no unanswered review comments. If something blocks, fix what is yours to fix (rebase on `main`, never merge `main` into the branch), push, wait for CI, then continue. If you cannot fix it, say what blocks and stop.
3. Record "PO accepted the pull request (date, via /abgenommen)" in the issue, with any notes.
4. Merge with "Rebase and merge" (the only enabled method), then delete the branch on GitHub. The issue closes through `Closes #<n>`; check that it did.
5. Answer in German: merged, the issue is closed, the address of `main` (`https://getthingsdone.onrender.com`). Suggest the next step briefly (for example `/start`).
