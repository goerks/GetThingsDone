import type { Criterion } from './types';

/**
 * Change history and comparing versions (#23): the acceptance criteria and their test cases for the product owner, in German.
 * One source for the issue comment, the acceptance panel of the preview and the names of the automated tests
 * (`src/domain/changeLog.test.ts`, `src/ChangeHistory.test.tsx`, `e2e/changeHistory.spec.ts`). The story names are those of the
 * demo data; story S-3 has a demo history of six versions. The design is variant E of `docs/design/change-history.md`.
 */
export const PACKAGE_23: { issue: number; pullRequest: number; title: string; criteria: Criterion[] } = {
  issue: 23,
  pullRequest: 56,
  title: 'Änderungsverlauf und Stände vergleichen',
  criteria: [
    {
      "id": "AC1",
      "story": "S1",
      "title": "Verlauf in den Dialogen",
      "cases": [
        {
          "id": "AC1.1",
          "title": "Verlauf einer Story ansehen",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Die Demo-Story „S-3“ („Reorder the backlog by priority“) hat einen Verlauf mit sechs Ständen.",
          "when": "Ich öffne „S-3“ (Doppelklick) und schaue auf das Feld „Verlauf“.",
          "then": "Die drei neuesten Änderungen stehen oben, jede mit Nummer (V6, V5, V4), Datum und Uhrzeit, zum Beispiel „Punkte: 3 → 5“. Neben V6 steht „Aktuell“.",
          "tests": [
            "src/ChangeHistory.test.tsx › AC1.1 shows the newest versions of a story with date and what changed"
          ]
        },
        {
          "id": "AC1.2",
          "title": "Verlauf in allen vier Dialogen",
          "link": "#/epics",
          "given": "Epic, Sprint und Release sind je einmal geändert worden.",
          "when": "Ich öffne nacheinander ein Epic, einen Sprint (Backlog, Sprint bearbeiten) und ein Release.",
          "then": "Im Epic und im Sprint gibt es ein Feld „Verlauf“ unter den anderen Feldern. Im Release gibt es einen Reiter „Verlauf“. Überall steht die Änderung mit Datum und Uhrzeit.",
          "tests": [],
          "manual": "Die vier Dialoge sind von Hand zu prüfen, weil nur das Auge sieht, ob das Feld an der richtigen Stelle sitzt.",
          "poCheck": "Bitte in Epic, Sprint und Release (Reiter) je einmal ansehen: Ist der Verlauf dort, wo man ihn erwartet?"
        },
        {
          "id": "AC1.3",
          "title": "Ein Speichern ist ein Stand",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Ich habe „S-3“ geöffnet; der Verlauf hat 6 Stände.",
          "when": "Ich ändere im Dialog den Status auf „Review“.",
          "then": "Es gibt einen neuen Stand V7 mit der Änderung „Status: … → Review“, V6 ist nicht mehr „Aktuell“. Mehrere Änderungen in einem Speichern wären ein Stand.",
          "tests": [
            "src/ChangeHistory.test.tsx › AC1.3 a save is one version: a change of the status adds V7 on top",
            "src/domain/changeLog.test.ts › AC1.3 records several changes of one save as one version"
          ]
        },
        {
          "id": "AC1.4",
          "title": "Leerer Verlauf",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Eine Story, die es vor dem Verlauf schon gab und die nie geändert wurde.",
          "when": "Ich öffne sie.",
          "then": "Das Feld „Verlauf“ sagt „Noch keine Änderungen.“; „Stände vergleichen“ ist ausgegraut.",
          "tests": [
            "src/ChangeHistory.test.tsx › AC1.4 an item without changes says so"
          ]
        }
      ]
    },
    {
      "id": "AC2",
      "story": "S2",
      "title": "Was aufgezeichnet wird",
      "cases": [
        {
          "id": "AC2.1",
          "title": "Story: alle Felder",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Story „S-3“.",
          "when": "Ich ändere nacheinander Titel, Beschreibung, Status, Punkte, Epic, Sprint, Release und das Feld „Priority“.",
          "then": "Jede Änderung steht im Verlauf mit altem und neuem Wert. Bei der Beschreibung steht nur „Beschreibung geändert“.",
          "tests": [
            "src/domain/changeLog.test.ts › AC2.1 records title, description, status, points, epic, sprint, release and custom fields of a story"
          ]
        },
        {
          "id": "AC2.2",
          "title": "Story: Kriterien",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "„S-3“ hat drei Kriterien.",
          "when": "Ich füge ein Kriterium hinzu, hake eines ab und lösche eines.",
          "then": "Der Verlauf zeigt „Kriterium hinzugefügt“, „Kriterium abgehakt“ und „Kriterium entfernt“, jeweils mit dem Text.",
          "tests": [
            "src/domain/changeLog.test.ts › AC2.2 records criteria that are added, ticked and removed"
          ]
        },
        {
          "id": "AC2.3",
          "title": "Story anlegen",
          "link": "#/board",
          "given": "Es gibt keine Story „S-20“.",
          "when": "Ich lege „Profil“ an.",
          "then": "Der Verlauf der neuen Story beginnt mit „Story erstellt“.",
          "tests": [
            "src/domain/changeLog.test.ts › AC2.3 starts the history of a new story with a created version",
            "src/ChangeHistory.test.tsx › AC2.3 a story created now starts its history with \"Story created\""
          ]
        },
        {
          "id": "AC2.4",
          "title": "Epic",
          "link": "#/epics",
          "given": "Epic „Boards“.",
          "when": "Ich benenne es um und ändere die Farbe.",
          "then": "Der Verlauf nennt die neue Bezeichnung und die Farbänderung.",
          "tests": [
            "src/domain/changeLog.test.ts › AC2.4 records the name and colour of an epic"
          ]
        },
        {
          "id": "AC2.5",
          "title": "Sprint mit Stories",
          "link": "#/backlog",
          "given": "„Sprint 2“ ist geplant, „S-7“ ist nicht darin.",
          "when": "Ich ziehe „S-7“ in „Sprint 2“, ändere das Enddatum, starte den Sprint später und ziehe „S-7“ wieder heraus.",
          "then": "Im Verlauf von „Sprint 2“ stehen „Story hinzugefügt: S-7 (8 Punkte)“, die Änderung des Enddatums und „Story entfernt: S-7“.",
          "tests": [
            "src/domain/changeLog.test.ts › AC2.5 records the stories that join and leave a sprint, and the dates and state of the sprint"
          ]
        },
        {
          "id": "AC2.6",
          "title": "Release",
          "link": "#/releases",
          "given": "Release „Release 1.0 – Public Beta“.",
          "when": "Ich ändere Titel, Beschreibung und Enddatum.",
          "then": "Der Verlauf nennt die drei Änderungen; bei der Beschreibung steht nur „Beschreibung geändert“.",
          "tests": [
            "src/domain/changeLog.test.ts › AC2.6 records title, description and dates of a release"
          ]
        },
        {
          "id": "AC2.7",
          "title": "Beschreibung im Vergleich im Volltext",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Die Beschreibung von „S-3“ wurde geändert (Demo-Verlauf).",
          "when": "Ich vergleiche V1 mit dem aktuellen Stand.",
          "then": "Im Vergleich stehen beide Texte vollständig, die geänderten Wörter sind markiert.",
          "tests": [
          "src/ChangeHistory.test.tsx › AC2.7 shows the description of both versions in full in the comparison"
        ]
        }
      ]
    },
    {
      "id": "AC3",
      "story": "S3",
      "title": "Verschieben und Zusammenfassen",
      "cases": [
        {
          "id": "AC3.1",
          "title": "Verschieben auf dem Board",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "„S-3“ steht in „To do“.",
          "when": "Ich ziehe „S-3“ nach „In progress“.",
          "then": "Der Verlauf von „S-3“ zeigt „Status: To do → In progress“.",
          "tests": [
            "e2e/changeHistory.spec.ts › AC3.1 moving a story on the board is a change of its status in the history",
            "src/domain/changeLog.test.ts › AC3.1 records a move to another status as a status change"
          ]
        },
        {
          "id": "AC3.2",
          "title": "Verschieben im Backlog",
          "link": "#/backlog",
          "given": "„S-7“ steht im Backlog ohne Sprint.",
          "when": "Ich ziehe „S-7“ in „Sprint 2“.",
          "then": "Der Verlauf von „S-7“ zeigt „Sprint: – → Sprint 2“, der von „Sprint 2“ zeigt „Story hinzugefügt: S-7“.",
          "tests": [
            "src/domain/changeLog.test.ts › AC3.2 records a move into a sprint as a change of the sprint of the story and of the sprint"
          ]
        },
        {
          "id": "AC3.3",
          "title": "Nur die Reihenfolge ändern",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "„S-3“ und „S-6“ stehen untereinander in „To do“; der Verlauf von „S-3“ hat 6 Stände.",
          "when": "Ich ziehe „S-6“ über „S-3“.",
          "then": "Der Verlauf von „S-3“ hat weiterhin 6 Stände.",
          "tests": [
            "e2e/changeHistory.spec.ts › AC3.3 changing only the order of two stories adds no version",
            "src/domain/changeLog.test.ts › AC3.3 does not record a pure reordering"
          ]
        },
        {
          "id": "AC3.4",
          "title": "Schnelles Tippen",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Ich bearbeite den Titel von „S-3“ direkt im Dialog.",
          "when": "Ich ändere den Titel und innerhalb einer Minute noch einmal.",
          "then": "Im Verlauf steht eine einzige Änderung vom alten zum endgültigen Titel. Nach über einer Minute wäre es ein neuer Stand.",
          "tests": [
            "src/domain/changeLog.test.ts › AC3.4 merges quick edits of the same field into one version",
            "src/domain/changeLog.test.ts › AC3.4 starts a new version after a minute, or for another field",
            "src/domain/changeLog.test.ts › AC3.4 drops a version when quick edits end where they started"
          ]
        }
      ]
    },
    {
      "id": "AC4",
      "story": "S4",
      "title": "Sprache",
      "cases": [
        {
          "id": "AC4.1",
          "title": "Sprachwechsel",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Die App ist auf Englisch; der Verlauf von „S-3“ enthält „Points: 3 → 5“.",
          "when": "Ich stelle die Sprache auf Deutsch, Französisch und Italienisch um.",
          "then": "Feldnamen, Statusnamen und Ausdrücke erscheinen in der gewählten Sprache; Datum und Uhrzeit folgen dem Format der Sprache. Selbst eingegebene Namen bleiben unverändert.",
          "tests": [
            "e2e/changeHistory.spec.ts › AC4.1 the history follows a language switch",
          ]
        },
        {
          "id": "AC4.2",
          "title": "Eigener Statusname",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Ein eigener Status „Abnahme“ wurde angelegt; „S-3“ wird dorthin verschoben.",
          "when": "Ich wechsle die Sprache.",
          "then": "„Abnahme“ steht überall so, wie ich es eingegeben habe.",
          "tests": [
            "src/ChangeHistory.test.tsx › AC4.2 shows a status name the team entered as it was entered"
          ]
        }
      ]
    },
    {
      "id": "AC5",
      "story": "S5",
      "title": "Speichern und Export",
      "cases": [
        {
          "id": "AC5.1",
          "title": "Nach dem Neuladen",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "„S-3“ hat einen Verlauf mit mehreren Einträgen.",
          "when": "Ich lade die App neu.",
          "then": "Der Verlauf ist unverändert vorhanden.",
          "tests": [
            "e2e/changeHistory.spec.ts › AC5.1 the history is still there after reloading the app",
            "src/data/sqliteRepository.test.ts › AC5.1 stores the versions with the data and gives them back in order",
            "src/data/localStorageRepository.test.ts › AC5.1 keeps the versions after a reload and applies writes"
          ]
        },
        {
          "id": "AC5.2",
          "title": "Export und Import",
          "link": "#/settings/data",
          "target": ".data-settings",
          "given": "Mehrere Elemente mit Verlauf.",
          "when": "Ich exportiere alle Daten und importiere die Datei wieder.",
          "then": "Alle Verläufe sind danach genau so da wie vorher. Eine ältere Exportdatei ohne Verlauf lässt sich weiter importieren.",
          "tests": [
            "src/domain/changeLog.test.ts › AC5.2 keeps the history in an export and import of all data",
            "src/domain/changeLog.test.ts › AC5.2 reads an export from before the history as one without versions"
          ]
        },
        {
          "id": "AC5.3",
          "title": "Gelöschtes Element",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Story mit Verlauf in einem Sprint.",
          "when": "Ich lösche die Story.",
          "then": "Ihr Verlauf ist weg; im Verlauf des Sprints bleibt der Eintrag mit der Nummer der Story lesbar.",
          "tests": [
            "src/domain/changeLog.test.ts › AC5.3 deletes the history of a deleted item and keeps the entry of the sprint"
          ]
        }
      ]
    },
    {
      "id": "AC6",
      "story": "S6",
      "title": "Alle Elementtypen gleich",
      "cases": [
        {
          "id": "AC6.1",
          "title": "Neuer Elementtyp",
          "link": "#/board",
          "given": "Ein erfundener Elementtyp „Initiative“ mit zwei Feldern (nur im automatischen Test).",
          "when": "Ein Feld ändern, speichern, zwei Stände vergleichen.",
          "then": "Verlauf und Vergleich funktionieren wie bei einer Story, ohne eigenen Verlaufs-Code für den Typ.",
          "tests": [
            "src/domain/changeLog.test.ts › AC6.1 records and compares an item type the log knows nothing about"
          ]
        },
        {
          "id": "AC6.2",
          "title": "Eigenes Feld am Sprint",
          "link": "#/backlog",
          "given": "Erst möglich, wenn es eigene Felder am Sprint gibt (#9).",
          "when": "Ich ändere das Sprintziel.",
          "then": "Die Änderung steht im Verlauf des Sprints.",
          "tests": [],
          "manual": "Noch nicht prüfbar: eigene Felder am Sprint gibt es erst mit #9. Die Technik ist über AC6.1 abgedeckt.",
          "poCheck": "Erst mit #9 prüfen."
        }
      ]
    },
    {
      "id": "AC7",
      "story": "S7",
      "title": "Bedienung und Sprachen",
      "cases": [
        {
          "id": "AC7.1",
          "title": "Nur mit Tastatur",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Der Verlauf von „S-3“ ist offen.",
          "when": "Ich bediene Stand wählen, vergleichen, Seiten tauschen und Schließen nur mit Tab, Pfeiltasten, Leertaste, Enter und Esc.",
          "then": "Alles ist erreichbar, der Fokus ist sichtbar, Esc geht eine Ebene zurück.",
          "tests": [
            "e2e/changeHistory.spec.ts › AC7.1 the comparison is operable with the keyboard only"
          ]
        },
        {
          "id": "AC7.2",
          "title": "Screenreader-Texte",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Der Vergleich ist offen.",
          "when": "Ich lasse mir die Zeile „Status“ vorlesen.",
          "then": "Es wird gesagt, was entfernt, hinzugefügt und geändert wurde, nicht nur Farben.",
          "tests": [],
          "manual": "Braucht einen Screenreader, ein Test kann nur die versteckten Wörter prüfen.",
          "poCheck": "Mit Screenreader kurz anhören: Wird „Entfernt“ / „Hinzugefügt“ vorgelesen?"
        },
        {
          "id": "AC7.3",
          "title": "Alle vier Sprachen",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Verlauf und Vergleich sind offen.",
          "when": "Ich schalte durch DE, EN, FR und IT.",
          "then": "Alle neuen Texte sind übersetzt; nirgends steht ein technischer Schlüssel.",
          "tests": [
            "src/ChangeHistory.test.tsx › AC7.3 has every history text in German, English, French and Italian"
          ]
        }
      ]
    },
    {
      "id": "AC8",
      "story": "S8",
      "title": "Zwei Stände vergleichen",
      "cases": [
        {
          "id": "AC8.1",
          "title": "V6 gegen Aktuell",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "„S-3“ hat sechs Stände.",
          "when": "Ich öffne „Stände vergleichen“, wähle „Von“ einen älteren Stand und „Nach“ „Aktuell“.",
          "then": "Links steht der ältere, rechts der neuere Stand. Geänderte Felder sind mit Zeichen und Wort markiert; unveränderte sind eingeklappt und über „Nur Änderungen“ aufklappbar; oben steht, wie viele Felder sich geändert haben.",
          "tests": [
            "e2e/changeHistory.spec.ts › AC8.1 compares V4 with the current version side by side",
            "src/domain/changeLog.test.ts › AC8.1 compares two states field by field in a fixed order"
          ],
          "poCheck": "Bitte ansehen: Ist der Vergleich links/rechts gut lesbar (Variante E, A + C)?"
        },
        {
          "id": "AC8.2",
          "title": "Beschreibung zeilenweise",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Wie AC8.1, mit V1 links.",
          "when": "Ich schaue auf die Beschreibung.",
          "then": "Beide Texte stehen nebeneinander, Zeile für Zeile, mit Zeilennummern; geänderte Zeilen und Wörter sind markiert.",
          "tests": [
            "src/ChangeHistory.test.tsx › AC8.2 shows the description line by line, with words marked",
            "e2e/changeHistory.spec.ts › AC8.2 shows the description line by line with line numbers",
            "src/domain/textDiff.test.ts › AC8.2 puts equal lines on both sides and marks the changed words of a changed line"
          ]
        },
        {
          "id": "AC8.3",
          "title": "Seiten tauschen",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Der Vergleich V4 gegen Aktuell ist offen.",
          "when": "Ich klicke auf „⇄“.",
          "then": "Aktuell steht links, V4 rechts; was „hinzugefügt“ war, ist nun „entfernt“.",
          "tests": [
            "src/ChangeHistory.test.tsx › AC8.3 swaps the sides",
            "src/domain/changeLog.test.ts › AC8.3 swapping the sides turns added into removed"
          ]
        },
        {
          "id": "AC8.4",
          "title": "Gleicher Stand links und rechts",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Der Vergleich ist offen.",
          "when": "Ich wähle links und rechts denselben Stand.",
          "then": "Es steht „Keine Unterschiede“.",
          "tests": [
            "src/ChangeHistory.test.tsx › AC8.4 says there are no differences for the same version on both sides",
            "src/domain/changeLog.test.ts › AC8.4 finds no difference between a version and itself"
          ]
        },
        {
          "id": "AC8.5",
          "title": "Nur ansehen",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Der Vergleich V4 gegen Aktuell ist offen.",
          "when": "Ich suche eine Möglichkeit, V4 wiederherzustellen oder etwas zu ändern.",
          "then": "Es gibt keine. Danach ist die Story unverändert, der Verlauf hat keinen neuen Eintrag.",
          "tests": [
            "src/ChangeHistory.test.tsx › AC8.5 offers nothing to restore or change in the comparison"
          ]
        },
        {
          "id": "AC8.6",
          "title": "Gilt auch für Sprint, Epic und Release",
          "link": "#/backlog",
          "given": "Ein Sprint mit mehreren Ständen.",
          "when": "Ich vergleiche zwei Stände des Sprints.",
          "then": "Dieselbe Ansicht; statt der Kriterien zeigt sie die hinzugekommenen und entfernten Stories mit + und −.",
          "tests": [
            "src/domain/changeLog.test.ts › AC8.6 compares two versions of a sprint, with the stories that joined and left"
          ]
        },
        {
          "id": "AC8.7",
          "title": "Schmales Fenster",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Der Vergleich ist offen.",
          "when": "Ich mache das Fenster schmal (unter etwa 720 Pixel).",
          "then": "Die beiden Spalten stehen untereinander, jede mit Überschrift („V4“, „Aktuell“).",
          "tests": [],
          "manual": "Die Darstellung bei schmalem Fenster prüft nur ein Mensch.",
          "poCheck": "Bitte das Fenster schmal ziehen: Stehen die beiden Stände lesbar untereinander?"
        }
      ]
    },
    {
      "id": "AC9",
      "story": "S9",
      "title": "Vergleich starten",
      "cases": [
        {
          "id": "AC9.1",
          "title": "Mit Aktuell vergleichen",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Das Feld „Verlauf“ von „S-3“ zeigt die letzten drei Einträge.",
          "when": "Ich klicke bei „V4“ auf „Mit Aktuell vergleichen“.",
          "then": "Der Vergleich öffnet mit V4 links und Aktuell rechts; „← Zurück“ bringt mich in die Story zurück.",
          "tests": [
            "src/ChangeHistory.test.tsx › AC9.1 compares a version with the current one from its entry"
          ]
        },
        {
          "id": "AC9.2",
          "title": "Zwei Stände ankreuzen",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Ich habe „Alle 5 Änderungen anzeigen“ geöffnet.",
          "when": "Ich kreuze V2, V5 und dann V6 an.",
          "then": "Nach V2 und V5 erscheint „V2 und V5 gewählt“ und „Vergleichen“ ist aktiv; beim dritten Haken wird der älteste (V2) abgewählt.",
          "tests": [
            "src/ChangeHistory.test.tsx › AC9.2 ticks two versions in the full list; a third tick replaces the oldest"
          ]
        },
        {
          "id": "AC9.3",
          "title": "Knopf „Stände vergleichen“",
          "link": "#/board",
          "target": ".card[data-story-id]",
          "given": "Das Feld „Verlauf“ von „S-3“ ist sichtbar.",
          "when": "Ich klicke auf „Stände vergleichen“ und öffne das Auswahlfeld „Von“.",
          "then": "Eine Liste aller Stände mit Datum und Kurzfassung erscheint; „Aktuell“ steht oben.",
          "tests": [
            "src/ChangeHistory.test.tsx › AC9.3 offers all versions in the picker, newest first, with a short summary"
          ]
        }
      ]
    }
  ]
};
