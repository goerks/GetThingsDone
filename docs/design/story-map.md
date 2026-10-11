# Design: user story map

Issue: [#2 User story map with sprints as slices](https://github.com/goerks/GetThingsDone/issues/2)

## Variants

Three variants were proposed to the product owner. The mockups are in [`story-map-variants.html`](story-map-variants.html) (open the file in a browser; the mockup text is in German because it was reviewed in German).

| Variant | Idea | Outcome |
|---|---|---|
| A · Grid like the board | Epic headers across the top, sprint labels in a left column, board-coloured cells in between. Header row and label column stay in place while scrolling. Dragging highlights the target cell, its epic header and its sprint label (crosshair) and shows a drop line. | **Chosen** |
| B · Sprint bands | Each sprint is a full-width, collapsible band with a header bar (name, dates, capacity bar). | Not built |
| C · Compact overview | Dense table with one-line story chips, no status or points. | Not built; candidate for a later "compact" toggle on top of A |

## Decisions

| Topic | Decision |
|---|---|
| Header | Epics only, one column each, ordered by their position. "+" at the end adds an epic. |
| Rows | Running and future sprints, ordered by start date. Past sprints (end before today) are not shown on the map. The last row is "Not planned". |
| Sprint | Name, start date, end date. A new sprint is prefilled: "Sprint n", starting the day after the last sprint ends (or today), two weeks long. Clicking a sprint label edits it. |
| Board | Shows only the running sprint: the one whose dates include today; if none runs, the next upcoming one; otherwise the last one. |
| Backlog | One section per sprint (past sprints included) plus "Not planned". Dragging between sections changes the sprint. |
| Cells | Board-coloured lanes with compact cards (key, title, points, status). A "+" in each cell creates a story with that epic and sprint. |
| Drag and drop | Whole card; target cell, epic header and sprint label are highlighted; a line shows the position. Dropping changes sprint and epic. Order inside a cell follows the backlog priority. |
