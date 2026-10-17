---
name: design-vorschlag
description: "The PO asks for design proposals (/design-vorschlag <number> [clarification]). Publishes an Artifact with rated variants and a clear recommendation, records it in the issue, and lets the PO confirm the recommendation interactively."
argument-hint: "<number of variants> [#<issue>] [what the PO wants]"
---

# /design-vorschlag: design variants with rating and recommendation (#52)

Arguments: $ARGUMENTS. The first number is how many variants to propose. The rest is the clarification of what the PO wants (and optionally `#<issue>`). Without a number, ask with the question tool (2, 3, 4 as options). The issue is the one named, else the one this conversation is about; if that is unclear, ask with the question tool (the open issues as options). If there is no issue for the topic yet, create it first (CLAUDE.md, rule 1).

## 1. Prepare

Read the issue, its comments and the relevant code and `docs/design/`, so the variants fit the product and the vision. Do not propose what the PO has already decided.

## 2. Build the variants

- **Variants** are numbered `1` … `x` (as many as the PO asked for). Each variant is a real alternative, with a name, a mockup and a short description.
- **Options** are lettered `A` … `D` where a variant has sub-choices; they can be combined (for example `1.a`, `2.c`). Use options only where they help; do not invent them.
- **Rating** of every variant and option: pros (positive) and cons (negative), short and concrete. Use symbol plus text, never colour alone.
- **Recommendation** at the end: one clear choice (for example "1.a"), with the reason in two or three sentences and what the PO gives up.

## 3. Publish the Artifact

Load the `artifact-design` skill, write the page (HTML, mobile friendly: the PO often reads it on a phone, no horizontal scroll) and publish it with the Artifact tool. The page shows the variants with mockups, the ratings and the recommendation at the end. The mockup must be clearly a proposal, with demo data only.

## 4. Document it in the issue (as before)

Post it as a comment on the issue in the same step (CLAUDE.md, rule 2): the variants, options, ratings and the recommendation as text, plus a screenshot of every mockup. Commit the screenshots under `docs/design/` and embed them in the comment with `https://github.com/<owner>/<repo>/blob/<branch>/<path>?raw=true`; `/abgenommen` switches these links to `main` at the merge, because the branch is deleted then (#63). Link the Artifact too, but the comment must stand on its own, because the Artifact is not part of the repository.

## 5. Ask for the decision

Ask with the question tool (selectable options, also usable from a phone). First option: "Empfehlung übernehmen (<e.g. 1.a>)". Then the other variants or combinations, and "Other" for free text. The PO may also just write "Empfehlung" in the chat, which means the same.

Record the decision in the issue afterwards, with the date and the chosen variant and options.

## 6. Answer

In German: the Artifact link, the issue comment link, the recommendation in one sentence, and the question from step 5.

Do not build anything yet. Next step for the PO: answer, then `/freigabe #<n>` for the acceptance criteria.
