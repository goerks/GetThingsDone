# Design: complete a sprint

Issue: [#17 Complete a sprint](https://github.com/goerks/GetThingsDone/issues/17)

The mockups are in [`complete-sprint-variants.html`](complete-sprint-variants.html) (open the file in a browser; the mockup text is in German because it is reviewed in German). Screenshots: `complete-sprint-*.png`.

## Decisions (PO, 2026-10-14)

| | Topic | Decision |
|---|---|---|
| Q1 | Planned points | The points in the sprint when it is completed (done plus unfinished) |
| Q2 | Ended, not completed sprint | The board keeps showing it with a hint and a "Complete sprint" button until it is completed |
| Q3 | Completing early or late | The end date is set to the completion day, but only after asking; the PO can keep the planned date |
| Q4 | Unfinished stories | One choice for all: next sprint, a new sprint or the backlog |
| Q5 | Completed sprints later | Only in the summary when completing; the overview comes with the velocity chart (#24) |
| Q6 | Stories without points | Count as 0 points; the summary names them |

## Views

| # | View | New or changed | Notes |
|---|---|---|---|
| 1 | Board, running sprint | Changed | Secondary button "Complete sprint" next to "New story" |
| 2 | Board, sprint ended but not completed | Changed | Badge "ended" instead of "running"; a hint above the columns (icon and text, not colour alone) with the primary button "Complete sprint" |
| 3A | Completion dialog in one step | New, **recommended** | Figures done / not done, progress bar, story lists (done collapsed), choice for the unfinished stories, end date question only when today is not the end date |
| 3B | Completion dialog in two steps | New, alternative | Step 1 result, step 2 choices |
| 4 | Special cases | New | All done (no choice), on the end date (no date question), no next sprint ("new sprint" preselected), stories without points |
| 5 | After completing | Changed | The board shows the next sprint with a status message; without an open sprint the empty state links to the story map |

## Open question

- **Q10** Completing late when the next sprint has already started: the dates overlap. Recommendation: a hint in the dialog only; alternative: move the start of the next sprint.
