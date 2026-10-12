# Design: release planning

Issue: [#10 Release planning](https://github.com/goerks/GetThingsDone/issues/10)

## Views

All new and changed views are mocked up in [`release-planning-variants.html`](release-planning-variants.html) (open the file in a browser; the mockup text is in German because it was reviewed in German). Light and dark theme follow the system setting.

| # | View | New or changed | Notes |
|---|---|---|---|
| 1 | Releases page | New, main navigation entry "Releases" | Variant A (cards, recommended) or B (table) |
| 2 | Release dialog | New | Tabs Details, Stories, Umfang (scope), Burndown. The create dialog is the narrow form only |
| 3 | Reports | New, tabs of the release dialog | Scope (increase and decrease) and burndown, each in points or tickets, hand-drawn SVG with a data table for screen readers. Variant R1 (tabs, recommended) or R2 (on the page) |
| 4 | Story dialog and new-story dialog | Changed | System field "Release" next to epic and sprint; a hint when the sprint ends after the release |
| 5 | Story map | Changed | Switch "Rows: Sprints / Releases"; release rows, "No release" row, drag between releases |
| 6 | Settings › Fields | Changed | "Release" system field of stories; the "Releases" column becomes active with title, description, start and end |
| 7 | Cards and backlog rows | Changed | Release tag only when the field is set to "On card" (default off) |
| 8 | Special cases | New | No releases, no dates, no stories, release done, no history before the first record, demo data |

## Decisions (PO, 2026-10-12, issue #10)

| Topic | Decision |
|---|---|
| Map slices | Sprints **or** releases, switchable |
| History before the first record | The curve starts with the state at the first record |
| Time axis | Calendar days. Without dates the burndown runs from the first record to today; the ideal line only exists with both dates |
| Release status | None; "done" is derived from the stories (planned / running / done are labels, not data) |
| Sprint after release end | A hint, never a blocker |
| Scope change | Every assignment after the start is an increase, every removal a decrease, a points change counts as the difference; status changes never change the scope |

## Rules shared by all views

- A story belongs to at most one release. The story's release select offers "No release" and every release that is not done.
- A release counts as done when it has stories and all of them are done. Adding a story or reopening one makes it run again.
- Colour never carries meaning alone: increase and decrease have a sign (`+8`, `−3`), the ideal line is dashed, everything has a text label and a table.
- All controls are real `button` / `a` / form elements, at least 44 × 44 px, with a visible focus ring. The unit switch and the row switch are button groups with `aria-pressed`; the release dialog tabs are a `tablist` with arrow keys.
- All texts are available in DE, EN, FR and IT.

## Open design choices for the PO

1. Releases page: A (cards) or B (table). Recommendation: A.
2. Reports: R1 (tabs in the dialog) or R2 (on the page). Recommendation: R1.
3. "Release" on cards and in the new-story dialog: default off. Recommendation: off.
