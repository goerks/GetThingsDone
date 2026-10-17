import type { Criterion } from './types';

/**
 * Settings with one place per feature (#61): the acceptance criteria and their test cases for the product owner, in German.
 * One source for the issue comment, the acceptance panel of the preview and the names of the automated tests
 * (`src/SettingsFeatures.test.tsx`, `e2e/settingsFeatures.spec.ts`). The design is variant 1.A of `docs/design/settings-features.md`.
 */
export const PACKAGE_61: { issue: number; pullRequest: number; title: string; criteria: Criterion[] } = {
  issue: 61,
  pullRequest: 65,
  title: 'Einstellungen: ein Ort pro Funktion',
  criteria: [
    {
      "id": "AC1",
      "story": "S1",
      "title": "Kein Tab «Funktionen» mehr",
      "cases": [
        {
          "id": "AC1.1",
          "title": "Kein Tab «Funktionen» mehr",
          "link": "#/settings/fields",
          "given": "Ich öffne die Einstellungen.",
          "when": "Ich schaue die Liste links an.",
          "then": "Es gibt keinen Eintrag «Funktionen».",
          "tests": [
            "src/SettingsFeatures.test.tsx › AC1.1 has no tab \"Features\" any more"
          ],
          "target": ".settings__nav"
        },
        {
          "id": "AC1.2",
          "title": "Alte Adresse führt zu Releases",
          "link": "#/settings/features",
          "given": "Ich habe ein Lesezeichen auf die alte Adresse «…#/settings/features».",
          "when": "Ich öffne es.",
          "then": "Der Tab «Releases» ist offen.",
          "tests": [
            "src/SettingsFeatures.test.tsx › AC1.2 leads the old address of the features to the tab \"Releases\""
          ]
        }
      ]
    },
    {
      "id": "AC2",
      "story": "S1",
      "title": "Zwei Gruppen mit Zustand",
      "cases": [
        {
          "id": "AC2.1",
          "title": "Zwei Gruppen in der Liste",
          "link": "#/settings/fields",
          "given": "Einstellungen offen.",
          "when": "Ich schaue die Liste links an.",
          "then": "Unter «Arbeitsbereich» stehen Felder, Status-Werte, Story Map, Definitionen, Daten. Unter «Funktionen» stehen Releases und Team.",
          "tests": [
            "src/SettingsFeatures.test.tsx › AC2.1 groups the list in \"Workspace\" and \"Features\""
          ],
          "target": ".settings__nav"
        },
        {
          "id": "AC2.2",
          "title": "Beide Funktionen immer sichtbar, mit Zustand",
          "link": "#/settings/fields",
          "given": "Team ist aus, Releases ist an.",
          "when": "Ich schaue die Liste unter «Funktionen» an.",
          "then": "Beide Einträge sind da. «Releases» trägt «Ein», «Team» trägt «Aus».",
          "tests": [
            "src/SettingsFeatures.test.tsx › AC2.2 shows both features always, with their state"
          ],
          "target": ".settings__nav"
        }
      ]
    },
    {
      "id": "AC3",
      "story": "S1",
      "title": "Schalter oben im Tab",
      "cases": [
        {
          "id": "AC3.1",
          "title": "Einschalten im Tab",
          "link": "#/settings/team",
          "given": "Team ist aus. Ich bin im Tab «Team».",
          "when": "Ich schalte oben den Schalter ein.",
          "then": "Der Eintrag in der Liste zeigt «Ein». Im Tab sehe ich die Mitglieder und «Mitglied hinzufügen». Auf dem Board erscheint der Mitglieder-Filter. Nach dem Neuladen ist Team noch an.",
          "tests": [
            "src/SettingsFeatures.test.tsx › AC3.1 switches the team on in its tab, shows its settings and keeps the choice",
            "e2e/settingsFeatures.spec.ts › AC3.1 the team stays on after a reload"
          ],
          "target": ".feature-tab"
        },
        {
          "id": "AC3.2",
          "title": "Ausschalten im Tab",
          "link": "#/settings/team",
          "given": "Team ist an, «Anna Keller» ist Mitglied.",
          "when": "Ich schalte oben den Schalter aus.",
          "then": "Der Tab zeigt die Startseite. Auf dem Board ist der Mitglieder-Filter weg. Schalte ich wieder ein, ist «Anna Keller» noch da.",
          "tests": [
            "src/SettingsFeatures.test.tsx › AC3.2 switches the team off in its tab, shows the start page and keeps the members"
          ],
          "target": ".feature-tab"
        },
        {
          "id": "AC3.3",
          "title": "Releases-Tab",
          "link": "#/settings/releases",
          "given": "Releases ist an. Ich bin im Tab «Releases».",
          "when": "Ich schalte oben den Schalter aus.",
          "then": "Der Tab zeigt die Startseite. Die Seite «Releases» ist aus der Hauptnavigation verschwunden.",
          "tests": [
            "src/SettingsFeatures.test.tsx › AC3.3 switches releases off in their tab and hides the page Releases"
          ],
          "target": ".feature-tab"
        }
      ]
    },
    {
      "id": "AC4",
      "story": "S1",
      "title": "Startseite bei ausgeschalteter Funktion",
      "cases": [
        {
          "id": "AC4.1",
          "title": "Startseite bei ausgeschalteter Funktion",
          "link": "#/settings/team",
          "given": "Team ist aus.",
          "when": "Ich öffne den Tab «Team».",
          "then": "Ich sehe die Beschreibung, den Hinweis «Mitglieder und Zuweisungen bleiben erhalten» und den Knopf «Team einschalten». Es gibt keine Mitgliederliste.",
          "tests": [
            "src/SettingsFeatures.test.tsx › AC4.1 shows a start page while the feature is off",
            "e2e/settingsFeatures.spec.ts › AC4.1 the start page of the team tab"
          ],
          "target": ".feature-tab__start"
        },
        {
          "id": "AC4.2",
          "title": "Knopf schaltet ein",
          "link": "#/settings/team",
          "given": "Team ist aus, Tab «Team» offen.",
          "when": "Ich klicke «Team einschalten».",
          "then": "Team ist an und die Mitglieder sind sichtbar.",
          "tests": [
            "src/SettingsFeatures.test.tsx › AC4.2 switches the feature on with the button of the start page"
          ],
          "target": ".feature-tab__start"
        }
      ]
    },
    {
      "id": "AC5",
      "story": "S1",
      "title": "Links führen zum Tab der Funktion",
      "cases": [
        {
          "id": "AC5.1",
          "title": "Link von der Story Map",
          "link": "#/map",
          "given": "Releases ist aus. Ich bin auf der Story Map und sehe den Hinweis, dass Release-Zeilen nicht verfügbar sind.",
          "when": "Ich klicke den Link im Hinweis.",
          "then": "Der Tab «Releases» ist offen, mit «Releases einschalten».",
          "tests": [
            "src/SettingsFeatures.test.tsx › AC5.1 leads from the story map to the tab \"Releases\""
          ]
        },
        {
          "id": "AC5.2",
          "title": "Link in der Hilfe",
          "link": "#/board",
          "given": "Team ist aus. Ich öffne in der Hilfe das Thema zum Zuweisen von Stories.",
          "when": "Ich klicke den Link zum Einschalten.",
          "then": "Der Tab «Team» ist offen, mit «Team einschalten».",
          "tests": [
            "src/SettingsFeatures.test.tsx › AC5.2 leads from the help to the tab of the feature"
          ]
        }
      ]
    },
    {
      "id": "AC6",
      "story": "S1",
      "title": "Nichts geht verloren",
      "cases": [
        {
          "id": "AC6.1",
          "title": "Zeilen der Story Map bleiben",
          "link": "#/settings/map",
          "given": "Releases ist an.",
          "when": "Ich öffne den Tab «Story Map».",
          "then": "Die Wahl «Sprints oder Releases» ist dort wie bisher.",
          "tests": [
            "src/SettingsFeatures.test.tsx › AC6.1 keeps the rows of the story map in the tab \"Story map\""
          ],
          "target": ".choices"
        },
        {
          "id": "AC6.2",
          "title": "Ausgeschaltet bleibt versteckt",
          "link": "#/board",
          "given": "Team ist aus.",
          "when": "Ich schaue Board und Story-Dialog an.",
          "then": "Kein Feld «Zugewiesen an», keine Initialen, kein Filter.",
          "tests": [
            "src/SettingsFeatures.test.tsx › AC6.2 hides a switched-off team on the board and in the story dialog"
          ]
        }
      ]
    },
    {
      "id": "AC7",
      "story": "S1",
      "title": "Sprachen, Tastatur, Hilfe",
      "cases": [
        {
          "id": "AC7.1",
          "title": "Sprachen",
          "link": "#/settings/team",
          "given": "Einstellungen offen.",
          "when": "Ich wechsle nacheinander auf Englisch, Französisch und Italienisch.",
          "then": "Gruppen, Tabs, Schalter, Startseite und Knopf sind jeweils in der Sprache; kein deutscher Rest.",
          "tests": [
            "src/SettingsFeatures.test.tsx › AC7.1 shows the groups, the start page and the button in %s"
          ],
          "target": ".settings"
        },
        {
          "id": "AC7.2",
          "title": "Nur Tastatur",
          "link": "#/settings/team",
          "given": "Team ist aus, ich bin im Tab «Team».",
          "when": "Ich erreiche mit Tab den Schalter und schalte mit der Leertaste ein.",
          "then": "Team ist an. Der Schalter hat einen Namen, den ein Screenreader vorliest («Team, Schalter, an»).",
          "tests": [
            "src/SettingsFeatures.test.tsx › AC7.2 operates the switch with the keyboard and names it"
          ],
          "target": ".feature-tab"
        },
        {
          "id": "AC7.3",
          "title": "Hilfe",
          "link": "#/settings/fields",
          "given": "Hilfe offen, Thema «Einstellungen».",
          "when": "Ich lese das Thema und klicke seine Links.",
          "then": "Der Text nennt keinen Tab «Funktionen» mehr, und alle Links führen zu einem vorhandenen Tab.",
          "tests": [
            "src/SettingsFeatures.test.tsx › AC7.3 no help text names the tab \"Features\" any more, and every link leads to a tab"
          ],
          "manual": "Inhalt der Texte",
          "poCheck": "Bitte die Hilfetexte zu Einstellungen, Releases und Team lesen: Stimmen die Wege?"
        }
      ]
    }
  ]
};
