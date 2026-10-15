# Design: Definition of Ready and Definition of Done

Issue: [#26 Definition of Ready and Definition of Done](https://github.com/goerks/GetThingsDone/issues/26)

The mockups are in [`definitions-variants.html`](definitions-variants.html) (open the file in a browser; the mockup text is in German because it is reviewed in German). Screenshots: `definitions-*.png`. Status: draft 2, variant C chosen by the PO on 2026-10-15; acceptance criteria still to be approved.

## Idea

Two checklists for the whole team: **Ready** (good enough to start?) and **Done** (really finished?). Items are **grouped**, have **three states** (open, checked, not relevant) and are **demanded at the transitions of the status categories**:

*not started* → [Ready] → *in progress* → [Done] → *done*

## Rules

- State per item and story: open (default), checked, not relevant. "Not relevant" is only offered for items the team marked "may be irrelevant" (checkbox per item in the settings, manual and automatic items alike); other items have open and checked only. Not relevant counts as met and is shown struck through. Counters read "3 of 5 · 1 not relevant".
- An item is manual (free text) or automatic (catalogue: has description, has acceptance criteria, has points, has an epic, all criteria accepted, is planned in a sprint). Automatic items show their own state themselves.
- Groups are named, ordered, and hold items. Items without a group are not possible (a default group "General" exists).
- Ready is checked when a story leaves *not started* for *in progress*, Done when it enters *done*. A move from *not started* straight to *done* checks both. Moves inside a category and backwards check nothing.
- Per list a switch "Check on status change". Off or empty: nothing is checked or marked.
- Only the lists as they were when a story became done count for done stories (PO answer 6): the story keeps a snapshot of the Done items at that moment.

## Where the checklist lives (three variants)

| Variant | Idea | Outcome |
|---|---|---|
| A · Story, the transition reminds | List kept on the story; the transition only shows the open items with "Move anyway" | Alternative |
| B · Transition | No list on the story; the transition asks all items; answers are saved on the story and shown read-only | Alternative: no state before the move, so no marks in backlog and board |
| C · Story and transition | State lives on the story; the transition dialog shows only the open items with the same three-way switch, "Open story" | **Chosen (PO, 2026-10-15)**. Changed the same day (PO): the transition is a quality gate and blocks; the only other way is a deliberate override in a second step. A later story logs overrides |

## Where it fits in the existing app

| Place | Change |
|---|---|
| Settings | New section "Definitions", one tab per list, switch, groups with items (drag, Alt+↑/↓) |
| Story dialog | Panels "Definition of Ready" / "Definition of Done" with groups, per-group counters and a three-way switch per item (radio group, arrow keys) |
| Board | Moving a card across a gate opens the transition dialog (A, B or C); done cards with an unmet Done list get "Not done 1/3" |
| Backlog | Stories that are not ready get "Not ready 3/5" (A and C) |

## Data

- `Settings.definitions`: per list `{ enforce: boolean, groups: { id, name, items: { id, text, rule: null | RuleKey, mayBeIrrelevant: boolean }[] }[] }`.
- `Story.checks`: `Record<itemId, 'checked' | 'na'>` (missing = open). `Story.doneItems`: snapshot of Done item ids at the move into *done*.
- Pure functions in `src/domain/definitions.ts` evaluate a story against a list and decide which gates a status change crosses; both repositories and the migration are extended.

## Visual design variants (2026-10-15)

Same function, three looks, in [`definitions-design-variants.html`](definitions-design-variants.html) (`definitions-design-<n>-story.png`, `-transition.png`):

| Variant | Idea | Outcome |
|---|---|---|
| 1 · Three-way switch in a panel | Two panels in the right column, a switch with ○ ✓ – per item | Open |
| 2 · Checkbox like the criteria list | One panel with tabs Ready/Done under the criteria, checkbox per item, quiet "not relevant" button where allowed, collapsible groups with a small meter | **Chosen (PO, 2026-10-15)** |
| 3 · State pill with menu | Own tab "Checklists" in the story dialog, groups as cards, state as a word in a pill with a menu | Open |

## Quality gate (PO feedback 2026-10-15)

The gate must not be tolerant: a status change that crosses a list the story does not meet is blocked. The dialog names the problem ("S-6 cannot move to “In progress”: 3 items of the Definition of Ready are still open"), puts the focus on the open items (checkbox, not relevant) and offers "Move" once they are resolved, "Open story" and "Cancel". The only other way is a deliberate override: "Override the gate…" turns the dialog into a second step in a warning frame that names the items that stay open; "Back to the items" or "Override and move". The override ends with a notice. Overrides are not yet recorded: logging them (who, when, which items, why) is a later story of #26. The demo lists are switched on.

## Editor of the lists (PO feedback 2026-10-15)

New groups and items are added directly in the list, groups move as blocks, automatic items come from a library that holds, among others, "Must be attached to an epic" and "Must be estimated". Three variants in [`definitions-editor-variants.html`](definitions-editor-variants.html) (`definitions-editor-a.png` to `-c.png`): A blocks with an add row and a library picker, B list and library side by side, C keyboard first with "/" for the library. **A chosen by the PO (2026-10-15)** and built in the same pull request: blocks with a handle (drag the whole group, open or folded), fold button, name, counter and remove; an add row in every block ("New item – Enter adds", "From library"); "New group – Enter adds" under the blocks; the library picker lists the automatic checks with a description, "already in this list" marks the ones taken.

## Switching lists on and off, hiding, test data (PO feedback 2026-10-15)

- Each list (Ready, Done) has an **activation switch** in Settings › Definitions, **off by default** (also in the demo data). An off list is not shown in stories, asks nothing at status changes and marks nothing; the settings say so in a note. The data field is still called `enforce`.
- In the story dialog the PO wants to **hide** the Definition block and to **switch** between Ready and Done (tabs or a segment, depending on the look variant).
- The acceptance panel offers **test data** (`src/acceptance/presets.ts`): both off, both on, only Ready on, only Done on, marks (S-3 ready, S-6 one item missing, S-7 most missing, S-2 done and not met, S-5 done before the lists existed), empty lists.

## Look of story block, editor and gate (PO feedback 2026-10-15)

The look of the three places is not liked yet. Mockups in [`definitions-look-variants.html`](definitions-look-variants.html) (`definitions-look-*.png`): story block S1 to S5 (plus S6 hidden), editor E1 to E4, gate dialog G1 to G5 (plus the override step). Not decided yet.
