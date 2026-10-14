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

## Decisions (PO, #37)

- Variant A is chosen. The recording bar is fixed (sticky) on the right edge and pushes the app to the left, so the UI gets narrower and nothing is covered.

## Adopted from B and C (proposed, to be confirmed by the PO)

- C: start dialog (name, requirement ID such as AC2.1, starting point), pause, bar that collapses to a narrow strip with a step counter.
- B: edit the sentence of a step; add a step by hand; "Erwartet festhalten" lets the user point at a result and offers "Ich sehe …" sentences.
- Not adopted: fully manual recording (B), three separate dialogs (C).


## As built (#37)

- The bar is fixed to the right edge (variant A); folded away it is a 52 px strip with the number of steps. On a narrow screen it sits at the bottom.
- The start dialog of C is a form inside the bar (name, requirement, starting point), so the app stays visible.
- PO feedback on the pull request: the button in the header was in the wrong place. The way in is the round button of the acceptance ([#35](https://github.com/goerks/GetThingsDone/pull/35), `feedback-button-pr35-*.png`): its popup has the tabs "Abnahme" and "Neuer Test"; "Neuer Test" opens the bar. Shown only where the acceptance shows.
- The bar lists "My tests" and has "Ergebnis kopieren": one text for the AI with the acceptance result and the new tests; the popup copies the same text (a preview of the text can be shown).
- Left out on the PO's decision: feedback entries and the feedback button at the bottom, acceptance results, file download, replay. The entries are built so that feedback can follow.
- Pointing at the expected result offers "I see …" sentences; keyboard drags are not recorded (add the step by hand).
