---
name: neu
description: "The PO describes a new idea or requirement (/neu <text>). Creates the GitHub issue in the PO's words and starts refining it."
argument-hint: <what the PO wants>
---

# /neu: capture a new requirement (#43)

The PO's text: $ARGUMENTS

1. Search the open issues for a duplicate or a close match. If there is one, show it and ask (question tool with options) whether to add to it or create a new issue.
2. Create the issue with the "Feature" template (`.github/ISSUE_TEMPLATE/feature.md`, label `feature`; `process` for changes to the way of working). Quote the PO's words under "Notes from the product owner"; write the rest in English. Draft acceptance criteria if the text allows it.
3. Refine (CLAUDE.md, workflow step 3): post the story breakdown and open questions as a comment, then ask the open questions in the chat with the question tool (short, selectable options, also usable from a phone), never as a plain list. Record the answers in the issue.
4. Answer in German with the link to the issue and what comes next (approve the acceptance criteria with `/freigabe #<n>`).

Do not build anything yet.
