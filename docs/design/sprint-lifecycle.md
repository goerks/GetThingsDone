# Design: start and complete a sprint

Issue: [#17 Start and complete a sprint](https://github.com/goerks/GetThingsDone/issues/17)

The mockups are in [`sprint-lifecycle.html`](sprint-lifecycle.html) (open the file in a browser; the mockup text is in German because it is reviewed in German). Screenshots: `sprint-lifecycle-*.png`.

## States

A sprint is **planned**, **running** (at most one) or **completed**. It runs when it is started, not by its dates. A start cannot be undone.

## Decisions (PO, 2026-10-14)

| | Topic | Decision |
|---|---|---|
| Scope | Start and complete | Built together; three states |
| Q1 | Planned points | The points in the sprint when it is started. Added and removed stories are shown when completing; done can be more than planned |
| Q2 | Running sprint after its end date | Stays on the board, badge "ended", hint with "Complete sprint" |
| Q3 | Completing on another day than the end date | Ask: end date becomes today (preselected) or stays |
| Q4 | Unfinished stories | One choice for all: next sprint, a new sprint or the backlog |
| Q5 | Completed sprints later | Only in the summary; the overview comes with the velocity chart (#24) |
| Q6 | Stories without points | Count as 0 points and are named |
| Q11 | Which sprint can be started | Any planned sprint, the first is proposed |
| Q12 | Starting on another day than planned | Ask: start today (preselected, the end moves along, the length stays) or keep the dates |
| Q13 | Board without a running sprint | Shows the next planned sprint, badge "planned", hint with "Start sprint"; without a planned sprint the empty state |
| Q14 | Starting while a sprint runs | Not possible; the completion dialog offers "Then start Sprint 2" (opens the start dialog) |
| Q15 | Start dialog | Sprint, stories, planned points; average with #24, capacity with #25; no sprint goal |
| Q16 | Undo a start | No |
| Q17 | Existing data on update | By date: today's sprint runs, earlier ones are completed (result computed at the update), later ones are planned |
| Q18 | State outside the board | Badges "running" and "planned" in backlog and story map; completed sprints disappear there |
| V1 | Completion dialog | One step |

## Views

| # | View | New or changed |
|---|---|---|
| 1 | Board without a running sprint: next planned sprint with hint and "Start sprint" | Changed |
| 2 | Start dialog: sprint select, stories, planned points, start date question | New |
| 3 | Board, running sprint: "Complete sprint", points now and at the start | Changed |
| 4 | Board, running sprint after its end date: badge "ended", hint | Changed |
| 5 | Completion dialog: planned at start, done, not done, changes during the sprint, choice, end date question, "Then start Sprint 2" | New |
| 6 | Special cases: all done on the end date; no planned sprint left; removed story; story without points | New |
| 7 | After completing: status message, next planned sprint or empty state | Changed |
| 8 | Backlog and story map with the badges "running" and "planned" | Changed |

Draft 1 (completion only, with a two-step alternative) is in the history of this file.
