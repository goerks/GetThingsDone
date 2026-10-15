import type { Criterion } from './types';

/**
 * Definition of Ready and Done (#26): the acceptance criteria and their test cases for the product
 * owner, in German. One source for the issue comment, the acceptance panel of the preview and the names of the
 * automated tests (`src/domain/definitions.test.ts`, `src/Definitions.test.tsx`, `e2e/definitions.spec.ts`).
 * The story names are those of the demo data. The demo lists of Ready and Done are switched on, so a change of status asks
 * for them; test case AC1.5 shows how to switch them off (Einstellungen › Definitionen).
 */
export const PACKAGE_26: {
  issue: number;
  pullRequest: number;
  title: string;
  criteria: Criterion[];
} = {
  issue: 26,
  pullRequest: 46,
  title: 'Definition of Ready und Done',
  criteria: [
    {
      id: 'AC1',
      story: 'S1',
      title: 'Definitionen in den Einstellungen pflegen',
      cases: [
        {
          id: 'AC1.1',
          title: 'Gruppe und Punkt direkt in der Liste anlegen',
          link: '#/settings/definitions',
          target: '.definition-blocks',
          given: 'Einstellungen › Definitionen, Karte „Definition of Ready“ ist eingeschaltet und zeigt die Beispielliste mit 5 Punkten.',
          when: 'Ich schreibe unter den Blöcken „Security“ in die Zeile „New group“ und drücke Enter. Im neuen Block schreibe ich „Threats are reviewed“ in die Zeile „New item“ und drücke Enter.',
          then: 'Block und Punkt stehen in der Liste, auch nach dem Neuladen. Die Karte zeigt „· 6“.',
          preset: 'definitionsOn',
          tests: [
            'src/Definitions.test.tsx › AC1.1 adds a group and a manual item directly in the list with Enter',
            'e2e/definitions.spec.ts › AC1.1 adds a group and an item directly in the list and takes a check from the library, also after a reload',
            'src/domain/definitions.test.ts › AC1.1 adds a group and a manual item into it'
          ],
          manual: 'Ob der Editor sich gut bedienen lässt, beurteilt nur ein Mensch.',
          poCheck: 'Lässt sich der Editor flüssig bedienen? Findest du die Zeilen zum Hinzufügen und die Bibliothek ohne Suchen?'
        },
        {
          id: 'AC1.2',
          title: 'Automatischen Punkt aus der Bibliothek wählen',
          link: '#/settings/definitions',
          target: '.definition-block__add',
          given: 'Karte „Definition of Done“, Block „Quality“.',
          when: 'Ich öffne „From library“, wähle mit den Pfeiltasten „Must be estimated“ und drücke Enter. Die Bibliothek zeigt auch „Must be attached to an epic“.',
          then: 'Der Punkt steht im Block mit dem Hinweis „automatic“ und ohne Textfeld. In der Bibliothek steht er danach als „already in this list“ und lässt sich nicht nochmals wählen.',
          preset: 'definitionsOn',
          tests: [
            'src/Definitions.test.tsx › AC1.2 adds an automatic item from the library with the keyboard; it cannot be renamed or chosen twice',
            'src/Definitions.test.tsx › AC1.2 the library offers "Must be attached to an epic" and adds it with a click',
            'src/domain/definitions.test.ts › AC1.2 an automatic item takes no text'
          ]
        },
        {
          id: 'AC1.3',
          title: 'Blöcke verschieben, umbenennen, Punkte löschen',
          link: '#/settings/definitions',
          target: '.definition-blocks',
          given: 'Blöcke „Functional“, „Technical“ und „Design“ mit ihren Punkten.',
          when: 'Ich ziehe den Block „Technical“ am Griff über „Functional“ (zugeklappt und aufgeklappt), verschiebe einen Punkt per Tastatur (Alt+↑) in den Block darüber, benenne „Technical“ um und lösche einen Punkt.',
          then: 'Der Block ist mitsamt seinen Punkten verschoben; alles ist gespeichert, auch nach dem Neuladen.',
          preset: 'definitionsOn',
          tests: [
            'e2e/definitions.spec.ts › AC1.3 drags a block above another one, folded or open, with its items, and keeps the order after a reload',
            'src/Definitions.test.tsx › AC1.3 renames a block, moves an item with the keyboard and removes an item',
            'src/Definitions.test.tsx › AC1.3 folds a block to its head and unfolds it again',
            'src/domain/definitions.test.ts › AC1.3 drags a group over another one, with its items'
          ]
        },
        {
          id: 'AC1.4',
          title: '„Darf nicht relevant sein“ je Punkt',
          link: '#/settings/definitions',
          target: '.definition-edit__na',
          given: 'Punkt „Code is reviewed“ in der Done-Liste ohne Häkchen bei „may be n/a“.',
          when: 'Ich setze das Häkchen.',
          then: 'In einer Story kann „Code is reviewed“ nun auf „nicht relevant“ gesetzt werden, vorher nicht.',
          preset: 'definitionsOn',
          tests: [
            'src/Definitions.test.tsx › AC1.4 an item allows "not relevant" in a story only when it is marked so',
            'src/domain/definitions.test.ts › AC1.4 sets "may be irrelevant" per item'
          ]
        },
        {
          id: 'AC1.5',
          title: 'Jede Liste einzeln ein- und ausschalten (Standard: aus)',
          link: '#/settings/definitions',
          target: '.definitions-settings__panel',
          given: 'Beide Listen sind ausgeschaltet (Standard). „S-6“ steht in „To do“.',
          when: 'Ich ziehe „S-6“ nach „In progress“. Dann schalte ich in Einstellungen › Definitionen „Activate the Definition of Ready“ ein und ziehe „S-3“ aus „To do“. Ich schalte den Schalter wieder aus und ziehe erneut.',
          then: 'Ausgeschaltet wird ohne Rückfrage verschoben, Stories zeigen die Liste nicht und nichts ist markiert. Eingeschaltet blockiert die App und fragt. Der Hinweis „The list is off…“ steht bei ausgeschalteten Listen in den Einstellungen.',
          preset: 'definitionsOff',
          tests: [
            'src/Definitions.test.tsx › AC1.5 both lists are off in the demo data and say so, with nothing of their content shown',
            'src/Definitions.test.tsx › AC1.5 a list is switched on and off with its own switch',
            'src/Definitions.test.tsx › AC1.5 a list that is switched off asks nothing',
            'e2e/definitions.spec.ts › AC1.5 both lists are off at first and nothing is asked; the switch in the settings turns the gate on'
          ]
        },
        {
          id: 'AC1.6',
          title: 'Leere Liste: Beispielliste einfügen oder leer beginnen',
          link: '#/settings/definitions',
          target: '.definitions-settings__panel',
          given: 'Beide Listen sind leer und ausgeschaltet.',
          when: 'Ich klicke bei „Definition of Ready“ auf „Insert example list“ und bei „Definition of Done“ auf „Start empty“.',
          then: 'Ready ist eingeschaltet und zeigt die Beispielgruppen; Done ist eingeschaltet und leer. Nach dem Neuladen bleibt beides so.',
          preset: 'definitionsEmpty',
          tests: ['src/Definitions.test.tsx › AC1.6 an empty list that is off offers the example list or an empty start, and both switch it on']
        },
        {
          id: 'AC1.7',
          title: 'Eine aktive Liste einklappen',
          link: '#/settings/definitions',
          target: '.definitions-settings__panel',
          given: 'Beide Listen sind eingeschaltet und gefüllt.',
          when: 'Ich klappe die Karte „Definition of Ready“ ein und wieder aus.',
          then: 'Eingeklappt stehen nur die Überschrift und eine Zusammenfassung wie „3 groups · 5 items“ da. Ausgeklappt ist alles wieder da.',
          preset: 'definitionsOn',
          tests: ['src/Definitions.test.tsx › AC1.7 an active list folds to a summary and unfolds again; the settings keep what it holds']
        }
      ]
    },
    {
      id: 'AC2',
      story: 'S2',
      title: 'Zustand eines Punktes in der Story',
      cases: [
        {
          id: 'AC2.1',
          title: 'Drei Zustände eines Punktes',
          link: '#/board',
          target: '[data-story-id="story-6"]',
          given: 'Story „S-6“ ist offen, Punkt „Design is available“ (darf nicht relevant sein) ist offen.',
          when: 'Ich klicke den Punkt dreimal hintereinander an: nicht gesetzt, erledigt, ignoriert, und ein viertes Mal.',
          then: 'Erst offen, dann abgehakt, dann ein Strich mit durchgestrichenem Text, dann wieder offen. Nach dem Neuladen bleibt der letzte Zustand.',
          preset: 'definitionsOn',
          tests: [
            'src/Definitions.test.tsx › AC2.1 one control goes through the three click states: not set, done, ignored, and back',
            'src/domain/definitions.test.ts › AC2.1 an item is open until it is checked or set to not relevant'
          ]
        },
        {
          id: 'AC2.2',
          title: '„Nicht relevant“ nur wo erlaubt',
          link: '#/board',
          target: '[data-story-id="story-6"]',
          given: 'Punkt „Code is reviewed“ erlaubt es nicht.',
          when: 'Ich klicke den Punkt zweimal an und drücke die Taste N.',
          then: 'Er geht nur zwischen offen und abgehakt hin und her; „ignoriert“ gibt es hier nicht, und die Taste N tut nichts.',
          preset: 'definitionsOn',
          tests: ['src/Definitions.test.tsx › AC2.2 an item that does not allow "not relevant" only goes between not set and done']
        },
        {
          id: 'AC2.3',
          title: 'Automatischer Punkt zeigt seinen Stand selbst',
          link: '#/board',
          target: '[data-story-id="story-3"]',
          given: 'Story „S-3“ mit 3 Kriterien, keines akzeptiert; Done-Punkt „All criteria accepted“.',
          when: 'Ich akzeptiere alle drei Kriterien.',
          then: 'Der Punkt springt von offen auf abgehakt. Von Hand lässt er sich nicht abhaken.',
          preset: 'definitionsOn',
          tests: [
            'src/Definitions.test.tsx › AC2.3 an automatic item cannot be ticked and follows the story',
            'src/domain/definitions.test.ts › AC2.3 an automatic item shows its own state',
            'src/domain/definitions.test.ts › AC2.3 every automatic check looks at the story'
          ]
        },
        {
          id: 'AC2.4',
          title: '„Nicht relevant“ zählt als erfüllt',
          link: '#/board',
          target: '[data-story-id="story-6"]',
          given: 'Eine Liste mit 5 Punkten, 4 abgehakt, 1 offen (darf n. r. sein).',
          when: 'Ich setze den offenen Punkt auf „nicht relevant“.',
          then: 'Der Zähler zeigt „4/5 · 1 n/a“ und die Warnung ist weg.',
          preset: 'definitionsOn',
          tests: ['src/domain/definitions.test.ts › AC2.4 not relevant counts as met']
        }
      ]
    },
    {
      id: 'AC3',
      story: 'S3',
      title: 'Das Panel im Story-Dialog',
      cases: [
        {
          id: 'AC3.1',
          title: 'Panel in der Story',
          link: '#/board',
          target: '[data-story-id="story-6"]',
          given: 'Ready- und Done-Liste mit Gruppen.',
          when: 'Ich öffne „S-6“.',
          then: 'Unter den Kriterien stehen zwei Karten untereinander: „Definition of Ready“ (offen) und „Definition of Done“ (zu), je mit Zähler, Warnzeichen und Fortschrittsbalken. Die Gruppen haben Namen, Zähler und Balken und lassen sich zu- und aufklappen. Bei einer Story in „In progress“ ist die Done-Karte offen.',
          preset: 'definitionsOn',
          tests: [
            'src/Definitions.test.tsx › AC3.1 shows a card per list with counter and progress, the card of the status open, and the groups with their own counters',
            'src/Definitions.test.tsx › AC3.1 a story in "In progress" opens the Done card',
            'src/domain/definitions.test.ts › AC3.1 groups carry their own counters'
          ],
          manual: 'Das Aussehen (Abstände, Balken, Farben) prüft nur ein Mensch.',
          poCheck: 'Sieht das Panel in der Story aufgeräumt aus? Sind Gruppen, Balken und der Knopf „Not relevant“ gut zu erkennen?'
        },
        {
          id: 'AC3.2',
          title: 'Nur Tastatur',
          link: '#/board',
          target: '[data-story-id="story-6"]',
          given: 'Story „S-6“ offen.',
          when: 'Ich gehe nur mit Tab zu den Karten, öffne und schliesse sie mit Enter, hake mit der Leertaste ab, setze mit N „nicht relevant“ und öffne das Menü „⋯“ mit Enter (Escape schliesst es).',
          then: 'Alles geht ohne Maus; der Fokus ist immer sichtbar.',
          preset: 'definitionsOn',
          tests: [
            'src/Definitions.test.tsx › AC3.2 works with the keyboard only: Space ticks, N sets not relevant',
            'src/Definitions.test.tsx › AC3.2 the cards open and close with Enter and the menu works with the keyboard'
          ]
        },
        {
          id: 'AC3.3',
          title: 'Ausgeschaltete oder leere Liste',
          link: '#/settings/definitions',
          target: '.definitions-settings',
          given: 'Nur die Definition of Ready ist eingeschaltet, die Done-Liste ist aus.',
          when: 'Ich öffne eine Story.',
          then: 'Es gibt nur die Karte „Definition of Ready“; „Definition of Done“ fehlt. Sind beide Listen aus oder leer, fehlt das ganze Panel.',
          preset: 'definitionsReadyOnly',
          tests: ['src/Definitions.test.tsx › AC3.3 a list that is empty or off has no card, and two lists that are off no panel']
        }
      ]
    },
    {
      id: 'AC4',
      story: 'S4',
      title: 'Die Listen am Übergang',
      cases: [
        {
          id: 'AC4.1',
          title: 'Ready beim Wechsel nach „In progress“',
          link: '#/board',
          target: '[data-story-id="story-6"]',
          given: 'Die Beispielliste ist eingeschaltet. „S-6“ steht in „To do“ und hat 3 offene Ready-Punkte.',
          when: 'Ich ziehe „S-6“ nach „In progress“.',
          then: 'Das Quality Gate blockiert: Ein Dialog „S-6 cannot move to “In progress”: 3 items of the Definition of Ready are still open“ sagt, was das Problem ist, und zeigt nur die offenen Punkte nach Gruppen. „Move“ ist gesperrt, die Story ist nicht verschoben.',
          preset: 'definitionsOn',
          tests: [
            'e2e/definitions.spec.ts › AC4.1 dragging a card out of "To do" asks for the Ready list and keeps the card where it is',
            'src/Definitions.test.tsx › AC4.1 leaving "To do" asks for the Ready list and shows only the open items',
            'src/domain/definitions.test.ts › AC4.1 asks only for the lists that are crossed and not met'
          ],
          manual: 'Das Aussehen des Dialogs prüft nur ein Mensch.',
          poCheck: 'Ist der Dialog gut lesbar? Ist klar, was das Problem ist und dass „Override the gate…“ nur die bewusste Ausnahme ist?'
        },
        {
          id: 'AC3.4',
          title: 'Definitionen in der Story aus- und einblenden',
          link: '#/board',
          target: '[data-story-id="story-6"]',
          given: 'Beide Listen sind eingeschaltet; „S-6“ zeigt beide Karten.',
          when: 'Ich öffne in einer Karte das Menü „⋯“ und wähle „Hide the definitions“. Dann öffne ich „S-3“ und wähle „Show definitions“.',
          then: 'Nach dem Ausblenden bleibt eine Zeile mit „Show definitions“ und den Zählern (ausgeblendet, nur in diesem Browser). Das gilt auch für andere Stories und nach dem Neuladen, bis ich sie wieder einblende. Das Gate und die Markierungen bleiben unverändert.',
          preset: 'definitionsOn',
          tests: ['src/Definitions.test.tsx › AC3.4 hides the definitions in the story and shows them again, and remembers the choice in this browser']
        },
        {
          id: 'AC3.5',
          title: 'Nur offene Punkte zeigen',
          link: '#/board',
          target: '[data-story-id="story-6"]',
          given: '„S-6“ zeigt die Ready-Karte mit erfüllten und offenen Punkten.',
          when: 'Ich wähle im Menü „⋯“ „Show only open items“. Danach erledige ich die offenen Punkte.',
          then: 'Erfüllte Punkte und Gruppen ohne offene Punkte sind ausgeblendet. Sind alle erfüllt, steht „All items are met.“ da.',
          preset: 'definitionsOn',
          tests: ['src/Definitions.test.tsx › AC3.5 shows only the open items on request, and says so when all are met']
        },
        {
          id: 'AC4.2',
          title: 'Im Dialog erledigen und verschieben',
          link: '#/board',
          target: '[data-story-id="story-6"]',
          given: 'Dialog aus AC4.1.',
          when: 'Ich hake „Dependencies are clarified“ ab, setze die beiden Design-Punkte auf „nicht relevant“ und wähle „Move“.',
          then: '„S-6“ steht in „In progress“, die Antworten sind auch im Story-Dialog zu sehen.',
          preset: 'definitionsOn',
          tests: [
            'e2e/definitions.spec.ts › AC4.2 resolves the open items in the dialog, moves the card and keeps the answers after a reload',
            'src/Definitions.test.tsx › AC4.2 resolves the open items in the dialog and moves; the items stay resolved on the story'
          ]
        },
        {
          id: 'AC4.3',
          title: 'Gate bewusst übergehen',
          link: '#/board',
          target: '[data-story-id="story-1"]',
          given: 'Dialog beim Ziehen von „S-1“ nach „Done“, nichts abgehakt.',
          when: 'Ich wähle „Override the gate…“. Der Dialog nennt die Punkte, die offen bleiben. Erst „Override and move“ verschiebt die Story; „Back to the items“ geht zurück.',
          then: 'Nach „Override and move“ ist „S-1“ in „Done“, die Punkte bleiben offen, und eine Meldung sagt, dass die Definition übergangen wurde (mit „Open story“). Vorher bewegt sich nichts.',
          preset: 'definitionsOn',
          tests: [
            'e2e/definitions.spec.ts › AC4.3 an override moves a card to "Done" with open items on purpose and tells so in a notice with a way to the story',
            'src/Definitions.test.tsx › AC4.3 an override moves the story only after a second, deliberate step that names what stays open'
          ]
        },
        {
          id: 'AC4.4',
          title: 'Abbrechen und Story öffnen',
          link: '#/board',
          target: '[data-story-id="story-6"]',
          given: 'Dialog aus AC4.1.',
          when: 'Ich wähle „Cancel“ (oder Escape), ziehe erneut und wähle „Open story“.',
          then: 'Nach „Cancel“ bleibt „S-6“ in „To do“. „Open story“ zeigt den Story-Dialog mit dem Panel.',
          preset: 'definitionsOn',
          tests: [
            'src/Definitions.test.tsx › AC4.4 "Cancel" keeps the story, "Open story" leads to its dialog',
            'src/Definitions.test.tsx › AC4.4 Escape cancels the question'
          ]
        },
        {
          id: 'AC4.5',
          title: 'Done beim Wechsel nach „Done“',
          link: '#/board',
          target: '[data-story-id="story-1"]',
          given: 'Done-Liste mit offenen Punkten. „S-1“ steht in „In progress“.',
          when: 'Ich ziehe „S-1“ nach „Done“.',
          then: 'Der Dialog fordert die Done-Liste ein, nicht die Ready-Liste.',
          preset: 'definitionsOn',
          tests: ['src/Definitions.test.tsx › AC4.5 entering "Done" asks for the Done list, not the Ready list']
        },
        {
          id: 'AC4.6',
          title: 'Direkt von „To do“ nach „Done“',
          link: '#/board',
          target: '[data-story-id="story-6"]',
          given: 'Beide Listen mit offenen Punkten, „S-6“ in „To do“.',
          when: 'Ich ziehe „S-6“ nach „Done“.',
          then: 'Erst fordert der Dialog die Ready-Liste ein, danach („Next list“) die Done-Liste.',
          preset: 'definitionsOn',
          tests: [
            'src/Definitions.test.tsx › AC4.6 from "To do" straight to "Done" asks for both lists, one after the other',
            'src/domain/definitions.test.ts › AC4.6 from "not started" straight to "done" crosses both lists, in order'
          ]
        },
        {
          id: 'AC4.7',
          title: 'Keine Prüfung innerhalb einer Kategorie und rückwärts',
          link: '#/board',
          target: '[data-story-id="story-1"]',
          given: 'Beide Listen mit offenen Punkten; „In progress“ und „Review“ liegen beide in der Kategorie „In progress“.',
          when: 'Ich ziehe „S-1“ von „In progress“ nach „Review“ und eine Story von „Done“ zurück nach „In progress“.',
          then: 'Beide Male ohne Dialog.',
          preset: 'definitionsOn',
          tests: [
            'src/Definitions.test.tsx › AC4.7 inside a category and backwards nothing is asked',
            'src/domain/definitions.test.ts › AC4.7 inside a category and backwards nothing is crossed'
          ]
        },
        {
          id: 'AC4.8',
          title: 'Alle Punkte schon erfüllt',
          link: '#/board',
          target: '[data-story-id="story-6"]',
          given: 'Alle Ready-Punkte der Story sind abgehakt oder nicht relevant.',
          when: 'Ich ziehe die Story nach „In progress“.',
          then: 'Kein Dialog, sie wird direkt verschoben.',
          preset: 'definitionsOn',
          tests: [
            'src/Definitions.test.tsx › AC4.8 a story that meets the list moves without a question',
            'src/domain/definitions.test.ts › AC4.8 asks nothing when the list is met'
          ]
        },
        {
          id: 'AC4.9',
          title: 'Wechsel per Tastatur und über das Menü',
          link: '#/board',
          target: '[data-story-id="story-6"]',
          given: 'Offene Ready-Punkte.',
          when: 'Ich ändere den Status nur mit der Tastatur über das Kontextmenü (Shift+F10) und im Story-Dialog über das Statusfeld.',
          then: 'Auch dort erscheint der Dialog; Escape bricht ab.',
          preset: 'definitionsOn',
          tests: [
            'e2e/definitions.spec.ts › AC4.9 asks the same when the status is changed with the keyboard through the menu of the card',
            'src/Definitions.test.tsx › AC4.9 asks the same through the status field of the story dialog, and Escape leaves the story where it is'
          ]
        }
      ]
    },
    {
      id: 'AC5',
      story: 'S5',
      title: 'Markierungen in Backlog und Board',
      cases: [
        {
          id: 'AC5.1',
          title: 'Backlog markiert „nicht bereit“',
          link: '#/backlog',
          target: '[data-story-id="story-6"]',
          given: 'Ready-Liste mit 5 Punkten; „S-6“ erfüllt 2, „S-7“ 1.',
          when: 'Ich öffne das Backlog.',
          then: '„S-6“ trägt „Not ready 2/5“ (mit Symbol und Text), „S-7“ „Not ready 1/5“. Erledigte Stories tragen nie diese Markierung.',
          preset: 'definitionsMarks',
          tests: [
            'e2e/definitions.spec.ts › AC5.1 the backlog marks the stories that are not ready with icon and text',
            'src/Definitions.test.tsx › AC5.1 the backlog marks stories that are not ready, with their counter',
            'src/domain/definitions.test.ts › AC5.1 a story that is not done and not ready is marked with its counter'
          ],
          manual: 'Farbe und Kante prüft nur ein Mensch.',
          poCheck: 'Fällt die Markierung auf, ohne zu stören? Ist sie auch in Dunkel gut lesbar?'
        },
        {
          id: 'AC5.2',
          title: 'Markierung verschwindet',
          link: '#/backlog',
          target: '[data-story-id="story-6"]',
          given: '„S-6“ ist „Not ready“.',
          when: 'Ich hake im Story-Dialog die letzten offenen Punkte ab oder setze sie auf „nicht relevant“.',
          then: 'Die Markierung im Backlog ist weg.',
          preset: 'definitionsMarks',
          tests: [
            'src/Definitions.test.tsx › AC5.2 the mark goes when the story meets the list',
            'src/domain/definitions.test.ts › AC5.2 a story that meets the list is not marked'
          ]
        },
        {
          id: 'AC5.3',
          title: 'Board markiert „nicht fertig“',
          link: '#/board',
          target: '[data-story-id="story-1"]',
          given: '„S-1“ wurde mit „Override and move“ nach „Done“ gezogen; Done-Liste hat 3 Punkte, keiner erfüllt.',
          when: 'Ich öffne das Board.',
          then: 'Die Karte „S-1“ trägt „Not done 0/3“; Karten in anderen Spalten tragen nichts.',
          preset: 'definitionsOn',
          tests: [
            'e2e/definitions.spec.ts › AC5.3 the board marks a card in "Done" that does not meet its Done list, also after a reload',
            'src/Definitions.test.tsx › AC5.3 the board marks a done story that does not meet its Done list',
            'src/domain/definitions.test.ts › AC5.3 a done story is marked by the Done list of its snapshot'
          ],
          manual: 'Farbe und Kante prüft nur ein Mensch.',
          poCheck: 'Ist die Markierung auf der Karte gut sichtbar und lesbar?'
        },
        {
          id: 'AC5.4',
          title: 'Alte erledigte Stories bleiben unberührt',
          link: '#/board',
          target: '[data-story-id="story-5"]',
          given: '„S-5“ ist schon erledigt, als ich einen neuen Done-Punkt anlege.',
          when: 'Ich öffne das Board.',
          then: '„S-5“ trägt keine Markierung. Eine Story, die ich danach nach „Done“ ziehe, wird mit der neuen Liste geprüft.',
          preset: 'definitionsMarks',
          tests: [
            'src/Definitions.test.tsx › AC5.4 a story that was done before the list changed is never marked',
            'src/Definitions.test.tsx › AC5.4 a story that becomes done afterwards is held to the list as it is then',
            'src/domain/definitions.test.ts › AC5.4 a story that becomes done remembers the Done items of that moment',
            'src/domain/definitions.test.ts › AC5.4 a story that was done before keeps its snapshot, also when the list changes later'
          ]
        },
        {
          id: 'AC5.5',
          title: 'Leere Listen',
          link: '#/backlog',
          target: '[data-story-id="story-6"]',
          given: 'Beide Listen leer (wie bisher).',
          when: 'Ich öffne Backlog und Board und ziehe Stories.',
          then: 'Keine Markierung, kein Dialog, nichts ist anders als heute.',
          preset: 'definitionsEmpty',
          tests: [
            'src/Definitions.test.tsx › AC5.5 empty lists mark nothing and ask nothing',
            'src/domain/definitions.test.ts › AC5.5 empty lists mark nothing'
          ]
        }
      ]
    },
    {
      id: 'AC6',
      story: 'S6',
      title: 'Sprachen und Hilfe',
      cases: [
        {
          id: 'AC6.1',
          title: 'Vier Sprachen',
          link: '#/settings/definitions',
          target: '.definitions-settings',
          given: 'Ready-Liste und Story mit Panel.',
          when: 'Ich wechsle die Sprache auf Deutsch, Englisch, Französisch, Italienisch.',
          then: 'Alle neuen Texte (Einstellungen, Panel, Dialog, Chips, Meldungen) sind in jeder Sprache übersetzt, kein Text fehlt.',
          preset: 'definitionsOn',
          tests: ['src/Definitions.test.tsx › AC6.1 shows the texts in %s']
        },
        {
          id: 'AC6.2',
          title: 'Hilfe',
          link: '#/board',
          target: '.help-btn',
          given: 'Hilfe geöffnet.',
          when: 'Ich suche „Definition of Done“.',
          then: 'Ein Hilfe-Thema erklärt Ready und Done und verlinkt zu Einstellungen › Definitionen (in allen vier Sprachen).',
          preset: 'definitionsOn',
          tests: ['src/Help.test.tsx › AC6.2 explains the definitions of Ready and Done and links to where to set them up']
        }
      ]
    }
  ]
};
