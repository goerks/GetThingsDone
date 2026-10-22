# ADR 0006: Design system catalogue with Storybook

Status: Proposed (awaiting PO approval)
Date: 2026-10-22
Issue: #70

## Context

ADR 0002 fixed the visual direction and the use of design tokens, but the design system itself was not documented: no list of components, variants and states, no type scale, elevation or layers, and the app mixed tokens with raw values (13 font sizes, 13 z-index values, `--space-*` never used). New features could not be checked against anything.

Options for the documentation: Storybook (React and Vite), Ladle, an in-app page, Style Dictionary with design token files, a design tool such as Figma.

## Decision

1. The **design system catalogue is Storybook** (`storybook`, `@storybook/react-vite`, addons `a11y` and `docs`, all MIT). It lives in `.storybook/` and in `*.stories.tsx` next to the code: foundations in `src/design-system/`, components in `src/ui/`.
2. **CSS custom properties in `docs/design/tokens.css` stay the only source of the tokens** (colour, type, spacing, radius, elevation, layers, motion, icon sizes, breakpoints as documented constants). No token build tool, no second source.
3. **Shared components live in `src/ui/`** (`Button`, `IconButton`, `TextButton`, `TextInput`, `Textarea`, `Select`, `Check`, `Badge`, `Pill`; `Dialog` stays in `src/components/`). They render the existing class names, so styles stay in `app.css`.
4. `npm run build` builds the web app and then the catalogue into `dist/design-system`, so the public pull request preview serves the catalogue at `<preview address>/design-system/` without a second hosting service. The desktop app is built with `npm run build:app` and does not contain it.
5. **Adhering to the design system is mandatory** for every feature (`CLAUDE.md`, Definition of Done, working mode). A missing token or component is added to the design system, with a story, in the same pull request.
6. Packages are installed where the npm registry is reachable (GitHub Actions); cloud sessions of the AI cannot reach it (#67).

## Consequences

- One more development dependency tree (Storybook); it is not part of the shipped app.
- A change of a token or a component is visible in the catalogue in both themes.
- Phase 4 of #70 (an automated guard against raw values, visual regression and axe per story) is not part of this decision and follows separately.

## Alternatives considered

- Ladle: lighter, but fewer addons for accessibility and documentation.
- In-app design page: no dependency, but the documentation layout would be ours to maintain.
- Style Dictionary or W3C token files: one platform and one theme pair do not need a build step.
- Figma or Zeroheight: a second source of truth that drifts from the code.
