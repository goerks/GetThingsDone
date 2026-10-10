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
| Board column | Uppercase title, count, vertical stack of cards |
| Story card | ID (mono), title as link, criteria progress bar with count, epic dot and name, points pill, assignee, move buttons |
| Backlog row | Rank, ID, title, epic, points, sprint tag, up and down buttons |
| Acceptance criteria list | One checkbox per criterion inside a label, progress bar, "all accepted" status message |
| Details panel | Definition list of fields, configurable later |

## Open points

- Focus ring style and keyboard drag-and-drop pattern for the board
- Epic colour contrast check for each token pair
- High contrast theme (later)
