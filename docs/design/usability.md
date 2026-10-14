# Design: usability

Issue: [#32 Improve usability: unified actions, quick actions, gestures](https://github.com/goerks/GetThingsDone/issues/32)

The mockups are in [`usability-variants.html`](usability-variants.html) (open the file in a browser; the mockup text is in German because it is reviewed in German). One mockup per proposal of the issue; the PO selects which are built. Screenshots of the page sections: `usability-unify.png`, `usability-quick-1.png`, `usability-quick-2.png`, `usability-gestures.png`, `usability-feedback.png`.

## Principles

- The same action looks and works the same on every page (board, backlog, story map, epics, releases).
- Every quick action exists as a menu entry as well as a key or gesture; menus are the single place where all of them are listed (Q1), so nothing has to be discovered by chance.
- Single-key shortcuts never fire while a text field has focus.
- Every gesture has a visible button or menu alternative; touch targets are at least 44 by 44 px.
- Feedback is visible and also announced to screen readers; animations respect "reduce motion".

## Proposals

| ID | Design |
|---|---|
| U1 | One click opens cards, rows, chips; drag starts after 4 px; cursor is a hand |
| U2 | "Delete" at the left of the dialog footer in all four detail dialogs; immediate with undo toast; choice for the stories of an epic, sprint or release |
| U3 | Create dialogs: footer with Cancel and primary button, Ctrl+Enter saves; backdrop click or Esc asks "Discard input?" only when something was typed |
| U4 | Primary "New …" button with its shortcut at the right of every page head, also on the story map |
| Q1 | Context menu (right click, menu key, Shift+F10, long press): Open, Status, Sprint, Epic, Points, top of backlog, Delete |
| Q2 | "+ Story" at the end of every board column, backlog section and map cell; title field, Enter creates and stays open |
| Q3 | "Create and add another" (Ctrl+Shift+Enter) keeps epic, sprint, release, points |
| Q4 | Keys on a focused card: 1–9 status, E edit, [ ] sprint, Ctrl+Up/Down move, Delete; help line while focused |
| Q5 | Result bar style "3 of 8" with previous and next (J/K, arrows) in the story dialog, in the order of the originating page |
| Q6 | `?` opens the shortcut overview (page shortcuts first); `/` search; `G` then letter goes to a page |
| Q7 | Multi-select with Ctrl/Shift click, floating action bar, drag moves the group |
| Q8 | Points pill and status dot open small pickers on the card |
| Q9 | Pasting several lines into "new criterion" offers one criterion per line |
| G1 | Long press opens the context menu as a bottom sheet on touch |
| G2 | Swipe a card right or left to the next or previous status, with the target shown behind |
| G3 | Board on phones: status bar and one column at a time, swipe to switch |
| G4 | Dialogs as bottom sheets on narrow screens, swipe down closes |
| G5 | Auto-scroll in an edge zone while dragging, with a visible gradient |
| G6 | Shift+wheel and drag on empty space pan wide views |
| F1 | Toast at the bottom after create, move, delete (undo once #27 exists), announced to screen readers |
| F2 | New or moved story scrolls into view and gets a green frame for 2 s |
| F3 | Remember last page, compact map, rows and scroll position (switch in settings) |
| F4 | Empty columns, sections and pages offer the next action |
| F5 | Ctrl+Z / Ctrl+Shift+Z (with #27) |

## Decisions

PO decisions (issue #32, 2026-10-13): packages one after the other with feedback after each; delete immediately with undo (needs #27); a click opens; no single-key shortcuts, so the overview opens with `Ctrl+/`; touch moves to #34; quick add takes the title only; one status per swipe (#34); remember the view is on by default (package 4).

Package 1 is built: U1, U3, U4, Q1, Q2, Q3, Q6, F1, F2, F4. Differences from the mockups: the shortcut hint sits under the footer buttons (they do not fit in one row), the open quick-add field replaces the button at the same height with the hint as placeholder, the context menu has no Delete and no "top of backlog" yet, and the release page lost the extra "+ Release" card.
