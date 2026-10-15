# Design: Custom workflow (allowed transitions between statuses)

Issue: [#49 Custom workflow: define allowed transitions between statuses](https://github.com/goerks/GetThingsDone/issues/49)

The mockups are in [`workflow-variants.html`](workflow-variants.html) (open the file in a browser; the mockup text is in German because it is reviewed in German). Screenshots: `workflow-*.png`. Status: variant 2 and board option a chosen by the PO on 2026-10-15 (recommendation 2.a); acceptance criteria still to be approved.

## Decided by the PO (2026-10-15)

- One workflow for all stories for now; epics have none. Custom types (#29) get their own workflow later.
- Start and end are explicit parts of the workflow. A forbidden transition to the end prevents deleting from that status.
- Everything is allowed by default, backward included; the PO forbids what must not happen.
- One switch per category: "Free transitions within the category".
- Bulk moves are all or nothing, with a message naming the stories.
- No status leads to the end: warning only.

## Variants for the settings

| Variant | Idea | Rating |
|---|---|---|
| 1 · Matrix | Table from × to, start as first row, end as last column | Overview at a glance; scrolls sideways on a phone, unwieldy beyond about 8 statuses |
| 2 · List "from here to …" | One row per status with its targets as toggle chips | Phone and keyboard friendly, grows downward; gaps are harder to see |
| 3 · Diagram | Start, statuses in category lanes, end; arrows are transitions | Matches the sketch; fiddly to edit and not accessible on its own |

## Options for the board (any variant)

| Option | Idea |
|---|---|
| a · Lock while dragging | Forbidden columns are greyed with a lock; the reason shows on hover |
| b · Drop and message | Nothing changes while dragging; the card returns with a message naming the reason |
| c · Collapse forbidden columns | Forbidden columns shrink to a strip while dragging |

The story dialog and the backlog only offer allowed target statuses.

## Recommendation

**2.a** (chosen by the PO): list with chips, lock while dragging. The message of b additionally covers touch, where there is no hover.
