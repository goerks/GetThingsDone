# Design: backup (export and import)

Issue: [#16 Export and import all data (backup)](https://github.com/goerks/GetThingsDone/issues/16)

Mockups: [`backup-variants.html`](backup-variants.html) (open in a browser; the mockup text is German because it is reviewed in German).

## Variants

| Variant | Idea | Outcome |
|---|---|---|
| A · Section "Data" in Settings | New section in the settings list with two cards, "Export all data" and "Import data…". Room for the storage folder and the empty project of #28. | Proposed |
| B · Gear menu | Shortcut entries "Export data…" and "Import data…" in a menu under the gear. | Possible addition; not proposed on its own, because an import needs an explanation |

## Import flow (A and B)

1. "Choose file…" opens the file picker (save dialog on export in the Windows app, browser download in the web build).
2. The app checks the file. If it is valid, a confirmation dialog compares the file with the current data (stories, epics, sprints, releases) and warns that everything is replaced. Focus is on "Cancel"; "Replace data" is the red, destructive button; "Export current data first" is offered.
3. Messages in the card: export saved, import done, or a clear reason when the file is not valid or comes from a newer format. Data stay unchanged on errors.
4. Web preview: same screens, with the hint that the import replaces the demo data in this browser only.
