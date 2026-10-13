# Requirements

Requirements of Get It Done. They are derived from the [vision](../vision.md) and from the product owner's feature issues, and kept current with every feature (see `CLAUDE.md` and the definition of done). The architecture is documented in [`docs/arc42/`](../arc42/README.md).

## Structure

| File | Content |
|---|---|
| [functional-requirements.md](functional-requirements.md) | What the product does, grouped by area, with acceptance criteria |
| [quality-requirements.md](quality-requirements.md) | Non-functional requirements (accessibility, i18n, local first, performance, portability, maintainability) |

## Conventions

- Every requirement has a stable ID: `FR-<AREA>-<nn>` for functional, `QR-<nn>` for quality requirements. IDs are never reused.
- Functional requirements are written as user stories with acceptance criteria.
- **Source** names the origin: `Vision`, an issue (`#12`) or a pull request.
- **Status**: `Implemented` (in the code, covered by tests), `Partial`, `Open` (agreed, not built), `Proposed` (awaiting PO approval).
- **Verified by** points to the tests that cover the requirement. For features refined with test cases, name the test case IDs (`#12 AC2.1`); the tests carry the same ID in their name.
- A new feature adds or changes requirements in the same pull request as the code.

## Roles

| Role | Description |
|---|---|
| Team member | Anyone in the team who works with stories on the board |
| Product owner (PO) | Orders the backlog and accepts stories |
