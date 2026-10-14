# Design: acceptance in the preview

Issue: [#32](https://github.com/goerks/GetThingsDone/issues/32). Mockups (clickable): [`acceptance-variants.html`](acceptance-variants.html); screenshots `acceptance-variant-a.png` to `-e.png`.

## Decided by the PO (2026-10-13)

- The acceptance is a **popup**, not a sidebar: the page keeps its place.
- Jumping to a test case with "Zur Seite" **lights up** what is to be tested (yellow frame and glow for 3 seconds).
- The **button** looks unlike every button of the app: marker yellow with a hard shadow, clipboard icon, the counter and the tag "Preview"; the popup has the same yellow header.

These three are built (`src/acceptance/Panel.tsx`). After "Zur Seite" the popup folds into a small reminder with the expected result and a tick box, so it does not cover the page.

## Variants for the next step (PO chooses)

| Variant | Idea |
|---|---|
| A · Criteria folded | Only the criteria with their progress; one open at a time; each test case a row that unfolds |
| B · Step through | One test case at a time ("Step 3 of 47"), "In Ordnung" goes to the next and lights it up, "Problem" asks for a comment, a strip of all steps as traffic lights; the popup moves to the side that does not hold the target |
| C · Slim bar | A one-line bar at the bottom: current case, expectation, ✓ ✗ and arrows; details fold upwards |
| D · Traffic light and filter | Three states per case, filters Open / OK / Problems, "copy only the problems" |
| E · Guided tour | The page dims, only the target stays bright with a speech bubble next to it; "pause" gives the page back |

Recommendation: **B**, with the filters and "copy only the problems" of **D** for a second pass.

## Button variants (PO, 2026-10-13)

The PO chose **B (step through)** and wants a different colour and/or shape for the button. Four designs in [`acceptance-button-variants.html`](acceptance-button-variants.html) (`acceptance-button-1.png` to `-4.png`): 1 edge tab (black with lime edge, text upright), 2 round button with progress ring (magenta), 3 warning tape (yellow-black stripes, square, tilted), 4 console pill (near black, lime, monospace, blinking dot). Their colours are used nowhere in the product. The choice is open.

## Decided and built (PO, 2026-10-13)

**Variant B (step through)** with **button 2 (round, magenta, progress ring)**: the PO accepted the recommendation. The result goes back to the PO's chat with the AI, not through the issue: "Ergebnis kopieren" copies a compact text (summary, problems with expectation and comment, other comments, ids in order and open) that the PO pastes into the conversation; the AI records what matters in the issue.
