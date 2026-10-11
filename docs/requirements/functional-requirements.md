# Functional requirements

Release 0.1 (app skeleton). Tests: `src/domain/board.test.ts` (unit), `src/App.test.tsx` (component).

## Board (BOARD)

### FR-BOARD-01 Show the sprint on a board
As a team member, I want to see the stories of the current sprint in columns by status, so that I know the state of the work.
- Columns "To do", "In progress", "Review" and "Done", each with its count.
- Only stories in the sprint are shown, ordered by backlog priority.
- An empty column shows a drop hint.
- A card shows key, title (link to the detail), criteria progress, epic and points.

Source: Vision · Status: Implemented · Verified by: App "shows the demo stories in their columns", "does not show stories that are not in the sprint"

### FR-BOARD-02 Move stories with drag and drop
As a team member, I want to drag a story to another column or position, so that the board reflects the progress.
- Works with mouse, touch and keyboard (space to pick up, arrow keys, space to drop, escape to cancel).
- Dropping on a card places the story next to it; dropping on a column appends it to that column.
- The move updates the status and the backlog priority, and is saved.

Source: Vision · Status: Implemented · Verified by: board.test "dropStory" (all cases), App "offers a keyboard accessible drag handle for every card"

### FR-BOARD-03 Announce drag and drop to screen readers
As a screen reader user, I want each drag step to be announced in my language, so that I can move stories without seeing the board.

Source: Vision (accessibility) · Status: Implemented · Verified by: manual check (automated check open, see QR-01)

### FR-BOARD-04 Sprint summary
As a team member, I want to see the number of stories and the sum of points in the sprint.

Source: Vision · Status: Implemented · Verified by: App "summarises the sprint", board.test "adds up the points of the sprint only"

### FR-BOARD-05 Create a story
As a team member, I want to create a story with title, description, epic and points, so that I can capture new work.
- Title is required, description optional, values are trimmed.
- The new story gets the next free key (`S-<n>`), status "To do", is in the sprint and at the end of the backlog.

Source: Vision · Status: Implemented · Verified by: App "creates a story in "To do"", board.test "createStory"

### FR-BOARD-06 Configurable columns
As a team, we want to configure the board columns, so that the board fits our process.

Source: Vision (MVP scope) · Status: Open (see technical debt TD-4)

## Backlog (BACKLOG)

### FR-BACKLOG-01 Ordered backlog
As a PO, I want to see all stories in priority order with rank, key, title, epic, points and sprint membership.

Source: Vision · Status: Implemented · Verified by: App "backlog" tests

### FR-BACKLOG-02 Reorder the backlog
As a PO, I want to move a story up or down, so that the order expresses the priority.
- The first story cannot move up, the last cannot move down.
- The new order is saved and also changes the board order.

Source: Vision · Status: Implemented · Verified by: App "moves a story up and stores the new order", board.test "moveInBacklog"

### FR-BACKLOG-03 Sprint membership
As a PO, I want to add a story to the sprint or remove it, so that I can plan the sprint.

Source: Vision · Status: Implemented · Verified by: App "adds a story to the sprint", board.test "sprint"

### FR-BACKLOG-04 Sprint line
As a PO, I want a visible line in the backlog that separates the sprint from the rest.

Source: Vision (MVP scope) · Status: Partial (membership shown per row as a tag, no line yet)

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

Source: Vision (work items) · Status: Open

## Epics (EPIC)

### FR-EPIC-01 Epics group stories
Every story belongs to one epic. The epic is shown with name and colour dot.

Source: Vision · Status: Implemented (epics come from the demo data)

### FR-EPIC-02 Manage epics
As a PO, I want to create, rename and delete epics.

Source: Vision · Status: Open

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
Header with board and backlog; the current page is marked. "Story Map" is shown as planned for release 2.

Source: Vision · Status: Implemented · Verified by: App "marks the current page", "parses known routes and falls back to the board"

## Release 2 (planned)

| ID | Requirement | Status |
|---|---|---|
| FR-MAP-01 | User story map with activities, activity steps, release and sprint slices | Open |
| FR-MAP-02 | Sprint planning on the map | Open |
