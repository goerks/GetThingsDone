# 1. Introduction and goals

## Purpose

Get It Done is a free, local-first tool for agile software development in small teams (up to roughly 10 people). Release 1 covers epics, stories, acceptance criteria, a Kanban board and an ordered backlog. A user story map with sprints as slices was added with issue #2 (activities and release slices follow later). See [vision](../vision.md) and [requirements](../requirements/README.md).

The product is also a showcase of "level 5 vibe coding": an AI develops it end to end, a human product owner sets the direction and accepts the result.

## Quality goals

| Priority | Goal | Meaning |
|---|---|---|
| 1 | Local first | Works fully offline. Data stays on the user's machine. |
| 2 | Accessibility | Keyboard operable, screen reader friendly, contrast 4.5:1, targets at least 44 by 44 px. |
| 3 | Testability | Domain logic is pure and unit tested. UI behaviour is covered by component tests. |
| 4 | Light install | One small executable or a minimal installer. |
| 5 | Multilingual | DE, EN, FR and IT from the first screen. |

Details and scenarios: [chapter 10](10-quality-requirements.md).

## Stakeholders

| Role | Expectation |
|---|---|
| Product owner (human) | Sets vision and features, accepts each feature in the pull request, tests the Windows build locally. |
| Developer (AI) | Clear rules (`CLAUDE.md`), traceable decisions (ADRs), fast feedback from tests and CI. |
| Team members (users) | A fast, calm tool that does not get in the way. |
| Showcase audience | Readable documentation that shows how the product was built. |
