# Functional requirements

Release 0.1 (app skeleton, including the PO feedback from the first test), issue #2 (story map with sprints) and issue #4 (configurable fields, in progress). Tests: `src/domain/board.test.ts`, `src/domain/epics.test.ts`, `src/domain/sprints.test.ts`, `src/domain/migrate.test.ts`, `src/domain/fields.test.ts` (unit), `src/App.test.tsx` (component), `src/data/sqliteRepository.test.ts` (integration, SQLite in memory).

## Board (BOARD)

### FR-BOARD-01 Show the sprint on a board
As a team member, I want to see the stories of the current sprint in columns by status, so that I know the state of the work.
- Columns "To do", "In progress", "Review" and "Done", each with its count.
- Each column is a clearly separated lane with its own background, border and header line, as tall as the board.
- Only stories in the sprint are shown, ordered by backlog priority.
- An empty column shows a drop hint.
- A card shows key, title (link to the detail), criteria progress, epic and points. Hidden built-in fields (FR-FIELD-10) are left out.

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
As a team member, I want to see the name and dates of the sprint on the board, with the number of stories and the sum of points. When points are hidden (FR-FIELD-10), the summary shows the number of stories only.

Source: Vision, issue #2 · Status: Implemented · Verified by: App "summarises the sprint", board.test "adds up points"

### FR-BOARD-05 Create a story
As a team member, I want to create a story with title, description, epic and points from the board or the backlog, so that I can capture new work.
- "New story" on the board and in the backlog opens a dialog (not an inline form). Escape, "Cancel" or a click outside closes it without saving.
- Title is required, description optional, values are trimmed.
- The new story gets the next free key (`S-<n>`), status "To do" and the end of the backlog.
- The sprint field is prefilled: the running sprint from the board, "Not planned" from the backlog, the cell's sprint (and epic) on the story map.
- The epic is optional: the dialog starts with "No epic" unless it is opened from a map cell. A new epic can be created from the epic field.

Source: Vision, PO feedback · Status: Implemented · Verified by: App "creates a story in "To do" through a dialog", "closes the new story dialog without saving on cancel", "adds a new story below the sprint line from a dialog", "creates a story directly in a cell…", board.test "createStory"

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
As a PO, I want to plan a story into a sprint or take it out, so that I can plan sprints.
- Drag a story into another sprint section, or choose the sprint on the story page, in the new story dialog or on the story map.

Source: Vision · Status: Implemented · Verified by: board.test "plans a story into the sprint…", "takes a story out of the sprint…", App "changes status, epic, points and sprint membership"

### FR-BACKLOG-04 Sprint sections
As a PO, I want the backlog grouped by sprint, so that I see what is planned when.
- One section per sprint in time order (past sprints included) with name, dates, "running" mark, number of stories and points; then "Not planned", separated by a strong rule.
- Ranks are numbered across all sections.

Source: Vision (MVP scope), PO feedback · Status: Implemented · Verified by: App "shows one section per sprint and the unplanned stories last"

## Story detail and acceptance criteria (STORY)

### FR-STORY-01 Story detail in a dialog
As a team member, I want to open a story and see its description, status, epic, points and sprint, without leaving the page I am on.
- Double click on a card or row, Enter on a focused card or a click on its title opens the story in a dialog over the current page (board, backlog or story map). The address does not change.
- Escape, the close button or a click outside closes the dialog and returns focus to the card.
- The same applies to epics (click on an epic name, an epic header on the map or a row of the Epics page) and sprints (click on a sprint label on the map); releases will follow the same pattern.

Source: Vision, PO feedback on #2 · Status: Implemented · Verified by: App "makes the whole card a keyboard stop…", "opens a story on double click", "opens a story over the current page…", "opens the epic of a story from its epic name", "opens an epic from its column header"

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
A story belongs to one epic or to none. The epic is shown with name and colour dot; a story without an epic shows none.
- The epic field in the story dialog and in the new story dialog offers "No epic".

Source: Vision, #4 · Status: Implemented · Verified by: App "creates a story without an epic and clears the epic of a story", sqliteRepository.test "saves a story without an epic"

### FR-EPIC-02 Manage epics
As a PO, I want to create, rename, recolour and delete epics.
- Page "Epics" in the main navigation lists every epic with its colour dot, name and number of stories. A click on an epic opens it in a dialog.
- "New epic" opens a dialog with name and one of eight colours; the first unused colour is suggested.
- In the epic dialog the name is edited in place and the colour is picked from the palette (a radio group, also by keyboard); both are saved at once.
- An epic that still has stories cannot be deleted; the dialog says how many stories use it.
- The epic field on the story page and in the new story form offers "+ New epic…".

Source: Vision, PO feedback · Status: Implemented · Verified by: App "epics" tests, "creates a new epic from the epic field", epics.test

## Fields (FIELD)

Configurable fields, issue #4, data model in ADR 0003. Stages 1 to 5 of the feature: custom fields on stories and epics, layout per item type, eight data types, renaming and hiding system and built-in fields. Sprints and releases as item types follow in #9.

### FR-FIELD-01 Field library as a matrix
As a team, we want to see every field of the workspace and the item types that use it, so that we know what our items carry.
- The section "Fields" of the settings (FR-SET-03) lists all fields with name and type, grouped into system, built-in and custom fields, with one checkbox column per item type: Stories, Epics, Releases. Sprints are shown as a planned column. Custom fields cannot be used on releases yet (#9); their cell in the Releases column is empty.
- System fields (key, title, story status, the release of a story) are ticked and locked. Built-in fields (description, epic, points, acceptance criteria on stories; colour on epics; start and end on releases) can be switched off (hidden), except the epic, which stays locked for now (FR-FIELD-10), and the description of releases, which is always shown. A field that does not exist for a type shows "–".
- A click on the checkbox of a custom field uses it on that type or takes it off, and is saved at once. Taking a field off hides it in that type's dialog but keeps its values, so they come back when the field is used again.
- System and built-in fields cannot be deleted, neither in the UI nor by either storage backend; they can be renamed (FR-FIELD-10). Missing ones are added automatically when data is loaded, also for data of release 0.1.

Source: #4, PO feedback (variant A in `docs/design/field-assignment.md`) · Status: Implemented · Verified by: App "shows a matrix of fields and item types…", "puts a field on epics…", "takes a field off stories without losing its values", "opens data of release 0.1…", "offers no way to delete, edit or switch off system fields and the epic", fields.test "missingBuiltins", "setAssigned", "locked fields", sqliteRepository.test "adds missing built-in fields…", "never deletes a system or built-in field", localStorageRepository.test "never deletes a system or built-in field"

### FR-FIELD-02 Create a custom field
As a team, we want to add our own fields, so that stories carry the information we need.
- "New field" opens a dialog with name, type (text, long text, number, date, checkbox, single select, multi select, link) and the item types that use it (Stories ticked by default, Epics).
- Single and multi select fields have ordered options, each with a name and one of eight colours. Options can be added and removed.
- An optional default value fills in new stories and epics: text, a number, a date, a link, "ticked" for a checkbox, one option or several options. A default that does not fit the type is refused.
- The name is required and unique among custom fields (ignoring case). A select field needs at least one option and no two options with the same name. Problems are shown in the dialog.

Source: #4 · Status: Implemented · Verified by: App "creates a select field…", "adds a text field for stories and epics, shows it everywhere and keeps its values after a reload", "explains what is wrong with a new field", fields.test "validateField", "createField"

### FR-FIELD-03 Edit a custom field
As a team, we want to rename a field and change its options.
- The edit dialog changes name, options and default. Where the field is used is switched in the matrix (FR-FIELD-01).
- The type can change only where every value is kept: text → long text, number → text, date → text, link → text, single select → multi select. The dialog offers only these; for any other type the type is locked with a hint to create a new field. Values and the default are converted.
- Renaming an option keeps the values that use it. Removing an option removes these values on stories and epics.

Source: #4 · Status: Implemented · Verified by: App "renames a field and removes an option…", "turns a single select into a multi select…", "offers only the type changes that keep every value…", fields.test "updateField", "type changes", "type changes in detail" (all 64 type pairs), "dropRemovedOptions", sqliteRepository.test "moves values to the storage of their new type…", "keeps every value for each allowed type change", "migrations 005 and 006…"

### FR-FIELD-04 Delete a custom field
As a team, we want to delete a field we no longer need.
- A confirmation says how many stories and how many epics lose a value. Deleting removes the field, its options, where it is used and all its values.

Source: #4 · Status: Implemented · Verified by: App "deletes a field after saying how many stories lose a value", fields.test "deleteField", "withoutField", sqliteRepository.test "deletes a field…", localStorageRepository.test "deletes a custom field…"

### FR-FIELD-05 Custom field values in the story dialog
As a team member, I want to fill in the custom fields of a story.
- The story dialog shows the custom fields used on stories in the details panel, in their order.
- Text and long text are edited in place like the description. A number field saves on Enter or when it is left; an entry that is not a number shows "Enter a number." and is not saved. Decimal comma and point are accepted. A select field offers its options and "No value".
- A date uses the date picker of the system. A checkbox saves when ticked or unticked. A multi select shows one checkbox per option with its colour. A link is edited in place, gets "https://" when the scheme is missing, accepts only http(s) addresses ("Enter a web address…" otherwise) and offers "Open …" in a new tab.
- On cards, a ticked checkbox shows "✓ name", a date shows in the UI language, a link shows its host, a multi select its option labels with their colours.
- Empty text or "No value" removes the value.

Source: #4 · Status: Implemented · Verified by: App "creates a select field…", "edits text and number values on the story page", "creates date, checkbox, multi select and link fields…", fields.test "parseValue", "more data types", sqliteRepository.test "sets, changes and clears values of every type", "stores dates, checkboxes, links and multi selects…"

### FR-FIELD-06 Demo fields
The demo data contains the custom fields "Priority" (single select: Must, Should, Could; used on stories and epics), "Business value" (number), "Labels" (multi select: UI, Data, Accessibility) and "Spec" (link), the last three on stories, with values on several stories and epics.

Source: #4 · Status: Implemented · Verified by: sqliteRepository.test "stores the demo data with its fields and values", "stores values of epics…"

### FR-FIELD-07 Custom field values in the epic dialog
As a PO, I want to fill in the custom fields of an epic.
- The epic dialog shows the custom fields used on epics below the colour, with the same controls as the story dialog (FR-FIELD-05).
- The values of an epic are deleted together with the epic.

Source: #4 · Status: Implemented · Verified by: App "puts a field on epics and edits its value in the epic dialog", sqliteRepository.test "stores values of epics and deletes them with the epic"

### FR-FIELD-08 Layout per item type
As a team, we want to decide the order of our fields, which ones are required, and which ones appear when creating an item and on its card.
- The fields section has two tabs: "Assignment" (the matrix, FR-FIELD-01) and "Layout". Layout has a tab per item type (Stories, Epics; Sprints and Releases planned).
- System and built-in fields are listed first with "Fixed position". Custom fields are reordered by drag and drop with a handle (mouse, touch, keyboard, announced to screen readers); the order applies to the story and epic dialogs and the create dialogs.
- Per custom field: "Required", "In create dialog", and for stories "On card". A required field is always in the create dialog. At most 3 fields show on a card; further "On card" boxes are disabled.
- Card: the values of the "On card" fields show as small chips on board and story map cards (select values with their colour; hidden in compact mode).

Source: #4, PO feedback (variant B in `docs/design/field-assignment.md`) · Status: Implemented · Verified by: App "makes a field required…", "shows the values of the fields chosen for the card", fields.test "layout per item type"; drag with mouse and keyboard: manual check in Chromium

### FR-FIELD-09 Required fields and default values when creating and editing
As a team member, I want new items to start with sensible values and required fields to be filled in.
- The new story and new epic dialogs show the custom fields marked "In create dialog" and every required one, prefilled with the default values. Defaults also apply to fields that are not in the dialog.
- Creating is refused while a required field is empty: "Please fill in: …" names the fields and they are marked.
- In the story and epic dialogs a required field is marked "(required)"; an empty one says "Required, not filled in yet", and clearing it is refused with "This field is required."

Source: #4 · Status: Implemented · Verified by: App "makes a field required, so the new story dialog asks for it, with defaults filled in", "does not let a required field be cleared…", "sets a default value in the field dialog", fields.test "default values", sqliteRepository.test "stores default values of fields"

### FR-FIELD-10 Rename and hide system and built-in fields
As a team, we want to call the fields by our own names and switch off the built-in fields we do not use.
- Every system and built-in field except the key has "Rename field …" in the matrix. The new name is one label shown in every language; the dialog names the translated default, and "Reset to …" brings it back. An empty name also resets it. The name is used in the story, epic and create dialogs, on the matrix and layout, and for points in the sprint, backlog and story map summaries ("12 Effort").
- Description, points and acceptance criteria (stories) and colour (epics) can be hidden by unticking them in the matrix. A hidden field disappears from the dialogs, create dialogs, cards and summaries; colour also from epic tags and the story map stripe. Values stay and come back when the field is shown again.
- Key, title and status cannot be hidden ("System field, always used"). The epic of a story cannot be hidden for now ("The epic cannot be hidden for now"; PO decision in #4).

Source: #4, PO decision 2026-10-11 · Status: Implemented · Verified by: App "hides points, so the board, cards and dialogs leave them out…", "hides acceptance criteria, description and epic colour", "renames built-in and system fields with one label and resets them", "renames title, description, epic, criteria and colour and uses the names in every dialog, also after a reload", fields.test "renaming and hiding built-in fields", sqliteRepository.test and localStorageRepository.test "keeps the label and hidden state of a built-in field" / "keeps a renamed and hidden built-in field"

## Releases (REL)

Release planning, issue #10; design in `docs/design/release-planning.md`. Phase 1 of the feature: releases, assigning stories, the release field. Phase 2 adds the story map rows. The scope report and the burndown follow in the next phases of the same pull request.

### FR-REL-01 Releases
As a PO, I want to plan releases, so that I see which stories belong to a release and how big it is.
- A release has a title (required), a description and an optional start and end day (both days belong to the release; the end cannot be before the start; one date alone is fine).
- Its size is the number of its stories and the sum of their points; "done" counts the stories with status done.
- A release is planned, running or done. This is derived, never stored: done when it has stories and all are done; running when its start day is today or earlier; otherwise planned (also without a start day). Adding a story or reopening one makes a done release run again.
- Deleting a release keeps its stories and removes their release.

Source: Issue #10 · Status: Implemented · Verified by: releases.test, App "releases page", "release dialog"

### FR-REL-02 Releases page
A main navigation entry "Releases" (`#/releases`) shows one card per release: title, state, period, description, stories, points, points done and a progress bar. Releases are ordered by start day (without a start day after those with one), done releases last. A click opens the release. The last, dashed card creates a release. Without releases the page explains what a release is.

Source: Issue #10, PO design (cards) · Status: Implemented · Verified by: App "is part of the main navigation and lists the demo releases as cards", "shows an empty page…"

### FR-REL-03 Create a release
"+ Release" (the last card of the releases page, or the row on the story map in release mode) opens the dialog "New release" (title, description, start, end). Ctrl+N does the same on the releases page (see FR-NAV-02).

Source: Issue #10 · Status: Implemented · Verified by: App "creates a release with a title only, through the last card", "asks for a title and refuses an end before the start", "creates a release from the map"

### FR-REL-04 Release dialog
A release opens in a dialog with the tabs "Details" and "Stories" (arrow keys switch). Title, description and dates are saved at once; a date that would put the end before the start is refused with a message and not saved. The details show size and progress and, when stories are planned in sprints that end after the release, a hint that names them (it never blocks). "Stories" lists the release's stories (key, title, epic, sprint, points, status), adds a story that has no release and removes one; a title opens the story. Deleting asks first and states how many stories lose their release.

Source: Issue #10, PO design (tabs in the dialog) · Status: Implemented · Verified by: App "release dialog" tests

### FR-REL-05 Release of a story
"Release" is a system field of stories: it cannot be removed, but renamed (FR-FIELD-10). A story belongs to at most one release. The story dialog has a select with "No release" and every release that is not done (plus the story's own); a change is saved at once. When the sprint of the story ends after its release, a hint says so.

Source: Issue #10 · Status: Implemented · Verified by: App "release on stories" tests, releases.test "selectableReleases", sqliteRepository.test "releases"

### FR-REL-06 Release on cards and in the new-story dialog
Both are off by default. In Settings › Fields › Layout › Stories the Release row can show the release in the create dialog and as a small tag on the card (not counted in the three card fields).

Source: Issue #10, PO decision · Status: Implemented · Verified by: App "keeps the release out of the new-story dialog…", "shows the release on the card only when the team ticked "On card""

### FR-REL-07 Release fields in the settings
The matrix has an active Releases column: title and description are always shown, start and end can be switched off (the dialogs then leave them out). Layout for releases and custom fields on releases follow with #9.

Source: Issue #10 · Status: Implemented · Verified by: App "release fields in the settings", fields.test

### FR-REL-08 Demo and migration
The demo data has two releases with demo stories. Data of earlier versions (SQLite migration 007, browser data) gets no releases and no release on stories; the title and description of releases are added to the field library on load.

Source: Issue #10 · Status: Implemented · Verified by: sqliteRepository.test "migration 007", "adds the title and description of releases…", localStorageRepository.test "migrates browser data without releases", migrate.test

### FR-REL-09 Story map rows: sprints or releases
As a PO, I want to plan on the story map by release, so that I see what ships when.
- What the rows are is a team setting, chosen in Settings › Story map (`#/settings/map`): sprints (the default) or releases, as a radio group of two cards, saved at once. The section lists next to "Fields"; a link leads back to the map. When releases are chosen and there is no release yet, a note says the map then shows only "No release" and links to the releases page.
- The head of the story map shows the choice as a link ("Rows: Releases" with a gear) to that setting, in both modes.
- In release mode each row is a release (order as on the releases page, releases that are done are left out like past sprints), plus a last row "No release". The label shows state, period, stories and points, a hint when stories are planned in sprints that end after the release, and opens the release. "+ Release" adds a release.
- Dragging a story into another cell changes its epic and its release in one move (mouse, touch, keyboard, announced in all four languages) and keeps its sprint, so the backlog stays grouped by sprint. The drop line and the highlight work as in sprint mode. "+" in a cell creates a story with that epic and release.

Source: Issue #10, PO decision · Status: Implemented · Verified by: board.test "story map with releases as rows", settings.test, StoryMapReleases.test, sqliteRepository.test "settings", localStorageRepository.test "keeps the settings…"

### FR-REL-10 Scope report
Scope increase and decrease of a release over time, in tickets and in points, from an append-only history.

Source: Issue #10 · Status: Planned (phase 3)

### FR-REL-11 Burndown
Remaining tickets and points over time with an ideal line when start and end are set.

Source: Issue #10 · Status: Planned (phase 4)

## Settings (SET)

### FR-SET-01 Language
As a user, I want to switch the UI between Deutsch, English, Français and Italiano. The choice is remembered; without a choice the browser language is used, else English.

Source: Vision · Status: Implemented · Verified by: App "switches the language and the document language"

### FR-SET-02 Theme
As a user, I want to switch between a light and a dark theme. The choice is remembered; without a choice the system preference is used.

Source: ADR 0002 · Status: Implemented · Verified by: App "switches the theme and remembers it"

### FR-SET-03 Settings page
As a team, we want the workspace settings in one place that stays out of the way of the daily work.
- A gear button next to theme and language opens the settings (`#/settings/fields`); it is marked while the settings are open. Pressed again ("Close settings"), it goes back to the page shown before. The main navigation holds only the working views.
- The settings list their sections next to the content (on narrow screens as chips above it). "Fields" is the first section, "Story map" the second (FR-REL-09). "Status values" (#5) is shown as planned and cannot be opened yet.
- The former address `#/fields` opens the fields section.

Source: #4, PO feedback (variant A in `docs/design/settings.md`) · Status: Implemented · Verified by: App "opens the fields from the settings, not from the main navigation", "closes the settings with the gear…", "parses known routes…"

## Storage (DATA)

### FR-DATA-01 Local storage
All data is stored locally: in a SQLite file in the desktop app, in the browser's local storage in the browser build. Changes are saved immediately and in order.

- Database migrations keep all existing stories and criteria (checked for migrations 003 and 004).

Source: Vision, ADR 0001 · Status: Implemented · Verified by: App tests (local storage); sqliteRepository.test (SQLite in memory, migrations); the Tauri boundary: manual check (TD-3)

### FR-DATA-02 Demo data on first start
On first start with an empty database, demo epics, two sprints (one running, one following) and stories are created so the board and the story map are not empty.

Source: Vision · Status: Implemented

### FR-DATA-03 Report storage errors
If loading or saving fails, a translated error message is shown.

Source: — · Status: Implemented

## Navigation (NAV)

### FR-NAV-02 Ctrl+N creates what the page is about
Ctrl+N (Cmd+N on a Mac) opens the create dialog of the current page: a new story on the board (prefilled with the running sprint), the backlog and the story map (not planned), a new epic on the epics page, a new release on the releases page. It does nothing in the settings, and not while a dialog is open. The create buttons name the shortcut (`aria-keyshortcuts`); the last release card shows it. Many browsers keep Ctrl+N for a new window and never pass it on, so the web preview may not react; the desktop app does, and the buttons work everywhere.

Source: Issue #10, PO request · Status: Implemented · Verified by: NewShortcut.test; Windows app: manual check

### FR-NAV-01 Main navigation
Header with board, backlog, story map, epics and releases, plus a gear button for the settings; the current page is marked.

Source: Vision · Status: Implemented · Verified by: App "marks the current page", "parses known routes and falls back to the board"

## Sprints (SPRINT)

### FR-SPRINT-01 Sprints with dates
As a PO, I want to plan several sprints, each with a name, a start date and an end date (both days included).
- A story belongs to one sprint or to none ("Not planned").
- A new sprint is prefilled: "Sprint n", starting the day after the last sprint ends (or today), two weeks long.
- The end date cannot be before the start date; the name is required.
- The single "Sprint 1" of release 0.1 is migrated to a real sprint running from the day of the update for two weeks.

Source: Issue #2 · Status: Implemented · Verified by: sprints.test, migrate.test, App "adds a sprint…", "refuses a sprint…", "migrates browser data of release 0.1…"

### FR-SPRINT-02 Running sprint on the board
The board shows the running sprint: the sprint whose dates include today; if none runs, the next upcoming one; otherwise the last one. Without any sprint, the board asks to create one on the story map.

Source: Issue #2 · Status: Implemented · Verified by: sprints.test "running sprint", App "asks to create a sprint when there is none"

## Story map (MAP)

### FR-MAP-01 Show the story map
As a PO, I want to see all stories in a grid of epics and sprints, so that I see which parts of the product are planned when.
- One column per epic (by epic position), with name, colour stripe, number of stories and points. While a story has no epic, a last column "No epic" holds these stories; stories can be dragged into it and created in it (#4).
- One row per running or future sprint in time order, with name, dates, number of stories and points; the running sprint is marked. Sprints that ended before today are not shown.
- The last row is "Not planned", separated by a strong rule.
- Each story is a card (key, title, points, status) in the cell of its epic and sprint, in backlog order.
- Header row and sprint labels stay visible while the map scrolls.

Source: Issue #2 (variant A), #4 · Status: Implemented · Verified by: App "story map" tests, "shows stories without an epic in their own column on the story map", board.test "story map"

### FR-MAP-02 Plan on the map with drag and drop
As a PO, I want to drag a story into another cell, so that I change its sprint and epic in one move.
- The whole card is dragged with mouse, touch or keyboard (space, arrow keys between cells, space; Escape cancels; Enter and double click open the story).
- While dragging, the target cell is highlighted, and so are its epic header and sprint label (crosshair). A line shows the position in the cell.
- Dropping changes epic and sprint and is saved; the backlog stays grouped by sprint.
- Moves are announced in DE, EN, FR and IT ("… goes to Sprint 2, Backlog, position 1").

Source: Issue #2 · Status: Implemented · Verified by: board.test "story map"; highlight, crosshair and keyboard drag: manual check in Chromium

### FR-MAP-03 Create sprints, epics and stories on the map
- There are no create buttons in the page head: everything is created where it belongs on the map.
- "+ Sprint" below the last sprint opens the sprint dialog, prefilled.
- A click on a sprint label edits its name and dates.
- "+" at the end of the epic headers opens "New epic".
- "+" in a cell opens "New story" with that epic and sprint prefilled.

Source: Issue #2, PO feedback · Status: Implemented · Verified by: App "adds a sprint…", "edits a sprint…", "adds an epic as a new column", "creates a story directly in a cell…", "has no "New story" or "+ Sprint" buttons at the top…"

### FR-MAP-04 Reorder upcoming sprints
As a PO, I want to drag a sprint that has not started yet up or down, so that I can change the order of the coming sprints.
- Only sprints whose start date is after today can be dragged (mouse, touch, keyboard). They cannot be dropped above the running sprint or below "Not planned".
- While dragging, a line shows the new position with the sprint's new dates.
- After the drop, every upcoming sprint keeps its length and the start dates follow each other without gaps from the end of the running sprint.

Source: PO feedback on #2 · Status: Implemented · Verified by: sprints.test "reordering upcoming sprints", App "lets only sprints that have not started be dragged"; drag with line and dates: manual check in Chromium

### FR-MAP-05 Compact cards
As a PO, I want to collapse the cards on the map to one line (key and title) and back, so that I see more of the plan at once. The switch "Compact" is in the page head and is remembered.

Source: PO feedback on #2 · Status: Implemented · Verified by: App "switches to compact cards and remembers the choice"

## Search (SEARCH)

### FR-SEARCH-01 Search from every page
As a team member, I want to search from every page with `Ctrl+F` (`Cmd+F`), so that I find a story, epic or sprint without knowing where it is.
- The search field is in the header. `Ctrl+F` / `Cmd+F` focuses it and selects the text; an open detail dialog closes first.
- Results appear while typing in a dropdown, grouped into stories, epics and sprints, at most five per group with "+ n more".
- Free text is found in the key, title, description, acceptance criteria and custom field values (#4) of stories and in the names of epics and sprints. Custom fields count as content, like the description; checkboxes are not searched. Case and accents are ignored, several words must all occur, double quotes search an exact phrase.
- The match is marked. A match outside the title shows where it was found (description, criterion or the name of the custom field) and a snippet.
- An exact key (`S-12`) comes first, then matches in key or title, then other matches; within these, backlog order.

Source: #7 · Status: Implemented · Verified by: search.test, Search.test "search field"

### FR-SEARCH-02 Filter by fields in the search text
As a PO, I want to combine free text with field filters typed in the same field, so that I find for example all open stories of an epic.
- A filter is typed as `field:value` (or `field=value`), e.g. `status:open points:5 epic:"local storage"`. Field names work in the UI language and in English; field and value names may be shortened while unique; case and accents are ignored. Fields: description (contains the text), status, epic, sprint, points, type, criteria and all custom fields (#4). Key and title are not fields; they are found by the free text (PO decision in #7).
- A word that starts like a field name lists the matching fields (typing "Punk" offers "Punkte"); `@` or `Ctrl+Space` lists all fields. `Tab` or `Enter` takes the field and lists its values; choosing a value, or starting the next word after a complete `field:value`, turns it into a badge `Field = value`.
- All filters and the free text are combined with AND. Each field is used at most once: a field that is set is shown as "already set" and cannot be chosen; typing it again replaces its value.
- One `Backspace` at the start of the field removes the last badge completely; ✕ on a badge removes it.
- The search field stays on one line: badges that do not fit are cut off with a fade, and a counter "+n" names how many more there are.
- An unknown field or value is named in a note under the field and left out of the search.
- There are no filter buttons, value counts, "is not" or several values per field (PO decision on #8).

Source: #7, PO feedback on #8 · Status: Implemented · Verified by: search.test "typed field filters", "badges", Search.test "field filters typed in the search"

### FR-SEARCH-03 Keyboard and opening a result
- Focus stays in the field; `↑`/`↓` move through the suggestions and results, `Enter` opens or takes the marked entry, `Tab` takes a field or value, `Esc` closes the list and a second `Esc` resets the search.
- A result is shown where it is before its detail dialog opens (PO feedback on #8):
  1. If the current page shows it, the item is marked there, scrolled into view and focused.
  2. Otherwise the app switches to the first page that shows it (story: board for the running sprint, backlog, story map; epic: epics page, story map; sprint: board, story map, backlog) and marks it there.
  3. If no page shows it, the dialog opens over the current page.
  The mark stays until the search is cleared; closing the dialog returns focus to the item. Recently opened items from the history follow the same order.
- The detail dialog shows "Result n of m" with previous, next and "Back to search"; `←` and `→` step to the previous and next result (not while a field has focus), `Esc` closes the dialog. Back reopens the list with the same result marked.
- Back on the page after closing the dialog, `Esc` resets the search: text, badges, highlighting and mark.
- Screen readers get a combobox with a grouped listbox and hear the number of results.

Source: #7, PO feedback on #8 · Status: Implemented · Verified by: Search.test "search field", "opening a result where it is shown", search.test "where a result is shown"

### FR-SEARCH-04 History and starting over
- An empty field shows the last 5 searches with their badges and the 5 items opened last, also those opened from board or map. A search is remembered when a result is opened from it or it is shown on the page with `Ctrl+Enter`.
- An entry is removed with ✕ or `Delete`; "Clear history" removes all. The history stays on the device.
- ✕ in the field clears text and badges. Without results, the list offers to search without one of the filters, with the number of results, or to start over.

Source: #7 · Status: Implemented · Verified by: searchHistory.test, Search.test "history", "suggests dropping a filter…"

### FR-SEARCH-05 Results on the current page
As a team member, I want to see search matches where they are on the page I am looking at, so that I keep the context.
- While a search is active, matching stories on board, backlog and story map get an accent border and the others are dimmed, already while typing. On the story map matching epic headers and sprint labels are marked too; on the epics page matching epics.
- A bar above the page shows "n of m stories here match" with the query and "Clear search".
- The result list is ordered by relevance only; items shown on the current page carry "On this page". There is no switch to limit the results to the page (PO decision in #7).
- "Show on <page>" or `Ctrl+Enter` closes the list and scrolls to the first match.

Source: #7 (variant D), PO feedback on #8 · Status: Implemented · Verified by: search.test "current page", Search.test "the current page"

## Later

| ID | Requirement | Status |
|---|---|---|
| FR-MAP-06 | Activities above epics on the map | Open (out of scope of #2) |
| FR-SEARCH-06 | Search in a side panel next to the board (rest of variant D) | Open (out of scope of #7) |
| FR-SEARCH-07 | Saved searches with a name | Proposed (PO undecided) |
| FR-MAP-07 | Release slices in addition to sprints | Implemented in #10, phase 2 (see FR-REL-09) |
