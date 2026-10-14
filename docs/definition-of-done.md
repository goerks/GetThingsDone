# Definition of Done

A feature is done when all of the following hold.

## Quality

- [ ] Every PO-approved test case is covered by at least one automated test named with its test case ID (or marked *(manuell)* and checked by hand)
- [ ] Unit and component tests cover the new logic, with high coverage
- [ ] Integration tests cover data access and the Tauri/web boundary
- [ ] End-to-end tests (`e2e/`) cover the main user journey of the feature in a real browser
- [ ] Automated accessibility checks pass (for example axe in the UI tests)
- [ ] Keyboard-only operation was checked
- [ ] All UI strings exist in DE, EN, FR and IT
- [ ] No linter or type errors, CI is green

## Documentation

- [ ] Requirements updated in `docs/requirements/`
- [ ] arc42 chapters updated where the architecture is affected
- [ ] ADR written for any new architecture decision
- [ ] User-facing documentation updated
- [ ] Help updated: topics in DE, EN, FR and IT with links to where to find the feature (and the step "switch the feature on first" where there is one), a test for it. Steps of the first steps (tutorial) only after the PO approved the topics

## Acceptance

- [ ] Preview deployment is available and lists the acceptance criteria
- [ ] Pull request description contains the acceptance checklist with test case IDs and covering tests
- [ ] Product owner has accepted in the pull request
