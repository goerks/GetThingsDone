import type { Criterion } from './types';

/**
 * Usability package 1 (#32): the acceptance criteria and their test cases for the product owner, in German.
 * One source for the issue comment, the acceptance panel of the preview and the names of the automated tests.
 * Every test case has an automated test whose name starts with the id (`e2e/usability1.spec.ts`).
 * The story names are those of the demo data; the demo sprint "Sprint 1" is running.
 */
export const PACKAGE_1: { issue: number; pullRequest: number; title: string; criteria: Criterion[] } = {
  issue: 32,
  pullRequest: 35,
  title: 'Usability, Paket 1',
  criteria: [
    {
      id: 'AC1',
      story: 'U1',
      title: 'Ein Klick öffnet, überall',
      cases: [
        {
          id: 'AC1.1',
          title: 'Karte auf dem Board mit einem Klick öffnen',
          link: '#/board',
          target: '[data-story-id="story-3"]',
          given: 'Das Board zeigt Sprint 1. Die Story „S-3 Reorder the backlog by priority“ steht in „Offen“.',
          when: 'Ich klicke auf eine freie Stelle der Karte, nicht auf den Titel.',
          then: 'Die Details von „S-3“ öffnen sich.',
          tests: ['e2e/usability1.spec.ts › AC1.1 opens a story on the board with one click on a free spot of the card']
        },
        {
          id: 'AC1.2',
          title: 'Zeile im Backlog und Karte auf der Story Map öffnen',
          link: '#/backlog',
          target: '[data-story-id="story-3"]',
          given: 'Ich bin im Backlog. „S-3“ steht im Abschnitt „Sprint 1“.',
          when: 'Ich klicke einmal auf die Zeile von „S-3“. Dann gehe ich auf die Story Map und klicke einmal auf die Karte „S-3“.',
          then: 'In beiden Fällen öffnen sich die Details von „S-3“.',
          tests: ['e2e/usability1.spec.ts › AC1.2 opens a story with one click on a backlog row and on a story map card']
        },
        {
          id: 'AC1.3',
          title: 'Ziehen öffnet nichts',
          link: '#/board',
          target: '[data-story-id="story-3"]',
          given: 'Das Board zeigt Sprint 1; „S-3“ steht in „Offen“.',
          when: 'Ich ziehe „S-3“ nach „Erledigt“ und lasse die Maustaste los.',
          then: '„S-3“ steht in „Erledigt“. Es öffnet sich kein Dialog.',
          tests: ['e2e/usability1.spec.ts › AC1.3 does not open a story when it is dragged']
        },
        {
          id: 'AC1.4',
          title: 'Enter und Doppelklick öffnen weiterhin',
          link: '#/board',
          target: '[data-story-id="story-3"]',
          given: 'Das Board zeigt Sprint 1.',
          when: 'Ich setze mit der Tab-Taste den Fokus auf die Karte „S-3“ und drücke Enter. Ich schliesse mit Esc und klicke zweimal schnell auf die Karte.',
          then: 'Beides öffnet genau einen Dialog für „S-3“; nach Esc ist er wieder weg.',
          tests: ['e2e/usability1.spec.ts › AC1.4 still opens with Enter and with a double click, exactly one dialog each']
        }
      ]
    },
    {
      id: 'AC2',
      story: 'U3',
      title: 'Alle Anlegen-Dialoge funktionieren gleich',
      cases: [
        {
          id: 'AC2.1',
          title: 'Fuss mit Abbrechen und Hauptknopf',
          link: '#/board',
          target: '.new-button',
          given: 'Ich bin auf dem Board.',
          when: 'Ich klicke auf „Neue Story“.',
          then: 'Unten im Dialog stehen „Abbrechen“ und rechts daneben der Hauptknopf „Story hinzufügen“, dazu der Hinweis „Ctrl+Enter speichert · Esc bricht ab“.',
          tests: ['e2e/usability1.spec.ts › AC2.1 shows "Cancel" and the primary button at the foot of a create dialog, with the shortcut hint'],
          poCheck: 'Bitte kurz erneut prüfen, weil du hier ein Problem gemeldet hast: „Neue Story“ öffnen, den Titel leer lassen, „Story hinzufügen“ klicken. Die Meldung muss jetzt auf Deutsch unter dem Feld stehen, ohne Browser-Blase.'
        },
        {
          id: 'AC2.2',
          title: 'Strg+Enter speichert aus jedem Feld',
          link: '#/board',
          target: '.new-button',
          given: 'Ich bin auf dem Board und habe „Neue Story“ geöffnet.',
          when: 'Ich tippe den Titel „Passwort zurücksetzen“, gehe ins Feld „Beschreibung“, schreibe „Per E-Mail“ und drücke Strg+Enter (auf dem Bildschirm steht „Ctrl“).',
          then: 'Der Dialog schliesst, die Story „Passwort zurücksetzen“ steht in der Spalte „Offen“. Gleiches gilt für Epic, Sprint und Release.',
          tests: ['e2e/usability1.spec.ts › AC2.2 saves a create dialog with Ctrl+Enter from any field: story, epic, sprint, release']
        },
        {
          id: 'AC2.3',
          title: 'Klick neben den Dialog schliesst nur, wenn nichts eingegeben ist',
          link: '#/board',
          target: '.new-button',
          given: 'Ich habe „Neue Story“ geöffnet und nichts eingegeben.',
          when: 'Ich klicke auf den dunklen Bereich neben dem Dialog.',
          then: 'Der Dialog schliesst ohne Rückfrage.',
          tests: ['e2e/usability1.spec.ts › AC2.3 closes a create dialog without a question when a click beside it finds nothing typed']
        },
        {
          id: 'AC2.4',
          title: 'Mit Eingabe fragt der Dialog nach',
          link: '#/board',
          target: '.new-button',
          given: 'Ich habe „Neue Story“ geöffnet und den Titel „Passwort zurücksetzen“ eingegeben.',
          when: 'Ich klicke neben den Dialog (Variante: ich drücke Esc).',
          then: 'Der Dialog bleibt offen und fragt „Eingaben verwerfen?“ mit „Weiter bearbeiten“ und „Verwerfen“. „Weiter bearbeiten“ behält den Titel; „Verwerfen“ schliesst und es entsteht keine Story.',
          tests: ['e2e/usability1.spec.ts › AC2.4 asks "Discard input?" when something was typed and a click beside the dialog or Escape follows']
        },
        {
          id: 'AC2.5',
          title: 'Abbrechen schliesst sofort',
          link: '#/board',
          target: '.new-button',
          given: 'Ich habe „Neue Story“ geöffnet und einen Titel eingegeben.',
          when: 'Ich klicke auf „Abbrechen“.',
          then: 'Der Dialog schliesst ohne Rückfrage, es entsteht keine Story.',
          tests: ['e2e/usability1.spec.ts › AC2.5 closes at once with "Cancel", even with input']
        },
        {
          id: 'AC2.6',
          title: 'Fehlendes Pflichtfeld wird verständlich gemeldet',
          link: '#/board',
          target: '.new-button',
          given: 'Ich habe „Neue Story“ geöffnet und den Titel leer gelassen.',
          when: 'Ich klicke auf „Story hinzufügen“. Dasselbe mache ich bei „Neues Epic“ ohne Namen.',
          then: 'Unter dem Feld steht in der Sprache der App in Rot „Bitte einen Titel eingeben.“ (beim Epic „Bitte einen Namen eingeben.“), das Feld ist rot umrandet und hat den Fokus. Es erscheint keine Meldung im Stil des Browsers.',
          tests: ['e2e/usability1.spec.ts › AC2.6 reports a missing title or name in the words of the app under the field', 'src/CreateProblems.test.tsx › AC2.6 reports a missing title in German, in the app, not in the style of the browser'],
          poCheck: 'Ist die Meldung bei „Neue Story“ und „Neues Epic“ verständlich und gefällt dir die Darstellung (rote Meldung, roter Rahmen)?'
        }
      ]
    },
    {
      id: 'AC3',
      story: 'U4',
      title: '„Neu“ sitzt auf jeder Seite am selben Platz',
      cases: [
        {
          id: 'AC3.1',
          title: 'Hauptknopf mit Kürzel auf allen Seiten',
          link: '#/map',
          target: '.new-button',
          given: 'Ich öffne nacheinander Board, Backlog, Story Map, Epics und Releases.',
          when: 'Ich schaue rechts oben in den Seitenkopf und klicke den Knopf.',
          then: 'Der Knopf steht überall am selben Platz und nennt sein Kürzel („Neue Story Ctrl+N“, „Neues Epic Ctrl+N“, „+ Release Ctrl+N“). Ein Klick öffnet den passenden Dialog (Story, Story, Story, Epic, Release).',
          tests: ['e2e/usability1.spec.ts › AC3.1 puts the primary "New" button with its shortcut at the right of the page head of every page']
        },
        {
          id: 'AC3.2',
          title: 'Strg+N funktioniert weiter',
          link: '#/epics',
          target: '.new-button',
          given: 'Ich bin auf der Seite Epics.',
          when: 'Ich drücke Strg+N.',
          then: 'Der Dialog „Neues Epic“ öffnet sich.',
          tests: ['e2e/usability1.spec.ts › AC3.2 still opens "New epic" with Ctrl+N on the epics page']
        }
      ]
    },
    {
      id: 'AC4',
      story: 'Q1',
      title: 'Kontextmenü auf Karten und Zeilen',
      cases: [
        {
          id: 'AC4.1',
          title: 'Rechtsklick öffnet das Menü',
          link: '#/board',
          target: '[data-story-id="story-3"]',
          given: 'Das Board zeigt Sprint 1.',
          when: 'Ich klicke mit der rechten Maustaste auf die Karte „S-3“.',
          then: 'Ein Menü an der Karte zeigt: Öffnen, Status, Sprint, Epic, Punkte. Der Dialog von „S-3“ öffnet sich nicht.',
          tests: ['e2e/usability1.spec.ts › AC4.1 opens a menu on the card with a right click, and does not open the story']
        },
        {
          id: 'AC4.2',
          title: 'Status über das Menü ändern',
          link: '#/board',
          target: '[data-story-id="story-3"]',
          given: '„S-3“ steht in „Offen“.',
          when: 'Ich öffne das Menü von „S-3“, wähle „Status“ und dann „Erledigt“.',
          then: '„S-3“ steht in „Erledigt“, auch nach einem Neuladen der App. Das Menü ist zu.',
          tests: ['e2e/usability1.spec.ts › AC4.2 changes the status through the menu, also after a reload']
        },
        {
          id: 'AC4.3',
          title: 'Sprint im Backlog wechseln',
          link: '#/backlog',
          target: '[data-story-id="story-3"]',
          given: 'Im Backlog steht „S-3“ im Abschnitt „Sprint 1“.',
          when: 'Ich öffne das Menü der Zeile „S-3“, wähle „Sprint“ und dann „Nicht geplant“.',
          then: '„S-3“ steht im Abschnitt „Nicht geplant“.',
          tests: ['e2e/usability1.spec.ts › AC4.3 changes the sprint of a backlog row through the menu']
        },
        {
          id: 'AC4.4',
          title: 'Epic und Punkte ändern',
          link: '#/board',
          target: '[data-story-id="story-3"]',
          given: '„S-3“ hat 5 Punkte und das Epic „Backlog“.',
          when: 'Ich wähle im Menü „Punkte“ → „8“ und danach „Epic“ → „Boards“.',
          then: 'Die Karte zeigt 8 Punkte und das Epic „Boards“.',
          tests: ['e2e/usability1.spec.ts › AC4.4 changes the points and the epic through the menu']
        },
        {
          id: 'AC4.5',
          title: 'Nur mit der Tastatur bedienen',
          link: '#/board',
          target: '[data-story-id="story-3"]',
          given: 'Der Fokus liegt auf der Karte „S-3“.',
          when: 'Ich drücke die Menütaste (oder Umschalt+F10), dann Pfeil unten bis „Status“, Pfeil rechts, Pfeil unten und Enter. Danach öffne ich das Menü nochmals und drücke Esc.',
          then: 'Der Status wechselt. Nach Esc ist das Menü zu und der Fokus liegt wieder auf der Karte.',
          tests: ['e2e/usability1.spec.ts › AC4.5 works with the keyboard only: menu key, arrows, Enter, Escape, focus returns to the card']
        },
        {
          id: 'AC4.6',
          title: 'Das Menü gibt es auch auf der Story Map',
          link: '#/map',
          target: '[data-story-id="story-3"]',
          given: 'Ich bin auf der Story Map.',
          when: 'Ich klicke mit rechts auf die Karte „S-3“ und wähle „Sprint“ → „Sprint 2“.',
          then: '„S-3“ steht in der Zeile „Sprint 2“.',
          tests: ['e2e/usability1.spec.ts › AC4.6 offers the menu on the story map too']
        },
        {
          id: 'AC4.7',
          title: 'Klick daneben schliesst das Menü',
          link: '#/board',
          target: '[data-story-id="story-3"]',
          given: 'Das Menü von „S-3“ ist offen.',
          when: 'Ich klicke auf eine freie Stelle der Seite.',
          then: 'Das Menü schliesst, es hat sich nichts geändert.',
          tests: ['e2e/usability1.spec.ts › AC4.7 closes the menu with a click beside it and changes nothing']
        },
        {
          id: 'AC4.8',
          title: 'Die gewählte Story ist beim Menü klar markiert',
          link: '#/board',
          target: '[data-story-id="story-3"]',
          given: 'Das Board zeigt Sprint 1.',
          when: 'Ich klicke mit rechts auf die Karte „S-3“ (ebenso auf eine Zeile im Backlog und eine Karte der Story Map).',
          then: 'Solange das Menü offen ist, hat die Karte einen deutlichen blauen Rahmen und hebt sich von den anderen ab; sobald das Menü zu ist, ist der Rahmen weg.',
          tests: ['e2e/usability1.spec.ts › AC4.8 marks the story whose menu is open, on the board, in the backlog and on the story map']
        }
      ]
    },
    {
      id: 'AC5',
      story: 'Q2',
      title: 'Direkt in der Spalte, im Sprint oder in der Zelle anlegen',
      cases: [
        {
          id: 'AC5.1',
          title: 'Story in einer Board-Spalte anlegen',
          link: '#/board',
          target: '[data-status="in_progress"]',
          given: 'Das Board zeigt Sprint 1; die Spalte „In Arbeit“ hat 2 Stories.',
          when: 'Ich klicke unten in „In Arbeit“ auf „+ Story“, tippe „Rechnung als PDF“ und drücke Enter.',
          then: 'Die Story steht in „In Arbeit“ (jetzt 3), gehört zu Sprint 1, das Titelfeld ist leer und bleibt offen.',
          tests: ['e2e/usability1.spec.ts › AC5.1 adds a story in a board column with the title only']
        },
        {
          id: 'AC5.2',
          title: 'Mehrere Stories hintereinander',
          link: '#/board',
          target: '[data-status="in_progress"]',
          given: 'Das Titelfeld in der Spalte ist offen.',
          when: 'Ich tippe „Mahnung senden“, Enter, „Mahnung stornieren“, Enter.',
          then: 'Beide Stories stehen in der Spalte, das Feld ist weiter offen.',
          tests: ['e2e/usability1.spec.ts › AC5.2 adds several stories one after the other']
        },
        {
          id: 'AC5.3',
          title: 'Esc schliesst, leere Eingabe legt nichts an',
          link: '#/board',
          target: '[data-status="in_progress"]',
          given: 'Das Titelfeld in der Spalte ist offen.',
          when: 'Ich drücke Enter ohne Text. Dann tippe ich „Entwurf“ und drücke Esc.',
          then: 'Es entsteht keine Story, das Feld ist zu.',
          tests: ['e2e/usability1.spec.ts › AC5.3 closes with Escape and does not add an empty title']
        },
        {
          id: 'AC5.4',
          title: 'Im Backlog in den Sprint oder nach „Nicht geplant“',
          link: '#/backlog',
          target: '[data-sprint-id="sprint-2"]',
          given: 'Ich bin im Backlog.',
          when: 'Ich klicke im Abschnitt „Sprint 2“ auf „+ Story“ und lege „Zahlung per Karte“ an. Dann lege ich im Abschnitt „Nicht geplant“ „Zahlung per TWINT“ an.',
          then: '„Zahlung per Karte“ steht in „Sprint 2“, „Zahlung per TWINT“ in „Nicht geplant“.',
          tests: ['e2e/usability1.spec.ts › AC5.4 adds a story in a backlog section: in the sprint and in "Not planned"']
        },
        {
          id: 'AC5.5',
          title: 'In einer Zelle der Story Map',
          link: '#/map',
          target: '[data-cell="epic-boards::sprint-2"]',
          given: 'Ich bin auf der Story Map.',
          when: 'Ich klicke in der Zelle „Sprint 2“ / „Boards“ auf das „+“, tippe „Spalten ausblenden“ und drücke Enter.',
          then: 'Die Story steht in dieser Zelle: Epic „Boards“, Sprint 2.',
          tests: ['e2e/usability1.spec.ts › AC5.5 adds a story in a cell of the story map with the epic and the sprint of that cell']
        },
        {
          id: 'AC5.6',
          title: 'Pflichtfeld: der volle Dialog öffnet sich',
          link: '#/settings/fields',
          given: 'Für Stories gibt es ein Pflichtfeld ohne Vorgabewert.',
          when: 'Ich lege eine Story im Board per „+ Story“ an.',
          then: 'Der Dialog „Neue Story“ öffnet sich mit dem schon eingetippten Titel und markiert das fehlende Pflichtfeld.',
          tests: ['src/QuickAdd.test.tsx › AC5.6 opens the full dialog with the title when a required field has no default', 'e2e/usability1.spec.ts › AC5.6 opens the full dialog with the title when a required field has no default, in the browser']
        }
      ]
    },
    {
      id: 'AC6',
      story: 'Q3',
      title: '„Hinzufügen und weitere“',
      cases: [
        {
          id: 'AC6.1',
          title: 'Weitere Story mit gleichen Werten anlegen',
          link: '#/map',
          target: '.new-button',
          given: 'Ich habe „Neue Story“ geöffnet, Epic „Boards“, Sprint 2 und 3 Punkte gewählt.',
          when: 'Ich tippe „Karte sortieren“ und klicke „Hinzufügen und weitere“.',
          then: 'Der Dialog bleibt offen, der Titel ist leer, Epic „Boards“, Sprint 2 und 3 Punkte sind noch gewählt. Eine Zeile sagt, dass „Karte sortieren“ hinzugefügt wurde.',
          tests: ['e2e/usability1.spec.ts › AC6.1 adds a story and keeps epic, sprint and points for the next one']
        },
        {
          id: 'AC6.2',
          title: 'Tastenkürzel Strg+Umschalt+Enter',
          link: '#/board',
          target: '.new-button',
          given: 'Ich habe „Neue Story“ geöffnet und einen Titel eingegeben.',
          when: 'Ich drücke Strg+Umschalt+Enter.',
          then: 'Dasselbe wie beim Klick auf „Hinzufügen und weitere“.',
          tests: ['e2e/usability1.spec.ts › AC6.2 does the same with Ctrl+Shift+Enter']
        },
        {
          id: 'AC6.3',
          title: 'Normales Anlegen schliesst weiter',
          link: '#/board',
          target: '.new-button',
          given: 'Ich habe „Neue Story“ geöffnet und einen Titel eingegeben.',
          when: 'Ich klicke „Story hinzufügen“.',
          then: 'Der Dialog schliesst und die Story steht auf dem Board.',
          tests: ['e2e/usability1.spec.ts › AC6.3 still closes the dialog with the normal "Add story"']
        }
      ]
    },
    {
      id: 'AC7',
      story: 'Q6',
      title: 'Übersicht der Tastenkürzel',
      cases: [
        {
          id: 'AC7.1',
          title: 'Strg+/ öffnet die Übersicht',
          link: '#/board',
          target: 'button[aria-keyshortcuts^="Control+/"]',
          given: 'Ich bin auf dem Board.',
          when: 'Ich drücke Strg+/ (auf dem Bildschirm steht „Ctrl+/“).',
          then: 'Ein Dialog „Tastenkürzel“ zeigt zuerst die Kürzel des Boards und darunter die allgemeinen.',
          tests: ['e2e/usability1.spec.ts › AC7.1 opens the overview with Ctrl+/, the shortcuts of the page first']
        },
        {
          id: 'AC7.2',
          title: 'Mit dem Knopf im Kopf öffnen und mit Esc schliessen',
          link: '#/backlog',
          target: 'button[aria-keyshortcuts^="Control+/"]',
          given: 'Ich bin im Backlog.',
          when: 'Ich klicke im Kopf auf das Tastatur-Symbol und danach auf Esc.',
          then: 'Die Übersicht öffnet und schliesst; der Fokus liegt wieder auf dem Symbol.',
          tests: ['e2e/usability1.spec.ts › AC7.2 opens from the keyboard button in the header and closes with Escape, the focus returns']
        },
        {
          id: 'AC7.3',
          title: 'Nur Kürzel, die es gibt, und passend zur Seite',
          link: '#/epics',
          target: 'button[aria-keyshortcuts^="Control+/"]',
          given: 'Ich öffne die Übersicht auf dem Board und danach auf der Seite Epics.',
          when: 'Ich vergleiche beide.',
          then: 'Auf dem Board stehen Karte öffnen, Karte ziehen und Menü; auf Epics fehlen die Karten-Kürzel. Beide nennen Ctrl+N bzw. Ctrl+F und Ctrl+/ (auf dem Bildschirm steht immer „Ctrl“).',
          tests: ['e2e/usability1.spec.ts › AC7.3 lists only shortcuts that exist and only those that fit the page']
        }
      ]
    },
    {
      id: 'AC8',
      story: 'F1',
      title: 'Hinweise nach Aktionen',
      cases: [
        {
          id: 'AC8.1',
          title: 'Hinweis nach dem Anlegen',
          link: '#/board',
          target: '.new-button',
          given: 'Ich bin auf dem Board.',
          when: 'Ich lege die Story „Passwort zurücksetzen“ an.',
          then: 'Unten erscheint der Hinweis „S-8 „Passwort zurücksetzen“ hinzugefügt“ (die Nummer folgt der letzten Story).',
          tests: ['e2e/usability1.spec.ts › AC8.1 shows a notice after a story was added']
        },
        {
          id: 'AC8.2',
          title: 'Hinweis nach dem Verschieben',
          link: '#/board',
          target: '[data-story-id="story-3"]',
          given: '„S-3“ steht in „Offen“.',
          when: 'Ich ziehe „S-3“ nach „Erledigt“. Danach verschiebe ich „S-6“ über das Menü nach „In Arbeit“.',
          then: 'Zuerst erscheint „S-3 nach Erledigt verschoben“, dann „S-6 nach In Arbeit verschoben“.',
          tests: ['e2e/usability1.spec.ts › AC8.2 shows a notice after a story was moved by dragging and through the menu']
        },
        {
          id: 'AC8.3',
          title: 'Der Hinweis verschwindet von selbst',
          link: '#/board',
          target: '[data-story-id="story-3"]',
          given: 'Ein Hinweis ist sichtbar.',
          when: 'Ich warte etwa 5 Sekunden. Beim nächsten Hinweis halte ich die Maus darauf.',
          then: 'Der erste Hinweis verschwindet. Solange die Maus auf dem zweiten liegt, bleibt er stehen und verschwindet danach.',
          tests: ['e2e/usability1.spec.ts › AC8.3 lets a notice go away by itself, but not while the pointer is on it']
        },
        {
          id: 'AC8.4',
          title: 'Screenreader hört den Hinweis',
          link: '#/board',
          target: '.new-button',
          given: 'Ich benutze einen Screenreader.',
          when: 'Ich lege eine Story an.',
          then: 'Der Screenreader liest den Hinweis vor, ohne dass ich den Fokus verschiebe.',
          tests: ['e2e/usability1.spec.ts › AC8.4 puts notices into a polite live region for screen readers'],
          manual: 'Die Ansage durch einen echten Screenreader lässt sich nicht automatisch prüfen; automatisch geprüft wird nur der Bereich für Ansagen.'
        }
      ]
    },
    {
      id: 'AC9',
      story: 'F2',
      title: 'Neues und Verschobenes wird hervorgehoben',
      cases: [
        {
          id: 'AC9.1',
          title: 'Neue Story ist sofort zu sehen',
          link: '#/backlog',
          target: '.new-button',
          given: 'Der Abschnitt „Nicht geplant“ ist so lang, dass ich nach unten scrollen muss (Fenster niedrig machen).',
          when: 'Ich lege dort per „+ Story“ eine Story an.',
          then: 'Die Seite scrollt so, dass die neue Zeile sichtbar ist; sie hat etwa 2 Sekunden einen grünen Rahmen.',
          tests: ['e2e/usability1.spec.ts › AC9.1 scrolls a new story into view and frames it in green for about two seconds']
        },
        {
          id: 'AC9.2',
          title: 'Verschobene Story wird hervorgehoben',
          link: '#/board',
          target: '[data-story-id="story-3"]',
          given: '„S-3“ steht in „Offen“.',
          when: 'Ich verschiebe „S-3“ per Menü nach „Review“.',
          then: '„S-3“ in „Review“ hat etwa 2 Sekunden einen grünen Rahmen.',
          tests: ['e2e/usability1.spec.ts › AC9.2 frames a moved story in green for about two seconds']
        },
        {
          id: 'AC9.3',
          title: 'Mit „Bewegung reduzieren“ ohne Animation',
          link: '#/board',
          target: '[data-story-id="story-3"]',
          given: 'Mein Betriebssystem ist auf „Bewegung reduzieren“ gestellt.',
          when: 'Ich verschiebe „S-3“ per Menü.',
          then: 'Der grüne Rahmen erscheint, aber die Seite scrollt nicht animiert.',
          tests: ['e2e/usability1.spec.ts › AC9.3 shows the frame without animation when "reduce motion" is set'],
          manual: 'Das Gefühl der Animation ist visuell; automatisch geprüft wird, dass bei „Bewegung reduzieren“ keine Animation läuft und der Rahmen da ist.'
        }
      ]
    },
    {
      id: 'AC10',
      story: 'F4',
      title: 'Leere Zustände bieten die nächste Aktion an',
      cases: [
        {
          id: 'AC10.1',
          title: 'Leere Board-Spalte',
          link: '#/board',
          target: '[data-status="done"]',
          given: 'Das Board zeigt Sprint 1; in der Spalte „Erledigt“ steht nur „S-5“.',
          when: 'Ich verschiebe „S-5“ nach „Offen“.',
          then: '„Erledigt“ zeigt „Story hier ablegen“ und darunter „+ Story“.',
          tests: ['e2e/usability1.spec.ts › AC10.1 offers "+ Story" in an empty board column']
        },
        {
          id: 'AC10.2',
          title: 'Leerer Sprint im Backlog',
          link: '#/backlog',
          target: '[data-sprint-id="sprint-2"]',
          given: '„Sprint 2“ hat keine Stories.',
          when: 'Ich schaue auf den Abschnitt „Sprint 2“.',
          then: 'Er erklärt, dass Stories hierher gezogen werden können, und bietet „+ Story“ an.',
          tests: ['e2e/usability1.spec.ts › AC10.2 offers "+ Story" in an empty sprint of the backlog']
        },
        {
          id: 'AC10.3',
          title: 'Seite ohne Epics',
          link: '#/epics',
          target: '.new-button',
          given: 'Es gibt kein Epic.',
          when: 'Ich öffne die Seite Epics.',
          then: 'Sie zeigt „Noch keine Epics.“ und den Knopf „Neues Epic Ctrl+N“.',
          tests: ['e2e/usability1.spec.ts › AC10.3 shows the text and the "New epic" button on an epics page without epics']
        }
      ]
    },
    {
      id: 'AC11',
      story: 'Abnahme',
      title: 'Abnahme in der Preview: Schritt für Schritt',
      cases: [
        {
          id: 'AC11.1',
          title: 'Ein Prüfpunkt auf einmal, mit dem Überblick aller Punkte',
          link: '#/board',
          target: '.acceptance__toggle',
          given: 'Ich öffne die Preview dieses Pull Requests.',
          when: 'Ich klicke unten auf den runden Knopf „Abnahme“.',
          then: 'Ein Popup zeigt „Schritt 1“ mit Ausgangslage, Aktion und Erwartung des ersten Prüfpunkts, und oben einen Streifen mit einem Feld pro Prüfpunkt.',
          tests: ['e2e/usability1.spec.ts › AC11.1 shows one test case at a time with a strip of all of them']
        },
        {
          id: 'AC11.2',
          title: '„In Ordnung“ geht zum nächsten Punkt und springt zur Seite',
          link: '#/board',
          target: '.acceptance__toggle',
          given: 'Das Popup zeigt Schritt 1 (AC1.1) auf dem Board.',
          when: 'Ich klicke „In Ordnung“.',
          then: 'AC1.1 ist grün im Streifen, das Popup zeigt Schritt 2 (AC1.2), die Seite wechselt zum Backlog und die Zeile „S-3“ leuchtet auf.',
          tests: ['e2e/usability1.spec.ts › AC11.2 marks "In Ordnung", goes to the next test case and jumps to its page']
        },
        {
          id: 'AC11.3',
          title: 'Problem mit Kommentar, auch nach dem Neuladen',
          link: '#/board',
          target: '.acceptance__toggle',
          given: 'Das Popup zeigt einen Prüfpunkt.',
          when: 'Ich klicke „Problem“, schreibe einen Kommentar und lade die Seite neu.',
          then: 'Das Feld im Streifen ist rot, der Kommentar steht noch da, die Zeile „… Problem“ im Status zählt mit, und das Popup öffnet beim selben Schritt.',
          tests: ['e2e/usability1.spec.ts › AC11.3 keeps a problem with its comment after a reload, at the same step']
        },
        {
          id: 'AC11.4',
          title: 'Ergebnis als Text kopieren',
          link: '#/board',
          target: '.acceptance__toggle',
          given: 'Ich habe einige Prüfpunkte als „In Ordnung“ oder „Problem“ markiert.',
          when: 'Ich klicke „Ergebnis kopieren“ und füge den Text in den Chat mit Claude ein.',
          then: 'Der Text nennt zuerst den Stand („12 von 47 in Ordnung, 2 Probleme“), dann jedes Problem mit Erwartung und meinem Kommentar, meine übrigen Kommentare, und die Nummern der Punkte, die in Ordnung oder noch offen sind. Claude braucht nichts nachzuschlagen.',
          tests: ['e2e/usability1.spec.ts › AC11.4 copies the result as text for the chat with the AI']
        },
        {
          id: 'AC11.5',
          title: 'Nur in der Preview sichtbar',
          link: '#/board',
          given: 'Ich öffne die App als Desktop-App oder die Hauptversion (getthingsdone.onrender.com).',
          when: 'Ich schaue unten links.',
          then: 'Es gibt keinen „Abnahme“-Knopf.',
          tests: ['e2e/usability1.spec.ts › AC11.5 does not show the panel without the preview address', 'src/acceptance/preview.test.ts › AC11.5 recognises the pull request previews and nothing else', 'src/acceptance/preview.test.ts › AC11.5 shows in a preview, with ?acceptance=1, never in the desktop app and not on main'],
          poCheck: 'Hauptversion (getthingsdone.onrender.com) öffnen: Es darf keinen „Abnahme“-Knopf geben. Wenn möglich auch in der Windows-App.',
          manual: 'Die Hauptversion und die Desktop-App kann nur der PO selbst öffnen; automatisch geprüft wird die Erkennung der Adresse.'
        },
        {
          id: 'AC11.6',
          title: 'Der Prüfpunkt leuchtet auf der Seite auf',
          link: '#/board',
          target: '[data-story-id="story-3"]',
          given: 'Das Popup zeigt einen Prüfpunkt, hier AC1.1, und ich bin auf einer anderen Seite.',
          when: 'Ich klicke „Zur Seite und markieren“.',
          then: 'Das Board öffnet sich und die Karte „S-3“, um die es geht, leuchtet etwa 3 Sekunden magenta auf. Das Popup rückt auf die Seite, auf der nichts leuchtet.',
          tests: ['e2e/usability1.spec.ts › AC11.6 lights up what is to be tested and moves the popup to the other side']
        },
        {
          id: 'AC11.7',
          title: 'Runder Knopf mit Fortschrittsring, klar anders als die App',
          link: '#/board',
          target: '.acceptance__toggle',
          given: 'Ich öffne die Preview.',
          when: 'Ich öffne und schliesse das Popup und schaue auf den Knopf.',
          then: 'Der Knopf ist rund und magenta, hat einen Ring, der sich mit dem Fortschritt füllt, eine Marke mit dem Stand (zum Beispiel „12/48“) und daneben das Wort „Preview“. Das Popup liegt über der Seite, die Seite verschiebt sich nicht.',
          tests: ['e2e/usability1.spec.ts › AC11.7 shows a round button with a progress ring and the Preview tag; the popup does not move the page'],
          poCheck: 'Sieht der Knopf klar anders aus als die App und gefällt dir die Form (rund, magenta, Ring, „Preview“)?',
          manual: 'Ob der Knopf klar anders aussieht, beurteilt der PO; automatisch geprüft wird, dass sich die Seite nicht verschiebt und der Knopf die Preview-Kennzeichnung trägt.'
        },
        {
          id: 'AC11.8',
          title: 'Alle Punkte anzeigen und direkt zu einem springen',
          link: '#/board',
          target: '.acceptance__toggle',
          given: 'Das Popup zeigt Schritt 1.',
          when: 'Ich klicke „Alle Punkte anzeigen“ und dann auf „AC4.2“. Danach klicke ich im Streifen auf das erste Feld.',
          then: 'Die Liste zeigt alle Prüfpunkte nach Kriterium mit ihrem Stand. Ein Klick darauf oder auf ein Feld im Streifen springt zu diesem Schritt und zur passenden Seite.',
          tests: ['e2e/usability1.spec.ts › AC11.8 shows all test cases and jumps to one, from the list and from the strip']
        },
        {
          id: 'AC11.9',
          title: 'Standardmässig nur die Punkte, die du prüfen musst',
          link: '#/board',
          target: '.acceptance__toggle',
          given: 'Ich öffne die Abnahme zum ersten Mal.',
          when: 'Ich schaue auf den Schritt und den Streifen. Dann hake ich „Auch automatisch geprüfte Punkte zeigen“ an.',
          then: 'Zuerst gibt es nur die wenigen Punkte mit dem Hinweis „Das prüfst du:“, im Ergebnis steht, wie viele Punkte automatisch abgedeckt sind. Nach dem Haken sind alle Punkte da; automatisch geprüfte sind als solche gekennzeichnet.',
          tests: ['e2e/usability1.spec.ts › AC11.9 shows only the test cases for the PO by default and all of them on request']
        }
      ]
    },
    {
      id: 'AC12',
      story: 'Gesamteindruck',
      title: 'Was nur du beurteilen kannst',
      cases: [
        {
          id: 'AC12.1',
          title: 'Aussehen und deutsche Texte der neuen Elemente',
          link: '#/board',
          given: 'Die App ist auf Deutsch gestellt.',
          when: 'Ich schaue mir einmal an: Kontextmenü (Rechtsklick auf eine Karte), „+ Story“ in einer Spalte, den Hinweis nach dem Anlegen, die grüne Hervorhebung, die Kürzel-Übersicht (Ctrl+/), eine leere Spalte, den Dialog „Neue Story“ und die neuen Hilfe-Themen („Story über das Menü ändern“, „Stories schnell anlegen“, Tastenkürzel) mit „Zeig es mir“.',
          then: 'Alles sieht stimmig aus, die Texte sind verständlich und gutes Deutsch.',
          tests: [],
          manual: 'Aussehen und Wortwahl kann kein Test beurteilen; die Texte der anderen Sprachen (FR, IT) sind nur auf vollständige Schlüssel geprüft.',
          poCheck: 'Einmal durchklicken (siehe „Ich mache“) und sagen, was nicht gefällt oder holpert.'
        },
        {
          id: 'AC12.2',
          title: 'Die neuen Bedienungen in der Windows-App',
          link: '#/board',
          given: 'Ich habe die Windows-App aus dem Pull Request gestartet.',
          when: 'Ich klicke mit rechts auf eine Karte, drücke Ctrl+N, Ctrl+/ und Ctrl+Enter in einem Dialog.',
          then: 'Das Menü öffnet sich, die Dialoge und die Kürzel-Übersicht erscheinen, und Windows oder die App fängt die Tasten nicht ab.',
          tests: [],
          manual: 'Die Windows-App mit ihrem eigenen Browser-Fenster (WebView2) läuft nicht in den automatischen Tests; dort ist nur der Web-Build in Chromium geprüft.',
          poCheck: 'Kurz in der Windows-App ausprobieren (Link zum Build im Pull Request).'
        }
      ]
    },
    {
      id: 'AC13',
      story: 'Hilfe',
      title: 'Die Hilfe kennt die neuen Funktionen',
      cases: [
        {
          id: 'AC13.1',
          title: 'Hilfe-Thema zum Menü einer Story',
          link: '#/board',
          target: '.help-btn',
          given: 'Die Hilfe ist auf dem Board offen.',
          when: 'Ich suche nach „Rechtsklick“ und öffne das Thema „Story über das Menü ändern“ und klicke auf „Zeig es mir“.',
          then: 'Eine Karte wird markiert, und der Text erklärt Rechtsklick, Menütaste und Pfeiltasten.',
          tests: ['src/Help.test.tsx › AC13.1 finds the topic about the context menu by "right click" and frames a card']
        },
        {
          id: 'AC13.2',
          title: 'Hilfe-Thema zum schnellen Anlegen',
          link: '#/board',
          target: '.help-btn',
          given: 'Die Hilfe ist auf dem Board offen.',
          when: 'Ich öffne das Thema „Stories schnell anlegen“ und klicke auf „Zeig es mir“.',
          then: 'Das erste „+ Story“ wird markiert, und der Text erklärt, dass nur der Titel gefragt wird.',
          tests: ['src/Help.test.tsx › AC13.2 frames the "+ Story" of a column for the topic about adding stories quickly']
        },
        {
          id: 'AC13.3',
          title: 'Neue Tastenkürzel in der Hilfe',
          link: '#/board',
          target: '.help-btn',
          given: 'Die Hilfe ist offen.',
          when: 'Ich öffne das Thema „Tastenkürzel“.',
          then: 'Es nennt auch Strg+/ (alle Kürzel), Strg+Enter, Strg+Umschalt+Enter und Umschalt+F10 (Menü).',
          tests: ['src/Help.test.tsx › AC13.3 lists the new keyboard shortcuts in the topic about shortcuts']
        }
      ]
    }
  ]
};
