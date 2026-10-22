# Design system: Focus

Source of truth for all tokens is `tokens.css`. See ADR 0002 for the reasoning. Since #70 the tokens and the shared components are shown in the Storybook catalogue (https://goerks.github.io/GetThingsDone/, per pull request at `<preview address>/design-system/`), and the rules for using them are in [`../design-system.md`](../design-system.md) (mandatory, ADR 0006). This page keeps the principles and the notes on feature specific components below; numbers in it (sizes, radii, z-index) are historic, the tokens are authoritative.

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
| Story card | ID (mono), title as link, criteria progress bar with count, epic dot and name, points pill. The whole card is the drag source; a click or Enter opens it (cursor `pointer`, `grabbing` while dragging); right click, menu key or Shift+F10 open the context menu |
| Backlog row | Rank (mono), ID, title, epic, points. Dragged as a whole, no buttons |
| Backlog sections | One section per sprint on a `--column` surface with name, dates and a "running" badge; a 3 px rule in `--text` separates "Not planned" |
| Story map | Variant A of `story-map.md`: epic headers with a 4 px colour stripe, sticky sprint labels (running sprint with a 4 px accent edge), cells in `--column`, compact cards with a status dot and the status name. "Not planned" row dashed below a 3 px rule. While dragging: target cell in `--accent-soft`, epic header and sprint label with an accent ring (crosshair), drop line |
| Running badge | Small uppercase pill in `--accent-soft` / `--accent-soft-ink`. The state badges of a sprint (#17): "running" like this, "planned" in `--pill` / `--muted`, "ended" in `--warn-soft` / `--warn` |
| Sprint hint and message | Above the board columns (`design/sprint-lifecycle.md`): a hint with an icon, a title, a line of text and the button "Start sprint" (planned sprint, `--accent-soft`) or "Complete sprint" (ended sprint, `--warn-soft` with a `--warn` edge); a message after completing in `--surface` with a green edge and a close button. Always icon and text, never colour alone |
| Start and complete dialogs | Native dialog (`Dialog`) with figures (`sprint-figure`), a line of changes, a meter, collapsible story lists, option cards (radio and checkbox) with a second line, and the actions. See `design/sprint-lifecycle.md` |
| Drop line | 4 px `--accent` line in the gap where the item will land; in the backlog with an accent pill "becomes rank n" |
| Editable text | Looks like text, shows a border on hover, turns into a field on click |
| Epic swatches | Eight 18 px dots as a radio group; the selected one has a ring. Shown in the new-epic and the epic dialog |
| Compact cards | On the story map, a pressed "Compact" switch turns cards into one-line chips: key and title, ellipsis |
| Sprint drop line | Reordering a sprint shows a 4 px accent line across the map row with a pill naming the sprint and its new dates |
| Create dialog footer | "Cancel" and the primary button at the right, the hint "Ctrl+Enter saves · Esc cancels" in muted 12 px text under them; "Add and add another" between them in the new-story dialog. "Discard input?" appears as a bar in `--danger-soft` under the form (focus on "Keep editing") |
| New button | The primary "New …" button at the right of every page head, with the shortcut in a small mono key (`Ctrl+N`) inside the button |
| Context menu | 190 px panel (`--surface`, border, shadow) at the pointer or the card, items 34 px, marked item in `--accent-soft`, status and epic with their colour dot, current choice with a tick, submenu at the right (left when it would leave the window); a transparent layer behind it catches the click beside it |
| Quick add | Dashed "+ Story" row under a column or section, 44 px high; open it becomes a title field of the same height (placeholder "Title – Enter adds, Esc closes"), so the page does not shift. In a map cell the existing "+" |
| Notice (toast) | Dark `--text` bar at the bottom centre, 5 s, with a close button; live region `role="status"` |
| Highlight frame | A moved or new story: 2 px `--epic-green` border and a 3 px soft ring for 2 s, a short pulse unless "reduce motion" |
| Shortcut overview | Dialog with a group per page and "Everywhere"; keys as small mono keycaps |
| Acceptance popup | Preview only, in magenta (`--tool`, used nowhere in the product): round 66 px button with a progress ring, a count badge and a "Preview" tag at the bottom left; 400 px popup above it with a magenta header, a strip of all steps (green, red, outlined for the current one), one test case at a time; it moves to the side without the target; the target glows magenta for 3 s (`.acceptance-glow`) |
| Dialog | Native modal `<dialog>`, 560 px wide (detail dialogs 1040 px), dimmed backdrop, title and form; used for creating and for the details of stories, epics and sprints, which never get a page of their own. Primary actions on pages ("New story", "New epic") open a dialog instead of an inline form |
| Acceptance criteria list | Drag handle, checkbox, editable text and delete button per criterion, progress bar, "all accepted" status message |
| Details panel | Status, epic, points as selects, sprint as checkbox, "Delete story" with confirmation below a rule |
| Definition panel | Story dialog (#26, `design/definitions.md`): two cards under the criteria ("Definition of Ready · 2/5 ⚠" and "… of Done"; Ready opens in "not started" and Done in "in progress", each only while an item is open), groups as uppercase `--pill` heads with the counter at the right that fold, a checkbox per item (dashed look for an automatic item with the tag "automatic", a dash for not relevant, text struck through) and a quiet "Not relevant" button only where the item allows it |
| Definition chip | Small pill in `--warn-soft` / `--warn` with ⚠ and text ("Not ready 3/5" in the backlog, "Not done 1/3" on the board) plus a 3 px `--warn` edge on the card or row |
| Transition dialog | Native dialog: title "S-8 to “In progress”: 2 items still open", the open items by group with the panel's rows, a problem line in `--warn-soft`, buttons "Move" (disabled until all resolved), "Open story", "Cancel" and the link-like "Override the gate…", which turns the dialog into a second, deliberate step in a `--warn` frame ("Back to the items", "Override and move" in the danger style) |
| Definitions settings | One card per list as in the chosen mockup `definitions-editor2-n6.png` (pill switch, title with summary, fold caret; groups as a bold name with a rule under it, items as text that edits in place, ⚙ automatic / ✋ manual, a small “–” toggle for “may be n/a”, ✕ to remove, “+ New item” row and “📚 Library” button), rows with drag handle, name field, tag, "may be n/a" checkbox and remove button; group rows on `--pill`; forms to add an item, an automatic item and a group |
| Search field | See `search.md`. 300 px in the header with a search icon and a `Ctrl+F` hint; 420 px with an accent ring while open. Badges inside the field in `--accent-soft`: field name in bold, "=", value, ✕ |
| Search dropdown | 560 px panel below the field: page scope switch, a note in `--danger-soft` for unknown fields or values, field or value suggestions ("@" or "=" icon, the text to type in mono), grouped results with uppercase group labels, marked option in `--accent-soft` with a 3 px accent edge, matches in `--mark`, footer with key hints |
| Result bar | Bar in `--accent-soft` at the top of a detail dialog opened from the search: query, "Result n of m", previous, next, "Back to search" |
| Highlighting | While a search is active, matching cards, rows, epic headers and sprint labels get an accent border with an `--accent-soft` ring; non-matching cards and rows drop to 38 % opacity (80 % on hover or focus). A bar in `--accent-soft` above the page content names the count and offers "Clear search". Results on the current page carry an "On this page" pill in `--accent-soft` |

## Tokens added later

- `--warn`, `--warn-soft` (#17): a sprint that has ended but is not completed. 5.4:1 on `--warn-soft` in the light theme, 6.5:1 in the dark theme.

## Open points

- High contrast theme (later)
