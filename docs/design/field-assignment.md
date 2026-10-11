# Design: which fields an item type uses

Issue: [#4 Customizable fields](https://github.com/goerks/GetThingsDone/issues/4), pull request #6

## Variants

In stage 1 the field dialog offers only "Stories", because epics show custom fields from stage 2 on. The PO asked for a view that assigns fields per item type (story, epic, later sprint and release), with system fields fixed and everything else selectable. The mockups are in [`field-assignment-variants.html`](field-assignment-variants.html) (open the file in a browser; the mockup text is in German because it was reviewed in German).

Rules for all variants: system fields (key, title, status) are always on and locked. Built-in fields belong to their own type and can be switched off (hidden, stage 5). Custom fields can be used on any type; switching a type off hides the field and keeps its values. Sprint and release are shown as planned.

| Variant | Idea | Outcome |
|---|---|---|
| A · Matrix | The field table gets one checkbox column per item type; a click assigns or unassigns and saves at once. | Proposed, together with stage 2 |
| B · List per type | Tabs per item type, each listing its fields in order; "Add field" picks from the library. | Proposed as an additional "Layout" view in stage 3 (order, required, on card) |
| C · Checkboxes in the field dialog | The current dialog, with all item types. | Smallest change; not proposed |
