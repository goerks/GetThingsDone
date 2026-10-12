# Design: global search

Issue: [#7 Global search with Ctrl+F and filters](https://github.com/goerks/GetThingsDone/issues/7)

## Variants

Four variants for the final version were proposed to the product owner. The mockups are in [`search-variants.html`](search-variants.html), the detailed design of the chosen variant in [`search-detail.html`](search-detail.html) (open the files in a browser; the mockup text is in German because it was reviewed in German).

| Variant | Idea | Outcome |
|---|---|---|
| A · Header dropdown | Search field in the header, results in a dropdown below it, field filters as badges in the field | **Chosen**, built in #7 |
| B · Search palette | Centred overlay with a preview pane, filter shortcuts such as `status:open`, quick actions | Not built |
| C · Search page | Own page with facets and counts, saved searches, shareable link | Not built |
| D · Side panel and highlighting | Search next to the board; matching cards highlighted, the others dimmed | Live highlighting on the current page and a page scope built in #7; the side panel is open |

## Decisions

| Topic | Decision |
|---|---|
| Opening | `Ctrl+F` (`Cmd+F` on macOS) focuses the search from every page and selects the last text, so typing replaces it. It replaces the browser's own find in the web preview. An open detail dialog closes first. |
| Free text and fields | One field. Free text searches key, title, description, acceptance criteria and custom field values of stories (shown text, e.g. the option label; checkboxes left out), and the names of epics and sprints. Field filters are typed in the same field as `field:value` and become badges. |
| Field filters (PO decision on #8) | Typed as `field:value` in the search text, see the proposal below (variant A with `@`). Free text that names a value is no longer offered as a filter. |
| Fields | Status, Epic, Sprint, Points, Type, Criteria and all custom fields. No filter buttons, no value counts, no "Search in". |
| Combining | All filters and free text AND; each field once; no OR and no "is not" in this step. Several words must all occur, in any field and order; text in double quotes is an exact phrase. Case and accents are ignored. |
| Results | Grouped: stories, epics, sprints. At most five per group, then "+ n more". Order: exact key, match in key or title, match elsewhere, then backlog order. A story shows key, title, status, epic, points, criteria progress, sprint and, for a match outside the title, where it was found with a snippet. |
| Keyboard | Focus stays in the field (combobox with `aria-activedescendant`). `↑`/`↓` move, `Enter` opens or takes the marked suggestion, `Tab` takes a field or value, `@` or `Ctrl+Space` lists all fields, `Backspace` at the start removes the last badge, `Delete` removes a history entry, `Esc` closes the list. `Ctrl+Enter` closes the list and scrolls to the first match on the page. |
| After opening | The item is first shown where it is: on the current page if it is there, otherwise on the first page that shows it (story: board, backlog, map; epic: epics page, map; sprint: board, map, backlog); it is marked with an accent outline, scrolled into view and focused. Then it opens in its detail dialog with a bar "Result n of m", previous, next and "Back to search". Back reopens the dropdown with the same result marked. |
| History | An empty field shows the last 5 searches (remembered when a result is opened or shown on the page) and the 5 items opened last (from anywhere). Each can be removed; "Clear history" removes all. Kept per device in the webview's local storage, like theme and language. |
| Starting over | ✕ in the field clears text and badges. Without results, the list offers "Search without <filter>" with the number of results, and "Clear everything and start over". |
| Current page (PO feedback on #8) | Each page tells the search what it shows. While a query is active, matches on the page are highlighted live (accent border) and the rest dimmed; a bar shows "n of m stories here match" and "Clear search". In the list, items on the page come first with "On this page". A switch "Everywhere / Only <page>" limits the results to the page (remembered). "Show on <page>" (`Ctrl+Enter`) closes the list and scrolls to the first match. |

## Proposal: field filters typed in the search text (PO feedback on #8)

The PO wants to filter by fields only through the text field, without the filter buttons in the dropdown. Proposal in [`search-syntax.html`](search-syntax.html), images in [`search-syntax/`](search-syntax/):

- Syntax `field:value` (also `field=value`), quotes for values with spaces, field and value names may be shortened while unique, field names in the UI language plus English. Filters and free text are combined with AND; each field once; no OR and no "is not" in the first step.
- A finished filter becomes a badge `(Status) = Open`; one `Backspace` right after it removes it completely.
- Variant A (recommended): field suggestions while typing a word that starts like a field name; `Ctrl+Space` lists all fields.
- Variant B: field list only on request with `Ctrl+Space` or `@`.
- Variant C: choosing a field creates an empty badge; the value is typed inside the badge.

Decision of the PO: variant A with `@` as an extra trigger; the filter buttons with value counts, "is not", several values per field and "Search in" are removed. Implemented in #8.
