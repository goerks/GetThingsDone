import type { Criterion } from './types';

/**
 * Backup, export and import of all data (#16): the acceptance criteria and their test cases for the product owner, in German.
 * One source for the issue comment, the acceptance panel of the preview and the names of the automated tests.
 * The place is the section "Daten" in the settings (PO decision, variant A of `docs/design/backup.md`).
 */
export const PACKAGE_16: { issue: number; pullRequest: number; title: string; criteria: Criterion[] } = {
  issue: 16,
  pullRequest: 47,
  title: 'Daten exportieren und importieren',
  criteria: [
  {
    "id": "AC1",
    "story": "S1",
    "title": "Export",
    "cases": [
      {
        "id": "AC1.1",
        "title": "Bereich «Daten» finden",
        "link": "#/board",
        "given": "Die App ist offen, ich bin auf dem Board.",
        "when": "Ich klicke auf das Zahnrad und dann links auf «Daten».",
        "then": "Ich sehe zwei Karten: «Daten exportieren» und «Daten importieren».",
        "tests": [
          "src/DataSettings.test.tsx › AC1.1 finds the section \"Data\" in the settings with the two cards",
          "e2e/backup.spec.ts › AC1.1 finds the section Data from the gear"
        ],
        "poCheck": "Bitte einmal ansehen: Passen Platz und Aussehen der beiden Karten (Variante A des Entwurfs)?"
      },
      {
        "id": "AC1.2",
        "title": "Alle Daten mit einem Klick exportieren",
        "link": "#/settings/data",
        "given": "Demo-Daten sind geladen. Heute ist der 15.10.2026.",
        "when": "Ich klicke auf «Alle Daten exportieren».",
        "then": "Eine Datei «getitdone-2026-10-15.json» wird gespeichert. In der Karte steht «Exportiert: getitdone-2026-10-15.json (… Stories, … Epics, …)».",
        "tests": [
          "src/DataSettings.test.tsx › AC1.2 exports all data with one click and says what was saved",
          "src/domain/backup.test.ts › AC1.2 names the file after the day",
          "e2e/backup.spec.ts › AC1.2 exports all data with one click"
        ],
        "target": ".data-settings"
      },
      {
        "id": "AC1.3",
        "title": "Exportdatei ist lesbar und vollständig",
        "link": "#/settings/data",
        "given": "Ich habe exportiert.",
        "when": "Ich öffne die Datei in einem Texteditor.",
        "then": "Ich sehe lesbaren Text mit einer Formatnummer sowie Stories, Epics, Kriterien, Sprints, Releases, Felder und Einstellungen.",
        "tests": [
          "src/domain/backup.test.ts › AC1.3 writes readable text with a format and a version"
        ],
        "target": ".data-settings",
        "manual": "Der Blick in die Datei im Texteditor.",
        "poCheck": "Bitte die exportierte Datei einmal im Texteditor öffnen: Ist sie lesbar und steht alles drin?"
      },
      {
        "id": "AC1.4",
        "title": "Leeres Projekt exportieren",
        "link": "#/settings/data",
        "given": "Es gibt keine Stories und keine Epics.",
        "when": "Ich klicke auf «Alle Daten exportieren».",
        "then": "Die Datei wird gespeichert, die Meldung sagt «0 Stories, 0 Epics».",
        "tests": [
          "src/domain/backup.test.ts › AC1.4 exports an empty project"
        ],
        "target": ".data-settings"
      }
    ]
  },
  {
    "id": "AC2",
    "story": "S2",
    "title": "Import mit Bestätigung",
    "cases": [
      {
        "id": "AC2.1",
        "title": "Import fragt nach",
        "link": "#/settings/data",
        "given": "Ich habe eine Exportdatei mit 42 Stories, die App hat heute 37.",
        "when": "Ich klicke auf «Datei wählen …» und wähle die Datei.",
        "then": "Ein Fenster «Daten importieren?» zeigt die Datei und eine Tabelle «In der Datei» (42 Stories) und «Heute in der App» (37 Stories). Eine Warnung sagt, dass alles ersetzt wird. Es hat noch nichts geändert.",
        "tests": [
          "src/DataSettings.test.tsx › AC2.1 asks before replacing: shows the file next to the current data and warns",
          "e2e/backup.spec.ts › AC2.1 asks before replacing"
        ],
        "target": ".data-settings"
      },
      {
        "id": "AC2.2",
        "title": "Abbrechen ändert nichts",
        "link": "#/settings/data",
        "given": "Das Fenster «Daten importieren?» ist offen.",
        "when": "Ich klicke auf «Abbrechen» (oder drücke Esc).",
        "then": "Das Fenster schliesst, die App hat weiter 37 Stories.",
        "tests": [
          "src/DataSettings.test.tsx › AC2.2 changes nothing on Cancel and on Escape"
        ],
        "target": ".data-settings"
      },
      {
        "id": "AC2.3",
        "title": "Ersetzen",
        "link": "#/settings/data",
        "given": "Das Fenster «Daten importieren?» ist offen.",
        "when": "Ich klicke auf «Daten ersetzen».",
        "then": "Die App hat jetzt 42 Stories. Die Karte meldet «Importiert: 42 Stories, …». Das Board zeigt die neuen Daten, auch nach dem Neuladen.",
        "tests": [
          "src/DataSettings.test.tsx › AC2.3 replaces the data after the confirmation and says what was imported",
          "e2e/backup.spec.ts › AC2.3 replaces the data and keeps it after a reload"
        ],
        "target": ".data-settings"
      },
      {
        "id": "AC2.4",
        "title": "Heutige Daten zuerst exportieren",
        "link": "#/settings/data",
        "given": "Das Fenster «Daten importieren?» ist offen.",
        "when": "Ich klicke auf «Heutige Daten zuerst exportieren».",
        "then": "Meine heutigen Daten werden als Datei gespeichert, das Fenster bleibt offen und ich kann danach noch ersetzen oder abbrechen.",
        "tests": [
          "src/DataSettings.test.tsx › AC2.4 exports the current data first and keeps the dialog open"
        ],
        "target": ".data-settings"
      },
      {
        "id": "AC2.5",
        "title": "Nur mit der Tastatur",
        "link": "#/settings/data",
        "given": "Das Fenster «Daten importieren?» ist offen.",
        "when": "Ich bediene es nur mit Tab, Enter und Esc.",
        "then": "Der Fokus startet auf «Abbrechen». Ich erreiche mit Tab alle drei Knöpfe, Enter löst den Knopf mit Fokus aus, Esc schliesst.",
        "tests": [
          "src/DataSettings.test.tsx › AC2.5 works with the keyboard only: focus starts on Cancel, Tab reaches all three buttons, Escape closes"
        ],
        "target": ".data-settings"
      }
    ]
  },
  {
    "id": "AC3",
    "story": "S3",
    "title": "Dieselben Daten nach Export und Import",
    "cases": [
      {
        "id": "AC3.1",
        "title": "Export und Import ergeben dieselben Daten",
        "link": "#/settings/data",
        "given": "Ich habe exportiert. Danach ändere ich den Titel von «S-3», lösche einen Epic und verschiebe «S-5» nach «Erledigt».",
        "when": "Ich importiere die Exportdatei und bestätige.",
        "then": "«S-3» heisst wieder wie vorher, der Epic ist zurück, «S-5» steht wieder in der alten Spalte.",
        "tests": [
          "src/DataSettings.test.tsx › AC3.1 gives back the same data after export and import",
          "e2e/backup.spec.ts › AC3.1 gives back the data of the export after changes"
        ],
        "target": ".data-settings"
      },
      {
        "id": "AC3.2",
        "title": "Alles ist dabei",
        "link": "#/settings/data",
        "given": "Demo-Daten mit Kriterien (teils abgehakt), Sprints, Releases mit Verlauf, eigenen Feldern mit Werten, eigenen Status-Werten und geänderten Einstellungen.",
        "when": "Ich exportiere, wechsle auf frische Demo-Daten und importiere die Datei.",
        "then": "Kriterien, Sprints, Releases samt Verlauf, Felder samt Werten, Status-Werte und Einstellungen sind wie vor dem Export.",
        "tests": [
          "src/domain/backup.test.ts › AC3.2 gives back the same data after a round trip",
          "e2e/backup.spec.ts › AC3.2 gives back every part of the data after fresh demo data"
        ],
        "target": ".data-settings"
      }
    ]
  },
  {
    "id": "AC4",
    "story": "S4",
    "title": "Ungültige Dateien abweisen",
    "cases": [
      {
        "id": "AC4.1",
        "title": "Keine Exportdatei: Textdatei",
        "link": "#/settings/data",
        "given": "Ich habe eine Datei «notizen.txt» mit dem Text «Hallo».",
        "when": "Ich wähle diese Datei beim Import.",
        "then": "Meldung «Diese Datei kann nicht importiert werden: Sie ist keine Get-It-Done-Exportdatei. Deine Daten sind unverändert.» Es erscheint kein Bestätigungsfenster, die Daten bleiben gleich.",
        "tests": [
          "src/DataSettings.test.tsx › AC4.1 refuses a plain text file and leaves the data unchanged",
          "src/domain/backup.test.ts › AC4.1 refuses a plain text file",
          "e2e/backup.spec.ts › AC4.1 refuses a text file and leaves the data unchanged"
        ],
        "target": ".data-settings"
      },
      {
        "id": "AC4.2",
        "title": "Keine Exportdatei: fremdes JSON",
        "link": "#/settings/data",
        "given": "Eine Datei mit dem Inhalt {\"a\": 1}.",
        "when": "Ich wähle sie beim Import.",
        "then": "Dieselbe Meldung wie bei AC4.1, die Daten bleiben gleich.",
        "tests": [
          "src/DataSettings.test.tsx › AC4.2 refuses JSON of another program and leaves the data unchanged",
          "src/domain/backup.test.ts › AC4.2 refuses JSON of another program"
        ],
        "target": ".data-settings"
      },
      {
        "id": "AC4.3",
        "title": "Datei aus einer neueren Version",
        "link": "#/settings/data",
        "given": "Eine Exportdatei mit Formatnummer 99.",
        "when": "Ich wähle sie beim Import.",
        "then": "Meldung, dass die Datei aus einer neueren Version stammt und welche Formate diese App kennt. Die Daten bleiben gleich.",
        "tests": [
          "src/DataSettings.test.tsx › AC4.3 refuses a file of a newer format and leaves the data unchanged",
          "src/domain/backup.test.ts › AC4.3 refuses a file of a newer format and names its version"
        ],
        "target": ".data-settings"
      },
      {
        "id": "AC4.4",
        "title": "Beschädigte oder leere Datei",
        "link": "#/settings/data",
        "given": "Eine Exportdatei, bei der die zweite Hälfte fehlt, und eine leere Datei.",
        "when": "Ich wähle jede Datei beim Import.",
        "then": "Jedes Mal eine klare Meldung («… beschädigt …» beziehungsweise «… ist leer …»), die Daten bleiben gleich.",
        "tests": [
          "src/DataSettings.test.tsx › AC4.4 refuses an empty file and leaves the data unchanged",
          "src/DataSettings.test.tsx › AC4.4 refuses a file that is cut off and leaves the data unchanged",
          "src/domain/backup.test.ts › AC4.4 refuses an export that is cut off, and an empty file"
        ],
        "target": ".data-settings"
      }
    ]
  },
  {
    "id": "AC5",
    "story": "S5",
    "title": "Windows-App und Browser",
    "cases": [
      {
        "id": "AC5.1",
        "title": "Von der Web-Vorschau in die Windows-App",
        "link": "#/settings/data",
        "given": "In der Vorschau habe ich ein paar Stories geändert und exportiert.",
        "when": "Ich importiere diese Datei in der Windows-App.",
        "then": "Die Windows-App zeigt dieselben Daten.",
        "tests": [],
        "manual": "Braucht die Windows-App auf einem Windows-Rechner.",
        "poCheck": "Bitte in der Windows-App prüfen: Export (wo landet die Datei?) und Import einer Datei aus der Vorschau."
      },
      {
        "id": "AC5.2",
        "title": "Von der Windows-App in die Web-Vorschau",
        "link": "#/settings/data",
        "given": "Export aus der Windows-App.",
        "when": "Ich importiere die Datei in der Vorschau.",
        "then": "Die Vorschau zeigt dieselben Daten, auch nach dem Neuladen.",
        "tests": [],
        "manual": "Braucht die Windows-App auf einem Windows-Rechner.",
        "poCheck": "Bitte einen Export aus der Windows-App in der Vorschau importieren."
      },
      {
        "id": "AC5.3",
        "title": "Import in der Web-Vorschau ist eine Demo",
        "link": "#/settings/data",
        "given": "Ich bin in der Web-Vorschau auf «Daten».",
        "when": "Ich schaue die Karte «Daten importieren» an.",
        "then": "Ein Hinweis sagt: «Dies ist eine Demo. Der Import ersetzt die Demo-Daten nur in diesem Browser.»",
        "tests": [
          "src/DataSettings.test.tsx › AC5.3 says in the browser build that the import only replaces the demo data of this browser",
          "e2e/backup.spec.ts › AC5.3 shows the demo hint in the preview"
        ],
        "target": ".data-settings"
      }
    ]
  },
  {
    "id": "AC6",
    "story": "S6",
    "title": "Sprachen, Tastatur, Hilfe",
    "cases": [
      {
        "id": "AC6.1",
        "title": "Vier Sprachen",
        "link": "#/settings/data",
        "given": "Ich bin auf «Daten».",
        "when": "Ich stelle die Sprache nacheinander auf Deutsch, English, Français und Italiano und öffne auch das Import-Fenster und eine Fehlermeldung.",
        "then": "Alle Texte sind in der gewählten Sprache, nichts bleibt deutsch.",
        "tests": [
          "src/DataSettings.test.tsx › AC6.1 has all texts in de",
          "src/DataSettings.test.tsx › AC6.1 has all texts in en",
          "src/DataSettings.test.tsx › AC6.1 has all texts in fr",
          "src/DataSettings.test.tsx › AC6.1 has all texts in it"
        ],
        "target": ".data-settings"
      },
      {
        "id": "AC6.2",
        "title": "Nur mit der Tastatur",
        "link": "#/settings/data",
        "given": "Ich bin auf «Daten».",
        "when": "Ich erreiche mit Tab beide Knöpfe und löse sie mit Enter aus.",
        "then": "Ich kann exportieren und importieren, ohne die Maus zu brauchen. Der Fokus ist immer sichtbar.",
        "tests": [
          "src/DataSettings.test.tsx › AC6.2 exports and opens the file choice with the keyboard only",
          "e2e/backup.spec.ts › AC6.2 exports with the keyboard only"
        ],
        "target": ".data-settings"
      },
      {
        "id": "AC6.3",
        "title": "Hilfe",
        "link": "#/settings/data",
        "given": "Die Hilfe ist offen.",
        "when": "Ich suche «Backup».",
        "then": "Das Thema «Daten sichern und mitnehmen» erscheint und führt mit einem Link zu Einstellungen › Daten.",
        "tests": [
          "src/DataSettings.test.tsx › AC6.3 finds the help topic \"Back up and export data\" by \"backup\" and links to Settings › Data"
        ]
      }
    ]
  }
]
};
