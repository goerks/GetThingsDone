# Jira sync: design proposals (#66)

Mockups (clickable, light and dark): [`jira-sync-variants.html`](jira-sync-variants.html). Only one sync service is active at a time (GitHub or Jira). Everything below is a proposal with demo data; nothing is built.

## Question 1: how is the service chosen and set up?

| Variant | Idea | Screenshot |
|---|---|---|
| **1 One tab "Synchronisation" with a service choice (recommended)** | One switch for the feature, four service cards, the form below belongs to the chosen card | `jira-sync-1-service-choice.png` |
| 2 One tab and one switch per service | Like Releases and Team (#61); switching Jira on switches GitHub off and says so | `jira-sync-2-tab-per-service.png` |
| 3 Wizard "Connect to a service" | Four steps: service, access, project, mapping; projects and boards are read after the login | `jira-sync-3-wizard.png` |

## Question 2: how is the mapping set?

| Option | Idea | Screenshot |
|---|---|---|
| **A Proposal with a summary (recommended)** | After "Test connection" the app detects statuses, epics, versions, sprints and the points field, and shows a summary; only unclear items need a look ("Adjust") | `jira-sync-option-a-summary.png` |
| B Table always visible | Jira status → column table and one switch per field | `jira-sync-option-b-table.png` |

## Other screens (all variants)

- Switching the service: `jira-sync-switch-service.png`
- Backlog with Jira keys, sprints, points, pending marker and the sync icon: `jira-sync-backlog.png`
- Jira refuses a transition (workflow condition): `jira-sync-transition-error.png`

## Recommendation

**1.A.** See the issue for the reasons and what is given up.
