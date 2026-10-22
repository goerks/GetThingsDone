# Quality requirements

How the architecture meets these requirements: [arc42 chapter 10](../arc42/10-quality-requirements.md).

| ID | Category | Requirement | Measure | Status |
|---|---|---|---|---|
| QR-01 | Accessibility | Automated accessibility checks pass for every page | axe in UI tests, zero violations | Open (no UI tests yet) |
| QR-02 | Accessibility | Every function works with the keyboard alone | Manual check per feature, keyboard drag and drop on the board | Implemented |
| QR-03 | Accessibility | Interactive targets are at least 44 by 44 px, with a visible focus ring | Design tokens, review | Implemented |
| QR-04 | Accessibility | Text contrast at least 4.5:1 in both themes; colour never carries meaning alone | Token check | Implemented (epic colours at least 4.3:1 against cards and columns, shown with the name) |
| QR-05 | Multilingual | All UI text in DE, EN, FR and IT, no hard-coded user-facing strings | Every key exists in all four files | Implemented |
| QR-06 | Local first | Works fully offline; no telemetry. The only network call is the optional GitHub connection (FR-GH-01), which is off by default, runs by hand, writes only when switched on and never blocks the app | Fonts bundled; the connection is behind `TrackerConnector` (ADR 0005) | Implemented |
| QR-07 | Reliability | No change is lost or reordered when saving | Writes run in order; errors are shown | Partial (no transactions, no retry: TD-5, TD-6) |
| QR-08 | Performance | The app starts and reacts without noticeable delay for a team backlog of a few hundred stories | Start under 2 s, interactions under 100 ms on a typical laptop | Not measured |
| QR-09 | Portability | Windows first; Linux and macOS from the same codebase | Tauri build on each platform | Partial (Windows build in CI) |
| QR-10 | Light install | One small portable executable or a minimal installer, no admin rights | Portable exe and per-user NSIS installer | Implemented |
| QR-11 | Maintainability | High test coverage of domain logic and UI behaviour; CI green on every push | Unit, component and end-to-end tests, typecheck | Implemented (coverage target not yet enforced) |
| QR-12 | Traceability | Requirements, ADRs and arc42 are updated with each feature | Definition of done, pull request checklist | Implemented from release 0.1 |
| QR-13 | Consistency | Every UI element uses the tokens and shared components of the design system; a new element extends the design system with a story in the same change | `docs/design-system.md`, Storybook catalogue, `src/styles/designSystem.test.ts`, pull request checklist | Implemented (#70; automated guard for components and visual regression follow) |
