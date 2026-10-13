# Design system: Focus

Source of truth for colours, spacing and radii is `tokens.css`. See ADR 0002 for the reasoning. The clickable reference is the "Focus" row of the design canvas.

## Principles

- Calm and scannable. One accent colour, everything else neutral.
- Colour never carries meaning alone. Epic names, status names and criteria counts are always written out.
- Every interactive element is a real `button`, `a` or form control, at least 44 by 44 px, with a visible focus ring.
- Both themes (light, dark) ship from the start. Components read tokens only.

## Type

- Text: IBM Plex Sans, 400 / 500 / 600.
- IDs and numbers: IBM Plex Mono, 12 px.
- Page title 22 px, card title 15 px, body 14 to 16 px, column header 13 px uppercase.

## Components (MVP)

| Component | Notes |
|---|---|
| App header | Logo, main navigation with underline for the current page, search field, theme switch, language, user. Sticky at the top of the window (`z-index: 30`, height shared as `--header-height`) |
| Board column | Own lane: `--column` background, border, header with a rule and the status dot; as tall as the board, at least 240 px wide; the board scrolls sideways when the columns do not fit. While dragging, the target column turns `--accent-soft` with an accent border |
| Category band | Above the columns of each status category (#5): name in uppercase, story count in mono, 3 px top edge in the category colour (`--epic-slate` not started, `--epic-blue` in progress, `--epic-green` done) |
| Status dot | The colour of a status: the category colour for the first status of a category, lighter `color-mix` shades with `--surface` for the following ones. Always next to the status name |
| Status value list | Settings › Status values: one group per category with the category colour as top edge and its rule in the head; rows with drag handle, status dot, name field, story count and remove button (lock for the last status of "not started" and "done"); dashed "+ Status in …" button per group |
| Story card | ID (mono), title as link, criteria progress bar with count, epic dot and name, points pill. The whole card is the drag source (cursor `grab`); double click or Enter opens it |
| Backlog row | Rank (mono), ID, title, epic, points. Dragged as a whole, no buttons |
| Backlog sections | One section per sprint on a `--column` surface with name, dates and a "running" badge; a 3 px rule in `--text` separates "Not planned" |
| Story map | Variant A of `story-map.md`: epic headers with a 4 px colour stripe, sticky sprint labels (running sprint with a 4 px accent edge), cells in `--column`, compact cards with a status dot and the status name. "Not planned" row dashed below a 3 px rule. While dragging: target cell in `--accent-soft`, epic header and sprint label with an accent ring (crosshair), drop line |
| Running badge | Small uppercase pill in `--accent-soft` / `--accent-soft-ink` |
| Drop line | 4 px `--accent` line in the gap where the item will land; in the backlog with an accent pill "becomes rank n" |
| Editable text | Looks like text, shows a border on hover, turns into a field on click |
| Epic swatches | Eight 18 px dots as a radio group; the selected one has a ring. Shown in the new-epic and the epic dialog |
| Compact cards | On the story map, a pressed "Compact" switch turns cards into one-line chips: key and title, ellipsis |
| Sprint drop line | Reordering a sprint shows a 4 px accent line across the map row with a pill naming the sprint and its new dates |
| Dialog | Native modal `<dialog>`, 560 px wide (detail dialogs 1040 px), dimmed backdrop, title and form; used for creating and for the details of stories, epics and sprints, which never get a page of their own. Primary actions on pages ("New story", "New epic") open a dialog instead of an inline form |
| Acceptance criteria list | Drag handle, checkbox, editable text and delete button per criterion, progress bar, "all accepted" status message |
| Details panel | Status, epic, points as selects, sprint as checkbox, "Delete story" with confirmation below a rule |
| Search field | See `search.md`. 300 px in the header with a search icon and a `Ctrl+F` hint; 420 px with an accent ring while open. Badges inside the field in `--accent-soft`: field name in bold, "=", value, ✕ |
| Search dropdown | 560 px panel below the field: page scope switch, a note in `--danger-soft` for unknown fields or values, field or value suggestions ("@" or "=" icon, the text to type in mono), grouped results with uppercase group labels, marked option in `--accent-soft` with a 3 px accent edge, matches in `--mark`, footer with key hints |
| Result bar | Bar in `--accent-soft` at the top of a detail dialog opened from the search: query, "Result n of m", previous, next, "Back to search" |
| Highlighting | While a search is active, matching cards, rows, epic headers and sprint labels get an accent border with an `--accent-soft` ring; non-matching cards and rows drop to 38 % opacity (80 % on hover or focus). A bar in `--accent-soft` above the page content names the count and offers "Clear search". Results on the current page carry an "On this page" pill in `--accent-soft` |

## Open points

- High contrast theme (later)
