# Design: Change history and comparing two versions

Issue: [#23 Change history of stories and epics](https://github.com/goerks/getthingsdone/issues/23)

Mockups (open in a browser; the mockup text is in German because it is reviewed in German): [`change-history-compare-variants.html`](change-history-compare-variants.html). Screenshots: `change-history-compare-a.png` to `-i.png`. Status: draft. PO on 2026-10-16: B and D are out; take the best of A and C (variant E).

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

## Chosen direction: E = A + C (PO, 2026-10-16)

- **Compare view (E, `-e.png`):** the "From" / "To" pickers and the field table of A (older left, newer right, unchanged fields folded), plus the summary chips and the line by line text comparison of C for long texts. The pickers open a list of the versions with a short summary (`-f.png`).
- **Entry points:** story, epic and sprint dialogs have no tabs, so each gets a panel "History" under the other panels: the last three entries, the link "Show all changes" and the button "Compare versions"; every entry offers "Compare with current" (`-g.png`). The release dialog already has tabs and gets a fifth tab "History".
- **Full list (H, `-h.png`, `-i.png`):** one checkbox per version; with two ticked the bar "Compare" appears. The sprint list also names the stories that joined or left.
- **Compare layer:** opens above the dialog with "Back to the story" and Esc.
- **States without a mockup:** no history yet, the same version left and right ("No differences"), narrow window (the two columns stack with a heading each).
