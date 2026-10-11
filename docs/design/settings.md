# Design: settings

Issue: [#4 Customizable fields](https://github.com/goerks/GetThingsDone/issues/4), pull request #6

## Variants

The Fields page was a fifth entry in the main navigation, next to Board, Backlog, Story Map and Epics. The PO found it too prominent: fields are set up once and rarely changed. Three variants move it into the settings. The mockups are in [`settings-variants.html`](settings-variants.html) (open the file in a browser; the mockup text is in German because it was reviewed in German).

| Variant | Idea | Outcome |
|---|---|---|
| A · Settings page | A gear button next to theme and language opens `#/settings/fields`: a settings page with a list of sections on the left (on narrow screens as chips on top) and the content on the right. Fields is the first section; the status values of #5 follow. | **Chosen**; the status values of #5 are already listed as planned |
| B · Gear menu | The gear opens a menu; each entry leads to its own page. | Possible later, once there are many settings |
| C · Settings dialog | A large dialog with tabs over the current page. | Not proposed: a dialog on top of a dialog for new fields, little room, no address |
