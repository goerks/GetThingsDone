# Functional requirements

Release 0.1 (app skeleton, including the PO feedback from the first test). Tests: `src/domain/board.test.ts`, `src/domain/epics.test.ts` (unit), `src/App.test.tsx` (component).

## Board (BOARD)

### FR-BOARD-01 Show the sprint on a board
As a team member, I want to see the stories of the current sprint in columns by status, so that I know the state of the work.
- Columns "To do", "In progress", "Review" and "Done", each with its count.
- Each column is a clearly separated lane with its own background, border and header line, as tall as the board.
- Only stories in the sprint are shown, ordered by backlog priority.
- An empty column shows a drop hint.
- A card shows key, title (link to the detail), criteria progress, epic and points.

Source: Vision, PO feedback · Status: Implemented · Verified by: App "shows the demo stories in their columns", "does not show stories that are not in the sprint", "shows each column as its own lane"

### FR-BOARD-02 Move stories with drag and drop
As a team member, I want to drag a story to another column or position, so that the board reflects the progress.
- The whole card can be dragged, with mouse, touch and keyboard (focus the card, space to pick up, arrow keys, space to drop, escape to cancel). There is no separate handle.
- While dragging, the target column is highlighted and a line shows where the story will land.
- Dropping in the upper half of a card places the story before it, in the lower half after it; dropping on a column appends it to that column.
- The move updates the status and the backlog priority, and is saved.

Source: Vision, PO feedback · Status: Implemented · Verified by: board.test "dropStory" (all cases), App "makes the whole card a keyboard stop…"; highlight and line: manual check in Chromium

### FR-BOARD-07 Open a story from the board
As a team member, I want to open a story by double-clicking its card.
- Double click on the card, Enter on the focused card or a click on the title opens the story.
- A single click on the card surface does nothing, so grabbing a card never opens it by accident.

Source: PO feedback · Status: Implemented · Verified by: App "opens a story on double click", "makes the whole card a keyboard stop…"

### FR-BOARD-03 Announce drag and drop to screen readers
As a screen reader user, I want each drag step to be announced in my language, so that I can move stories without seeing the board.

Source: Vision (accessibility) · Status: Implemented · Verified by: manual check (automated check open, see QR-01)

### FR-BOARD-04 Sprint summary
As a team member, I want to see the number of stories and the sum of points in the sprint.

Source: Vision · Status: Implemented · Verified by: App "summarises the sprint", board.test "adds up the points of the sprint only"

### FR-BOARD-05 Create a story
As a team member, I want to create a story with title, description, epic and points from the board or the backlog, so that I can capture new work.
- "New story" on the board and in the backlog opens a dialog (not an inline form). Escape, "Cancel" or a click outside closes it without saving.
- Title is required, description optional, values are trimmed.
- The new story gets the next free key (`S-<n>`), status "To do" and the end of the backlog.
- "In Sprint 1" is ticked when the dialog is opened from the board and unticked from the backlog, so a story from the backlog lands below the sprint line.
- A new epic can be created from the epic field.

Source: Vision, PO feedback · Status: Implemented · Verified by: App "creates a story in "To do" through a dialog", "closes the new story dialog without saving on cancel", "adds a new story below the sprint line from a dialog", board.test "createStory"

### FR-BOARD-06 Configurable columns
As a team, we want to configure the board columns, so that the board fits our process.

Source: Vision (MVP scope) · Status: Open (see technical debt TD-4)

## Backlog (BACKLOG)

### FR-BACKLOG-01 Ordered backlog
As a PO, I want to see all stories in priority order with rank, key, title, epic and points.
- Ranks are numbered across the whole backlog.
- Enter on a focused row, double click or a click on the title opens the story.

Source: Vision · Status: Implemented · Verified by: App "numbers the ranks across both sections", "opens a story with Enter"

### FR-BACKLOG-02 Reorder the backlog with drag and drop
As a PO, I want to drag a story to a new position, so that the order expresses the priority.
- The whole row is dragged, with mouse, touch or keyboard. There are no up and down buttons.
- While dragging, a line shows where the story will land, labelled with the rank it will get ("becomes rank 3").
- The new order is saved and also changes the board order.

Source: Vision, PO feedback · Status: Implemented · Verified by: board.test "backlog" (all cases), App "has no move or sprint buttons…"; line and label: manual check in Chromium

### FR-BACKLOG-03 Sprint membership
As a PO, I want to add a story to the sprint or remove it, so that I can plan the sprint.
- Drag a story across the sprint line, or use the sprint checkbox on the story page.

Source: Vision · Status: Implemented · Verified by: board.test "plans a story into the sprint…", "takes a story out of the sprint…", App "changes status, epic, points and sprint membership"

### FR-BACKLOG-04 Sprint line
As a PO, I want a visible line in the backlog that separates the sprint from the rest.
- The sprint is shown above the line with its number of stories and points, the other stories below it under "Not planned".

Source: Vision (MVP scope), PO feedback · Status: Implemented · Verified by: App "separates the sprint from the rest with the sprint line"

## Story detail and acceptance criteria (STORY)

### FR-STORY-01 Story detail
As a team member, I want to open a story and see its description, status, epic, points and sprint membership.
- An unknown story id shows a message instead of an error.

Source: Vision · Status: Implemented · Verified by: App "shows a message for an unknown story"

### FR-STORY-02 Tick off acceptance criteria
As a PO, I want to tick off each criterion and see the progress, so that I can accept the story.
- Progress is shown as "x of y accepted" and as a bar, also on the card.
- When all criteria are ticked, an "all accepted" message is announced.

Source: Vision · Status: Implemented · Verified by: App "ticks a criterion and updates the progress", "announces when every criterion is accepted", board.test "acceptance criteria"

### FR-STORY-03 Add acceptance criteria
As a PO, I want to add a criterion to a story. Empty text is ignored.

Source: Vision · Status: Implemented · Verified by: App "adds a criterion", board.test "adds a criterion at the end"

### FR-STORY-04 Edit and delete stories and criteria
As a team member, I want to change or delete stories and criteria.
- Title and description are edited in place: click the text, Enter (Ctrl+Enter for the description) or leaving the field saves, Escape discards. An empty title is not saved.
- Status, epic, points and sprint membership are fields on the story page and save on change.
- A criterion's text can be edited in place, the criterion can be deleted and reordered by drag and drop (handle, keyboard).
- A story is deleted only after a confirmation on the page; afterwards the board is shown.

Source: Vision (work items), PO feedback · Status: Implemented · Verified by: App "edits the title…", "discards an edit…", "edits the description…", "changes status, epic, points…", "edits and deletes acceptance criteria", "deletes a story only after confirmation", board.test "editing stories", "moves a criterion…"

## Epics (EPIC)

### FR-EPIC-01 Epics group stories
Every story belongs to one epic. The epic is shown with name and colour dot.

Source: Vision · Status: Implemented

### FR-EPIC-02 Manage epics
As a PO, I want to create, rename, recolour and delete epics.
- Page "Epics" in the main navigation lists every epic with its colour dot, name and number of stories.
- "New epic" opens a dialog with name and one of eight colours; the first unused colour is suggested.
- The name is edited in place. A click on the colour dot opens the palette (a radio group, also by keyboard); picking a colour saves it and closes the palette, Escape or a click outside closes it unchanged.
- An epic that still has stories cannot be deleted; the page says how many stories use it.
- The epic field on the story page and in the new story form offers "+ New epic…".

Source: Vision, PO feedback · Status: Implemented · Verified by: App "epics" tests, "creates a new epic from the epic field", epics.test

## Settings (SET)

### FR-SET-01 Language
As a user, I want to switch the UI between Deutsch, English, Français and Italiano. The choice is remembered; without a choice the browser language is used, else English.

Source: Vision · Status: Implemented · Verified by: App "switches the language and the document language"

### FR-SET-02 Theme
As a user, I want to switch between a light and a dark theme. The choice is remembered; without a choice the system preference is used.

Source: ADR 0002 · Status: Implemented · Verified by: App "switches the theme and remembers it"

## Storage (DATA)

### FR-DATA-01 Local storage
All data is stored locally: in a SQLite file in the desktop app, in the browser's local storage in the browser build. Changes are saved immediately and in order.

Source: Vision, ADR 0001 · Status: Implemented · Verified by: App tests (local storage); SQLite: manual check (integration tests open, TD-3)

### FR-DATA-02 Demo data on first start
On first start with an empty database, demo epics and stories are created so the board is not empty.

Source: Vision · Status: Implemented

### FR-DATA-03 Report storage errors
If loading or saving fails, a translated error message is shown.

Source: — · Status: Implemented

## Navigation (NAV)

### FR-NAV-01 Main navigation
Header with board, backlog and epics; the current page is marked. "Story Map" is shown as planned for release 2.

Source: Vision · Status: Implemented · Verified by: App "marks the current page", "parses known routes and falls back to the board"

## Release 2 (planned)

| ID | Requirement | Status |
|---|---|---|
| FR-MAP-01 | User story map with activities, activity steps, release and sprint slices | Open |
| FR-MAP-02 | Sprint planning on the map | Open |
