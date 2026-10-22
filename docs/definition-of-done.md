# Definition of Done

A feature is done when all of the following hold.

## Quality

- [ ] Every PO-approved test case is covered by at least one automated test named with its test case ID (or marked *(manuell)* and checked by hand)
- [ ] Unit and component tests cover the new logic, with high coverage
- [ ] Integration tests cover data access and the Tauri/web boundary
- [ ] End-to-end tests (`e2e/`) cover the main user journey of the feature in a real browser
- [ ] Automated accessibility checks pass (for example axe in the UI tests)
- [ ] Keyboard-only operation was checked
- [ ] Design system adherence: only tokens and shared components of `src/ui/`, no raw values; anything new (token or component) is added to the design system with a story in light and dark, and `src/styles/designSystem.test.ts` is green
- [ ] All UI strings exist in DE, EN, FR and IT
- [ ] No linter or type errors, CI is green

## Documentation

- [ ] Requirements updated in `docs/requirements/`
- [ ] arc42 chapters updated where the architecture is affected
- [ ] ADR written for any new architecture decision
- [ ] Design system documentation updated (`docs/design-system.md`, Storybook stories) where a token or component was added or changed
- [ ] User-facing documentation updated
- [ ] Help updated: topics in DE, EN, FR and IT with links to where to find the feature (and the step "switch the feature on first" where there is one), a test for it. Steps of the first steps (tutorial) only after the PO approved the topics

## Acceptance

- [ ] Preview deployment is available and lists the acceptance criteria; the design system catalogue is reachable at `<preview address>/design-system/`
- [ ] Pull request description contains the acceptance checklist with test case IDs and covering tests and the entry "Design system adherence" (what is new in the design system, or that nothing is)
- [ ] Product owner has accepted in the pull request
