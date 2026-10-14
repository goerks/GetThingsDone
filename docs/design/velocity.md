# Design: velocity chart

Issue: [#24 Velocity chart for sprints](https://github.com/goerks/GetThingsDone/issues/24), built on [#17](complete-sprint.md).

The mockups are in [`velocity-variants.html`](velocity-variants.html) (open the file in a browser; the mockup text is in German because it is reviewed in German). Screenshots: `velocity-*.png`.

## Decisions (PO, 2026-10-14)

| | Topic | Decision |
|---|---|---|
| Q1 | Planned points | The points in the sprint when it is completed, so done is never more than planned |
| Q7 | Where | In the backlog above the sprint sections, collapsible |
| Q8 | Fewer than three completed sprints | Average over the completed sprints there are, with their number ("Ø 18 · 2 sprints") |
| Q9 | How many sprints | The last 8; "‹ Older sprints" pages back; the table shows all |

## Views

| # | View | New or changed | Notes |
|---|---|---|---|
| 1A | Velocity panel, two bars per sprint | New, alternative | Planned (`--epic-amber`) and done (`--accent`) side by side, values above |
| 1B | Velocity panel, done inside planned | New, **recommended** | Planned as an outlined bar, done as the accent fill inside it, "done / planned" above; one colour |
| 2 | Table | New | Switch "Chart / Table"; newest first, all completed sprints; screen readers always get the table |
| 3 | States | New | Collapsed (head shows the average), fewer than three sprints, empty state, sprint sections of backlog and story map show "30 planned · Ø 21" |

## Rules

- Colour never carries meaning alone: values are written at every bar, the average line is dashed and labelled, a legend names both series.
- The chart is hand-drawn SVG like the release reports (#10); no chart library.
- Hover or focus on a sprint shows a tooltip with dates, planned, done and share.
