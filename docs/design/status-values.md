# Design: status values

Issue: [#5 Configurable status values and board columns](https://github.com/goerks/GetThingsDone/issues/5)

The mockups are in [`status-values-variants.html`](status-values-variants.html) (open the file in a browser; the mockup text is in German because it is reviewed in German).

## Decisions (PO, 2026-10-13)

- Fixed categories in a fixed order: *not started* → *in progress* → *done*. At least one status in *not started* and one in *done*.
- Order is free only within a category; a *done* column never stands before an *in progress* column.
- Colours: one base colour per category (slate, blue, green). The first status of a category has the full colour, the following ones get lighter shades, computed automatically. There is no colour picker; the name is always shown next to the colour.
- The board shows a band per category above its columns, with name, category colour and story count.
- Dragging a status into another group changes its category. When stories have that status, a confirmation says how many and that they count as done (or open) from today on; the release history records the change on that day.
- New stories get the first status in *not started*.
- Removing a status value in use: the confirmation states the number of stories and asks for the target status (default: the status to the left).
- The board keeps a minimum column width and scrolls horizontally; no maximum number of status values.

## Variants

| Variant | Idea | Outcome |
|---|---|---|
| A · Grouped by category | Three fixed groups; drag within and across groups. | **Chosen**, with category shades instead of free colours and a category band on the board |
| B · One list, category per row | Like the option editor of #4 with a category select per row; free order, rules reported as messages. | Rejected: rules only show up as errors, free order allows a confusing board |
| C · Board preview | Empty columns under category bands; name and colour in a popover. | Rejected: too wide, hard to operate by keyboard and on narrow screens; the band idea moved to the board itself |

## Dragging between categories (PO, 2026-10-13)

The first build used one sortable list over all three groups, which pushed the rows below the dragged status out of their groups while dragging, and always dropped *behind* the status it was over. Now every row stays in place while dragging, a copy follows the pointer, and a line shows where the status lands: in front of the status it is over (upper half) or behind it (lower half), as on the board and the story map. An empty category shows "Drag a status here" and takes the drop. Only the dragged status changes its category; nobody is switched.

