# Functional requirements

Release 0.1 (app skeleton, including the PO feedback from the first test), issue #2 (story map with sprints), issue #4 (configurable fields), issue #10 (release planning) and issue #5 (configurable status values) and issue #33 (help system) and issue #30 (GitHub issues). Tests: `src/domain/board.test.ts`, `src/domain/epics.test.ts`, `src/domain/sprints.test.ts`, `src/domain/migrate.test.ts`, `src/domain/fields.test.ts` (unit), `src/App.test.tsx` (component), `src/data/sqliteRepository.test.ts` (integration, SQLite in memory).

## Board (BOARD)

### FR-BOARD-01 Show the sprint on a board
As a team member, I want to see the stories of the current sprint in columns by status, so that I know the state of the work.
- One column per status value in the configured order (FR-BOARD-06), each with its count; the defaults are "To do", "In progress", "Review" and "Done".
- Each column is a clearly separated lane with its own background, border and header line, as tall as the board.
- Only stories in the sprint are shown, ordered by backlog priority.
- An empty column shows a drop hint.
- A card shows key, priority letter, points, title, epic, labels and the criteria count (FR-UI-01). Hidden built-in fields (FR-FIELD-10) are left out.

Source: Vision, PO feedback · Status: Implemented · Verified by: App "shows the demo stories in their columns", "does not show stories that are not in the sprint", "shows each column as its own lane"

### FR-BOARD-02 Move stories with drag and drop
As a team member, I want to drag a story to another column or position, so that the board reflects the progress.
- The whole card can be dragged, with mouse, touch and keyboard (focus the card, space to pick up, arrow keys, space to drop, escape to cancel). There is no separate handle.
- While dragging, the target column is highlighted and a line shows where the story will land.
- Dropping in the upper half of a card places the story before it, in the lower half after it; dropping on a column appends it to that column.
- The move updates the status and the backlog priority, and is saved.

Source: Vision, PO feedback · Status: Implemented · Verified by: board.test "dropStory" (all cases), App "makes the whole card a keyboard stop…"; highlight and line: manual check in Chromium

### FR-BOARD-07 Open a story from the board
As a team member, I want to open a story with one click on its card.
- A click anywhere on the card, Enter on the focused card or a click on the title opens the story; this holds on the board, in the backlog and on the story map (FR-UX-01).
- A drag starts after 4 px of movement, so a drag never opens the story.

Source: PO feedback, changed by #32 (was: double click) · Status: Implemented · Verified by: e2e AC1.1–AC1.4, App "opens a story on double click", "makes the whole card a keyboard stop…"

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
- The new story gets the next free key (`S-<n>`), the first status in "Not started" (by default "To do", FR-BOARD-06) and the end of the backlog.
- The sprint field is prefilled: the running sprint from the board, "Not planned" from the backlog, the cell's sprint (and epic) on the story map.
- The epic is optional: the dialog starts with "No epic" unless it is opened from a map cell. A new epic can be created from the epic field.

Source: Vision, PO feedback · Status: Implemented · Verified by: App "creates a story in "To do" through a dialog", "closes the new story dialog without saving on cancel", "adds a new story below the sprint line from a dialog", "creates a story directly in a cell…", board.test "createStory"

### FR-BOARD-06 Configurable columns
As a team, we want to define our own status values, and with them the board columns, so that the board fits our process.
- Settings › Status values (`#/settings/statuses`) lists the status values in three fixed categories in a fixed order: "Not started", "In progress", "Done". The board shows one column per status value in this order.
- Status values can be added at the end of a category, renamed (one name for every language; an empty name brings back the translated default of a default value), reordered inside a category and removed. Changes are saved at once.
- "Not started" and "Done" always keep at least one status value: the last one there shows a lock and can be neither removed nor moved to another category. New stories get the first status in "Not started".
- Dragging a status value into another category (or Alt+Arrow up/down in its name field across the edge of the category) changes its category, and only its category: no other status value is switched or moved. While dragging, every other status stays where it is; a line shows where the dragged one will land, on the upper or lower half of the status it is over (like the drop line on the board and the story map), or at the end of an empty category (it shows "Drag a status here"). When stories then become done or open again, a confirmation names how many stories (with their keys) and says that this counts from today; the release history records it on that day and earlier days stay as they were.
- A story counts as done when its status is in "Done": release progress, release state, scope report, burndown and the story map use this (FR-REL).
- Removing a status value that stories use opens a confirmation with the number of stories (and their keys) and a target status (default: the status to the left); confirming moves the stories and removes the value in one step.
- Colours: one base colour per category (slate, blue, green); the first status of a category has the full colour, the following ones get lighter shades. Colour is never alone: the name is always shown.
- The board shows a band per category above its columns with name, colour and story count. Columns keep a minimum width; with many columns the board scrolls sideways.
- Existing data keeps every story and its status: the four former statuses become the default values (SQLite migration 010, browser data migrated when read).

Source: Vision (MVP scope), #5, PO decisions of 2026-10-13 (`docs/design/status-values.md`); test cases AC1.1 to AC6.3 approved in issue #5 · Status: Implemented · Verified by: e2e `e2e/statusValues.spec.ts` (AC1.1, AC1.3, AC1.4, AC2.1, AC2.3, AC2.4, AC2.6, AC3.1, AC3.4, AC3.5, AC4.1, AC5.1, AC5.3, AC6.1, AC6.2, AC6.3); component `src/StatusValues.test.tsx` (AC1.1, AC1.2, AC2.2, AC3.2, AC3.3, AC4.1); unit `src/domain/statuses.test.ts` (rules, order, categories, removal, colours), `src/domain/history.test.ts` (category change in the release history); data `sqliteRepository.test` (AC5.2 migration 010, AC5.3), `localStorageRepository.test` (AC5.1). By hand: AC2.5 colours, AC5.2 Windows app with the real database, AC6.3 real screen reader

### FR-BOARD-08 Workflow: allowed transitions between statuses
As a team, we want to define which statuses a story may move to next, where new stories start and from which statuses they can be deleted, so that a story cannot jump from "To do" to "Done" when our process does not allow it.
- Settings › Workflows (`#/settings/workflows`) has a switch "Activate the workflow" at the top. It is off by default, as the definitions are. While it is off, every transition is allowed, new stories start in the first status of "Not started", and nothing in the app mentions the workflow. What was set stays saved.
- With the workflow on, the page is a list "from here to …": a row "New story" (the start: statuses of "Not started", at least one stays on), one row per status in its category, with the other statuses and "End (delete)" as toggle buttons (on = allowed). By default everything is allowed. A new status starts with every transition allowed; removing a status removes its transitions.
- Each category has a switch "Free transitions within the category": turned on, every transition inside the category is allowed; single ones can be forbidden afterwards ("with exceptions"); turned off, nothing changes. A category with one status has no use for it.
- Where a story's status is chosen (story dialog, card menu) only the current status and the allowed targets are offered. While a story is dragged on the board, columns it may not go to are locked, greyed with a lock, and name the reason on hover. A drop or keyboard move to a forbidden status changes nothing and shows a notice with the reason, which screen readers read out. The quick add of a column only exists where a story may start.
- A story in a status without a transition to the end cannot be deleted: the story dialog refuses at once, with the reason. When no status leads to the end, the settings show a warning; saving stays possible.
- Changing the workflow never changes existing stories. The workflow is stored per item type (stories only; epics have none) in the settings and travels with the export and import.
- Every change of the transitions (including a removed status) saves a version of the workflow with date and time. Settings › Workflows lists the versions, newest first, and the user can name a version and go back to any earlier one after a confirmation: that state becomes the current one as a new version, nothing is deleted. All versions are kept, travel with the export and import, and switching the workflow on or off creates none.
- The page shows the workflow first as a UML state diagram (AC13 to AC15): initial state, final state, one frame per category (composite state), a rounded rectangle per status, solid arrows forward, dashed arrows back, and one arrow from a frame to the end where every status of it may be deleted. "Free within the category" is one double arrow. With nothing forbidden only neighbouring arrows are drawn. A status or the start is chosen by click or keyboard and its targets are toggles below the diagram. A switch "Diagram | List" shows the list "from here to …" instead; both edit the same workflow. On a narrow screen the diagram is drawn upright. A text list of all transitions is there for screen readers (`src/domain/workflowDiagram.ts`, `src/pages/WorkflowDiagram.tsx`).
- Moving several stories at once, all or nothing, is built with the multi-select of #40.

Source: #49, PO decisions of 2026-10-15 (`docs/design/workflow.md`); test cases AC1.1 to AC16.1 approved in issue #49 (AC12 versions: PO, 2026-10-16; AC13 to AC16 diagram: PO, 2026-10-30) · Status: Implemented · Verified by: unit `src/domain/workflow.test.ts` (all cases), component `src/Workflows.test.tsx`, e2e `e2e/workflows.spec.ts` (AC1.1, AC2.3, AC3.1 to AC3.4, AC11.2); AC12.6 (keyboard and French texts): manual; layout and look of the lock: manual check in Chromium

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

Release planning, issue #10; design in `docs/design/release-planning.md`. Phase 1 of the feature: releases, assigning stories, the release field. Phase 2 adds the story map rows, phase 3 the history and the scope report, phase 4 the burndown.

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
A release opens in a dialog with the tabs "Details" and "Stories" (arrow keys switch). Title, description and dates are saved at once; a date that would put the end before the start is refused with a message and not saved. The details show size and progress and, when stories are planned in sprints that end after the release, a hint that names them (it never blocks). "Stories" lists the release's stories (key, title, epic, sprint, points, status), adds a story that has no release by full-text search and removes one; a title opens the story. The search field (a combobox with a listbox) finds stories by their key and title: all words must occur in any order, case and accents are ignored, a number alone ("7") or a key without the dash ("s7") finds "S-7", and the exact key comes first. The list shows at most eight matches and says how many more there are; the arrow keys move, Enter or a click adds the story and keeps the focus in the field for the next one, Escape closes the list (a second Escape the dialog). Matches and additions are announced to screen readers. Deleting asks first and states how many stories lose their release.

Source: Issue #10, PO design (tabs in the dialog), PO request (search) · Status: Implemented · Verified by: App "release dialog" tests, "adding a story by search", search.test

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
As a PO, I want to see how the scope of a release changed, so that I know whether it grows or shrinks.
- The release dialog has a third tab "Scope". A switch "Points | Tickets" (remembered, shared by all reports) chooses the unit; without the points field only tickets are shown.
- Four figures: scope at the start, increase, decrease and scope now. Below, a step chart of the scope and of what is done per calendar day up to today, with the change of each day marked and signed (`+8`, `−3`), and the same numbers as a table ("Show as table") for screen readers. Colour never carries the meaning alone.
- A list names every change after the start, newest first: story key and title (or "(deleted story)"), added, removed, or points before and after with the difference.
- **Start and changes:** the start is the state of the release on its start day (without one: on the first day of its history). A story added to the release after that day is an increase, one removed (also by deleting it) a decrease, a change of points counts as the difference. A change of status never changes the scope. Entries before or on the start day are part of the start.
- The history starts at the first record: the report says "Recorded since <date>. Nothing is known about the time before." and invents nothing earlier. A release that has stories but no history when the app loads starts its history with a baseline of those stories.
- The release cards show "Scope since start" with the net change in stories and points, or "±0".
- Without any entry the tab says so; with less than two days of history the chart is replaced by a note, the figures and the list stay.

Source: Issue #10, PO decisions · Status: Implemented · Verified by: history.test, ReleaseHistory.test "scope report", ReleaseJourney.test (a release from planning to the last day over three weeks with a controlled clock), sqliteRepository.test "history of releases"

### FR-REL-12 History of the releases
Every change of a story that matters for a release is appended to the history of that release and never changed: joining or leaving a release (moving to another release, deleting the story), a change of points and a change into or out of done while the story is in a release. Stories without a release are not recorded. Deleting a release deletes its history. The demo data brings a demo history, so the preview shows the report. Data of earlier versions gets an empty history (SQLite migration 009, browser data) and a baseline when loaded (FR-REL-10).

Source: Issue #10 · Status: Implemented · Verified by: history.test "releaseEventsFor", "baselineEvents", ReleaseHistory.test "recording the history", sqliteRepository.test, localStorageRepository.test

### FR-REL-11 Burndown
As a PO, I want to see how much of a release is left and whether it will make its end date.
- The release dialog has a fourth tab "Burndown" with the same unit switch as the scope report (points or tickets, remembered).
- Three figures: what is left now (scope minus done), what is done of the scope, and where the release stands against the target line ("6 P behind", "2 P ahead", "on the line", or "–" without a line).
- A chart of what is left per calendar day from the first recorded day to today, or to the end date when that is later. The line rises when stories are added and falls when stories are removed or finished; each change of the scope is marked and signed (`+8`, `−3`) like in the scope report. A dashed line marks today. The same numbers are available as a table ("Show as table") for screen readers; colour never carries the meaning alone.
- **Target line:** with a start and an end date it runs straight from what was left on the start day (when the history starts later: on the first recorded day) to nothing on the end day. Without both dates there is no line and the tab says what is missing. Without a history, or with less than two days of it, the tab says so like the scope report.
- It uses the history of FR-REL-12 and counts what is done by the status of the stories at that time.

Source: Issue #10, PO decisions · Status: Implemented · Verified by: burndown.test, ReleaseHistory.test "burndown", ReleaseJourney.test

## Settings (SET)

### FR-REL-13 Feature toggle for releases
As a PO of a team that works with sprints only, I want to switch the releases feature off and on again later without losing anything.
- Each feature has its own tab in Settings, in the group "Features" (Releases, Team); there is no separate tab "Features" (#61, FR-SET-FEATURE). The switch is at the top of the tab. A toggle is a team setting, on by default (Team: off), saved at once (`settings.features`, SQLite keys `feature_<name>`). While a feature is off, its tab is a start page (description, the note that data is kept, button "Switch on …"); the list labels both tabs "On" or "Off". `#/settings/features` leads to the tab "Releases". Verified by `src/SettingsFeatures.test.tsx`, `e2e/settingsFeatures.spec.ts`.
- Off: the main navigation has no "Releases", the address `#/releases` leads to the board, the story dialog, the create dialog and the cards do not show the release field, and the story map shows sprints.
- The story map says so clearly: in Settings › Story map the choice "Releases" is disabled, marked "Not available" and a warning above it says that releases are switched off, with a link to the toggle. When the team had chosen releases as rows, the map page shows the same warning with the link.
- In the field settings the release field and the column "Releases" are marked as not available because releases are switched off, with a link to the toggle.
- Nothing is deleted: releases, assignments of stories and the history stay, and are all back when the toggle is on again.

Source: Issue #10, PO requests · Status: Implemented · Verified by: ReleasesSwitch.test, settings.test, sqliteRepository.test "settings"

### FR-SET-01 Language
As a user, I want to switch the UI between Deutsch, English, Français and Italiano. The choice is remembered; without a choice the browser language is used, else English.

Source: Vision · Status: Implemented · Verified by: App "switches the language and the document language"

### FR-SET-02 Theme
As a user, I want to switch between a light and a dark theme. The choice is remembered; without a choice the system preference is used.

Source: ADR 0002 · Status: Implemented · Verified by: App "switches the theme and remembers it"

### FR-SET-03 Settings page
As a team, we want the workspace settings in one place that stays out of the way of the daily work.
- A gear button next to theme and language opens the settings (`#/settings/fields`); it is marked while the settings are open. Pressed again ("Close settings"), it goes back to the page shown before. The main navigation holds only the working views.
- The settings list their sections next to the content (on narrow screens as chips above it). "Fields" is the first section, then "Status values" (FR-BOARD-06), "Story map" (FR-REL-09), "Definitions" and "Data", then the group "Features" with "Releases" and "Team".
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

### FR-NAV-03 Escape closes the help and the settings
As a team member, I want `Escape` to close what is open on top of my work, so that I get back to it with the keyboard.
- With the help open, the first `Escape` closes the help, the second closes the settings (when they are open) and returns to the page shown before, like the gear.
- A dialog, a field or the search that uses `Escape` itself comes first: the settings stay open while `Escape` only cancels a field, and close with the next one.

Source: #33 (PO feedback) · Status: Implemented · Verified by: #33 AC11.1 to AC11.6 (`src/Help.test.tsx`, `e2e/help.spec.ts` "AC11.2", "AC11.4")

### FR-NAV-01 Main navigation
Header with board, backlog, story map, epics and releases, plus the search, theme, language and a gear button for the settings; the current page is marked.
- The header is sticky (#15): it stays at the top of the window while the page scrolls. Its height is shared as `--header-height`, so a focused element scrolled into view does not end up below it.

Source: Vision, #15 · Status: Implemented · Verified by: App "marks the current page", "parses known routes and falls back to the board", e2e `header.spec.ts` AC1.1

## Sprints (SPRINT)

### FR-SPRINT-01 Sprints with dates
As a PO, I want to plan several sprints, each with a name, a start date and an end date (both days included).
- A story belongs to one sprint or to none ("Not planned").
- A new sprint is prefilled: "Sprint n", starting the day after the last sprint ends (or today), two weeks long.
- The end date cannot be before the start date; the name is required.
- The single "Sprint 1" of release 0.1 is migrated to a real sprint running from the day of the update for two weeks.

Source: Issue #2 · Status: Implemented · Verified by: sprints.test, migrate.test, App "adds a sprint…", "refuses a sprint…", "migrates browser data of release 0.1…"

### FR-SPRINT-02 Sprint on the board
The board shows the running sprint (see FR-SPRINT-03). While none runs it shows the next planned sprint with a hint and "Start sprint"; once every sprint is completed it shows an empty state with the way to the story map. Without any sprint, the board asks to create one on the story map.

Source: Issue #2, changed by #17 · Status: Implemented · Verified by: sprints.test "sprint on the board", Sprints.test AC4.1–AC4.4, e2e `sprints.spec.ts` AC4.1

### FR-SPRINT-03 States of a sprint
A sprint is **planned**, **running** or **completed**; at most one sprint runs. A sprint runs when it is started, not by its dates. A new sprint is planned. A running sprint whose end date has passed stays on the board, marked "ended", until it is completed. Backlog and story map mark running and planned sprints and show no completed sprint (neither the sprint nor its stories). A completed sprint is offered in the sprint select only to the stories that are in it.

Source: Issue #17 · Status: Implemented · Verified by: sprintLife.test AC1.2, Sprints.test AC1.1, AC1.2, AC5.1, AC5.2, AC9.1, AC9.4, e2e `sprints.spec.ts` AC9.2

### FR-SPRINT-04 Start a sprint
As a team, we start a planned sprint when none runs: the dialog shows its stories and points, which are kept as the planned scope (`startItems`). When today is not the planned start day it asks whether the sprint starts today (preselected; the end date moves along so the length stays) or keeps its dates. A start cannot be undone.

Source: Issue #17 · Status: Implemented · Verified by: sprintLife.test AC2.1, AC2.3, AC2.4, AC3.1–AC3.4, Sprints.test AC2.1–AC2.4, AC3.1–AC3.3, AC12.2

### FR-SPRINT-05 Complete a sprint
As a team, we complete the running sprint. The summary shows what was planned at the start, what is done and not done, and what joined or left during the sprint (stories without points count as 0 and are named). For the unfinished stories there is one choice: the next planned sprint, a new sprint or the backlog; they go to the top of the target. When today is not the planned end day, the dialog asks whether the end date becomes today (preselected) or stays. The result (planned, done, not done, added, removed, changed points) is stored in the sprint. "Then start Sprint n" opens the start dialog right away. After completing, a message says what happened; the board then shows the next planned sprint or the empty state.

Source: Issue #17 · Status: Implemented · Verified by: sprintLife.test AC6.1–AC6.4, AC7.1–AC7.5, AC8.1–AC8.4, AC9.1, Sprints.test AC6.1–AC6.4, AC7.1–AC7.5, AC8.1–AC8.4, AC10.1–AC10.4, AC12.1, AC12.3, AC12.4, AC12.5, e2e `sprints.spec.ts` AC7.1

### FR-SPRINT-06 Existing sprints get a state
When the app opens data of an earlier version, every sprint gets its state by its dates: the sprint that includes today runs (its stories are kept as the planned scope), earlier sprints are completed with their result (their unfinished stories go back to the backlog), later sprints are planned. This happens once, in the browser build when the data is read and in the desktop app when the database is loaded (migration `011_sprint_states.sql` adds the columns).

Source: Issue #17 · Status: Implemented · Verified by: sprintLife.test AC11.1–AC11.3, sqliteRepository.test AC11.1, AC11.2, e2e `sprints.spec.ts` AC11.1

### FR-SPRINT-07 Velocity
As a team, we want to see how many points we planned and completed per sprint, so that we plan the next sprints realistically.
- The head of the board has a button "Velocity · Ø 21" next to "Complete sprint" and "New story" (also while no sprint runs). It shows the average; without a completed sprint it is just "Velocity". It opens a window under the button; the button, Esc (focus returns to the button), the close button or a click next to the window close it.
- The window shows the chart and the table together. Chart: for the last 8 completed sprints, in sprint order, one combined bar each: the frame is the points planned when the sprint was started, the blue part inside is the completed points (it reaches above the frame when more was done), with both numbers at the bar. "Older sprints" pages back by 8 more. Hover or focus on a sprint shows its dates, planned, done (with the share in percent) and the stories and points that joined after the start. A dashed, labelled line and the head of the window show the average of the completed points of the last three completed sprints, rounded to whole points; with fewer sprints the average of those there are and their number ("Ø 18 points · 2 sprints"). Table: all completed sprints, newest first, with the points added during the sprint, the share and the average in the footer.
- Every running and planned sprint in the backlog and on the story map, and the start dialog, show the points currently in the sprint next to the average ("30 planned · Ø 21"; without a completed sprint only "30 planned"). The backlog has no velocity panel of its own. The points planned at the start are those of the completed sprints (FR-SPRINT-04).
- Without a completed sprint the window explains why there is no chart.
- The window is fixed under the button and as high as the free space in the browser window (it scrolls inside itself), so it never makes the page scroll.
- Colour never carries meaning alone (numbers, frame versus filled part, legend, dashed labelled line); the chart has a description and the table a name for screen readers.
- Button and labels are hidden while the built-in field "points" is hidden (FR-FIELD-10).
- The demo data has no completed sprint. To try the velocity in the preview, the acceptance panel loads test data (`src/acceptance/presets.ts`: 6, 10, 2, 1 or no completed sprints, or no running sprint) for the test case at hand, or the PO picks it under "Testdaten". It replaces the data in that browser, after a question. The test data is for the acceptance only and not part of the product.
- Texts in DE, EN, FR and IT; keyboard operable; help topic "Velocity" (at the board).

Source: Issue #24 · Status: Implemented · Verified by: velocity.test AC1.1–AC1.3, AC2.1–AC2.3, Velocity.test AC1.1–AC1.8, AC2.1–AC2.3, AC3.1–AC3.6, AC4.1, AC5.1–AC5.3, AC6.1–AC6.3, AC7.1, e2e `velocity.spec.ts` (all but AC5.4, which is checked by hand: greyscale look)

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

Source: Issue #2 · Status: Implemented · Verified by: board.test "story map", e2e storyMap "FR-MAP-02.1" (mouse, highlight, backlog, board, reload) and "FR-MAP-02.2" (keyboard, announcement, Escape); drop line: manual check in Chromium

### FR-MAP-03 Create sprints, epics and stories on the map
- There are no create buttons in the page head: everything is created where it belongs on the map.
- "+ Sprint" below the last sprint opens the sprint dialog, prefilled.
- A click on a sprint label edits its name and dates.
- "+" at the end of the epic headers opens "New epic".
- "+" in a cell opens "New story" with that epic and sprint prefilled.

Source: Issue #2, PO feedback · Status: Implemented · Verified by: App "adds a sprint…", "edits a sprint…", "adds an epic as a new column", "creates a story directly in a cell…", e2e storyMap "FR-MAP-03.1", "has no "New story" or "+ Sprint" buttons at the top…"

### FR-MAP-04 Reorder upcoming sprints
As a PO, I want to drag a sprint that has not started yet up or down, so that I can change the order of the coming sprints.
- Only sprints whose start date is after today can be dragged (mouse, touch, keyboard). They cannot be dropped above the running sprint or below "Not planned".
- While dragging, a line shows the new position with the sprint's new dates.
- After the drop, every upcoming sprint keeps its length and the start dates follow each other without gaps from the end of the running sprint.

Source: PO feedback on #2 · Status: Implemented · Verified by: sprints.test "reordering upcoming sprints", App "lets only sprints that have not started be dragged", e2e storyMap "FR-MAP-04.1"; line with the new dates while dragging: manual check in Chromium

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

## Help (HELP)

### FR-HELP-01 Help panel
As a team member, I want to open help next to the page I am working on, so that I can look something up without losing my place.
- A `?` button in the header (and the key `?` when no text field has the focus and no dialog is open) opens and closes the help. `Escape` closes it from every view and wherever the focus is; if the focus was in the panel, it goes back to the button.
- The help is a panel next to the page: the page makes room and stays usable. On a narrow window the panel covers the whole page.
- The title names the page (`Help · Board`); the panel lists the topics of the current page first, then the general topics, and follows the page when it changes.
- Topics: moving, columns and status values, opening and creating stories, ordering the backlog and the sprint line, story map, epics, releases, settings, search and keyboard shortcuts.

Source: #33 · Status: Implemented · Verified by: #33 AC1.1 to AC1.4, AC2.1, AC9.1, AC11.1 (`src/Help.test.tsx`, `e2e/help.spec.ts`)

### FR-HELP-02 Search the help
As a team member, I want to search the help, so that I find a topic by the words I know.
- Several words must all occur; text in double quotes is a phrase. Case and accents are ignored. A match in the title ranks above one in the keywords, and that above one in the text.
- Hits show the matched words (marked), where the text matches and, for topics of other pages, the page they belong to. No hits says so and offers all topics. A cross clears the search.
- The search finds the texts of the current language only.
- Keyboard: `↓` from the field into the hits, arrow keys between them, `Enter` opens a topic, "Back" goes back to the hits with the search kept. The number of hits (or "no results") is announced to screen readers.

Source: #33 · Status: Implemented · Verified by: #33 AC3.1 to AC3.7, AC4.1, AC4.2 (`src/domain/helpSearch.test.ts`, `src/help/topics.test.ts`, `src/Help.test.tsx`, `e2e/help.spec.ts`)

### FR-HELP-03 Show me
As a team member, I want a help topic to point at the thing it talks about, so that I see it in the app.
- "Show me" frames the element with an accent outline and scrolls it into view. Nothing is dimmed. The frame ends with the next click, key or change of page.
- Without such an element the help says so (for stories: "Create a story first"). A topic of another page offers a link to that page instead.

Source: #33 · Status: Implemented · Verified by: #33 AC5.1 to AC5.3 (`src/Help.test.tsx`, `e2e/help.spec.ts`)

### FR-HELP-04 First steps (optional introduction)
As a new user, I want a short introduction I can start when I want it, so that I learn the main things by doing them.
- The introduction is a checklist of four steps in the help: get to know the board, move a story, create a story, order the backlog. It is never forced and can be left at any time.
- The first step is confirmed by the user. The others are ticked off by the app when the user really does the thing, in the panel or not. Only what is done after the start counts; a skipped step is done later if the user does it.
- A step can be skipped; the introduction can be closed and continued; "Start again" (after a confirmation) resets it without touching any story.
- The progress is kept per device (`localStorage`, like theme and language).

Source: #33 · Status: Implemented · Verified by: #33 AC6.1 to AC6.6, AC7.1, AC7.2 (`src/domain/helpTour.test.ts`, `src/Help.test.tsx`, `e2e/help.spec.ts` "AC6.3 leads through all four first steps")

### FR-HELP-05 Invitation on the first start
As a new user, I want to be asked once whether I want the introduction, so that I find it without it being forced on me.
- On the first start a small card above the page (not in the settings) offers "Start introduction" and "No thanks". It blocks nothing.
- It goes away for good after either button, and also when the user starts working on their own (moves or creates a story, orders the backlog).

Source: #33 · Status: Implemented · Verified by: #33 AC8.1 to AC8.4 (`src/Help.test.tsx`, `e2e/help.spec.ts`)

### FR-HELP-06 Links to the right pages
As a team member, I want help topics to lead me to the pages they talk about, so that I find the feature without searching.
- A topic lists the places it talks about as link buttons (icon, name, arrow; at least 44 px high): pages, and the sections of the settings (fields, status values, story map, releases, team). The help stays open and follows the page. A link to the page the user is on is left out.
- A feature that has to be switched on first (today Releases and Team, switched on in their own settings tab) is explained first, and linked before the places that need it. The feature button is highlighted. While the feature is off, those places are not links but grey, dashed buttons with a lock that say to switch the feature on first; they become links when it is on.
- The help is extended with every feature, like the technical documentation (Definition of Done). The topics of the first steps are agreed with the PO first.

Source: #33 (PO feedback) · Status: Implemented · Verified by: #33 AC10.1 to AC10.5 (`src/Help.test.tsx`, `src/help/topics.test.ts`, `e2e/help.spec.ts` "AC10.3")
## Usability (UX)

Issue #32, package 1. Verified by `e2e/usability1.spec.ts` (Playwright, with screenshot checks of the new elements), `src/QuickAdd.test.tsx` and `src/acceptance/preview.test.ts`; the test case IDs are those of the issue and of `src/acceptance/package1.ts`.

### FR-UX-01 One click opens
A click on a card, a backlog row or a story map chip opens the story; Enter and a double click still do (one dialog). Dragging does not open. The pointer over cards is a hand. A click beside a dialog within 0.4 s of opening is ignored (second click of a double click).

Verified by: e2e AC1.1, AC1.2, AC1.3, AC1.4

### FR-UX-02 Create dialogs work the same
Story, epic, sprint and release dialogs end in "Cancel" and the primary button, with the hint "Ctrl+Enter saves · Esc cancels"; `Ctrl+Enter` saves from any field. Escape or a click beside the dialog closes it, but asks "Discard input?" (Keep editing / Discard) when something was typed. "Cancel" closes at once. A missing title or name is reported under the field in the language of the app (the form does not use the browser's own validation bubble), the field is marked and focused.

Verified by: e2e AC2.1–AC2.6, component AC2.6 (German)

### FR-UX-03 "New" at the same place on every page
Board, backlog, story map, epics and releases have the primary "New …" button with its shortcut at the right of the page head (the releases page no longer has the extra "+ Release" card).

Verified by: e2e AC3.1, AC3.2

### FR-UX-04 Context menu of a story
Right click, the menu key or `Shift+F10` on a card, row or chip opens a menu: Open, Status ▸, Sprint ▸, Epic ▸, Points ▸ (Epic and Points only while shown, FR-FIELD-10). Arrow keys, `→` for a submenu, `←` back, Enter, Escape; the focus returns to the card. While the menu is open, the story it acts on is marked with a blue frame (card, row or chip). A click beside the menu only closes it. Choosing changes the story, tells the user (FR-UX-08) and highlights it (FR-UX-09). Delete joins the menu with undo.

Verified by: e2e AC4.1–AC4.8

### FR-UX-05 Quick add
"+ Story" at the end of every board column, backlog section and the "+" of a story map cell turns into a title field: Enter adds and keeps the field for the next story, Escape closes, an empty title adds nothing. The story gets the status, sprint, epic and release of the place, 3 points and the default values of custom fields. When a required custom field has no default, the "New story" dialog opens with the title filled in and the field marked.

Verified by: e2e AC5.1–AC5.5, component AC5.6

### FR-UX-06 Add and add another
"New story" has "Add and add another" (`Ctrl+Shift+Enter`): the story is added, the dialog stays with an empty title and the same epic, sprint, release and points, and a line names the added story.

Verified by: e2e AC6.1–AC6.3

### FR-UX-07 Shortcut overview
`Ctrl+/` or the keyboard button in the header opens "Keyboard shortcuts": the shortcuts of the current page first, then the general ones; only existing shortcuts are listed. The shortcuts of package 1 are combinations with Ctrl (Cmd on a Mac) (PO decision in #32: no single-key shortcuts); the only single key is `?` for the help (FR-HELP-01), which works only when no text field has the focus.

Verified by: e2e AC7.1–AC7.3

### FR-UX-08 Notices
After a story, epic, sprint or release was added and after a story was moved (drag and drop, menu), a notice appears at the bottom for 5 seconds (it stays while the pointer or focus is on it) in a polite live region, so screen readers read it.

Verified by: e2e AC8.1–AC8.4 (the reading itself: manual)

### FR-UX-09 Highlight
A story that was just added or moved scrolls into view and gets a green frame for 2 seconds; with "reduce motion" the frame shows without animation.

Verified by: e2e AC9.1–AC9.3

### FR-UX-10 Empty states offer the next action
An empty board column shows the drop hint and "+ Story"; an empty sprint in the backlog explains how to fill it and offers "+ Story"; the epics page without epics shows the text and "New epic".

Verified by: e2e AC10.1–AC10.3

### FR-UX-11 Acceptance aid in previews
In the pull request previews (`getthingsdone-pr-<n>.onrender.com`, the dev server and with `?acceptance=1`; never in the desktop app and not on `main`), a round magenta button "Abnahme" with a progress ring, a count and the tag "Preview" at the bottom left (unlike every other control of the app) opens a popup (no sidebar, the page does not move) that steps through the test cases of the pull request, one at a time: starting point, action, expectation, a strip with all steps as traffic lights, "Zur Seite und markieren" (opens the page and lights up the element under test for 3 seconds; the popup moves to the side that does not hold it), "In Ordnung" (marks and goes on to the next test case and its page), "Problem" (with a comment), back and forward, "Alle Punkte anzeigen" (list by criterion, jump to any). "Ergebnis kopieren" puts the state as text on the clipboard for the chat with the AI: summary, every problem with expectation and comment, other comments, ids in order and still open. By default only the test cases the PO has to check are shown (`poCheck` in `src/acceptance/package<n>.ts`: judgement calls and things only a person on a real machine can see); a switch shows all, the automated ones marked as such, and the copied result says how many are covered by automated tests. Each test case names its automated tests, and a unit test checks that they exist. Notes and the current step stay in the browser (`localStorage`). The panel is German only, like the test cases it shows. Design and variants: `docs/design/acceptance.md`.

Verified by: e2e AC11.1–AC11.9, unit AC11.5

### FR-UX-12 The help knows the new functions
The help (FR-HELP-01) has the topics "Change a story from its menu" and "Add stories quickly" (with "Show me"), and the topics "Open and edit a story", "Create a story" and "Keyboard shortcuts" describe one click to open, "Add and add another", `Ctrl+/`, `Ctrl+Enter`, `Ctrl+Shift+Enter` and `Shift+F10`, in DE, EN, FR and IT. The first steps are unchanged.

Verified by: component AC13.1–AC13.3 (`src/Help.test.tsx`), `src/help/topics.test.ts` (texts in all languages)

## Definition of Ready and Done (DEF)

Issue #26. Verified by `src/domain/definitions.test.ts` (unit), `src/Definitions.test.tsx` (component), `e2e/definitions.spec.ts` (Playwright), `src/data/*Repository.test.ts` and `src/Help.test.tsx`; the test case IDs are those of the issue and of `src/acceptance/package2.ts`. Design: `docs/design/definitions.md`.

### FR-DEF-01 The lists of the team
Settings › Definitions shows the Definition of Ready and the Definition of Done as two cards one under the other. A card starts with the switch; only an active list shows its content (a list that is off and empty offers "Insert example list" or "Start empty"), and an active card folds to a summary such as "3 groups · 5 items". A list is a column of blocks, one per named group, with items. New groups and items are added directly in the list: a row "New group" under the blocks and a row "New item" (Enter adds) in every block. An item is manual (free text) or automatic, taken from a library: a picker ("From library" in every block; arrow keys, Enter, Escape) with a description per check; the library holds "Has a description", "Has acceptance criteria", "Must be estimated" (has points), "Must be attached to an epic", "All criteria accepted" and "Is planned in a sprint", and a check that is in the list already cannot be taken again. Blocks are dragged as a whole by their handle (open or folded) and folded to their head; items are dragged between blocks; Alt+Arrow keys move an item or a block, groups and items are renamed and removed in place. Per item "may be n/a" says whether a story may set it to not relevant. Per list a switch says whether the list is active (a change of status asks for it). In a story one control per item goes through three click states: not set, done, ignored (the last only where "may be n/a" is set). Saved at once; the demo data has example lists that are switched off.

Source: #26 · Status: Implemented · Verified by: #26 AC1.1 to AC1.5

### FR-DEF-02 The state of an item in a story
An item is open, checked or (where allowed) not relevant for each story. An automatic item shows its own state; it can be set to not relevant but not ticked. Not relevant counts as met, is shown struck through, and stays when the item stops allowing it. The story dialog shows a panel with a tab per list that has items (counter such as "3/5 · 1 n/a" and a warning while something is open), the groups folded or open with their own counters, and a checkbox per item with a quiet "Not relevant" button where allowed. Space ticks, N sets not relevant, arrow keys change the tab. Empty lists have no tab; two empty lists no panel.

Source: #26 · Status: Implemented · Verified by: #26 AC2.1 to AC2.4, AC3.1 to AC3.3

### FR-DEF-03 The lists are asked at the transitions
A change of status that leaves "not started" asks for the Ready list; one that enters "done" asks for the Done list; from "not started" straight to "done" both, one after the other. Moves inside a category, backwards, and lists that are switched off, empty or already met ask nothing. This holds for the board (mouse and keyboard drag), the context menu and the status field of the story dialog. The dialog shows only the items that were open, with the same checkboxes; "Move" works when they are all resolved, "Open story" and "Cancel" (Escape) leave the story where it is. The gate blocks: the only other way is a deliberate override, a second step ("Override the gate…" then "Override and move") that names the items that stay open and ends with a notice with a way to the story. The answers are kept on the story. Logging the overrides (who, when, why) is a later story (see the issue).

Source: #26 · Status: Implemented · Verified by: #26 AC4.1 to AC4.9

### FR-DEF-04 Marks in the backlog and on the board
The backlog marks a story that is not done and does not meet the Ready list: "Not ready 3/5" with an icon and an edge in the warning colour. The board marks a story in a "done" status that does not meet the Done list that applied when it became done: "Not done 1/3". A story remembers the Done items at the moment it enters "done" (`doneItems`); stories done before the feature existed, and stories that became done while the list was off, are never marked. Empty or switched off lists mark nothing.

Source: #26 · Status: Implemented · Verified by: #26 AC5.1 to AC5.5

### FR-DEF-05 Texts and help
All texts exist in DE, EN, FR and IT. The help has the topic "Definition of Ready and Done" (steps, links to Settings › Definitions, backlog and board).

Source: #26 · Status: Implemented · Verified by: #26 AC6.1, AC6.2

## Export and import (DATA)

### FR-DATA-01 Export and import of all data
Settings › Data (`#/settings/data`) has two cards. "Export all data" saves stories, epics, criteria, sprints, releases and their history, fields and values, status values and settings in one readable JSON file `getitdone-<date>.json` with a format name and a version, and says what was exported. "Choose file …" checks the file and shows a confirmation dialog that compares the file with the current data (stories, epics, sprints, releases), warns that everything is replaced (focus on "Cancel", "Export current data first" offered), and replaces all data only after "Replace data". After export and import the app shows the same data. A file that is empty, not a Get It Done export (also other JSON), cut off or from a newer format is refused with the reason and "Your data are unchanged", without a confirmation. The same file works in the Windows app and in the browser build; the import also works in the web preview, which says that it only replaces the demo data of this browser. The Definition of Ready/Done lists of #26 are part of the settings and thereby of the file. Texts in DE, EN, FR and IT, keyboard operable, help topic "Back up and export data".

Verified by: unit `src/domain/backup.test.ts` (AC1.2–AC1.4, AC3.2, AC4.1–AC4.4), component `src/DataSettings.test.tsx` (AC1.1–AC1.2, AC2.1–AC2.5, AC3.1, AC4.1–AC4.4, AC5.3, AC6.1–AC6.3), e2e `e2e/backup.spec.ts` (AC1.1–AC1.2, AC2.1, AC2.3, AC3.1–AC3.2, AC4.1, AC5.3, AC6.2); AC1.3, AC5.1 and AC5.2 are checked by hand

## Change history (HIST)

### FR-HIST-01 History of items and comparing two versions
Stories, epics, sprints and releases keep a history of versions (#23, ADR 0004). One save is one version (V1, V2, …) with date and time; the story, epic and sprint dialogs have a panel "History" that is collapsed by default and shows only the current version ("Show older versions" opens the last three, then "Show all changes", "Compare versions", "Compare with current" per entry), the release dialog has a tab "History". Recorded: creation, title or name, description (the list says "changed", the comparison shows the full text), status, points, epic, sprint, release, custom field values, acceptance criteria (added, ticked, removed), colour, dates, sprint state, and the stories that join or leave a sprint. Moves on the board and in the backlog are changes of status or sprint; pure reordering is not recorded; edits of the same field within 60 seconds are one version. Names follow the chosen language. Two versions (including "Current") are compared side by side, older left and newer right: field by field with changed fields marked by sign and word, unchanged fields folded ("Only changes"), the description line by line with line numbers; the sides can be swapped; the view only reads. The comparison starts from an entry, from the button "Compare versions" or by ticking two versions in the full list. The history is saved, part of export and import (older files import with an empty history), and works for every item type without new history code. Items older than the history show "No changes yet". Texts in DE, EN, FR and IT, keyboard operable, help topic "History and comparing versions".

Verified by: unit `src/domain/changeLog.test.ts` and `src/domain/textDiff.test.ts` (AC1.3, AC2.1–AC2.6, AC3.1–AC3.4, AC5.2–AC5.3, AC6.1, AC8.1–AC8.4, AC8.6), repositories `src/data/sqliteRepository.test.ts` and `src/data/localStorageRepository.test.ts` (AC5.1), component `src/ChangeHistory.test.tsx` (AC1.1, AC1.3–AC1.4, AC2.3, AC2.7, AC4.2, AC7.3, AC8.2–AC8.5, AC9.1–AC9.3), e2e `e2e/changeHistory.spec.ts` (AC3.1, AC3.3, AC4.1, AC5.1, AC7.1, AC8.1–AC8.2); AC1.2, AC6.2, AC7.2 and AC8.7 are checked by hand
## GitHub issues (GH)

Issue #30, ADR 0005. Tests: `src/sync/github/format.test.ts` and `src/domain/githubRoundtrip.test.ts` (unit), `src/sync/github/restApi.test.ts`, `src/sync/github/api.test.ts` and `src/sync/runSync.test.ts` (the connectors and the sync), `src/Github.test.tsx` and `src/GithubRoundtrip.test.tsx` (component), `src/data/sqliteRepository.test.ts` (integration), `e2e/github.spec.ts` (end-to-end, simulated GitHub).

### FR-GH-01 Switch on and connect one repository
As a team that uses GitHub, we want to connect a GitHub repository in the settings, so that we can plan with its issues.
- The feature "Synchronisation" (Settings → Synchronisation) is off by default. While it is off, there is no connection form, no "Synchronise" button and no issue keys (the stories show their own keys); switching it off keeps the imported stories and the connection.
- Settings → Synchronisation (only while the feature is on) lists the services as one choice (GitHub; Jira and GitLab as planned, see FR-SYNC-01), takes the repository as `owner/name` and an access token, and "Test connection" says "Connection ok · n open issues" or what is wrong (repository missing, wrong form, not found, token refused, no network). "Remove connection" asks first, then forgets repository and token; the stories stay, without link and marker.
- "Also write to GitHub" is off by default; the token then needs "Issues: read and write". "When both sides changed the same field": GitHub wins (default), local wins, or I decide.
- The token is never shown again after it was saved; desktop app: kept in the credential store of the operating system; browser: only in the memory of the page, asked for again after a reload. The public preview is labelled "Demo", uses a simulated GitHub and needs no real token.
- Fully keyboard operable, all texts in DE, EN, FR and IT.

Source: #30 · Status: Implemented · Verified by: #30 AC1.1–AC1.8, AC6.1, AC6.2, AC11.1, AC11.2 (`src/Github.test.tsx`, `src/GithubRoundtrip.test.tsx`, `e2e/github.spec.ts`, `src/sync/github/format.test.ts`); keychain: manual check on the Windows app

### FR-GH-02 Import open issues as stories
As a team member, I want to import the open issues as stories, so that I do not copy them by hand.
- "Synchronise" in the head of the backlog creates a story for every open issue that has none: title, description, labels (field "Labels") and the address of the issue; the story starts in the first status, in no sprint, with 0 points.
- An issue that was imported is never imported twice; pull requests and closed issues without a story are not imported. A story that was deleted here is not imported again.

Source: #30 · Status: Implemented · Verified by: #30 AC2.1–AC2.3

### FR-GH-03 Sync imported stories in both directions
As a team member, I want to bring the imported stories and their issues up to date, and see what changed.
- Title, description, labels, closed or open (done or not done) and the task list under the heading "Acceptance criteria" ("Akzeptanzkriterien", "Abnahmekriterien") with its ticks are compared field by field with what the issue looked like at the last sync. A field that changed only on GitHub is taken; a field that changed only here is published (when writing is on). Tasks under any other heading stay in the description.
- A field that changed on both sides follows the conflict rule of the connection (GitHub wins by default; local wins; I decide, with a dialog that shows both versions and changes nothing until I choose). The result always names what was overwritten.
- A closed issue puts its story into the first "done" status; an issue that is open again puts a done story back to the first status. Sprint, points, rank, epic and the column of an open story stay as they are and never go to GitHub.
- After each sync a dialog counts the stories newly imported, updated and done and the changes published, lists the changes per issue, says what was overwritten and what stayed pending, and closes with the button or Esc (focus returns to the button). The head of the backlog shows the time of the last sync.

Source: #30 · Status: Implemented · Verified by: #30 AC3.1–AC3.8, AC8.1–AC8.4

### FR-GH-04 Issue number and link
Imported stories show their issue number (`#31`) as a link that opens the issue on GitHub in a new tab: on cards, in the backlog and in the story. Stories of the team have none; the numbers are hidden while the feature is off.

Source: #30 · Status: Implemented · Verified by: #30 AC4.1, AC4.2

### FR-GH-05 Clear messages, local data stays
Without network, with a refused token, an unknown repository, a missing connection or when GitHub limits the requests, the sync shows a clear message in a dialog and changes nothing; the app keeps working with the local data. A token that may not write is told so ("Issues: read and write"); the local changes stay.

Source: #30 · Status: Implemented · Verified by: #30 AC5.1, AC5.2, AC7.6

### FR-GH-06 Publish local changes to GitHub
As a team member, I want my changes to an imported story to reach its issue, so that both sides say the same.
- With "Also write to GitHub" on, "Synchronise" publishes title, description, labels (only labels the repository has; unknown ones are reported and stay on the story), criteria with their ticks and done/not done as closed/open. Nothing is published without pressing "Synchronise". With writing off, local changes stay marked and the result says so.
- Stories with changes that are not on GitHub yet are marked ("not on GitHub") and counted ("n changes not on GitHub yet") in the backlog before the sync.
- A story that exists only here becomes a new issue with "Create on GitHub" in its menu (only while writing is on); it is linked from then on. No story is published without that action.

Source: #30 · Status: Implemented · Verified by: #30 AC7.1–AC7.6, AC9.1, AC9.2, AC10.1–AC10.3

### FR-GH-07 One mechanism, a connector per service
The sync is one general mechanism: the engine asks a connector for the open items, one item, and tells it what to change. GitHub is the first connector; the settings list GitLab, Jira and Trello as planned. A connector has to pass the shared connector tests (reading, writing, errors); a connection can be removed without touching the stories.

Source: #30 · Status: Implemented · Verified by: #30 AC11.1–AC11.3 (`src/sync/github/api.test.ts`)

### FR-GH-08 Story map and board columns through milestones and labels
As a team that plans with the story map, I want releases, epics and board columns to follow GitHub, so that the whole plan is visible there.
- A release is a milestone: the release of a story and the milestone of its issue follow each other like the other fields (changed on one side goes to the other, both sides follow the conflict rule). An unknown milestone becomes a release (title, description, end date = due date, no start date). A release without a milestone stays as it is and the result says so. While writing is on, a sync makes the milestone a story needs (title, description, due date) and deletes a milestone it made itself once no release and no issue needs it (AC16).
- An epic is a label "epic: <name>", shown only as the epic, not in the field "Labels". An unknown label becomes an epic. With several epic labels the first counts and the result says so. While writing is on, a sync makes the label a story needs in the colour of the epic and deletes a label it made itself once no epic and no issue needs it (AC16).
- A board column between the first one and Done is a label "status: <name>" (own columns by their name). An open issue without such a label is in the first column, a closed one is Done. While writing is on, a sync makes the label of a column a story is in and deletes it again once nothing needs it; only labels and milestones the app made (kept in the connection settings) are ever deleted. While writing is off, a column or epic whose label GitHub does not have stays marked as "not on GitHub" and the result names the label.
- The sync icon (two circular arrows) replaces the text button on Backlog, Board and Story Map; it turns while a sync runs, shows the number of changes that are not on GitHub yet and has the name "Synchronise" for tooltip and screen readers.

Source: #30 · Status: Implemented · Verified by: #30 AC12.1–AC12.7, AC13.1–AC13.7, AC14.1–AC14.7, AC15.1–AC15.9 (`src/domain/githubStoryMap.test.ts`, `src/sync/runSync.test.ts`, `src/GithubRoundtrip.test.tsx`)

### FR-GH-09 Automatic sync, short notice and sync log
As a team member, I want the sync to run by itself and to tell me discreetly what it did, so that I never have to press a button or close a report.
- After every sync (button or automatic) there is no dialog: a notice at the bottom says in one line what changed ("Synchronised: 2 new, 3 updated") or "Already up to date", with a "Log" button; it goes away after 5 seconds. Errors stay until closed. The sync icon shows a tick for a moment. Only a conflict under the rule "I decide" opens a dialog (the choice), and only for a sync by hand.
- Settings › GitHub has the switch "Synchronise automatically" (off by default; all issues or none). On: a run at the start of the app, when it comes back to the front and every 15 minutes while it is open, with the same rules as the button. A run waits while a dialog is open or someone types, is skipped offline, and never overlaps another run. Settings show the last and the next run.
- An automatic run asks nothing: under "I decide" it marks the tickets, the icon shows their number and the notice says "Conflicts waiting for you: n" with "Review". After three errors in a row it pauses (icon "!"); pressing the icon runs once and resumes.
- The sync log (Settings › GitHub) has one row per run (time, trigger Start / Automatic / Manual, summary, result); a row opens to the single changes (ticket, field, from → to, who won, labels and milestones made or deleted, errors). Runs without changes that follow each other are one row. Filter: all / with changes / errors. The last 100 runs of the last 90 days are kept, "Clear" empties it.

Source: #30 (PO decision of 2026-10-21, `docs/design/auto-sync.md`) · Status: Implemented · Verified by: #30 AC17.1–AC17.5, AC18.1–AC18.7, AC19.1–AC19.2, AC20.1–AC20.5 (`src/GithubAuto.test.tsx`, `src/Github.test.tsx`, `src/domain/syncLog.test.ts`)

## Team and assignment (TEAM)

### FR-TEAM-01 Team members and assignment of stories
Settings › Team (`#/settings/team`, #18) holds the team as a plain list: name and initials, no accounts, no colour. Members are added, changed and removed there; the initials are derived from the name (first letter of the first and last word, at most 3 characters) and can be changed; they follow a renamed member while they were not changed by hand. Initials are unique and at most 3 characters, names are unique, and an empty name or initials are refused with a hint. Removing a member without stories is immediate; with stories it asks first and leaves the stories unassigned. A story is assigned to one member or nobody in the story dialog and in "New story" (field "Assigned to"). A round badge with the initials shows on board cards (top right), backlog rows and story map cards; an unassigned story shows a dashed empty badge, a team without members shows no badge; the full name is the tooltip and the text for assistive technology. Above the board a filter bar shows all, one member or "Unassigned"; a filter on a removed member shows everything again. The search finds stories by the name or initials of the assignee and has the filter field "Assigned". The team and the assignments are part of export and import (older files import with an empty team), the change history records an assignment as a change of the field "Assigned to", and the demo data hold a team of three. The team is a feature with a switch in Settings › Features, like releases: off for a new project, on in the demo data. While it is off nothing of it shows (no section "Team", no field "Assigned to", no badge, no filter bar, no assignee in the search; the address of Settings › Team leads to the features); members and assignments are kept, stay in export and import and come back when it is switched on, and the history keeps showing assignments. Texts in DE, EN, FR and IT, keyboard operable, help topic "Team and assignment" (it starts with switching the team on).

Source: #18 · Status: Implemented · Verified by: unit `src/domain/members.test.ts` (AC1.1–AC1.4, AC1.6, AC4.1–AC4.4, AC5.1, AC5.3, AC6.1–AC6.3, AC7.1–AC7.3), repositories `src/data/sqliteRepository.test.ts` (AC1.1, AC5.1, AC7.1, AC7.3), component `src/Team.test.tsx` (AC1.1–AC1.6, AC2.1–AC2.5, AC3.1–AC3.5, AC4.1–AC4.5, AC5.1–AC5.2, AC7.2), e2e `e2e/team.spec.ts` (AC2.1, AC2.5, AC4.1); AC3.4 is checked by hand; AC8 (the switch): `src/Team.test.tsx` (AC8.1–AC8.3, AC8.5–AC8.7) and `src/domain/members.test.ts` (AC8.2–AC8.4, AC8.6)

## Major UI update (UI)

### FR-UI-01 Recognisable, compact board cards
As a team member, I want cards that read as cards and take little room.
- A card is a light surface with a border and a soft shadow on a tinted column, with clear spacing; hover, keyboard focus and dragging each look different.
- The card shows the key, the value of single-select card fields (such as the priority) as a letter in a coloured square (M, S, C, W; the full word is the tooltip and the screen reader text), the points, and the title.
- One line below holds the epic first, then the labels (multi-select and other card field values) as mini chips; at most two chips are shown, the rest becomes "+n" with a tooltip.
- "☑ done/total" ends that line, green when all criteria are accepted; no progress bar. Screen readers read "2 of 4 criteria accepted".
- The "Compact" toggle button in the page head (same behaviour as on the story map, choice remembered in `getitdone.boardCompact`) shows one line per story: letter, title, epic dot, "☑ done/total", points.

Source: #55 · Status: Implemented · Verified by: #55 AC1.1–AC4.5 (`src/UiUpdate.test.tsx`, `e2e/uiUpdate.spec.ts`); look in light and dark: manual (AC1.1, AC1.2)

### FR-UI-02 Backlog: round points, number outside, inline points
- The points in a sprint header look like the points of a story (round).
- The item number (key) stands outside the row, on its left; the rank is part of the row's accessible name.
- A click or Enter on the points of a story turns them into an input: Enter or leaving the field saves, Escape cancels. Valid are whole numbers from 0 to 100; an empty field removes the points (0). Anything else is not saved and shows "Only numbers, 0–100". The sprint total follows at once.

Source: #55 · Status: Implemented · Verified by: #55 AC5.1, AC6.1, AC7.1–AC7.7 (`src/domain/board.test.ts` `parsePoints`, `src/UiUpdate.test.tsx`, `e2e/uiUpdate.spec.ts`)

### FR-UI-03 No shortcut hints on screen
The shortcuts keep working and are announced with `aria-keyshortcuts`, but they are not written on buttons, in the search box and its list, in dialogs or in help texts. Only the shortcut overview (the keyboard button and its help topic) names them. The first steps are not part of this change.

Source: #55 · Status: Implemented · Verified by: #55 AC8.1–AC8.5 (`src/UiUpdate.test.tsx`, `src/help/noShortcutHints.test.ts`, `e2e/uiUpdate.spec.ts`)

## Design system (DS)

### FR-DS-01 Design system catalogue
Source: #70 · Status: Implemented · Verified by: #70 AC1.1–AC1.4, AC2.1–AC2.2 (stories in `src/design-system/` and `src/ui/`, `src/DesignSystem.test.tsx`, `src/test/designSystemRules.test.ts`); AC1.4: manual

The design system is documented in Storybook: foundations (colour, type, spacing, radius, elevation, layers, motion, icons, accessibility rules) and the shared components with variants and states, in light and dark. It is built from the real code and published with the pull request preview at `/design-system/`.

### FR-DS-02 The app uses the design system
Source: #70 · Status: Implemented · Verified by: #70 AC3.1–AC3.3, AC8 (`src/styles/designSystem.test.ts`, `e2e/designSystem.spec.ts`, the screenshots of `e2e/usability1.spec.ts`); AC4.1: manual (comparison with the before/after in the issue)

Colours, font sizes, line heights, weights, radii, spacings, shadows, layers and transitions of `src/styles/app.css` come from tokens; buttons, text fields, selects, checkboxes and link-like buttons are the shared components. Merged near-duplicates: two link-style buttons became `TextButton`.

### FR-DS-04 Catalogue on GitHub Pages
Source: #70 · Status: Implemented · Verified by: #70 AC6.1–AC6.3 (`src/test/designSystemRules.test.ts`); AC6.1 and AC6.3: manual after the merge

The catalogue is published on GitHub Pages after every change of `main`, at https://goerks.github.io/GetThingsDone/, and linked from the README and the design system page.

### FR-DS-05 The design system is guarded automatically
Source: #70 · Status: Implemented · Verified by: #70 AC7.1–AC7.3, AC8.1–AC8.2 (`src/styles/contrast.test.ts`, `src/styles/designSystem.test.ts`, `e2e/designSystemStories.spec.ts`, `e2e/designSystem.spec.ts`)

The contrast of every colour pair, the accessibility and the look of every story in both themes, and the absence of raw values and raw tags are checked on every push.

### FR-DS-06 The app components in the catalogue
Source: #70 · Status: Implemented · Verified by: #70 AC9.1–AC9.6 (`src/DesignSystem.test.tsx`, `e2e/designSystemStories.spec.ts`)

The catalogue shows the real components of the app with demo data, in light and dark: story, epic, release and sprint cards, board lanes, status dot, header, member filter, context menu, notices and the detail dialogs. They are checked for accessibility and compared with reference images like the base components.

### FR-DS-03 Adherence is mandatory
Source: #70 · Status: Implemented · Verified by: #70 AC5.1, AC5.2 (`src/test/designSystemRules.test.ts`)

`CLAUDE.md`, the Definition of Done, `docs/working-mode.md`, the `go` and `design-vorschlag` skills and the pull request template require every feature to use the design system and to extend it, with a story, where something is missing.

## Later

| ID | Requirement | Status |
|---|---|---|
| FR-MAP-06 | Activities above epics on the map | Open (out of scope of #2) |
| FR-SEARCH-06 | Search in a side panel next to the board (rest of variant D) | Open (out of scope of #7) |
| FR-SEARCH-07 | Saved searches with a name | Proposed (PO undecided) |
| FR-MAP-07 | Release slices in addition to sprints | Implemented in #10, phase 2 (see FR-REL-09) |

## Synchronisation with one chosen service (SYNC)

Issue #66, ADR 0007, ADR 0008. Step 0 of the Jira sync: the shipped GitHub sync is generalised; Jira follows in phases (AC3 to AC10 of #66), phase 1 is FR-SYNC-05. Tests: `src/Sync.test.tsx` (component), `src/sync/connector.test.ts` (the series every connector passes), `src/data/sqliteRepository.test.ts`, `src/domain/settings.test.ts`, `src/domain/syncLog.test.ts`, `src/domain/storyKey.test.ts` and `src/domain/search.test.ts` (unit), `src/Jira.test.tsx` and `src/sync/jira/jira.test.ts` (Jira).

### FR-SYNC-01 Choose the service
As a team, we want to choose one service for the synchronisation, so that exactly one is active.
- Settings → Synchronisation shows the services as one choice (radio group): GitHub, Jira, GitLab. A service without a connector is "planned" and cannot be chosen. GitHub is chosen by default.
- Exactly one service is active; its connection form and options follow the choice.

Source: #66 AC1 · Status: Implemented (GitHub; Jira in phase 1) · Verified by: #66 AC1.1, AC1.4 (`src/Sync.test.tsx`)

### FR-SYNC-02 Switch the service
- Choosing another service asks first and says what happens: the connection to the old service and its token are removed, the stories stay without issue key and link, the first sync with the new service imports all its open issues, and stories of the team can be published one by one. Without any connection nothing is asked.
- Confirming removes token, connection and links, resets the options (read only, the service wins) and chooses the new service. Cancel or Esc changes nothing.

Source: #66 AC2 · Status: Implemented · Verified by: #66 AC2.1–AC2.4 (`src/Sync.test.tsx`)

### FR-SYNC-03 The issue key is the ID of a linked story
- A story that is linked to an issue shows the key of the issue (`#31`; `PROJ-123` on Jira) as its ID, as a link to the issue, on the cards, in the backlog, on the story map, in the story dialog, in the search, in the history and in the dialogs, while the synchronisation is on. A story without a link shows its own key (`S-4`).
- The own key stays stored: the search finds a linked story by both keys, the story dialog shows it small ("Local ID S-4"), and it is shown again when the connection is removed. Entries of the history keep the key they had when they were written.

Source: #66 AC12 · Status: Implemented · Verified by: #66 AC12.1, AC12.3, AC12.4, AC12.6 (`src/Sync.test.tsx`, `src/domain/storyKey.test.ts`, `src/domain/search.test.ts`)

### FR-SYNC-04 One mechanism, a connector per service
- The sync engine and the settings know no service; a connector turns its issues into neutral items and what the engine publishes into its own calls. A connector passes the same series of tests (reading, writing, errors, a run of the engine). GitLab fits without a change of the engine.
- The shipped GitHub data is converted when the app starts: links, keys, settings, log and keychain entry; an existing GitHub connection keeps working. Exports and the browser storage of before are read as well.

Source: #66 AC11 · Status: Implemented · Verified by: #66 AC11.1–AC11.3 (`src/sync/connector.test.ts`), AC11.2 (`src/data/sqliteRepository.test.ts`, `src/domain/settings.test.ts`, `src/domain/syncLog.test.ts`)

### FR-SYNC-05 Synchronise with Jira Cloud (phase 1)
As a team that works in Jira, we want to import and update our stories from a Jira project, so that the backlog stays in line with Jira.
- Choosing the card "Jira" shows the form: site, e-mail address, project key, API token and an optional JQL filter. "Test connection" says "Connection ok · n open issues" or what is wrong (entry missing or wrong form, project not found, token refused, no network). The token is kept in the keychain and never shown again. In the preview a simulated Jira is used and marked "Demo".
- "Sync" imports the open issues of the project (not the done ones) as stories with the issue key as ID; epics and sub-tasks are left out and counted in the notice.
- With writing on, a sync publishes title, description, labels (not those with spaces), criteria and the status as a transition of the workflow; a transition that Jira refuses is reported and the change stays local and marked. A description with a table, an image or formatting is never rewritten. A story of the team can be created in Jira from its menu. Nothing is ever deleted in Jira.
- Not yet: the list of boards, the table of status names, epics, fix versions, sprints, points, order, assignees.

Source: #66 AC3 to AC6, AC8 to AC10.3, AC12.2 · Status: Implemented (phase 1) · Verified by: #66 AC3.1, AC3.2, AC3.4, AC3.5, AC4.1–AC4.4, AC5.2, AC5.9, AC6.2–AC6.5, AC8.1–AC8.3, AC9.1, AC10.3, AC12.2 (`src/Jira.test.tsx`, `src/sync/jira/jira.test.ts`, `src/sync/connector.test.ts`)

### FR-SYNC-06 Jira decides columns, team and sprints (phase 5)
- With Jira connected, the columns of the board are the statuses of the Jira workflow (name, category, order); columns without a status are removed and their stories move to the first column of the same category. The settings of the status values are locked with a note.
- The team is the people who can be assigned in the project (bots left out); other members are removed with their assignments. The feature Team is switched on, the team settings are locked with a note.
- Sprints are connected to Jira sprints (Jira id and base per sprint, migration 017) and compared field by field (name, dates, goal, state) in both directions. A sprint that Jira started or completed is started or completed here by the rules of the app; one started or completed here is started or completed in Jira. A sprint that only exists here is made in Jira; one that only exists in Jira is made here as a planned sprint. Only one sprint runs here; a second running Jira sprint stays planned and is named. A sprint has a goal. Nothing is deleted in Jira.

- The first successful connection to Jira switches the automatic sync on (start, return to the app, every 15 minutes; it can be switched off and the choice is kept). The labels of the Jira site are offered as choices of the labels field, also when no issue carries them; labels with a space cannot be sent to Jira and are named in the notice.

Source: #66 AC13 to AC17 · Status: Implemented · Verified by: #66 AC13.1–AC13.4, AC14.1–AC14.3, AC15.1–AC15.7, AC16.1–AC16.2, AC17.1–AC17.3 (`src/domain/syncStatuses.test.ts`, `src/domain/syncMembers.test.ts`, `src/domain/syncSprints.test.ts`, `src/Jira.test.tsx`, `src/sync/jira/jira.test.ts`)
