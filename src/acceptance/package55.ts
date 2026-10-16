import type { Criterion } from './types';

/**
 * Major UI update (#55): the acceptance criteria and their test cases for the product owner, in German. One source for
 * the issue comment, the acceptance panel of the preview and the names of the automated tests
 * (`src/UiUpdate.test.tsx`, `src/domain/board.test.ts`, `src/help/noShortcutHints.test.ts`, `e2e/uiUpdate.spec.ts`).
 * The story names are those of the demo data.
 */
export const PACKAGE_55: { issue: number; pullRequest: number; title: string; criteria: Criterion[] } = {
  issue: 55,
  pullRequest: 60,
  title: 'Grosses UI-Update',
  criteria: [
    {
      "id": "AC1",
      "story": "S1",
      "title": "Kacheln als Kacheln erkennbar",
      "cases": [
        {
          "id": "AC1.1",
          "title": "Kacheln sind als Kacheln erkennbar",
          "link": "#/board",
          "given": "Das Board mit den Demo-Stories ist offen.",
          "when": "Ich schaue mir die Spalten „To do“ und „In progress“ an.",
          "then": "Jede Story ist eine helle Kachel mit feinem Rand und leichtem Schatten auf der etwas dunkleren Spalte, mit sichtbarem Abstand dazwischen.",
          "tests": [],
          "target": ".card",
          "manual": "Aussehen",
          "poCheck": "Bitte ansehen: Sind die Kacheln klar als Kacheln erkennbar?"
        },
        {
          "id": "AC1.2",
          "title": "Kachel im dunklen Design",
          "link": "#/board",
          "given": "Das Board ist offen.",
          "when": "Ich schalte oben auf das dunkle Design um.",
          "then": "Die Kacheln heben sich auch im dunklen Design klar von der Spalte ab.",
          "tests": [],
          "target": ".card",
          "manual": "Aussehen",
          "poCheck": "Bitte im dunklen Design ansehen: Heben sich die Kacheln ab?"
        },
        {
          "id": "AC1.3",
          "title": "Kachel reagiert auf Maus und Tastatur",
          "link": "#/board",
          "given": "Das Board ist offen.",
          "when": "Ich fahre mit der Maus über „S-1“, springe mit Tab auf „S-1“ und ziehe die Kachel.",
          "then": "Beim Darüberfahren wird der Rand kräftiger, mit der Tastatur sehe ich einen Rahmen, beim Ziehen ist die Kachel leicht gekippt mit grossem Schatten.",
          "tests": [
            "e2e/uiUpdate.spec.ts › AC1.3 a card reacts to the mouse and to the keyboard"
          ],
          "target": ".card"
        }
      ]
    },
    {
      "id": "AC2",
      "story": "S2",
      "title": "Fortschritt als kleine Zahl",
      "cases": [
        {
          "id": "AC2.1",
          "title": "Fortschritt als kleine Zahl statt Balken",
          "link": "#/board",
          "given": "„S-1“ hat 4 Kriterien, 2 davon erledigt.",
          "when": "Ich schaue die Kachel „S-1“ an.",
          "then": "Es steht „☑ 2/4“, ohne Fortschrittsbalken und ohne eigene Zeile.",
          "tests": [
            "src/UiUpdate.test.tsx › AC2.1 shows the progress as a small \"☑ 2/4\" and no progress bar"
          ],
          "target": ".card__tasks"
        },
        {
          "id": "AC2.2",
          "title": "Alles erledigt wird grün",
          "link": "#/board",
          "given": "„S-5“ hat alle Kriterien erledigt, „S-3“ keines.",
          "when": "Ich vergleiche beide Kacheln.",
          "then": "Bei „S-5“ steht die Zahl in Grün, bei „S-3“ in Grau.",
          "tests": [
            "src/UiUpdate.test.tsx › AC2.2 turns green when all criteria are accepted"
          ],
          "target": ".card__tasks"
        },
        {
          "id": "AC2.3",
          "title": "Anzeige ändert sich mit",
          "link": "#/board",
          "given": "„S-1“ steht auf „☑ 2/4“.",
          "when": "Ich öffne „S-1“, hake ein Kriterium ab und schliesse die Story.",
          "then": "Auf der Kachel steht „☑ 3/4“.",
          "tests": [
            "src/UiUpdate.test.tsx › AC2.3 changes with the criteria of the story"
          ],
          "target": ".card__tasks"
        },
        {
          "id": "AC2.4",
          "title": "Screenreader nennt den Fortschritt",
          "link": "#/board",
          "given": "Ein Screenreader ist an.",
          "when": "Ich gehe auf „S-1“.",
          "then": "„2 von 4 Kriterien abgenommen“ wird vorgelesen.",
          "tests": [
            "src/UiUpdate.test.tsx › AC2.4 reads \"2 of 4 criteria accepted\" to a screen reader, not only \"2/4\""
          ],
          "target": ".card__tasks"
        }
      ]
    },
    {
      "id": "AC3",
      "story": "S3",
      "title": "Priorität, Epic und Labels in einer Zeile",
      "cases": [
        {
          "id": "AC3.1",
          "title": "Priorität als Buchstabe",
          "link": "#/board",
          "given": "„S-1“ ist Must, „S-3“ Should, „S-6“ Could.",
          "when": "Ich schaue die Kacheln an und fahre über den Buchstaben.",
          "then": "M, S und C mit dem ganzen Wort als Tooltip.",
          "tests": [
            "src/UiUpdate.test.tsx › AC3.1 shows the priority as a letter with the full word as tooltip and screen reader text"
          ],
          "target": ".card__letter"
        },
        {
          "id": "AC3.2",
          "title": "Epic zuerst, dann Labels, alles in einer Zeile",
          "link": "#/board",
          "given": "„S-6“ hat ein Epic und zwei Labels.",
          "when": "Ich schaue die Kachel an.",
          "then": "Eine Zeile: Epic, dann die Labels als Chips, rechts „☑ 0/4“.",
          "tests": [
            "src/UiUpdate.test.tsx › AC3.2 shows the epic first, then the labels, and the tasks at the end of one line",
            "e2e/uiUpdate.spec.ts › AC3.2 keeps epic, labels and tasks on one line, also in a narrow column"
          ],
          "target": ".card__meta"
        },
        {
          "id": "AC3.3",
          "title": "Zu viele Labels",
          "link": "#/board",
          "given": "Eine Story hat vier Labels.",
          "when": "Ich schaue die Kachel an und fahre über „+2“.",
          "then": "Zwei Labels und „+2“, der Tooltip nennt die übrigen.",
          "tests": [
            "src/UiUpdate.test.tsx › AC3.3 shows only two labels and \"+2\" with a tooltip for the rest"
          ],
          "target": ".card__meta"
        },
        {
          "id": "AC3.4",
          "title": "Story ohne Labels",
          "link": "#/board",
          "given": "„S-3“ hat keine Labels.",
          "when": "Ich schaue die Kachel an.",
          "then": "Nur das Epic, keine leeren Chips.",
          "tests": [
            "src/UiUpdate.test.tsx › AC3.4 shows no empty chips for a story without labels"
          ],
          "target": ".card__meta"
        },
        {
          "id": "AC3.5",
          "title": "Sprachwechsel",
          "link": "#/board",
          "given": "Das Board ist offen.",
          "when": "Ich wechsle auf English, Français und Italiano.",
          "then": "Tooltips und Vorlesetexte erscheinen in der Sprache, die Kachel bleibt einzeilig.",
          "tests": [
            "src/UiUpdate.test.tsx › AC3.5 reads the criteria in the chosen language"
          ]
        }
      ]
    },
    {
      "id": "AC4",
      "story": "S4",
      "title": "Kompakte Ansicht",
      "cases": [
        {
          "id": "AC4.1",
          "title": "Kompakt einschalten",
          "link": "#/board",
          "given": "„Kompakt“ ist nicht gedrückt.",
          "when": "Ich klicke oben auf „Kompakt“.",
          "then": "Der Knopf ist gedrückt, jede Story ist eine Zeile mit Buchstabe, Titel, Epic-Punkt, „☑ 2/4“ und Punkten.",
          "tests": [
            "src/UiUpdate.test.tsx › AC4.1 switches to one line per story with a pressed button"
          ],
          "target": ".page-head .btn"
        },
        {
          "id": "AC4.2",
          "title": "Kompakt wieder ausschalten",
          "link": "#/board",
          "given": "Die kompakte Ansicht ist an.",
          "when": "Ich klicke nochmals auf „Kompakt“.",
          "then": "Die normalen Kacheln sind wieder da.",
          "tests": [
            "src/UiUpdate.test.tsx › AC4.2 switches back to the normal cards"
          ]
        },
        {
          "id": "AC4.3",
          "title": "Auswahl wird gemerkt",
          "link": "#/board",
          "given": "Die kompakte Ansicht ist an.",
          "when": "Ich lade die App neu.",
          "then": "Die kompakte Ansicht ist weiterhin an.",
          "tests": [
            "src/UiUpdate.test.tsx › AC4.3 remembers the choice after a reload"
          ]
        },
        {
          "id": "AC4.4",
          "title": "Kompakt nur mit Tastatur und mit Ziehen",
          "link": "#/board",
          "given": "Die kompakte Ansicht ist an.",
          "when": "Ich schalte mit Tab und Eingabetaste um und ziehe „S-3“ nach „In progress“.",
          "then": "Die Eingabetaste schaltet um, „S-3“ steht nach dem Ziehen und dem Neuladen in „In progress“.",
          "tests": [
            "src/UiUpdate.test.tsx › AC4.4 switches with the keyboard",
            "e2e/uiUpdate.spec.ts › AC4.4 drags a story in the compact view and keeps it there after a reload"
          ]
        },
        {
          "id": "AC4.5",
          "title": "Langer Titel in der kompakten Zeile",
          "link": "#/board",
          "given": "Kompakte Ansicht, schmale Spalte.",
          "when": "Ich schaue die Zeile von „S-6“ an und fahre darüber.",
          "then": "Der Titel wird mit „…“ gekürzt, die Zeile bleibt einzeilig, der volle Titel steht im Tooltip.",
          "tests": [
            "src/UiUpdate.test.tsx › AC4.5 gives a compact line the full title and the epic name as tooltips",
            "e2e/uiUpdate.spec.ts › AC4.5 never wraps a long title in the compact view"
          ]
        }
      ]
    },
    {
      "id": "AC5",
      "story": "S5",
      "title": "Punkte im Sprint-Titel rund",
      "cases": [
        {
          "id": "AC5.1",
          "title": "Punkte im Sprint-Titel sind rund",
          "link": "#/backlog",
          "given": "Das Backlog zeigt „Sprint 1“ mit 23 Punkten.",
          "when": "Ich vergleiche die „23“ im Titel mit der Zahl bei „S-3“.",
          "then": "Beide sind runde Zahlen-Kreise gleicher Form.",
          "tests": [
            "src/UiUpdate.test.tsx › AC5.1 shows the points of the sprint header as round as those of a story"
          ],
          "target": ".backlog__heading"
        }
      ]
    },
    {
      "id": "AC6",
      "story": "S5",
      "title": "Nummer ausserhalb der Kachel",
      "cases": [
        {
          "id": "AC6.1",
          "title": "Nummer ausserhalb der Kachel",
          "link": "#/backlog",
          "given": "Das Backlog ist offen.",
          "when": "Ich schaue die Einträge an.",
          "then": "„S-1“, „S-3“ usw. stehen klein und grau links neben der weissen Kachel, alle untereinander.",
          "tests": [
            "src/UiUpdate.test.tsx › AC6.1 puts the number of an item outside the row, as its first element",
            "e2e/uiUpdate.spec.ts › AC6.1 shows the number outside the white row, on its left"
          ],
          "target": ".backlog__code"
        }
      ]
    },
    {
      "id": "AC7",
      "story": "S6",
      "title": "Punkte direkt ändern",
      "cases": [
        {
          "id": "AC7.1",
          "title": "Punkte direkt ändern",
          "link": "#/backlog",
          "given": "„S-1“ hat 3 Punkte, der Sprint 23.",
          "when": "Ich klicke auf die „3“, tippe „8“ und drücke die Eingabetaste.",
          "then": "„S-1“ hat 8 Punkte, der Sprint 28, auch nach dem Neuladen.",
          "tests": [
            "src/UiUpdate.test.tsx › AC7.1 edits the points with a click and Enter, and the sprint total follows",
            "e2e/uiUpdate.spec.ts › AC7.1 changes the points and keeps them after a reload"
          ],
          "target": ".pill--edit"
        },
        {
          "id": "AC7.2",
          "title": "Wegklicken speichert",
          "link": "#/backlog",
          "given": "Wie AC7.1.",
          "when": "Ich klicke auf die „3“, tippe „5“ und klicke daneben.",
          "then": "„S-1“ hat 5 Punkte, der Sprint 25.",
          "tests": [
            "src/UiUpdate.test.tsx › AC7.2 saves when I click away"
          ]
        },
        {
          "id": "AC7.3",
          "title": "Abbrechen",
          "link": "#/backlog",
          "given": "„S-1“ hat 3 Punkte.",
          "when": "Ich klicke auf die „3“, tippe „9“ und drücke Esc.",
          "then": "„S-1“ hat weiter 3 Punkte, der Sprint 23.",
          "tests": [
            "src/UiUpdate.test.tsx › AC7.3 cancels with Escape"
          ]
        },
        {
          "id": "AC7.4",
          "title": "Ungültige Eingabe",
          "link": "#/backlog",
          "given": "„S-1“ hat 3 Punkte, das Feld ist offen.",
          "when": "Ich tippe „abc“, „-3“, „3,5“ oder „101“ und drücke die Eingabetaste.",
          "then": "Nicht gespeichert, rotes Feld mit dem Hinweis „Nur Zahlen, 0–100“. „0“ und „100“ werden gespeichert. Mit Esc steht wieder „3“.",
          "tests": [
            "src/UiUpdate.test.tsx › AC7.4 does not save \"%s\" and shows the hint",
            "src/UiUpdate.test.tsx › AC7.4 saves the limit %s",
            "src/domain/board.test.ts › AC7.4 accepts whole numbers from 0 to 100",
            "src/domain/board.test.ts › AC7.4 refuses everything else"
          ]
        },
        {
          "id": "AC7.5",
          "title": "Nur mit der Tastatur",
          "link": "#/backlog",
          "given": "Das Backlog ist offen.",
          "when": "Ich springe mit Tab auf die Punkte von „S-1“, drücke Enter, tippe „8“ und drücke Enter.",
          "then": "„S-1“ hat 8 Punkte, der Fokus bleibt auf den Punkten.",
          "tests": [
            "src/UiUpdate.test.tsx › AC7.5 edits with the keyboard only and keeps the focus on the points"
          ]
        },
        {
          "id": "AC7.6",
          "title": "Story bleibt zu",
          "link": "#/backlog",
          "given": "Das Backlog ist offen.",
          "when": "Ich klicke auf die Punkte.",
          "then": "Nur das Eingabefeld öffnet sich, nicht die Story.",
          "tests": [
            "src/UiUpdate.test.tsx › AC7.6 does not open the story when I click the points"
          ]
        },
        {
          "id": "AC7.7",
          "title": "Leeres Feld entfernt die Punkte",
          "link": "#/backlog",
          "given": "„S-1“ hat 3 Punkte, der Sprint 23.",
          "when": "Ich klicke auf die „3“, lösche die Zahl und drücke die Eingabetaste.",
          "then": "„S-1“ hat keine Punkte mehr, der Sprint 20.",
          "tests": [
            "src/UiUpdate.test.tsx › AC7.7 removes the points when the field is empty",
            "src/domain/board.test.ts › AC7.7 reads an empty text as no points"
          ]
        }
      ]
    },
    {
      "id": "AC8",
      "story": "S7",
      "title": "Keine Kürzel-Hinweise",
      "cases": [
        {
          "id": "AC8.1",
          "title": "Kein Kürzel auf den „Neu“-Knöpfen",
          "link": "#/board",
          "given": "Ich bin auf Board, Backlog, Story Map und Epics.",
          "when": "Ich schaue den Knopf oben rechts an.",
          "then": "Nur der Text steht darauf, kein „Ctrl+N“.",
          "tests": [
            "src/UiUpdate.test.tsx › AC8.1 writes no shortcut on the \"New\" buttons, which keep working"
          ],
          "target": ".new-button"
        },
        {
          "id": "AC8.2",
          "title": "Kein Kürzel im Suchfeld und in Dialogen",
          "link": "#/board",
          "given": "Das Board ist offen.",
          "when": "Ich schaue das Suchfeld an und öffne „Neue Story“.",
          "then": "Kein „Ctrl+F“ im Suchfeld, kein Speicher-Hinweis im Dialog.",
          "tests": [
            "src/UiUpdate.test.tsx › AC8.2 shows no hint in the search field, its list or the dialogs"
          ],
          "target": ".search"
        },
        {
          "id": "AC8.3",
          "title": "Die Kürzel funktionieren weiter",
          "link": "#/board",
          "given": "Das Board ist offen.",
          "when": "Ich drücke Ctrl+N, Ctrl+F und Ctrl+/.",
          "then": "Dialog „Neue Story“, Suchfeld bekommt den Fokus, Kürzel-Übersicht öffnet sich.",
          "tests": [
            "src/UiUpdate.test.tsx › AC8.3 keeps the shortcuts working",
            "e2e/uiUpdate.spec.ts › AC8.3 keeps the shortcuts working in a real browser"
          ]
        },
        {
          "id": "AC8.4",
          "title": "Hilfe ohne Kürzel-Anzeigen",
          "link": "#/board",
          "given": "Die Hilfe ist offen.",
          "when": "Ich lese „Neue Story“ und „Suche“ in allen vier Sprachen.",
          "then": "Die Texte nennen keine Tastenkürzel. Das Thema zur Kürzel-Übersicht gibt es weiterhin.",
          "tests": [
            "src/help/noShortcutHints.test.ts › AC8.4 no help topic in ${language} names a key combination, except the shortcut overview"
          ]
        },
        {
          "id": "AC8.5",
          "title": "Keine Tastenlegende im Suchfeld",
          "link": "#/board",
          "given": "Das Board ist offen.",
          "when": "Ich klicke ins Suchfeld und tippe „S-“.",
          "then": "Im Dropdown steht keine Zeile mit Tastenkürzeln, Pfeiltasten und Enter funktionieren weiter.",
          "tests": [
            "src/UiUpdate.test.tsx › AC8.5 shows no key legend in the search list, and the keys keep working"
          ],
          "target": ".search"
        }
      ]
    },
  {
    "id": "AC9",
    "story": "S8",
    "title": "Story Map wie das Board",
    "cases": [
      {
        "id": "AC9.1",
        "title": "Karte auf der Story Map wie auf dem Board",
        "link": "#/map",
        "target": ".map-card",
        "given": "Die Story Map ist offen.",
        "when": "Ich vergleiche die Karte „S-6“ mit der auf dem Board.",
        "then": "Sie sieht genau gleich aus wie auf dem Board: Schlüssel, Priorität, Punkte, Titel, Epic, Labels und „☑ 0/4“. Das Board gibt die Darstellung vor.",
        "tests": [
          "src/UiUpdate.test.tsx › AC9.1 shows a card on the story map exactly like on the board"
        ]
      },
      {
        "id": "AC9.2",
        "title": "Kompakt auf der Story Map",
        "link": "#/map",
        "target": ".map-card",
        "given": "Die Story Map ist offen.",
        "when": "Ich klicke auf „Kompakt“.",
        "then": "Jede Story ist eine Zeile wie in der kompakten Ansicht des Boards.",
        "tests": [
          "src/UiUpdate.test.tsx › AC9.2 shows one line per story on the map with \"Compact\", like on the board"
        ]
      }
    ]
  },
  {
    "id": "AC10",
    "story": "S8",
    "title": "Priorität zurückhaltend",
    "cases": [
      {
        "id": "AC10.1",
        "title": "Priorität ist unauffällig",
        "link": "#/board",
        "target": ".card__letter",
        "given": "Das Board ist offen, „S-1“ hat die Priorität Must.",
        "when": "Ich schaue die Kachel an.",
        "then": "Die Priorität ist ein kleiner Farbpunkt mit grauem Buchstaben, ohne farbiges Quadrat. Ohne Priorität steht nichts da.",
        "tests": [
          "e2e/uiUpdate.spec.ts › AC10.1 shows the priority as a small quiet mark, not as a box"
        ],
        "manual": "Aussehen",
        "poCheck": "Bitte ansehen: Ist die Priorität jetzt zurückhaltend genug?"
      }
    ]
  }
  ]
};
