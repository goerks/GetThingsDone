# Design: help system

Issue: [#33 Help system](https://github.com/goerks/GetThingsDone/issues/33)

## Variants

The PO wants help to look things up (preferably interactive) and an optional introduction that is never forced. Three concepts, all with a `?` button in the header as the fixed entry point. The mockups are in [`help-variants.html`](help-variants.html) (open the file in a browser; the mockup text is in German because it is reviewed in German). Screenshots: `help-a1.png` to `help-c3.png`.

| Variant | Idea | Outcome |
|---|---|---|
| A · Help side panel with "First steps" checklist | `?` opens a panel next to the page: help for the current page, search, "Show me" highlights the element in the app. The introduction is an optional checklist in the same panel that ticks steps off when they are really done. A small dismissible card offers it on first start. | Proposed base |
| B · Help centre with lessons | `?` opens its own page `#/help` with search, topics and learning paths. Lessons run on a practice board with demo data. | Possible later, once content grows |
| C · Guided tour with hotspots and help search | A tour dims the page and walks over real elements; small `?` hotspots sit next to elements; a command-palette style help search. | Parts adopted: help search and a soft "Show me" highlight |
