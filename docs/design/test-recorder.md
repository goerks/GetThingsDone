# Design: record tests in the web preview

Issue: [#37 Web preview: record new test cases by clicking through and export them like feedback](https://github.com/goerks/GetThingsDone/issues/37)

## Idea (PO)

In the web preview, start a new test, click through the app, record the expected result, and export the test like feedback. The recorder exists only in the preview (demo data), not in the Windows app.

## Variants

Mockups: [`test-recorder-variants.html`](test-recorder-variants.html) (German, because the PO reviews it in German). Images: `test-recorder-*.png`.

| Variant | Idea | Status |
|---|---|---|
| A · Automatic recording with a bottom bar | "Test aufnehmen" in the header; every click, input and drag is written as a sentence in a bar at the bottom; steps can be edited or deleted; "Erwartet festhalten" adds the expected result | Proposed (with the start and finish dialogs of C) |
| B · Steps set by hand | Pick mode: point at an element, choose the action, write the sentence | Possible |
| C · Guided flow in three dialogs | Start dialog (name, requirement, starting point), small recording pill, finish dialog (review steps, write expected result) | Possible |
| Export (shared) | "Meine Tests" list per device (`localStorage`); export as text in the test case format, as `.md` and as `.json` with the technical steps | Proposed |

Decisions of the PO follow in the issue.
