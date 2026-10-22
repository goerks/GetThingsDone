# Design system

The design system of Get It Done: the tokens, the shared components and the rules for using them. Introduced with #70, decision in [ADR 0006](adr/0006-design-system-catalogue.md), visual direction in [ADR 0002](adr/0002-visual-direction-focus.md). **Using it is mandatory for every feature** (see [`CLAUDE.md`](../CLAUDE.md), [Definition of Done](definition-of-done.md)).

## The catalogue

Storybook shows the real tokens and components, in light and dark (switch in the toolbar):

- Pull request preview: `<preview address>/design-system/`, for example `https://getthingsdone-pr-<n>.onrender.com/design-system/`.
- Local: `npm run storybook` (port 6006). Static build: `npm run build-storybook`.

| Section | What it documents |
|---|---|
| Foundations / Colors, Typography, Spacing, Radius, Elevation, Layers, Motion, Icons, Accessibility | Every token with name, value and purpose |
| Components / Button, IconButton, Form fields, Badge and pill, Dialog | Every shared component with its variants and states (normal, hover, focus, pressed, disabled, error) |

## Rules

1. **Tokens only.** Colours, font sizes, line heights, weights, spacings, radii, shadows, layers, durations and icon sizes come from `docs/design/tokens.css`. No raw values (`#fff`, `13px`, `z-index: 5`) in `src/styles/app.css`, in components or in inline styles. `src/styles/designSystem.test.ts` fails on them. Breakpoints are the two documented widths (640 px, 760 px).
2. **Shared components first.** Buttons, text fields, selects, checkboxes and link-like buttons are `Button`, `IconButton`, `TextButton`, `TextInput`, `Textarea`, `Select` and `Check` from `src/ui/`, dialogs are `Dialog`. No hand-classed `<button className="btn …">` or `<input className="input">`.
3. **Extend, do not improvise.** If no token or component fits, add it to the design system in the same pull request, with a story in both themes, and say so in the pull request. Never add a one-off value or style to a feature.
4. **Accessibility is part of the component.** Contrast 4.5:1, 44 px targets, visible focus, colour never alone, and keyboard operation hold for every component in both themes.
5. **Design proposals speak design system.** A proposal (`/design-vorschlag`) names the tokens and components it uses and which ones would be new.

## Tokens at a glance

| Group | Tokens |
|---|---|
| Colour | `--bg`, `--surface`, `--column`, `--border`, `--text`, `--muted`, `--accent*`, `--danger*`, `--warn*`, `--ok*`, `--mark*`, `--overlay`, `--shadow*`, `--epic-*` |
| Type | `--font-sans`, `--font-mono`, `--font-size-2xs … 5xl`, `--weight-*`, `--leading-*` |
| Spacing | `--space-px`, `--space-0-5 … 12` (4 px grid with half steps) |
| Shape | `--radius-2xs … lg`, `--radius-pill`, `--radius-round` |
| Elevation | `--elevation-1 … 4`, `--elevation-panel` |
| Layers | `--z-raised … --z-menu` |
| Motion | `--duration-fast`, `--duration-slow`, `--ease` |
| Other | `--icon-sm`, `--icon-md`, `--icon-lg`, `--target-min` |

## Adding a component

1. Put it in `src/ui/<Name>.tsx`, export it from `src/ui/index.ts`; styles go to `src/styles/app.css` with tokens only.
2. Write `src/ui/<Name>.stories.tsx`: one story with all variants and states, one each for hover and focus where they apply.
3. Use it in the feature, update `docs/arc42/` and this page.
