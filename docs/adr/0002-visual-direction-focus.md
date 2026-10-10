# ADR 0002: Visual direction "Focus"

Status: Proposed (awaiting PO approval)
Date: 2026-10-10

## Context

Four visual directions were compared for the board screen: Focus (light, calm), Workbench (dark, dense), Studio (colourful, rounded) and Swiss (high contrast, typographic). Criteria were overview and density, accessibility, fit for small teams, effort and maintainability, theming and showcase value.

## Decision

1. Use **Focus** as the visual direction: cool neutral greys, one blue accent, IBM Plex Sans and IBM Plex Mono for IDs.
2. Build all colours as **design tokens** (CSS custom properties) with a light and a dark theme from the first release. The dark theme takes its palette from the Workbench direction.
3. Epic colours appear only as a small dot next to the epic name. Colour never carries meaning alone: the name is always shown.
4. Interactive targets are at least 44 by 44 px. Body text meets contrast ratio 4.5:1.
5. The Swiss direction's strict, typographic style is reserved for the product site and documentation.

## Consequences

- All components use tokens from `docs/design/tokens.css`, never hard-coded colours.
- A new theme (for example high contrast) only needs a new token set.
- Epic colour pairs must be checked for contrast in both themes.

## Alternatives considered

- Workbench as the only theme: dense, but excludes users who prefer light interfaces.
- Studio: friendly, but many colour fills make accessibility checks harder.
- Swiss: very legible, but less suited to a card-heavy board.
