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
| App header | Logo, main navigation with underline for the current page, theme switch, language, user |
| Board column | Own lane: `--column` background, border, header with a rule; as tall as the board. While dragging, the target column turns `--accent-soft` with an accent border |
| Story card | ID (mono), title as link, criteria progress bar with count, epic dot and name, points pill. The whole card is the drag source (cursor `grab`); double click or Enter opens it |
| Backlog row | Rank (mono), ID, title, epic, points. Dragged as a whole, no buttons |
| Sprint line | The sprint section sits on a `--column` surface; a 3 px rule in `--text` separates it from "Not planned" |
| Drop line | 4 px `--accent` line in the gap where the item will land; in the backlog with an accent pill "becomes rank n" |
| Editable text | Looks like text, shows a border on hover, turns into a field on click |
| Epic swatches | Eight 18 px dots as a radio group; the selected one has a ring. On the epics page they appear in a popover under the epic's colour dot |
| Dialog | Native modal `<dialog>`, 560 px wide, dimmed backdrop, title and form; used for new story and new epic. Primary actions on pages ("New story", "New epic") open a dialog instead of an inline form |
| Acceptance criteria list | Drag handle, checkbox, editable text and delete button per criterion, progress bar, "all accepted" status message |
| Details panel | Status, epic, points as selects, sprint as checkbox, "Delete story" with confirmation below a rule |

## Open points

- High contrast theme (later)
