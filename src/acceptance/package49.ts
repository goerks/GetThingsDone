import type { Criterion, Intro } from './types';

/**
 * Workflows (#49): the acceptance criteria and their test cases for the product owner, in German. One source for the issue
 * comment, the acceptance panel of the preview and the names of the automated tests (`src/domain/workflow.test.ts`,
 * `src/Workflows.test.tsx`, `e2e/workflows.spec.ts`). The status names are those of the demo data. The workflow is off by
 * default (test case AC11.1); the test data below switch it on with the rules each test case needs. AC3.7 (several stories
 * at once, all or nothing) moved to #40, where multi-select is built.
 */
export const PACKAGE_49: {
  issue: number;
  pullRequest: number;
  title: string;
  intro?: Intro;
  criteria: Criterion[];
} = {
  issue: 49,
  pullRequest: 77,
  title: 'Workflows',
  intro: {
    about:
      'Ticket #49: Du legst selbst fest, welche Status-Übergänge erlaubt sind. Beispiel: Eine Story darf von „To do“ nicht direkt nach „Done“. Das stellst du in Einstellungen › Workflows ein; das Board, der Story-Dialog und das Backlog halten sich daran. Neu seit deinem Wunsch vom 16.10.: Jede Änderung wird als Version gespeichert, und du kannst zu einem früheren, funktionierenden Stand zurückkehren. Neu seit dem 30.10.: Die Seite zeigt den Workflow als UML-Statusdiagramm, das du direkt bearbeiten kannst.',
    todo: [
      'Die Prüfpunkte unten führen dich der Reihe nach durch: „Zur Seite und markieren“ öffnet die Seite und hebt die Stelle hervor.',
      'Bei jedem Punkt steht „Das prüfst du“: das ist die Frage an dich (Verständlichkeit, Aussehen, Bedienung).',
      'Mit „In Ordnung“ oder „Problem“ markieren, bei einem Problem kurz sagen, was dir auffällt.',
      'Am Ende „Ergebnis kopieren“ und im Chat einfügen. Alles andere ist automatisch getestet.'
    ]
  },
  criteria: [
    {
      id: 'AC1',
      story: 'S1',
      title: 'Start, Ende und erlaubte Übergänge festlegen',
      cases: [
        {
          id: 'AC1.1',
          title: 'Standard: alles ist erlaubt',
          link: '#/board',
          target: '.board',
          given: 'Ich habe den Workflow nie angepasst. „S-3“ steht in „To do“.',
          when: 'Ich ziehe „S-3“ direkt in „Done“.',
          then: '„S-3“ steht in „Done“, wie bisher.',
          preset: 'demo',
          tests: [
            'src/domain/workflow.test.ts › AC1.1 allows every transition by default, with the workflow on or off',
            'e2e/workflows.spec.ts › AC1.1 moves a story from "To do" straight to "Done" while nothing is set'
          ]
        },
        {
          id: 'AC1.2',
          title: 'Einen Übergang sperren',
          link: '#/settings/workflows',
          target: '.workflow-editor',
          given: 'Einstellungen › Workflows, der Workflow ist eingeschaltet, Zeile „To do“.',
          when: 'Ich schalte „Done“ aus. Dann ziehe ich „S-3“ von „To do“ nach „Done“.',
          then: 'Es geht nicht (siehe AC3). Nach dem Neuladen ist „Done“ in der Zeile weiterhin ausgeschaltet.',
          preset: 'workflowOn',
          tests: [
            'src/domain/workflow.test.ts › AC1.2 forbids one transition and keeps the opposite direction and the other transitions allowed',
            'src/domain/workflow.test.ts › AC1.2 forbids nothing while the workflow is off, and staying in the same status is always allowed',
            'src/Workflows.test.tsx › AC1.2 forbids a transition, and AC7.1 it is still forbidden after a reload'
          ]
        },
        {
          id: 'AC1.3',
          title: 'Start-Status wählen',
          link: '#/settings/workflows',
          target: '[data-part="start"]',
          given: '„Nicht begonnen“ hat zwei Status: „To do“ und „Ready“.',
          when: 'In der Zeile „New story“ schalte ich „Ready“ ein und „To do“ aus. Dann lege ich auf dem Board in „Ready“ eine neue Story an.',
          then: 'Die neue Story steht in „Ready“. In den anderen Spalten gibt es kein „+ Story“.',
          preset: 'workflowStarts',
          tests: [
            'src/domain/workflow.test.ts › AC1.3 starts a new story in the allowed start status, in board order',
            'src/Workflows.test.tsx › AC1.3 sets where a new story starts, and AC1.4 keeps the last start on'
          ]
        },
        {
          id: 'AC1.4',
          title: 'Mindestens ein Start-Status bleibt an',
          link: '#/settings/workflows',
          target: '[data-part="start"]',
          given: 'In der Zeile „New story“ ist nur „To do“ an.',
          when: 'Ich versuche, „To do“ auszuschalten.',
          then: 'Es geht nicht: Die Schaltfläche ist gesperrt, ein Hinweis erklärt, dass neue Stories irgendwo starten müssen.',
          preset: 'workflowOn',
          tests: [
            'src/domain/workflow.test.ts › AC1.4 keeps the last start status on and refuses a start outside "Not started"'
          ]
        }
      ]
    },
    {
      id: 'AC2',
      story: 'S1',
      title: 'Die Liste „Von hier aus nach …“',
      cases: [
        {
          id: 'AC2.1',
          title: 'Die Liste „Von hier aus nach …“',
          link: '#/settings/workflows',
          target: '.workflow-editor',
          given: 'Der Workflow ist eingeschaltet.',
          when: 'Ich schaue die Seite an.',
          then: 'Oben die Zeile „New story“. Darunter drei Gruppen mit je einer Zeile pro Status. In jeder Zeile stehen die anderen Status und „End (delete)“ als Schaltflächen, erlaubte mit Häkchen. Ein Status steht nie als Ziel in seiner eigenen Zeile.',
          preset: 'workflowOn',
          tests: [
            'src/Workflows.test.tsx › AC2.1 lists the start, the categories with one row per status, and the other statuses and the end as targets'
          ],
          poCheck: 'Ist die Seite auf einen Blick verständlich? Findest du, was ein Status darf, ohne zu suchen?'
        },
        {
          id: 'AC2.2',
          title: 'Nur mit der Tastatur bedienen',
          link: '#/settings/workflows',
          target: '.workflow-editor',
          given: 'Der Workflow ist eingeschaltet.',
          when: 'Ich springe mit Tab zu „Review“ → „Done“ und drücke die Leertaste.',
          then: 'Die Schaltfläche wechselt zwischen an und aus. Die Vorlesehilfe nennt „From Review to Done“ und ob es an ist.',
          preset: 'workflowOn',
          tests: [
            'src/Workflows.test.tsx › AC2.2 switches a target with the keyboard and names it for the screen reader'
          ]
        },
        {
          id: 'AC2.3',
          title: 'Schmaler Bildschirm',
          link: '#/settings/workflows',
          target: '.workflow-editor',
          given: 'Das Fenster ist so schmal wie ein Handy (etwa 400 Punkte).',
          when: 'Ich öffne Einstellungen › Workflows.',
          then: 'Die Zeilen stehen untereinander, alle Schaltflächen sind erreichbar, die Seite scrollt nicht seitwärts.',
          preset: 'workflowOn',
          tests: [
            'e2e/workflows.spec.ts › AC2.3 shows the workflow page on a narrow screen with the rows one under the other and no sideways scrolling'
          ],
          manual: 'Wie es auf einem echten Handy aussieht, sieht nur ein Mensch.',
          poCheck: 'Lässt sich die Seite auf dem Handy gut bedienen? Treffen die Finger die Schaltflächen?'
        }
      ]
    },
    {
      id: 'AC3',
      story: 'S2',
      title: 'Gesperrte Übergänge auf Board, Backlog und im Story-Fenster',
      cases: [
        {
          id: 'AC3.1',
          title: 'Beim Ziehen sind gesperrte Spalten sichtbar',
          link: '#/board',
          target: '.board',
          given: '„To do → Done“ ist gesperrt. „S-3“ steht in „To do“.',
          when: 'Ich nehme „S-3“ in die Hand und ziehe, ohne loszulassen.',
          then: '„Done“ ist ausgegraut und mit einem Schloss markiert. Die anderen Spalten sind normal.',
          preset: 'workflowRestricted',
          tests: [
            'e2e/workflows.spec.ts › AC3.1 locks the columns a story may not go to while it is dragged'
          ],
          poCheck: 'Sieht man beim Ziehen sofort, wohin es nicht geht? Ist das Schloss gut erkennbar?'
        },
        {
          id: 'AC3.2',
          title: 'Grund beim Darüberfahren',
          link: '#/board',
          target: '.board',
          given: 'Wie AC3.1, „S-3“ wird gezogen.',
          when: 'Ich fahre über die gesperrte Spalte „Done“.',
          then: 'Ein Hinweis erscheint: „To do → Done is not allowed“.',
          preset: 'workflowRestricted',
          tests: [
            'e2e/workflows.spec.ts › AC3.2 names the reason over a locked column'
          ]
        },
        {
          id: 'AC3.3',
          title: 'Loslassen auf gesperrter Spalte',
          link: '#/board',
          target: '.board',
          given: 'Wie AC3.1.',
          when: 'Ich lasse „S-3“ über „Done“ los.',
          then: '„S-3“ bleibt in „To do“. Eine Meldung sagt, dass der Übergang nach „Done“ nicht erlaubt ist.',
          preset: 'workflowRestricted',
          tests: [
            'e2e/workflows.spec.ts › AC3.3 keeps a story in place when it is dropped on a locked column, and says why'
          ]
        },
        {
          id: 'AC3.4',
          title: 'Verschieben mit der Tastatur',
          link: '#/board',
          target: '.board',
          given: '„S-3“ ist mit der Tastatur ausgewählt, „To do → In progress“ ist gesperrt.',
          when: 'Ich nehme „S-3“ mit der Leertaste auf, schiebe sie mit der Pfeiltaste nach rechts und lasse sie mit der Leertaste los.',
          then: '„S-3“ bleibt, die Meldung erscheint und wird vorgelesen.',
          preset: 'workflowRestricted',
          tests: [
            'e2e/workflows.spec.ts › AC3.4 refuses a move with the keyboard to a locked column and announces the reason'
          ],
          manual: 'Dass ein Screenreader die Meldung wirklich vorliest, hört nur ein Mensch.'
        },
        {
          id: 'AC3.5',
          title: 'Statusauswahl im Story-Fenster',
          link: '#/board',
          target: '.board',
          given: '„S-3“ steht in „To do“, „Done“ ist gesperrt, „In progress“ ist erlaubt.',
          when: 'Ich öffne „S-3“ und klappe die Statusauswahl auf.',
          then: 'Zur Auswahl stehen der aktuelle Status „To do“ und die erlaubten, aber nicht „Done“.',
          preset: 'workflowRestricted',
          tests: [
            'src/Workflows.test.tsx › AC3.5 offers only the current status and the allowed targets in the story dialog'
          ]
        },
        {
          id: 'AC3.6',
          title: 'Statusmenü im Backlog',
          link: '#/backlog',
          target: '.backlog',
          given: 'Wie AC3.5.',
          when: 'Ich öffne im Backlog mit der rechten Maustaste das Menü von „S-3“ und dort „Status“.',
          then: 'Wie AC3.5: „Done“ steht nicht zur Auswahl.',
          preset: 'workflowRestricted',
          tests: [
            'src/Workflows.test.tsx › AC3.6 offers only the allowed targets in the menu of a card in the backlog'
          ]
        }
      ]
    },
    {
      id: 'AC4',
      story: 'S3',
      title: 'Start und Ende',
      cases: [
        {
          id: 'AC4.1',
          title: 'Löschen aus gesperrtem Status',
          link: '#/board',
          target: '.board',
          given: 'Bei „Done“ ist „End (delete)“ gesperrt. „S-5“ steht in „Done“, „S-6“ in „To do“.',
          when: 'Ich versuche zuerst „S-5“ zu löschen, dann „S-6“.',
          then: '„S-5“ lässt sich nicht löschen, ohne Rückfrage, mit kurzem Grund. „S-6“ lässt sich löschen.',
          preset: 'workflowRestricted',
          tests: [
            'src/domain/workflow.test.ts › AC4.1 forbids deleting from a status without a way to the end',
            'src/Workflows.test.tsx › AC4.1 refuses to delete a story in a status without a way to the end, and deletes one in another status'
          ]
        },
        {
          id: 'AC4.2',
          title: 'Warnung ohne Weg zum Ende',
          link: '#/settings/workflows',
          target: '.workflow-editor',
          given: 'Bei allen Status ist „End (delete)“ eingeschaltet.',
          when: 'Ich schalte „End (delete)“ bei jedem Status aus.',
          then: 'Eine Warnung erscheint, dass Stories nicht mehr gelöscht werden können. Ich kann trotzdem speichern (es wird sofort gespeichert).',
          preset: 'workflowOn',
          tests: [
            'src/domain/workflow.test.ts › AC4.2 notices that no status leads to the end',
            'src/Workflows.test.tsx › AC4.2 warns when no status leads to the end, and still saves'
          ]
        }
      ]
    },
    {
      id: 'AC5',
      story: 'S2',
      title: 'Bestehende Stories',
      cases: [
        {
          id: 'AC5.1',
          title: 'Bestehende Stories bleiben unberührt',
          link: '#/board',
          target: '.board',
          given: '„S-2“ steht in „Review“.',
          when: 'Ich sperre in der Zeile „Review“ alle Ziele ausser „In progress“.',
          then: '„S-2“ bleibt in „Review“. Ich kann sie nach „In progress“ verschieben, nicht aber nach „Done“.',
          preset: 'workflowRestricted',
          tests: [
            'src/domain/workflow.test.ts › AC5.1 leaves a story in a status that is no longer reachable, and lets it leave along an allowed transition',
            'src/Workflows.test.tsx › AC5.1 keeps a story where it is and offers it only the transitions that are still allowed'
          ]
        }
      ]
    },
    {
      id: 'AC6',
      story: 'S4',
      title: 'Status entfernen und anlegen',
      cases: [
        {
          id: 'AC6.1',
          title: 'Status entfernen',
          link: '#/settings/statuses',
          given: 'Es gibt den Status „Review“. „To do → Review“ ist gesperrt.',
          when: 'Ich entferne „Review“ in den Status-Werten (die Story geht nach „In progress“).',
          then: 'In Einstellungen › Workflows gibt es die Zeile „Review“ nicht mehr, und „Review“ steht bei keinem anderen Status als Ziel.',
          preset: 'workflowRestricted',
          tests: [
            'src/domain/workflow.test.ts › AC6.1 removes the transitions of a removed status',
            'src/Workflows.test.tsx › AC6.1 drops the row and the transitions of a removed status, and AC6.2 gives a new status every transition'
          ]
        },
        {
          id: 'AC6.2',
          title: 'Neuer Status',
          link: '#/settings/statuses',
          given: 'Der Workflow ist eingeschaltet, einzelne Übergänge sind gesperrt.',
          when: 'Ich lege den Status „Test“ in „In progress“ an und öffne Einstellungen › Workflows.',
          then: '„Test“ hat eine Zeile, und alle Übergänge von und zu „Test“ sind erlaubt.',
          preset: 'workflowRestricted',
          tests: [
            'src/domain/workflow.test.ts › AC6.2 allows every transition from and to a new status'
          ]
        }
      ]
    },
    {
      id: 'AC7',
      story: 'S4',
      title: 'Speichern, Neuladen, Backup',
      cases: [
        {
          id: 'AC7.1',
          title: 'Workflow bleibt erhalten',
          link: '#/settings/workflows',
          target: '.workflow-editor',
          given: '„To do → Done“ ist gesperrt.',
          when: 'Ich lade die App neu. Dann exportiere ich alle Daten, lösche sie in einem anderen Browserfenster und importiere die Datei.',
          then: 'Nach dem Neuladen und nach dem Import ist „To do → Done“ weiterhin gesperrt.',
          preset: 'workflowRestricted',
          tests: [
            'src/domain/workflow.test.ts › AC7.1 stays the same after saving, loading and a backup'
          ]
        }
      ]
    },
    {
      id: 'AC8',
      story: 'S4',
      title: 'Sprachen und Bedienung',
      cases: [
        {
          id: 'AC8.1',
          title: 'Sprachen',
          link: '#/settings/workflows',
          target: '.workflows-settings',
          given: 'Der Workflow ist eingeschaltet.',
          when: 'Ich schalte die Sprache nacheinander auf Deutsch, Englisch, Französisch, Italienisch.',
          then: 'Alle Texte der Seite, Meldungen und Hinweise sind in der gewählten Sprache. Eigene Status-Namen bleiben, wie ich sie eingegeben habe.',
          preset: 'workflowOn',
          tests: [
            'src/Workflows.test.tsx › AC8.1 shows the page in %s'
          ]
        }
      ]
    },
    {
      id: 'AC9',
      story: 'S1',
      title: 'Kategorie-Schalter „Freie Übergänge innerhalb“',
      cases: [
        {
          id: 'AC9.1',
          title: 'Kategorie-Schalter einschalten',
          link: '#/settings/workflows',
          target: '.workflow-editor',
          given: 'Zwischen „In progress“ und „Review“ ist in beide Richtungen ein Übergang gesperrt. Der Schalter bei „In progress“ ist aus.',
          when: 'Ich schalte „Free transitions within In progress“ ein.',
          then: '„In progress → Review“ und „Review → In progress“ sind erlaubt. „To do → Done“ bleibt gesperrt.',
          preset: 'workflowFreeOff',
          tests: [
            'src/domain/workflow.test.ts › AC9.1 turns a category free: every transition inside it is allowed, the others stay as they are',
            'src/Workflows.test.tsx › AC9.1 turns a category free with its switch, and AC9.2 shows an exception made afterwards'
          ]
        },
        {
          id: 'AC9.2',
          title: 'Ausnahme nach dem Schalter',
          link: '#/settings/workflows',
          target: '.workflow-editor',
          given: 'Der Schalter bei „In progress“ ist an.',
          when: 'Ich schalte „Review“ → „In progress“ aus.',
          then: 'Der Übergang bleibt gesperrt, der Schalter bleibt an und zeigt „with exceptions“.',
          preset: 'workflowOn',
          tests: [
            'src/domain/workflow.test.ts › AC9.2 keeps an exception made after the switch and reports it'
          ]
        },
        {
          id: 'AC9.3',
          title: 'Kategorie-Schalter ausschalten',
          link: '#/settings/workflows',
          target: '.workflow-editor',
          given: 'Der Schalter bei „In progress“ ist an, alle Übergänge dort sind erlaubt.',
          when: 'Ich schalte ihn aus.',
          then: 'Alle Übergänge bleiben erlaubt, wie sie waren.',
          preset: 'workflowOn',
          tests: [
            'src/domain/workflow.test.ts › AC9.3 keeps the transitions when the switch is turned off',
            'src/Workflows.test.tsx › AC9.3 keeps the transitions when the switch is turned off'
          ]
        },
        {
          id: 'AC9.4',
          title: 'Kategorie mit einem einzigen Status',
          link: '#/settings/workflows',
          target: '.workflow-editor',
          given: 'In „Done“ gibt es nur den Status „Done“.',
          when: 'Ich schaue den Schalter dieser Kategorie an.',
          then: 'Der Schalter ist ausgegraut, mit dem Hinweis „only one status“.',
          preset: 'workflowOn',
          tests: [
            'src/domain/workflow.test.ts › AC9.4 offers the switch only for a category with two or more statuses',
            'src/Workflows.test.tsx › AC9.4 greys out the switch of a category with a single status'
          ]
        }
      ]
    },
    {
      id: 'AC10',
      story: 'S4',
      title: 'Nur für Stories',
      cases: [
        {
          id: 'AC10.1',
          title: 'Epics sind nicht betroffen',
          link: '#/settings/workflows',
          target: '.workflow-editor',
          given: 'Der Workflow ist eingeschaltet.',
          when: 'Ich suche eine Einstellung für Epics.',
          then: 'Die Seite gilt nur für Stories, es gibt nichts für Epics, und Epics verhalten sich unverändert.',
          preset: 'workflowOn',
          tests: [
            'src/domain/workflow.test.ts › AC10.1 stores the workflow per item type: only stories have one, and unknown stored parts are dropped',
            'src/Workflows.test.tsx › AC10.1 has rows for the statuses of the stories only, nothing for epics'
          ]
        }
      ]
    },
    {
      id: 'AC11',
      story: 'S1',
      title: 'Standardmässig aus',
      cases: [
        {
          id: 'AC11.1',
          title: 'Standardmässig aus',
          link: '#/settings/workflows',
          target: '.workflows-settings',
          given: 'Ich starte die App mit den Demo-Daten und habe am Workflow nie etwas geändert.',
          when: 'Ich öffne Einstellungen › Workflows.',
          then: 'Der Schalter „Activate the workflow“ ist ausgeschaltet. Von der Liste ist noch nichts zu sehen, nur ein kurzer Hinweis.',
          preset: 'demo',
          tests: [
            'src/domain/workflow.test.ts › AC11.1 is off by default',
            'src/Workflows.test.tsx › AC11.1 is off by default: only the switch and a note, no list'
          ]
        },
        {
          id: 'AC11.2',
          title: 'Ohne Aktivierung ist alles erlaubt',
          link: '#/board',
          target: '.board',
          given: 'Der Workflow ist ausgeschaltet, es sind aber Sperren gespeichert. „S-3“ steht in „To do“.',
          when: 'Ich ziehe „S-3“ direkt nach „Done“.',
          then: '„S-3“ steht in „Done“. Auf dem Board ist nirgends von einem Workflow die Rede (kein Schloss, keine Hinweise).',
          preset: 'workflowSaved',
          tests: [
            'e2e/workflows.spec.ts › AC11.2 offers no sign of a workflow and allows every move while the workflow is off, although rules are saved'
          ]
        },
        {
          id: 'AC11.3',
          title: 'Aktivieren zeigt die Liste',
          link: '#/settings/workflows',
          target: '.workflows-settings',
          given: 'Der Workflow ist ausgeschaltet.',
          when: 'Ich schalte „Activate the workflow“ ein.',
          then: 'Die Liste „Von hier aus nach …“ erscheint, wie in AC2.1. Alle Übergänge sind zunächst erlaubt.',
          preset: 'demo',
          tests: [
            'src/Workflows.test.tsx › AC11.3 shows the list when the workflow is activated, with every transition allowed'
          ]
        },
        {
          id: 'AC11.4',
          title: 'Ausschalten hebt Sperren auf, Einschalten bringt sie zurück',
          link: '#/settings/workflows',
          target: '.workflows-settings',
          given: 'Der Workflow ist an, „To do → Done“ ist gesperrt.',
          when: 'Ich schalte „Activate the workflow“ aus und ziehe „S-3“ von „To do“ nach „Done“. Danach schalte ich den Workflow wieder ein.',
          then: 'Bei ausgeschaltetem Workflow klappt das Ziehen. Nach dem Wiedereinschalten ist „To do → Done“ weiterhin gesperrt.',
          preset: 'workflowRestricted',
          tests: [
            'src/domain/workflow.test.ts › AC11.4 keeps what was set while it is switched off and on',
            'src/Workflows.test.tsx › AC11.4 keeps what was set when the workflow is switched off and on'
          ]
        },
        {
          id: 'AC11.5',
          title: 'Ausgeschaltet auch beim Anlegen und Löschen',
          link: '#/board',
          target: '.board',
          given: 'Der Workflow ist aus. Gespeichert (aber nicht wirksam) ist: Start nur in „Ready“, „End (delete)“ bei „Done“ gesperrt.',
          when: 'Ich lege eine neue Story an und lösche „S-5“ in „Done“.',
          then: 'Die neue Story steht im ersten Status von „Nicht begonnen“. „S-5“ lässt sich löschen.',
          preset: 'workflowSaved',
          tests: [
            'src/domain/workflow.test.ts › AC11.5 ignores a saved start and a saved end rule while the workflow is off',
            'src/Workflows.test.tsx › AC11.5 ignores a saved start and a saved end rule while the workflow is off'
          ]
        }
      ]
    },
    {
      id: 'AC12',
      story: 'S1',
      title: 'Workflow-Versionen und Zurückkehren',
      cases: [
        {
          id: 'AC12.1',
          title: 'Jede Änderung erzeugt eine Version',
          link: '#/settings/workflows',
          target: '[data-part="versions"]',
          given: 'Einstellungen › Workflows, der Workflow ist eingeschaltet, die Versionsliste ist noch leer.',
          when: 'Ich sperre den Übergang von „To do“ nach „Done“.',
          then: 'In der Versionsliste steht ein neuer Eintrag ganz oben mit heutigem Datum und Uhrzeit, markiert als „Current“. Darunter steht der Stand davor.',
          preset: 'workflowOn',
          tests: [
            'src/domain/workflow.test.ts › AC12.1 adds a version with every change, and none for switching on or off',
            'src/Workflows.test.tsx › AC12.1 lists a version with every change, newest first'
          ],
          poCheck: 'Ist sofort klar, was eine Version ist und welche die aktuelle ist?'
        },
        {
          id: 'AC12.2',
          title: 'Version benennen',
          link: '#/settings/workflows',
          target: '[data-part="versions"]',
          given: 'Die Versionsliste hat mindestens zwei Einträge.',
          when: 'Ich gebe dem obersten Eintrag den Namen „Vor dem Umbau“ und drücke Enter.',
          then: 'Der Eintrag zeigt Datum, Uhrzeit und „Vor dem Umbau“, auch nach dem Neuladen.',
          preset: 'workflowVersions',
          tests: [
            'src/domain/workflow.test.ts › AC12.2 names a version, trims the name and removes it when empty',
            'src/Workflows.test.tsx › AC12.2 names a version and keeps the name after a reload'
          ],
          poCheck: 'Findest du das Feld zum Benennen, und ist klar, dass Enter speichert?'
        },
        {
          id: 'AC12.3',
          title: 'Zu einem alten Stand zurückkehren',
          link: '#/settings/workflows',
          target: '[data-part="versions"]',
          given: 'Der Workflow ist „kaputt“: aus „To do“ ist alles gesperrt. Es gibt eine Version „Funktionierend“.',
          when: 'Ich klicke bei „Funktionierend“ auf „Go back to this version“ und bestätige mit „Go back“.',
          then: 'Die Übergänge sind wieder wie im funktionierenden Stand. Oben steht ein neuer Eintrag „Current“; der kaputte Stand ist weiterhin in der Liste.',
          preset: 'workflowVersions',
          tests: [
            'src/domain/workflow.test.ts › AC12.3 goes back to an old version as a new current one without losing any',
            'src/Workflows.test.tsx › AC12.3 goes back to a working version after a confirmation'
          ],
          poCheck: 'Ist klar, was beim Zurückkehren passiert? Genügt die Rückfrage, und ist verständlich, dass nichts verloren geht?'
        },
        {
          id: 'AC12.4',
          title: 'Nichts geht verloren',
          link: '#/settings/workflows',
          target: '[data-part="versions"]',
          given: 'Ich bin wie in AC12.3 zum funktionierenden Stand zurückgekehrt.',
          when: 'Ich kehre zum kaputten Stand zurück.',
          then: 'Auch das funktioniert, und alle bisherigen Einträge sind noch da.',
          preset: 'workflowVersions',
          tests: ['src/domain/workflow.test.ts › AC12.4 goes back and forth between versions without losing any']
        },
        {
          id: 'AC12.5',
          title: 'Export und Import',
          link: '#/settings/data',
          target: '.settings-content',
          given: 'Mehrere Versionen, eine davon mit Namen.',
          when: 'Ich exportiere alle Daten, lösche sie und importiere die Datei wieder.',
          then: 'Alle Versionen mit Namen sind wieder da.',
          preset: 'workflowVersions',
          tests: ['src/domain/workflow.test.ts › AC12.5 keeps the versions with their names in a backup']
        },
        {
          id: 'AC12.6',
          title: 'Tastatur und Sprache',
          link: '#/settings/workflows',
          target: '[data-part="versions"]',
          given: 'Die Sprache ist Französisch.',
          when: 'Ich bediene die Versionsliste nur mit der Tastatur: benennen, zurückkehren.',
          then: 'Alles ist erreichbar, und alle Texte sind französisch.',
          preset: 'workflowVersions',
          tests: [],
          manual: 'Ob die Bedienung nur mit der Tastatur und die französischen Texte stimmig sind, prüft man am besten von Hand.',
          poCheck: 'Lässt sich alles mit der Tastatur erreichen, und sind alle Texte französisch?'
        }
      ]
    },
    {
      id: 'AC13',
      story: 'S6',
      title: 'Workflow als UML-Statusdiagramm',
      cases: [
        {
          id: 'AC13.1',
          title: 'Diagramm statt Liste',
          link: '#/settings/workflows',
          target: '.workflow-diagram',
          given: 'Der Workflow ist eingeschaltet, Demo-Daten.',
          when: 'Ich öffne Einstellungen › Workflows.',
          then: 'Ich sehe ein Diagramm mit Start (ausgefüllter Punkt), Ende (Kreis mit Punkt), drei Rahmen „Not started“, „In progress“, „Done“ und die vier Status darin.',
          preset: 'workflowRestricted',
          tests: [
            'src/domain/workflowDiagram.test.ts › AC13.1 draws the start, the end, a frame per category and a rounded rectangle per status',
            'src/Workflows.test.tsx › AC13.1 shows the workflow as a diagram with the start, the end, a frame per category and the statuses',
            'e2e/workflows.spec.ts › AC13.1 shows the diagram with the start, the end and the frames on a wide screen'
          ],
          poCheck: 'Sieht es wie ein sauberes UML-Statusdiagramm aus? Kreuzen sich Pfeile, oder ist etwas unklar?'
        },
        {
          id: 'AC13.2',
          title: 'Erlaubte Übergänge als Pfeile',
          link: '#/settings/workflows',
          target: '.workflow-diagram',
          given: '„To do“ → „Done“ ist gesperrt, alles andere erlaubt.',
          when: 'Ich schaue das Diagramm an.',
          then: 'Zwischen „To do“ und „Done“ gibt es keinen Pfeil. Zwischen „To do“ und „In progress“ gibt es einen.',
          preset: 'workflowRestricted',
          tests: ['src/domain/workflowDiagram.test.ts › AC13.2 draws an arrow for every allowed transition and none for a forbidden one']
        },
        {
          id: 'AC13.3',
          title: 'Rückwärts gestrichelt',
          link: '#/settings/workflows',
          target: '.workflow-diagram',
          given: '„Done“ → „In progress“ ist erlaubt.',
          when: 'Ich schaue das Diagramm an.',
          then: 'Der Pfeil von „Done“ zurück nach „In progress“ ist gestrichelt, die Vorwärtspfeile sind durchgezogen.',
          preset: 'workflowRestricted',
          tests: ['src/domain/workflowDiagram.test.ts › AC13.3 draws the arrows back dashed and the arrows forward solid']
        },
        {
          id: 'AC13.4',
          title: 'Löschen am Rahmen',
          link: '#/settings/workflows',
          target: '.workflow-diagram',
          given: 'Aus allen Status von „In progress“ ist Löschen erlaubt, aus „Done“ nicht.',
          when: 'Ich schaue das Diagramm an. Dann sperre ich Löschen aus „Review“.',
          then: 'Zuerst führt ein Pfeil vom Rahmen „In progress“ zum Ende. Danach führt einer von „In progress“ allein zum Ende, von „Review“ keiner.',
          preset: 'workflowRestricted',
          tests: ['src/domain/workflowDiagram.test.ts › AC13.4 leads one arrow from a frame to the end where every status may be deleted, else one per status']
        },
        {
          id: 'AC13.5',
          title: 'Frei in der Kategorie',
          link: '#/settings/workflows',
          target: '.workflow-diagram',
          given: 'In „In progress“ sind „In progress“ und „Review“ in beide Richtungen erlaubt.',
          when: 'Ich schaue das Diagramm an.',
          then: 'Zwischen den beiden steht ein Doppelpfeil mit „frei“.',
          preset: 'workflowOn',
          tests: ['src/domain/workflowDiagram.test.ts › AC13.5 draws "free within the category" as one double arrow with a label, and none when the switch is off']
        }
      ]
    },
    {
      id: 'AC14',
      story: 'S6',
      title: 'Im Diagramm bearbeiten',
      cases: [
        {
          id: 'AC14.1',
          title: 'Status anklicken',
          link: '#/settings/workflows',
          target: '.workflow-diagram',
          given: 'Das Diagramm ist offen.',
          when: 'Ich klicke „In progress“.',
          then: 'Unter dem Diagramm stehen seine Ziele „Review“, „Done“, „To do“ und „End (delete)“ als Schalter, eingeschaltet wie im Diagramm.',
          preset: 'workflowOn',
          tests: ['src/Workflows.test.tsx › AC14.1 shows the targets of a chosen status below the diagram'],
          poCheck: 'Ist klar, dass man einen Status anklickt und darunter die Ziele umschaltet?'
        },
        {
          id: 'AC14.2',
          title: 'Schalter ändert das Diagramm',
          link: '#/settings/workflows',
          target: '.workflow-diagram',
          given: '„In progress“ ist gewählt, „Done“ ist erlaubt.',
          when: 'Ich schalte „Done“ aus.',
          then: 'Der Pfeil von „In progress“ nach „Done“ verschwindet, auch nach dem Neuladen. In der Versionsliste steht eine neue Version.',
          preset: 'workflowRestricted',
          tests: ['src/Workflows.test.tsx › AC14.2 redraws the diagram, saves and adds a version when a toggle changes']
        },
        {
          id: 'AC14.3',
          title: 'Start wählen',
          link: '#/settings/workflows',
          target: '.workflow-diagram',
          given: '„Nicht begonnen“ hat „To do“ und „Ready“.',
          when: 'Ich klicke den Start-Punkt und schalte „Ready“ als Start ein.',
          then: 'Vom Start führt auch ein Pfeil nach „Ready“.',
          preset: 'workflowStarts',
          tests: [
            'src/domain/workflowDiagram.test.ts › AC14.3 leads an arrow from the start to every status where a story may start',
            'src/Workflows.test.tsx › AC14.3 lets me choose where a story starts by clicking the start'
          ]
        }
      ]
    },
    {
      id: 'AC15',
      story: 'S6',
      title: 'Diagramm oder Liste, Handy, Tastatur',
      cases: [
        {
          id: 'AC15.1',
          title: 'Diagramm oder Liste',
          link: '#/settings/workflows',
          target: '.workflow-view',
          given: 'Das Diagramm ist offen.',
          when: 'Ich wähle „List“.',
          then: 'Ich sehe die Liste „von hier nach …“ mit denselben Einstellungen. Wähle ich wieder „Diagram“, ist alles wie vorher.',
          preset: 'workflowRestricted',
          tests: ['src/Workflows.test.tsx › AC15.1 switches between the diagram and the list, which show the same workflow']
        },
        {
          id: 'AC15.2',
          title: 'Hochkant am Handy',
          link: '#/settings/workflows',
          target: '.workflow-diagram',
          given: 'Das Fenster ist so schmal wie ein Handy (etwa 400 Punkte).',
          when: 'Ich öffne Einstellungen › Workflows.',
          then: 'Das Diagramm steht hochkant, von oben (Start) nach unten (Ende). Die Seite scrollt nicht seitwärts.',
          preset: 'workflowRestricted',
          tests: [
            'src/domain/workflowDiagram.test.ts › AC15.2 draws the diagram upright on a narrow screen: taller than wide, the same states, no overlaps',
            'e2e/workflows.spec.ts › AC15.2 draws the diagram upright on a narrow screen without sideways scrolling'
          ],
          manual: 'Wie es auf einem echten Handy aussieht, sieht nur ein Mensch.',
          poCheck: 'Ist das hochkante Diagramm auf dem Handy gut lesbar und bedienbar?'
        },
        {
          id: 'AC15.3',
          title: 'Nur mit der Tastatur',
          link: '#/settings/workflows',
          target: '.workflow-diagram',
          given: 'Das Diagramm ist offen.',
          when: 'Ich gehe mit Tab zu „In progress“ und drücke Enter.',
          then: 'Der Status ist gewählt und seine Schalter stehen unter dem Diagramm. Eine Textliste nennt alle Übergänge, zum Beispiel „From To do to In progress“.',
          preset: 'workflowRestricted',
          tests: ['src/Workflows.test.tsx › AC15.3 chooses a status with the keyboard and lists all transitions as text']
        }
      ]
    },
    {
      id: 'AC16',
      story: 'S6',
      title: 'Sprachen',
      cases: [
        {
          id: 'AC16.1',
          title: 'Sprachen',
          link: '#/settings/workflows',
          target: '.workflow-diagram',
          given: 'Die Sprache ist Französisch.',
          when: 'Ich öffne Einstellungen › Workflows.',
          then: 'Alle Texte rund um das Diagramm sind französisch.',
          preset: 'workflowOn',
          tests: ['src/Workflows.test.tsx › AC16.1 shows the texts of the diagram in French']
        }
      ]
    }
  ]
};
