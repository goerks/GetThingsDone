# Definition of Done

A feature is done when all of the following hold.

## Quality

- [ ] Unit and component tests cover the new logic, with high coverage
- [ ] Integration tests cover data access and the Tauri/web boundary
- [ ] UI tests cover the main user journey of the feature
- [ ] Automated accessibility checks pass (for example axe in the UI tests)
- [ ] Keyboard-only operation was checked
- [ ] All UI strings exist in DE, EN, FR and IT
- [ ] No linter or type errors, CI is green

## Documentation

- [ ] Requirements updated in `docs/requirements/`
- [ ] arc42 chapters updated where the architecture is affected
- [ ] ADR written for any new architecture decision
- [ ] User-facing documentation updated

## Acceptance

- [ ] Preview deployment is available and lists the acceptance criteria
- [ ] Pull request description contains the acceptance checklist
- [ ] Product owner has accepted in the pull request
