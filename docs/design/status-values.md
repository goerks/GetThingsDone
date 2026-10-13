# Design: status values

Issue: [#5 Configurable status values and board columns](https://github.com/goerks/GetThingsDone/issues/5)

## Decisions already taken (PO, 2026-10-13)

- Fixed categories *not started*, *in progress*, *done*; at least one status in *not started* and one in *done*.
- Every status value has its own colour; default derived from the category.
- New stories get the first status in board order, which is in *not started*.
- A category change counts from the day of the change in the release history.
- The board keeps a minimum column width and scrolls horizontally; no maximum number of status values.
- Removing a status value in use: the confirmation states the number of stories and asks for the target status.

## Variants

The mockups are in [`status-values-variants.html`](status-values-variants.html) (open the file in a browser; the mockup text is in German because it is reviewed in German).

| Variant | Idea | Outcome |
|---|---|---|
| A · Grouped by category | Three fixed groups; drag within and across groups, which changes the category. Board order follows the groups. | Proposed |
| B · One list, category per row | Like the option editor of #4 with a category select per row; free order, rules reported as messages. | Open |
| C · Board preview | Empty columns side by side under category bands; name and colour in a popover. | Open |

Shared by all variants: the removal dialog and the board with many columns.
