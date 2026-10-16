# Design: Change history and comparing two versions

Issue: [#23 Change history of stories and epics](https://github.com/goerks/getthingsdone/issues/23)

Mockups (open in a browser; the mockup text is in German because it is reviewed in German): [`change-history-compare-variants.html`](change-history-compare-variants.html). Screenshots: `change-history-compare-a.png` to `-d.png`. Status: draft, variants proposed to the PO on 2026-10-16.

## Idea

The history is a generic list per item (story, epic, sprint, release, later custom types). The PO added: two **versions** of an item can be picked, for example "Current" against "V6", and shown side by side (older left, newer right).

A **version** is one save of an item (V1, V2, …); several field changes in one save are one version. "Current" is the latest version. The compare view is read only; restoring an old version stays out of scope.

## Variants

| Variant | Idea | Strength | Weakness |
|---|---|---|---|
| A · Table | "From" and "To" pickers, one row per field, unchanged fields folded | Compact, like a form | Long descriptions get narrow cells; no view of what happened in between |
| B · List and two cards | Version list at the left with A/B markers, two read-only cards at the right | Pick and compare in one place | Needs the full dialog width |
| C · Review style | Summary chips, short fields in rows, line by line text diff with line numbers | Best for long texts | Most space, most "technical" |
| D · Timeline with two handles | Two draggable handles on a timeline, list of the saves in between, compact table | Shows the path between the versions | Dragging needs a good keyboard variant; many versions need zoom |

## Rules common to all variants

- Added: green with **+**, removed: red and struck through with **−**, changed: amber edge with **~**. Never colour alone.
- Entry point: button "Compare versions" in the "History" tab. Keyboard: arrows in the list, `A` and `B` set the two versions, Esc goes back; a swap button reverses the direction.
- Open point: comparing descriptions needs the full old and new text in the history. This contradicts the earlier answer "long texts only say changed" (question 2 in #23) and needs a PO decision.
