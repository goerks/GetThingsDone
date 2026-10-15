---
name: start
description: "Session start overview for the product owner. Lists the top 5 open issues of the GitHub backlog with a short assessment and ends with 2–3 questions or suggestions on how the product could continue. Use at the start of a session when the PO's first message has no concrete task, or when the PO types /start."
---

# Session start overview (#41)

Give the product owner (PO) a short overview so they can decide what to work on next. Answer in German, in plain language. Read only; do not create issues, branches or comments.

## 1. Gather

- Open issues of the repository (GitHub MCP tools: `list_issues` with state `OPEN`; read the body and the latest comments of the candidates).
- Open pull requests (`list_pull_requests`): which ones wait for the PO's review or approval, which ones have red CI.
- `docs/vision.md` for the direction of the product.

## 2. Rank the top 5

Rank by, in this order:

1. Open pull requests waiting for the PO (they block the most).
2. Issues already in progress (approved test cases, a go, an open branch or pull request).
3. Issues others depend on.
4. Value for the user according to `docs/vision.md`.
5. Size: when the value is similar, the smaller next step first.

## 3. Answer

Keep it short; the PO should read it in a minute.

```markdown
## Backlog: Top 5

| # | Issue | Stand | Beurteilung |
|---|---|---|---|
| 1 | [#12 Titel](link) | z. B. PR wartet auf dich / Testfälle freigegeben / neu | ein Satz: warum jetzt, was ist der nächste Schritt |
…

## Wie weiter?

1. Frage oder Anregung …
2. …
3. …
```

- "Stand" says where the issue is in the working mode (`docs/working-mode.md`): new, refined, test cases proposed or approved, in build, pull request open.
- After the table, ask the 2–3 questions with the question tool (short, selectable options, so the PO can answer by tapping, also on a phone), not as a plain list. Suggestions without a decision stay in the text.
- The 2–3 questions or suggestions look ahead: a decision the PO has to make, a gap compared with `docs/vision.md`, or a feature idea. Feature ideas stay suggestions in the conversation; do not create issues for them unasked.
- If there are fewer than 5 open issues, list those and say so.
