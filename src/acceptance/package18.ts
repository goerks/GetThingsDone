import type { Criterion } from './types';

/**
 * Team members and assignment of stories (#18): the acceptance criteria and their test cases for the product owner, in German.
 * One source for the issue comment, the acceptance panel of the preview and the names of the automated tests
 * (`src/domain/members.test.ts`, `src/Team.test.tsx`, `src/data/sqliteRepository.test.ts`). The demo data hold the team
 * Marco Brunner (MB), Anna Keller (AK) and Luca Rossi (LR). The design is variant 1.A of `docs/design/team-design-variants.html`.
 */
export const PACKAGE_18: { issue: number; pullRequest: number; title: string; criteria: Criterion[] } = {
  issue: 18,
  pullRequest: 59,
  title: 'Team und Zuweisung von Stories',
  criteria: [
    {
      "id": "AC1",
      "story": "S1",
      "title": "Team in den Einstellungen pflegen",
      "cases": [
        {
          "id": "AC1.1",
          "title": "Mitglied hinzufügen",
          "link": "#/settings/team",
          "target": ".team",
          "given": "Einstellungen, Bereich „Team“, drei Mitglieder: Marco Brunner (MB), Anna Keller (AK), Luca Rossi (LR).",
          "when": "Ich klicke „Mitglied hinzufügen“ und gebe den Namen „Sara Meier“ ein.",
          "then": "„Sara Meier“ steht in der Liste, das Kürzel ist „SM“. Nach dem Neuladen ist sie noch da.",
          "tests": [
            "src/Team.test.tsx › AC1.1 adds a member who stays after a reload",
            "src/domain/members.test.ts › AC1.1 adds a member with initials derived from the name",
            "src/domain/members.test.ts › AC1.1 derives initials from one word, from several words and suggests a free pair when they are taken",
            "src/data/sqliteRepository.test.ts › AC1.1 adds, changes and assigns, and the data stay"
          ]
        },
        {
          "id": "AC1.2",
          "title": "Kürzel ändern",
          "link": "#/settings/team",
          "target": ".team",
          "given": "„Luca Rossi (LR)“ steht in der Liste.",
          "when": "Ich ändere das Kürzel auf „LUC“ und bestätige.",
          "then": "Die Liste zeigt „LUC“.",
          "tests": [
            "src/Team.test.tsx › AC1.2 changes the initials of a member",
            "src/domain/members.test.ts › AC1.2 changes the initials of a member"
          ]
        },
        {
          "id": "AC1.3",
          "title": "Mitglied umbenennen, Kürzel folgt dem Namen",
          "link": "#/settings/team",
          "target": ".team",
          "given": "„Anna Keller (AK)“, das Kürzel wurde nie von Hand geändert. Ihr ist „S-3“ zugewiesen.",
          "when": "Ich benenne sie in „Anna Roth“ um.",
          "then": "Die Liste zeigt „Anna Roth (AR)“. „S-3“ ist weiter ihr zugewiesen.",
          "tests": [
            "src/Team.test.tsx › AC1.3 renames a member and the initials follow the name",
            "src/domain/members.test.ts › AC1.3 lets the initials follow the new name while they were never changed by hand"
          ]
        },
        {
          "id": "AC1.3a",
          "title": "Umbenennen, Kürzel von Hand geändert",
          "link": "#/settings/team",
          "target": ".team",
          "given": "Ein Mitglied „Sara Meier“ mit dem von Hand gesetzten Kürzel „SAM“.",
          "when": "Ich benenne sie in „Sara Meier-Frei“ um.",
          "then": "Das Kürzel bleibt „SAM“.",
          "tests": [
            "src/domain/members.test.ts › AC1.3a keeps initials that were set by hand when the member is renamed"
          ]
        },
        {
          "id": "AC1.4",
          "title": "Ungültige Eingaben",
          "link": "#/settings/team",
          "target": ".team",
          "given": "Das Formular für ein neues Mitglied ist offen.",
          "when": "Ich gebe ein: leeren Namen, ein Kürzel mit 4 Zeichen („ANNA“), ein Kürzel, das es schon gibt („AK“), einen Namen, den es schon gibt („Anna Keller“), oder ich breche ab.",
          "then": "Es erscheint der passende Hinweis und nichts wird gespeichert. Beim Abbrechen bleibt die Liste unverändert.",
          "tests": [
            "src/Team.test.tsx › AC1.4 refuses %s",
            "src/Team.test.tsx › AC1.4 leaves the list unchanged when I cancel",
            "src/domain/members.test.ts › AC1.4 refuses empty, too long and taken names and initials"
          ]
        },
        {
          "id": "AC1.5",
          "title": "Nur mit der Tastatur",
          "link": "#/settings/team",
          "target": ".team",
          "given": "Einstellungen, Bereich „Team“.",
          "when": "Ich lege nur mit Tab, Enter und Tippen ein Mitglied an. Die Maus bleibt liegen.",
          "then": "Alles geht ohne Maus. Der Fokus ist immer sichtbar.",
          "tests": [
            "src/Team.test.tsx › AC1.5 adds a member with the keyboard only"
          ]
        },
        {
          "id": "AC1.6",
          "title": "Mitglied ohne Stories entfernen",
          "link": "#/settings/team",
          "target": ".team",
          "given": "„Luca Rossi (LR)“ hat keine Stories.",
          "when": "Ich entferne ihn.",
          "then": "Er ist sofort aus der Liste verschwunden, ohne Rückfrage.",
          "tests": [
            "src/Team.test.tsx › AC1.6 removes a member without stories at once",
            "src/domain/members.test.ts › AC1.6 removes a member without stories"
          ]
        }
      ]
    },
    {
      "id": "AC2",
      "story": "S2",
      "title": "Story zuweisen",
      "cases": [
        {
          "id": "AC2.1",
          "title": "Im Story-Dialog zuweisen",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Ich öffne „S-4“, das Feld „Zugewiesen an“ zeigt „Niemand“.",
          "when": "Ich wähle „Luca Rossi (LR)“.",
          "then": "„S-4“ ist Luca zugewiesen, auch nach dem Neuladen.",
          "tests": [
            "src/Team.test.tsx › AC2.1 assigns a story in the story dialog",
            "e2e/team.spec.ts › AC2.1 a story assigned in its dialog keeps its person after a reload"
          ]
        },
        {
          "id": "AC2.2",
          "title": "Zuweisung aufheben",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "„S-3“ ist Anna zugewiesen.",
          "when": "Ich wähle im Feld „Zugewiesen an“ den Eintrag „Niemand“.",
          "then": "„S-3“ ist niemandem zugewiesen. Die Karte zeigt den gestrichelten Kreis.",
          "tests": [
            "src/Team.test.tsx › AC2.2 removes the assignment with \"Nobody\""
          ]
        },
        {
          "id": "AC2.3",
          "title": "Beim Anlegen einer neuen Story zuweisen",
          "link": "#/board",
          "target": ".page-head__action",
          "given": "Der Dialog „Neue Story“ ist offen, Titel „Profile picture“.",
          "when": "Ich wähle „Marco Brunner (MB)“ und lege die Story an.",
          "then": "Die neue Story erscheint mit „MB“.",
          "tests": [
            "src/Team.test.tsx › AC2.3 assigns a new story when it is created"
          ]
        },
        {
          "id": "AC2.4",
          "title": "Ohne Auswahl bleibt es leer",
          "link": "#/board",
          "target": ".page-head__action",
          "given": "Der Dialog „Neue Story“ ist offen.",
          "when": "Ich lege eine Story an, ohne eine Person zu wählen.",
          "then": "Die Story ist niemandem zugewiesen.",
          "tests": [
            "src/Team.test.tsx › AC2.4 leaves a new story without assignee when I choose nobody"
          ]
        },
        {
          "id": "AC2.5",
          "title": "Nur mit der Tastatur",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Der Story-Dialog ist offen.",
          "when": "Ich wähle mit Tab und den Pfeiltasten eine Person.",
          "then": "Die Zuweisung gilt. Der Screenreader liest „Zugewiesen an“.",
          "tests": [
            "src/Team.test.tsx › AC2.5 reaches the field \"Assigned to\" by name and assigns with the keyboard focus on it",
            "e2e/team.spec.ts › AC2.5 the arrow keys choose a person in the field \"Assigned to\""
          ]
        }
      ]
    },
    {
      "id": "AC3",
      "story": "S3",
      "title": "Kürzel auf Karten und Listen",
      "cases": [
        {
          "id": "AC3.1",
          "title": "Board",
          "link": "#/board",
          "target": ".assignee",
          "given": "Das Board mit „S-3“ in „In Arbeit“.",
          "when": "Ich schaue auf die Karte „S-3“.",
          "then": "Rechts oben steht ein Kreis mit „AK“. Ohne Team gibt es keinen Kreis.",
          "tests": [
            "src/Team.test.tsx › AC3.1 shows the initials on a board card",
            "src/Team.test.tsx › AC3.1 shows no badge while the team is empty"
          ]
        },
        {
          "id": "AC3.2",
          "title": "Backlog",
          "link": "#/backlog",
          "target": ".assignee",
          "given": "„S-3“ steht im Backlog.",
          "when": "Ich schaue auf die Zeile.",
          "then": "Die Zeile zeigt den Kreis mit „AK“.",
          "tests": [
            "src/Team.test.tsx › AC3.2 shows the initials in the backlog"
          ]
        },
        {
          "id": "AC3.3",
          "title": "Story-Map",
          "link": "#/map",
          "target": ".assignee",
          "given": "„S-3“ steht auf der Story-Map.",
          "when": "Ich schaue auf die Karte.",
          "then": "Die Karte zeigt den Kreis mit „AK“.",
          "tests": [
            "src/Team.test.tsx › AC3.3 shows the initials on the story map"
          ]
        },
        {
          "id": "AC3.4",
          "title": "Nicht zugewiesen",
          "link": "#/board",
          "target": ".assignee--none",
          "given": "„S-4“ hat keine Person.",
          "when": "Ich schaue auf die Karte.",
          "then": "Statt des Kreises mit Kürzel steht ein gestrichelter, leerer Kreis. Er ist auch im dunklen Modus gut zu sehen.",
          "tests": [
            "src/Team.test.tsx › AC3.4 shows an empty badge for a story without assignee"
          ],
          "manual": "Das Aussehen (gestrichelt, Kontrast im dunklen Modus) sieht nur das Auge.",
          "poCheck": "Bitte „S-4“ im hellen und im dunklen Modus ansehen: Ist der gestrichelte Kreis gut zu erkennen?"
        },
        {
          "id": "AC3.5",
          "title": "Voller Name",
          "link": "#/board",
          "target": ".assignee",
          "given": "Das Board mit „S-3“.",
          "when": "Ich fahre mit der Maus über das Kürzel „AK“.",
          "then": "Ein Hinweis zeigt „Anna Keller“. Für den Screenreader steht an der Karte „Zugewiesen an Anna Keller“, bei „S-4“ „Nicht zugewiesen“.",
          "tests": [
            "src/Team.test.tsx › AC3.5 gives the full name as tooltip and for the screen reader"
          ]
        }
      ]
    },
    {
      "id": "AC4",
      "story": "S4",
      "title": "Filter auf dem Board",
      "cases": [
        {
          "id": "AC4.1",
          "title": "Nach einer Person filtern",
          "link": "#/board",
          "target": ".member-filter",
          "given": "Das Board mit Stories verschiedener Personen.",
          "when": "Ich klicke in der Filterleiste auf „AK“.",
          "then": "Nur Annas Stories sind zu sehen. Der Filter „AK“ ist als aktiv erkennbar.",
          "tests": [
            "src/Team.test.tsx › AC4.1 shows only the stories of one person",
            "e2e/team.spec.ts › AC4.1 the filter bar shows only the stories of one person on the board",
            "src/domain/members.test.ts › AC4.1 filters to the stories of one person"
          ]
        },
        {
          "id": "AC4.2",
          "title": "Nicht zugewiesene Stories",
          "link": "#/board",
          "target": ".member-filter",
          "given": "Das Board.",
          "when": "Ich klicke auf „Nicht zugewiesen“.",
          "then": "Nur Stories ohne Person sind zu sehen, zum Beispiel „S-4“.",
          "tests": [
            "src/Team.test.tsx › AC4.2 shows only the stories nobody works on",
            "src/domain/members.test.ts › AC4.2 filters to the stories nobody works on"
          ]
        },
        {
          "id": "AC4.3",
          "title": "Filter zurücksetzen",
          "link": "#/board",
          "target": ".member-filter",
          "given": "Filter „AK“ ist aktiv.",
          "when": "Ich klicke auf „Alle“.",
          "then": "Alle Stories sind wieder zu sehen.",
          "tests": [
            "src/Team.test.tsx › AC4.3 shows all stories again with \"All\"",
            "src/domain/members.test.ts › AC4.3 shows all stories again with \"All\""
          ]
        },
        {
          "id": "AC4.4",
          "title": "Person ohne Stories",
          "link": "#/board",
          "target": ".member-filter",
          "given": "„Luca Rossi“ hat keine Stories.",
          "when": "Ich klicke auf „LR“.",
          "then": "Das Board ist leer, mit dem Hinweis „Keine Stories für diese Person.“. „Alle“ bringt alles zurück.",
          "tests": [
            "src/Team.test.tsx › AC4.4 says so when a person has no stories",
            "src/domain/members.test.ts › AC4.4 gives no stories for a person without stories"
          ]
        },
        {
          "id": "AC4.5",
          "title": "Nur mit der Tastatur",
          "link": "#/board",
          "target": ".member-filter",
          "given": "Das Board.",
          "when": "Ich erreiche die Filterleiste mit Tab und wähle „AK“ mit Enter.",
          "then": "Der Filter wirkt. Der Screenreader liest „ausgewählt“.",
          "tests": [
            "src/Team.test.tsx › AC4.5 operates the filter with the keyboard"
          ]
        }
      ]
    },
    {
      "id": "AC5",
      "story": "S5",
      "title": "Mitglied mit Stories entfernen",
      "cases": [
        {
          "id": "AC5.1",
          "title": "Mit Rückfrage entfernen",
          "link": "#/settings/team",
          "target": ".team",
          "given": "Anna hat zwei Stories, darunter „S-3“.",
          "when": "Ich entferne „Anna Keller“ und bestätige die Rückfrage.",
          "then": "Anna ist aus der Liste weg. Ihre Stories sind niemandem zugewiesen und noch vorhanden.",
          "tests": [
            "src/Team.test.tsx › AC5.1 asks before it removes a member with stories and leaves the stories without assignee",
            "src/domain/members.test.ts › AC5.1 removes a member with stories and leaves the stories without assignee",
            "src/data/sqliteRepository.test.ts › AC5.1 leaves the stories without assignee when a member is deleted"
          ]
        },
        {
          "id": "AC5.2",
          "title": "Abbrechen",
          "link": "#/settings/team",
          "target": ".team",
          "given": "Die Rückfrage zum Entfernen von Anna ist offen.",
          "when": "Ich klicke auf „Abbrechen“.",
          "then": "Anna und ihre Zuweisungen bleiben. Der Fokus steht auf „Abbrechen“.",
          "tests": [
            "src/Team.test.tsx › AC5.2 keeps the member when I cancel the question, with the focus on \"Cancel\""
          ]
        },
        {
          "id": "AC5.3",
          "title": "Aktiver Filter auf entfernter Person",
          "link": "#/board",
          "target": ".member-filter",
          "given": "Das Board ist auf „AK“ gefiltert und Anna wird entfernt.",
          "when": "Ich schaue danach aufs Board.",
          "then": "Es gilt wieder „Alle“, ohne Fehler.",
          "tests": [
            "src/domain/members.test.ts › AC5.3 shows everything again when the filter is on a member who was removed"
          ]
        }
      ]
    },
    {
      "id": "AC6",
      "story": "S6",
      "title": "Suche, Demodaten, Sprachen",
      "cases": [
        {
          "id": "AC6.1",
          "title": "Suche nach Person",
          "link": "#/board",
          "given": "Das Board, Suche mit Strg+F.",
          "when": "Ich gebe „Anna“ ein, danach „AK“. Ich probiere auch den Filter „Zugewiesen“.",
          "then": "„S-3“ und „S-1“ sind Treffer. Der Filter findet die Stories einer Person oder die ohne Person.",
          "tests": [
            "src/domain/members.test.ts › AC6.1 finds the stories of a person by name and by initials",
            "src/domain/members.test.ts › AC6.1 filters the search by assignee and by \"not assigned\""
          ]
        },
        {
          "id": "AC6.2",
          "title": "Demodaten",
          "link": "#/board",
          "given": "Die Web-Vorschau ist frisch geladen.",
          "when": "Ich schaue auf Board und Einstellungen › Team.",
          "then": "Das Team hat drei Mitglieder, einige Stories sind zugewiesen, andere nicht.",
          "tests": [
            "src/domain/members.test.ts › AC6.2 holds a team with assigned and unassigned stories in the demo data"
          ]
        },
        {
          "id": "AC6.3",
          "title": "Sprachen",
          "link": "#/settings/team",
          "given": "Die App ist auf Deutsch, Englisch, Französisch oder Italienisch.",
          "when": "Ich wechsle die Sprache.",
          "then": "„Team“, „Zugewiesen an“ und „Nicht zugewiesen“ stehen in der gewählten Sprache.",
          "tests": [
            "src/domain/members.test.ts › AC6.3 has the texts in German, English, French and Italian"
          ]
        }
      ]
    },
    {
      "id": "AC7",
      "story": "S7",
      "title": "Export, Import und Verlauf",
      "cases": [
        {
          "id": "AC7.1",
          "title": "Export und Import",
          "link": "#/settings/data",
          "given": "Team mit drei Mitgliedern, „S-3“ ist Anna zugewiesen. Ich exportiere alle Daten.",
          "when": "Ich entferne Anna, importiere die Datei und bestätige das Ersetzen.",
          "then": "Anna ist wieder in der Liste, „S-3“ zeigt wieder „AK“.",
          "tests": [
            "src/domain/members.test.ts › AC7.1 brings team members and assignments back through an export and an import",
            "src/data/sqliteRepository.test.ts › AC7.1 stores the team and the assignments with the data and gives them back"
          ]
        },
        {
          "id": "AC7.2",
          "title": "Verlauf",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "„S-4“ ist niemandem zugewiesen.",
          "when": "Ich weise „S-4“ Luca zu und öffne den Verlauf von „S-4“.",
          "then": "Der Verlauf zeigt „Zugewiesen an: Niemand → Luca Rossi“ mit Zeitpunkt.",
          "tests": [
            "src/Team.test.tsx › AC7.2 shows the assignment in the history of the story",
            "src/domain/members.test.ts › AC7.2 records an assignment as a change of the story in the history"
          ]
        },
        {
          "id": "AC7.3",
          "title": "Alte Sicherung ohne Team",
          "link": "#/settings/data",
          "given": "Eine Export-Datei aus der Zeit vor dem Team.",
          "when": "Ich importiere sie.",
          "then": "Der Import klappt ohne Fehler. Das Team ist leer, alle Stories sind nicht zugewiesen.",
          "tests": [
            "src/domain/members.test.ts › AC7.3 imports a backup from before the team without error and leaves every story unassigned",
            "src/domain/members.test.ts › AC7.3 drops an assignment to a member who is not in the file",
            "src/data/sqliteRepository.test.ts › AC7.3 opens a database from before the team without a member and without assignment"
          ]
        }
      ]
    },
    {
      "id": "AC8",
      "story": "S8",
      "title": "Team als Funktion ein- und ausschalten",
      "cases": [
        {
          "id": "AC8.1",
          "title": "Team einschalten",
          "link": "#/settings/features",
          "target": ".feature",
          "given": "Ein neues Projekt ohne Demodaten. „Team“ steht auf „Aus“.",
          "when": "Ich schalte „Team“ ein.",
          "then": "Der Schalter steht auf „An“. In den Einstellungen erscheint der Bereich „Team“, im Story-Dialog das Feld „Zugewiesen an“. Nach dem Neuladen ist es noch an.",
          "tests": [
            "src/Team.test.tsx › AC8.1 switches the team on in Settings › Features and keeps the choice"
          ]
        },
        {
          "id": "AC8.2",
          "title": "Ausgeschaltet ist nichts vom Team zu sehen",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Demodaten mit Team. Ich schalte „Team“ aus.",
          "when": "Ich schaue Board, Dialoge, Einstellungen und Suche an.",
          "then": "Keine Kreise, keine Filterleiste, kein Feld „Zugewiesen an“, kein Bereich „Team“. Die Suche findet „S-3“ nicht über „Anna“. Die Adresse der Team-Einstellungen führt zu den Funktionen.",
          "tests": [
            "src/Team.test.tsx › AC8.2 shows nothing of the team on the board and in the dialogs while it is off",
            "src/Team.test.tsx › AC8.2 leaves out the field \"Assigned to\" in \"New story\" while the team is off",
            "src/Team.test.tsx › AC8.2 leads the address of the team settings back to the features while the team is off",
            "src/domain/members.test.ts › AC8.2 finds nobody by name while the team is off, because the search has no member list"
          ]
        },
        {
          "id": "AC8.3",
          "title": "Daten bleiben erhalten",
          "link": "#/settings/features",
          "target": ".feature",
          "given": "„S-3“ ist Anna zugewiesen. „Team“ ist ausgeschaltet.",
          "when": "Ich schalte „Team“ wieder ein.",
          "then": "Anna ist in der Liste, „S-3“ zeigt wieder „AK“. Ein Export im ausgeschalteten Zustand enthält das Team trotzdem.",
          "tests": [
            "src/Team.test.tsx › AC8.3 brings the members and assignments back when the team is switched on again",
            "src/domain/members.test.ts › AC8.3 exports the team even while it is switched off"
          ]
        },
        {
          "id": "AC8.4",
          "title": "Standard",
          "link": "#/settings/features",
          "target": ".feature",
          "given": "Web-Vorschau frisch geladen, ein neues Projekt, eine Datei von vor dem Team.",
          "when": "Ich schaue auf den Schalter „Team“.",
          "then": "In der Web-Vorschau mit Demodaten ist „Team“ an. Bei einem neuen Projekt, älteren Daten und einem Import einer alten Datei ist es aus.",
          "tests": [
            "src/domain/members.test.ts › AC8.4 has the team off by default and on in the demo data",
            "src/domain/members.test.ts › AC8.4 imports a file from before the team with the team switched off"
          ]
        },
        {
          "id": "AC8.5",
          "title": "Verlauf bei ausgeschaltetem Team",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "„S-4“ wurde Luca zugewiesen, danach ist „Team“ aus.",
          "when": "Ich öffne den Verlauf von „S-4“.",
          "then": "Der Verlauf zeigt weiter „Zugewiesen an: Niemand → Luca Rossi“.",
          "tests": [
            "src/Team.test.tsx › AC8.5 keeps showing an assignment in the history while the team is off"
          ]
        },
        {
          "id": "AC8.6",
          "title": "Schalter, Tastatur, Sprachen",
          "link": "#/settings/features",
          "target": ".feature",
          "given": "Einstellungen › Funktionen.",
          "when": "Ich erreiche „Team“ mit Tab und schalte mit der Leertaste. Dann wechsle ich die Sprache.",
          "then": "Der Schalter wird mit Name und Zustand vorgelesen. Name und Beschreibung stehen in DE, EN, FR und IT. Ist er aus, erklärt ein Hinweis, dass Mitglieder und Zuweisungen erhalten bleiben.",
          "tests": [
            "src/Team.test.tsx › AC8.6 operates the switch with the space key and names it with its state",
            "src/domain/members.test.ts › AC8.6 describes the switch in German, English, French and Italian"
          ]
        },
        {
          "id": "AC8.7",
          "title": "Hilfe",
          "link": "#/board",
          "given": "Die Hilfe ist offen, Thema „Team und Zuweisung“.",
          "when": "Ich lese den Text und schaue auf die Links.",
          "then": "Der Text beginnt mit dem Hinweis, „Team“ zuerst unter Einstellungen › Funktionen einzuschalten. Der Link „Einstellungen › Team“ ist gesperrt, solange die Funktion aus ist.",
          "tests": [
            "src/Team.test.tsx › AC8.7 starts with the switch and locks the link to the settings while the team is off"
          ]
        }
      ]
    }
  ]
};
