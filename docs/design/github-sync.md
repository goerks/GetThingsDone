# Design: GitHub sync (activation and configuration)

Issue: [#30 Import and sync from GitHub Issues](https://github.com/goerks/GetThingsDone/issues/30)

Mockups (clickable): [`github-sync-variants.html`](github-sync-variants.html); screenshots `github-sync-a.png`, `github-sync-b1.png`, `github-sync-b2.png`, `github-sync-c.png`. The mockup text is German because it is reviewed in German.

## Variants

| Variant | Idea | Status |
|---|---|---|
| A · Everything in Settings → Features | Switch "GitHub connection" in the list of features; the form (repository, token) and the buttons import / sync open below it | Proposed |
| B · Switch in Features, own section "GitHub", sync in the Backlog | Switch in Features (like Releases); when on, Settings gets a section "GitHub" for the connection; the Backlog gets a "Synchronise" button, the last sync time and a result dialog | **Recommended** |
| C · Wizard in the Backlog | Features only has the switch; the Backlog offers "Connect with GitHub", a three step dialog | Proposed |

## Rules for all variants

- Off by default; when off, no GitHub section, button or issue number is visible and imported data is kept.
- The token is never shown after saving. Desktop app: operating system keychain. Browser: for the session only. Public preview: simulated GitHub answers, labelled "Demo", no real token.
- Import and sync run only by hand. Read access only.
- GitHub wins on title, description, labels, criteria and their ticks; sprint, points, rank and the board column of open stories stay local.
- Errors (no network, wrong token, repository not found) say what happened and that the local data is unchanged.

## Decision (PO, #30)

Variant B. Milestones and epics are not synchronised for now (no "milestone → epic" option); this replaces the earlier answer in the issue.
