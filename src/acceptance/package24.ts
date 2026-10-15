import type { Criterion } from './types';

/**
 * Velocity chart (#24): the acceptance criteria and their test cases for the product owner, in German.
 * One source for the issue comment, the acceptance panel of the preview and the names of the automated tests.
 * The velocity is a window under the button "Velocity · Ø n" in the head of the board (PO decision, placement A).
 * The data of the test cases: six completed sprints (planned at the start / done: 18/12, 22/19, 25/17, 20/22, 24/20,
 * 26/22), the running "Sprint 7" with 24 points and the planned "Sprint 8" with 30 points. The demo data of the preview
 * has no completed sprint, so every test case names the test data (`preset`, see `presets.ts`) the panel loads for it.
 */
const COMPONENT = 'src/Velocity.test.tsx';
const E2E = 'e2e/velocity.spec.ts';

export const PACKAGE_24: { issue: number; pullRequest: number; title: string; criteria: Criterion[] } = {
  issue: 24,
  pullRequest: 45,
  title: 'Velocity-Diagramm',
  criteria: [
    {
      id: 'AC1',
      story: 'V1',
      title: 'Velocity-Fenster beim Board',
      cases: [
        {
          id: 'AC1.1',
          preset: 'velocity6',
          title: 'Zwei Balken pro Sprint, mit Tabelle',
          link: '#/board',
          target: '.velocity-button',
          given: 'Sechs abgeschlossene Sprints (Sprint 1: 18 geplant, 12 erledigt; … Sprint 6: 26 geplant, 22 erledigt).',
          when: 'Ich öffne das Board und drücke oben bei „Neue Story“ den Knopf „Velocity · Ø 21“.',
          then: 'Unter dem Knopf öffnet sich das Fenster „Velocity“. Es zeigt für jeden Sprint zwei Balken mit Zahlen („18“ und „12“ bei Sprint 1) in der Reihenfolge Sprint 1 bis 6, darunter die Tabelle. Die Legende nennt „Geplant“ und „Erledigt“.',
          tests: [`${COMPONENT} › AC1.1 shows two bars with numbers per sprint, in order, with a legend`, `${E2E} › AC1.1 shows two bars with numbers per sprint, in order, with a legend`],
          poCheck: 'Bitte einmal ansehen: Passt der Platz des Knopfes neben „Neue Story“ und das Fenster darunter? Passen Farben und Aussehen der Balken, sind Zahlen, Legende und Tabelle gut lesbar? (Die Testdaten mit 6 abgeschlossenen Sprints lädst du mit dem Knopf unten.)'
        },
        {
          id: 'AC1.2',
          preset: 'velocity6',
          title: 'Erledigt kann über geplant liegen',
          link: '#/board',
          target: '.velocity-button',
          given: 'Wie AC1.1.',
          when: 'Ich öffne das Velocity-Fenster und schaue auf Sprint 4.',
          then: 'Der Balken „Erledigt“ (22) ist höher als der Balken „Geplant“ (20).',
          tests: [`${COMPONENT} › AC1.2 draws the done bar higher than the planned bar when more was done`, `${E2E} › AC1.2 draws the done bar of Sprint 4 higher than its planned bar`]
        },
        {
          id: 'AC1.3',
          preset: 'velocity10',
          title: 'Nur die letzten 8 Sprints',
          link: '#/board',
          target: '.velocity-button',
          given: '10 abgeschlossene Sprints, Sprint 1 bis Sprint 10.',
          when: 'Ich öffne das Velocity-Fenster und drücke „Ältere Sprints“.',
          then: 'Zuerst stehen Sprint 3 bis Sprint 10 da. Nach „Ältere Sprints“ stehen auch Sprint 1 und 2 da.',
          tests: [`${COMPONENT} › AC1.3 shows the last 8 of 10 sprints and the older ones after "Older sprints"`, `${E2E} › AC1.3 shows the last 8 of 10 sprints and the older ones after "Older sprints"`]
        },
        {
          id: 'AC1.4',
          preset: 'velocity6',
          title: 'Öffnen und Schliessen',
          link: '#/board',
          target: '.velocity-button',
          given: 'Wie AC1.1. Das Fenster ist zu.',
          when: 'Ich schaue auf den Knopf, öffne das Fenster und schliesse es auf vier Wegen: Knopf, Esc-Taste, „✕“ und ein Klick daneben.',
          then: 'Der Knopf zeigt „Velocity · Ø 21“. Im geöffneten Fenster steht „Ø 21 Punkte · letzte 3 Sprints“. Jeder der vier Wege schliesst das Fenster; nach Esc ist der Fokus wieder auf dem Knopf.',
          tests: [`${COMPONENT} › AC1.4 shows the average on the button and opens and closes with the button, Esc, the close button and a click next to it`, `${E2E} › AC1.4 opens and closes with the button, Esc and a click next to the window, and the button shows the average`]
        },
        {
          id: 'AC1.5',
          preset: 'velocity6',
          title: 'Details zu einem Sprint',
          link: '#/board',
          target: '.velocity-button',
          given: 'Wie AC1.1, das Fenster ist offen. Beim Sprint 4 wurden 2 Stories mit 5 Punkten dazugenommen.',
          when: 'Ich fahre mit der Maus über Sprint 4. Danach gehe ich mit der Tabulatortaste zu Sprint 4.',
          then: 'Beides zeigt „Sprint 4“, den Zeitraum, „Geplant beim Start 20 · Erledigt 22 (110 %)“ und „+2 Stories, +5 Punkte dazugekommen“.',
          tests: [`${COMPONENT} › AC1.5 shows the details of a sprint on keyboard focus`, `${E2E} › AC1.5 shows the details of Sprint 4 on hover and on keyboard focus`]
        },
        {
          id: 'AC1.6',
          preset: 'velocity6',
          title: 'Neuer abgeschlossener Sprint erscheint',
          link: '#/board',
          target: '.velocity-button',
          given: 'Wie AC1.1, Sprint 7 läuft.',
          when: 'Ich schliesse Sprint 7 ab und öffne das Velocity-Fenster.',
          then: 'Im Diagramm kommt „Sprint 7“ dazu, mit den Punkten vom Start und den erledigten.',
          tests: [`${COMPONENT} › AC1.6 adds a newly completed sprint to the chart`, `${E2E} › AC1.6 adds Sprint 7 to the chart after I complete it`]
        }
      ]
    },
    {
      id: 'AC2',
      story: 'V2',
      title: 'Durchschnitt',
      cases: [
        {
          id: 'AC2.1',
          preset: 'velocity6',
          title: 'Durchschnitt der letzten 3',
          link: '#/board',
          target: '.velocity-button',
          given: 'Sprint 4, 5, 6 haben 22, 20 und 22 erledigt.',
          when: 'Ich öffne das Velocity-Fenster.',
          then: 'Die gestrichelte Linie ist beschriftet mit „Ø 21 (letzte 3)“. Die Kopfzeile sagt „Ø 21 Punkte · letzte 3 Sprints“.',
          tests: [`${COMPONENT} › AC2.1 shows the average of the last 3 sprints in the head and on a dashed line`, `${E2E} › AC2.1 labels the dashed average line "Ø 21 (last 3)"`, 'src/domain/velocity.test.ts › AC2.1 averages the done points of the last three sprints, rounded to whole points (21.33 → 21)']
        },
        {
          id: 'AC2.2',
          preset: 'velocity2',
          title: 'Zwei Sprints',
          link: '#/board',
          target: '.velocity-button',
          given: 'Nur 2 abgeschlossene Sprints mit 12 und 24 erledigten Punkten.',
          when: 'Ich öffne das Velocity-Fenster.',
          then: '„Ø 18 Punkte · 2 Sprints“.',
          tests: [`${COMPONENT} › AC2.2 names the number of sprints when only 2 are completed`, 'src/domain/velocity.test.ts › AC2.2 averages the sprints there are when fewer than three are completed']
        },
        {
          id: 'AC2.3',
          preset: 'velocity1',
          title: 'Ein Sprint',
          link: '#/board',
          target: '.velocity-button',
          given: 'Nur 1 abgeschlossener Sprint mit 12 erledigten Punkten.',
          when: 'Ich öffne das Velocity-Fenster.',
          then: '„Ø 12 Punkte · 1 Sprint“.',
          tests: [`${COMPONENT} › AC2.3 names the single sprint when only 1 is completed`, 'src/domain/velocity.test.ts › AC2.3 works with a single sprint']
        }
      ]
    },
    {
      id: 'AC3',
      story: 'V3',
      title: 'Geplante Punkte neben dem Durchschnitt',
      cases: [
        {
          id: 'AC3.1',
          preset: 'velocity6',
          title: 'Im Backlog',
          link: '#/backlog',
          target: '.backlog__plan',
          given: 'Sprint 7 läuft mit 24 Punkten, Sprint 8 ist geplant mit 30 Punkten. Ø ist 21.',
          when: 'Ich öffne das Backlog.',
          then: 'Bei Sprint 7 steht „24 geplant · Ø 21“, bei Sprint 8 „30 geplant · Ø 21“.',
          tests: [`${COMPONENT} › AC3.1 shows planned points and the average on each open sprint of the backlog`]
        },
        {
          id: 'AC3.2',
          preset: 'velocity6',
          title: 'Auf der Story Map',
          link: '#/map',
          target: '.map-sprint__plan',
          given: 'Wie AC3.1.',
          when: 'Ich öffne die Story Map.',
          then: 'In der Beschriftung von Sprint 7 und Sprint 8 stehen dieselben Angaben.',
          tests: [`${COMPONENT} › AC3.2 shows the same on the story map`]
        },
        {
          id: 'AC3.3',
          preset: 'velocityStart',
          title: 'Im Start-Dialog',
          link: '#/board',
          given: 'Wie AC3.1, kein Sprint läuft, Sprint 8 ist geplant.',
          when: 'Ich öffne „Sprint starten“.',
          then: 'Der Dialog zeigt „30 geplant · Ø 21“.',
          tests: [`${COMPONENT} › AC3.3 shows the same in the start dialog`]
        },
        {
          id: 'AC3.4',
          preset: 'velocity0',
          title: 'Ohne abgeschlossenen Sprint',
          link: '#/backlog',
          target: '.backlog__plan',
          given: 'Es gibt noch keinen abgeschlossenen Sprint. Sprint 1 hat 23 Punkte.',
          when: 'Ich öffne das Backlog.',
          then: 'Bei Sprint 1 steht nur „23 geplant“, ohne „Ø“.',
          tests: [`${COMPONENT} › AC3.4 shows only the planned points while no sprint is completed`]
        },
        {
          id: 'AC3.5',
          preset: 'velocity6',
          title: 'Zahl ändert sich mit der Planung',
          link: '#/backlog',
          target: '.backlog__plan',
          given: 'Sprint 8 hat 30 Punkte.',
          when: 'Ich ziehe eine Story mit 5 Punkten in Sprint 8.',
          then: 'Bei Sprint 8 steht „35 geplant · Ø 21“.',
          tests: [`${COMPONENT} › AC3.5 follows the planning when a story is moved into the sprint`, `${E2E} › AC3.5 changes the planned points of Sprint 8 when I drag a story into it`]
        },
        {
          id: 'AC3.6',
          preset: 'velocity6',
          title: 'Kein Velocity-Bereich im Backlog',
          link: '#/backlog',
          given: 'Wie AC1.1.',
          when: 'Ich öffne das Backlog.',
          then: 'Über den Sprints gibt es keinen Velocity-Bereich und keinen Velocity-Knopf. Bei jedem Sprint steht nur „24 geplant · Ø 21“.',
          tests: [`${COMPONENT} › AC3.6 does not add a velocity panel to the backlog`]
        }
      ]
    },
    {
      id: 'AC4',
      story: 'V4',
      title: 'Leerer Zustand',
      cases: [
        {
          id: 'AC4.1',
          preset: 'velocity0',
          title: 'Noch kein Sprint abgeschlossen',
          link: '#/board',
          target: '.velocity-button',
          given: 'Es gibt keinen abgeschlossenen Sprint.',
          when: 'Ich öffne das Board und das Velocity-Fenster.',
          then: 'Der Knopf heisst nur „Velocity“, ohne „Ø“. Das Fenster zeigt „Noch kein Sprint abgeschlossen“ mit dem Satz „Sobald du einen Sprint auf dem Board abschliesst, siehst du hier, wie viele Punkte geplant und erledigt wurden.“. Es gibt kein Diagramm und kein „Ø“.',
          tests: [`${COMPONENT} › AC4.1 explains why there is no chart while no sprint is completed`, `${E2E} › AC4.1 explains why there is no chart while no sprint is completed`]
        }
      ]
    },
    {
      id: 'AC5',
      story: 'V5',
      title: 'Tabelle und Barrierefreiheit',
      cases: [
        {
          id: 'AC5.1',
          preset: 'velocity6',
          title: 'Diagramm und Tabelle zusammen',
          link: '#/board',
          target: '.velocity-button',
          given: 'Wie AC1.1.',
          when: 'Ich öffne das Velocity-Fenster.',
          then: 'Diagramm und Tabelle stehen zusammen im Fenster, ohne Umschalter. Die Tabelle zeigt den neuesten Sprint zuerst. Spalten: Sprint, Zeitraum, Abgeschlossen, Geplant beim Start, Dazugekommen, Erledigt, Anteil. Alle 6 Sprints stehen drin, zum Beispiel „Sprint 4 · 20 · +5 · 22 · 110 %“. Eine Fusszeile nennt „Ø der letzten 3 Sprints: 21“.',
          tests: [`${COMPONENT} › AC5.1 shows the table together with the chart, newest sprint first, with the points added and the average in the footer`, `${E2E} › AC5.1 shows the table together with the chart, newest sprint first, with the average below`]
        },
        {
          id: 'AC5.2',
          preset: 'velocity10',
          title: 'Mehr als 8 Sprints in der Tabelle',
          link: '#/board',
          target: '.velocity-button',
          given: '10 abgeschlossene Sprints.',
          when: 'Ich öffne das Velocity-Fenster.',
          then: 'Alle 10 Sprints stehen in der Tabelle, im Diagramm die letzten 8.',
          tests: [`${COMPONENT} › AC5.2 lists all 10 sprints in the table, not only 8`]
        },
        {
          id: 'AC5.3',
          preset: 'velocity6',
          title: 'Screenreader',
          link: '#/board',
          target: '.velocity-button',
          given: 'Das Fenster ist offen.',
          when: 'Ich lese die Seite mit einem Screenreader.',
          then: 'Das Diagramm hat eine Beschreibung, und die Tabelle hat einen Namen, sodass beides vorgelesen wird.',
          tests: [`${COMPONENT} › AC5.3 describes the chart for screen readers`, `${E2E} › AC5.3 describes the chart for screen readers`]
        },
        {
          id: 'AC5.4',
          preset: 'velocity6',
          title: 'Farbe allein trägt keine Bedeutung',
          link: '#/board',
          target: '.velocity-button',
          given: 'Wie AC1.1.',
          when: 'Ich öffne das Velocity-Fenster und schaue das Diagramm in Graustufen an.',
          then: 'Über jedem Balken steht seine Zahl. Die Legende nennt beide Balken. Die Durchschnittslinie ist gestrichelt und beschriftet.',
          tests: [],
          manual: 'Es geht um das Aussehen in Graustufen; die Zahlen, die Legende und die beschriftete gestrichelte Linie sind in AC1.1 und AC2.1 automatisch geprüft.',
          poCheck: 'Bitte das Diagramm in Graustufen ansehen (zum Beispiel Bildschirmfoto in Schwarzweiss): Sind beide Balken auch ohne Farbe unterscheidbar? (Nur für das Aussehen; die Zahlen sind automatisch geprüft.)'
        }
      ]
    },
    {
      id: 'AC6',
      story: 'V6',
      title: 'Sprachen, Tastatur, Hilfe',
      cases: [
        {
          id: 'AC6.1',
          preset: 'velocity6',
          title: 'Vier Sprachen',
          link: '#/board',
          target: '.velocity-button',
          given: 'Wie AC1.1.',
          when: 'Ich wechsle die Sprache.',
          then: 'Der Knopf, das Fenster, die Legende, die Tabelle und der leere Zustand erscheinen in DE, EN, FR und IT, zum Beispiel „Ältere Sprints“, „Older sprints“, „Sprints précédents“ und „Sprint precedenti“.',
          tests: [`${COMPONENT} › AC6.1 translates the button and the window into DE, EN, FR and IT`, `${E2E} › AC6.1 shows the button and the window in German, French and Italian`]
        },
        {
          id: 'AC6.2',
          preset: 'velocity6',
          title: 'Nur mit der Tastatur',
          link: '#/board',
          target: '.velocity-button',
          given: 'Wie AC1.1.',
          when: 'Ich gehe mit der Tab-Taste zum Knopf „Velocity“, öffne das Fenster mit Enter, gehe durch die Sprints und schliesse es mit Esc.',
          then: 'Alles geht ohne Maus. Der Fokus ist sichtbar und nach Esc wieder auf dem Knopf.',
          tests: [`${COMPONENT} › AC6.2 operates with the keyboard only: open, step through the sprints, close`, `${E2E} › AC6.2 works with the keyboard only`]
        },
        {
          id: 'AC6.3',
          title: 'Hilfe',
          link: '#/backlog',
          given: 'Die Hilfe ist offen.',
          when: 'Ich suche nach „Velocity“.',
          then: 'Es gibt ein Thema, das den Knopf, das Diagramm und den Durchschnitt erklärt. Ein Link führt zum Board.',
          tests: [`${COMPONENT} › AC6.3 has a help topic for the velocity that links to the board`]
        }
      ]
    },
    {
      id: 'AC7',
      story: 'V7',
      title: 'Testdaten in der Vorschau',
      cases: [
        {
          id: 'AC7.1',
          title: 'Testdaten laden',
          link: '#/board',
          target: '.velocity-button',
          given: 'Die Vorschau mit den Demo-Daten, in der kein Sprint abgeschlossen ist.',
          when: 'Ich öffne die Abnahme, gehe zu einem Prüfpunkt der Velocity und drücke „Diese Testdaten laden“. Danach öffne ich das Velocity-Fenster auf dem Board.',
          then: 'Nach einer Rückfrage lädt die Seite neu, die Abnahme ist wieder offen. Das Fenster zeigt sechs abgeschlossene Sprints, Sprint 7 läuft und lässt sich abschliessen. Über „Testdaten“ unten im Panel kann ich auch andere Testdaten oder wieder die Demo-Daten wählen.',
          tests: [`${COMPONENT} › AC7.1 loads test data with six completed sprints and a running sprint that can be completed`, `${E2E} › AC7.1 loads the test data from the acceptance panel and keeps it after the reload`]
        }
      ]
    }
  ]
};
