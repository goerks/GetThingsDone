# Design: release planning

Issue: [#10 Release planning](https://github.com/goerks/GetThingsDone/issues/10)

## Views

All new and changed views are mocked up in [`release-planning-variants.html`](release-planning-variants.html) (open the file in a browser; the mockup text is in German because it was reviewed in German). Light and dark theme follow the system setting. The file shows the chosen design only; the alternatives that were proposed first are listed under "Decisions".

| # | View | New or changed | Notes |
|---|---|---|---|
| 1 | Releases page | New, main navigation entry "Releases" | One card per release: title, period, stories, points, progress, scope change since the start |
| 2 | Release dialog | New | Tabs Details, Stories, Scope, Burndown. The create dialog is the narrow form only |
| 3 | Reports | New, tabs of the release dialog | Scope (increase and decrease) and burndown, each in points or tickets, hand-drawn SVG with a data table for screen readers |
| 4 | Story dialog and new-story dialog | Changed | System field "Release" next to epic and sprint; a hint when the sprint ends after the release |
| 5 | Story map | Changed | Rows are sprints or releases, as set in the settings. A link "Rows: Releases" with a gear in the page head jumps to the setting. Release rows, "No release" row, drag between releases |
| 6 | Settings › Story map | New section | One setting, "Rows of the story map": Sprints (default) or Releases, as a radio group of two cards with a preview. Saved at once, for the whole team. A link "To the story map" leads back |
| 7 | Settings › Fields | Changed | "Release" system field of stories; the "Releases" column becomes active with title, description, start and end |
| 8 | Cards and backlog rows | Changed | Release tag only when the field is set to "On card" (default off) |
| 9 | Special cases | New | No releases, no dates, no stories, release done, no history before the first record, demo data |

## Decisions

| Topic | Decision | Date |
|---|---|---|
| Map slices | Sprints **or** releases | 2026-10-12 |
| Where the slice is chosen | In the settings (section "Story map", `#/settings/map`), **not** on the map. The map page head links to it | 2026-10-12 |
| History before the first record | The curve starts with the state at the first record | 2026-10-12 |
| Time axis | Calendar days. Without dates the burndown runs from the first record to today; the ideal line only exists with both dates | 2026-10-12 |
| Release status | None; planned / running / done are derived labels | 2026-10-12 |
| Sprint after release end | A hint, never a blocker | 2026-10-12 |
| Scope change | Every assignment after the start is an increase, every removal a decrease, a points change counts as the difference; status changes never change the scope | 2026-10-12 |
| Releases page | Cards (the table was the alternative) | 2026-10-12 |
| Ctrl+N | Creates what the page is about: a story on board, backlog and story map, an epic on the epics page, a release on the releases page; nothing in the settings (many browsers keep Ctrl+N for a new window, so it works in the desktop app) | 2026-10-12 |
| Reports | Tabs in the release dialog (the alternative was charts on the page) | 2026-10-12 |
| "Release" on cards and in the new-story dialog | Off by default | 2026-10-12 |

## Deviations from the mockups

- Phase 1: the "Umfang" and "Burndown" tabs were left out until their phases; the scope line of the cards waited for the history.
- Phase 4: the burndown tab follows the mockup (unit switch, figures, step chart with the target line, signed markers, table). The figures are what is left, what is done and the distance to the target line; the mockup's fourth figure (stories left) is the other unit of the switch. A dashed line marks today.
- Phase 3: the scope tab follows the mockup (unit switch, four figures, step chart with signed markers, table, change list). The chart is hand-drawn SVG; the "Done" line is added to the scope chart.

## Rules shared by all views

- A story belongs to at most one release. The story's release select offers "No release" and every release that is not done.
- A release counts as done when it has stories and all of them are done. Adding a story or reopening one makes it run again.
- Colour never carries meaning alone: increase and decrease have a sign (`+8`, `−3`), the ideal line is dashed, everything has a text label and a table.
- All controls are real `button` / `a` / form elements, at least 44 × 44 px, with a visible focus ring. The unit switch is a button group with `aria-pressed`; the row setting is a radio group with a legend; the release dialog tabs are a `tablist` with arrow keys; the link from the map to the settings is a real link to `#/settings/map`.
- All texts are available in DE, EN, FR and IT.
