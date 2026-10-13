# Design: help system

Issue: [#33 Help system](https://github.com/goerks/GetThingsDone/issues/33)

## Variants

The PO wants help to look things up (preferably interactive) and an optional introduction that is never forced. Three concepts, all with a `?` button in the header as the fixed entry point. The mockups are in [`help-variants.html`](help-variants.html) (open the file in a browser; the mockup text is in German because it is reviewed in German). Screenshots: `help-a1.png` to `help-c3.png`.

| Variant | Idea | Outcome |
|---|---|---|
| A · Help side panel with "First steps" checklist | `?` opens a panel next to the page: help for the current page, search, "Show me" highlights the element in the app. The introduction is an optional checklist in the same panel that ticks steps off when they are really done. A small dismissible card offers it on first start. | **Chosen by the PO**, built in #33 |
| B · Help centre with lessons | `?` opens its own page `#/help` with search, topics and learning paths. Lessons run on a practice board with demo data. | Possible later, once content grows |
| C · Guided tour with hotspots and help search | A tour dims the page and walks over real elements; small `?` hotspots sit next to elements; a command-palette style help search. | Parts adopted: help search and a soft "Show me" highlight |

## Decisions (PO, #33)

- Concept A as the base, with the help search and the soft "Show me" frame of C; B can follow once the content grows.
- The invitation on the first start is a small dismissible card. The introduction has four steps (board, move a story, create a story, order the backlog); only the first is confirmed by the user, the others are ticked off by the app when the user does them after the start. The steps work on the user's own data and can be skipped.
- First version topics: board, backlog, story map, epics, releases, settings, search and keyboard shortcuts, in DE, EN, FR and IT.
- What the help remembers (invitation answered, progress) is kept per device in `localStorage`, like theme and language. It is not part of the team's data, so the repository (SQLite) is unchanged.
