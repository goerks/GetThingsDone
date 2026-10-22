import type { Criterion } from './types';

/**
 * Design system (#70): the acceptance criteria and their test cases for the product owner, in German.
 * One source for the issue comment, the acceptance panel of the preview and the names of the automated tests
 * (`src/DesignSystem.test.tsx`, `src/styles/designSystem.test.ts`, `src/test/designSystemRules.test.ts`, `e2e/designSystem.spec.ts`).
 * The catalogue is the page `/design-system/` next to the app.
 */
export const PACKAGE_70: { issue: number; pullRequest: number; title: string; criteria: Criterion[] } = {
  issue: 70,
  pullRequest: 71,
  title: 'Design System',
  criteria: [
    {
      id: 'AC1',
      story: 'S3',
      title: 'Das Design System ist im Katalog dokumentiert',
      cases: [
        {
          id: 'AC1.1',
          title: 'Grundlagen im Katalog finden',
          link: '#/board',
          given: 'Ich öffne den Katalog: Adresse dieser Vorschau, am Ende «/design-system/».',
          when: 'Ich öffne nacheinander die Seiten Colors, Typography, Spacing, Radius, Elevation, Layers, Motion, Icons und Accessibility.',
          then: 'Jede Seite zeigt ihre Werte mit Namen, Beispiel und Einsatzzweck (zum Beispiel «Akzentfarbe: für Hauptaktionen»).',
          tests: ['src/DesignSystem.test.tsx › AC1.1 the page "%s" shows its values with names'],
          manual: 'Das Aussehen der Seiten beurteilt nur eine Person.',
          poCheck: 'Sind die Seiten verständlich und vollständig?'
        },
        {
          id: 'AC1.2',
          title: 'Hell und Dunkel umschalten',
          link: '#/board',
          given: 'Katalog, Seite «Colors» ist offen.',
          when: 'Ich schalte oben zwischen Hell und Dunkel um.',
          then: 'Alle Farbfelder wechseln auf die Werte des gewählten Themes; kein Feld bleibt unlesbar.',
          tests: ['src/DesignSystem.test.tsx › AC1.2 every colour of the catalogue has a light and a dark value'],
          manual: 'Lesbarkeit der Felder beurteilt nur eine Person.',
          poCheck: 'Bleibt in beiden Themes jedes Feld lesbar?'
        },
        {
          id: 'AC1.3',
          title: 'Jeder Baustein mit allen Varianten und Zuständen',
          link: '#/board',
          given: 'Katalog, Bereich «Components».',
          when: 'Ich öffne nacheinander Button, IconButton, Form fields, Badge and pill und Dialog.',
          then: 'Jeder Baustein zeigt alle Varianten und Zustände (Normal, Hover, Fokus, Gedrückt, Deaktiviert, Fehler) in Hell und Dunkel.',
          tests: [
            'src/DesignSystem.test.tsx › AC1.3 shows every button variant in the normal, small, pressed and disabled state',
            'src/DesignSystem.test.tsx › AC1.3 has a hover and a focus story for the button, and the keyboard focuses it',
            'src/DesignSystem.test.tsx › AC1.3 shows the icon button, form fields, checks, badge and pill with their states'
          ],
          manual: 'Das Aussehen der Zustände beurteilt nur eine Person.',
          poCheck: 'Fehlt ein Baustein, eine Variante oder ein Zustand?'
        },
        {
          id: 'AC1.4',
          title: 'Nur Tastatur',
          link: '#/board',
          given: 'Katalog, Seite «Button».',
          when: 'Ich bewege mich nur mit der Tab-Taste durch die Beispiele.',
          then: 'Der Fokusring ist bei jedem Element sichtbar, und die Reihenfolge ist logisch.',
          tests: [],
          manual: 'Ein Blick auf den Fokusring lässt sich nicht automatisch prüfen.',
          poCheck: 'Ist der Fokusring überall sichtbar?'
        }
      ]
    },
    {
      id: 'AC2',
      story: 'S1',
      title: 'Der Katalog ist aus dem echten Code gebaut und pro Pull Request erreichbar',
      cases: [
        {
          id: 'AC2.1',
          title: 'Katalog ist aus dem echten Code gebaut',
          link: '#/board',
          given: 'Der Button «Primär» im Katalog und derselbe Button in der App (zum Beispiel «New story»).',
          when: 'Ich öffne beide nebeneinander.',
          then: 'Beide sehen identisch aus (gleiche Farbe, Grösse, Rundung).',
          tests: ['src/DesignSystem.test.tsx › AC2.1 every class a component renders exists in the style sheet of the app'],
          manual: 'Der Vergleich der Optik beurteilt nur eine Person.',
          poCheck: 'Sehen Katalog und App gleich aus?'
        },
        {
          id: 'AC2.2',
          title: 'Katalog pro Pull Request erreichbar',
          link: '#/board',
          given: 'Der Pull Request ist bereit zur Abnahme.',
          when: 'Ich öffne den Katalog-Link (Adresse der Vorschau + «/design-system/»).',
          then: 'Der Katalog lädt ohne Anmeldung und zeigt den Stand dieses Pull Requests; die Web-Vorschau funktioniert weiterhin.',
          tests: ['src/test/designSystemRules.test.ts › AC2.2 npm run build also builds the catalogue next to the web app, the desktop app does not'],
          manual: 'Ob die Vorschau den Katalog ausliefert, hängt von der Einrichtung bei Render ab.',
          poCheck: 'Lädt der Katalog ohne Anmeldung?'
        }
      ]
    },
    {
      id: 'AC3',
      story: 'S7',
      title: 'Die App nutzt nur Tokens und gemeinsame Bausteine',
      cases: [
        {
          id: 'AC3.1',
          title: 'App sieht unverändert aus',
          link: '#/board',
          target: '.board',
          given: 'Web-Vorschau dieses Pull Requests und die Seite «main» nebeneinander, Demo-Daten.',
          when: 'Ich öffne nacheinander Backlog, Board, Story Map, Releases, Einstellungen, Hilfe, eine Story, einen Dialog und das Kontextmenü, in Hell und Dunkel.',
          then: 'Die Seiten sehen aus wie vorher, ausser bei den freigegebenen Vereinheitlichungen (AC4). Alle Funktionen arbeiten wie zuvor, zum Beispiel eine Story per Drag & Drop in «Done» ziehen.',
          tests: ['e2e/designSystem.spec.ts › AC3.1 moves a story to Done by drag and drop, as before'],
          manual: 'Den optischen Vergleich mit «main» macht nur eine Person.',
          poCheck: 'Sieht die App aus wie vorher?'
        },
        {
          id: 'AC3.2',
          title: 'Keine Rohwerte mehr (automatisch geprüft)',
          link: '#/board',
          given: 'Der Code dieses Pull Requests.',
          when: 'Nichts: ein Test sucht nach festen Werten.',
          then: 'Ausserhalb der Token-Datei gibt es keine festen Farben, Schriftgrössen, Rundungen, Abstände und Ebenen mehr.',
          tests: [
            'src/styles/designSystem.test.ts › AC3.2 colours come from tokens: no hex, rgb or rgba outside the token file',
            'src/styles/designSystem.test.ts › AC3.2 font sizes, line heights, weights and radii come from tokens',
            'src/styles/designSystem.test.ts › AC3.2 spacings come from tokens (gaps, padding, margins and offsets)',
            'src/styles/designSystem.test.ts › AC3.2 layers, shadows and durations come from tokens'
          ]
        },
        {
          id: 'AC3.3',
          title: 'Bedienung per Tastatur und Sprache bleibt',
          link: '#/board',
          given: 'Web-Vorschau, Sprache Deutsch.',
          when: 'Ich öffne und schliesse einen Dialog nur mit der Tastatur (Tab, Enter, Esc) und wechsle die Sprache auf Englisch, Französisch und Italienisch.',
          then: 'Alles funktioniert wie vorher; alle Texte erscheinen in der gewählten Sprache.',
          tests: ['e2e/designSystem.spec.ts › AC3.3 opens and closes a dialog with the keyboard only and follows a language switch']
        }
      ]
    },
    {
      id: 'AC4',
      story: 'S4',
      title: 'Vereinheitlichung nur nach Freigabe',
      cases: [
        {
          id: 'AC4.1',
          title: 'Vereinheitlichung nur nach Freigabe',
          link: '#/board',
          given: 'Im Ticket steht, welche Varianten zusammengelegt wurden (zwei Link-Buttons wurden zu «TextButton»).',
          when: 'Ich vergleiche das mit der Vorschau.',
          then: 'Jede sichtbare Änderung steht im Ticket; was grösser abweicht, hatte ich freigegeben.',
          tests: [],
          manual: 'Der Vergleich mit dem Ticket ist eine Prüfung durch eine Person.',
          poCheck: 'Stimmen die Änderungen mit dem Ticket überein?'
        }
      ]
    },
    {
      id: 'AC5',
      story: 'S12',
      title: 'Die Einhaltung ist verbindlich',
      cases: [
        {
          id: 'AC5.1',
          title: 'Pflicht in den Regeln',
          link: '#/board',
          given: 'Pull Request, Dateien «CLAUDE.md», «Definition of Done», «Arbeitsmodell».',
          when: 'Ich lese die neuen Abschnitte.',
          then: 'Es steht klar: Jedes neue Feature nutzt das Design System; fehlt ein Baustein oder Wert, kommt er im selben Pull Request mit Beispiel in den Katalog.',
          tests: ['src/test/designSystemRules.test.ts › AC5.1 CLAUDE.md, the Definition of Done and the working mode require the design system'],
          manual: 'Ob die Regeln klar formuliert sind, beurteilt nur eine Person.',
          poCheck: 'Sind die Regeln klar und streng genug?'
        },
        {
          id: 'AC5.2',
          title: 'Pflicht in der Pull-Request-Beschreibung',
          link: '#/board',
          given: 'Die Beschreibung dieses Pull Requests.',
          when: 'Ich suche den Punkt «Design System Adherence».',
          then: 'Der Punkt ist als Haken in der Liste enthalten, mit Link zum Katalog.',
          tests: ['src/test/designSystemRules.test.ts › AC5.2 the pull request template has the entry "Design system adherence" with the link to the catalogue']
        }
      ]
    },
    {
      id: 'AC6',
      story: 'S1',
      title: 'Der Katalog ist auf GitHub Pages veröffentlicht',
      cases: [
        {
          id: 'AC6.1',
          title: 'Katalog ist öffentlich erreichbar',
          link: '#/board',
          given: 'Der Pull Request ist in «main» gemerged und «Pages» ist auf GitHub eingeschaltet.',
          when: 'Ich öffne https://goerks.github.io/GetThingsDone/ im Browser, ohne Anmeldung.',
          then: 'Der Katalog lädt und zeigt dieselben Seiten wie in der Vorschau (Grundlagen und Bausteine, Hell/Dunkel-Umschalter).',
          tests: ['src/test/designSystemRules.test.ts › AC6.1 the catalogue is published on GitHub Pages after every change of main'],
          manual: 'Erst nach dem Merge und der einmaligen Einstellung «Pages» auf GitHub prüfbar.',
          poCheck: 'Nach dem Merge: Lädt die öffentliche Adresse?'
        },
        {
          id: 'AC6.2',
          title: 'Katalog ist verlinkt',
          link: '#/board',
          given: 'Datei «README» und Seite «Design system» im Repository.',
          when: 'Ich suche den Link zum Katalog.',
          then: 'In beiden steht die öffentliche Adresse des Katalogs.',
          tests: ['src/test/designSystemRules.test.ts › AC6.2 the README and the design system page link the public catalogue']
        },
        {
          id: 'AC6.3',
          title: 'Neuer Stand nach jedem Merge',
          link: '#/board',
          given: 'Ein weiterer Pull Request ändert einen Baustein und wird gemerged.',
          when: 'Ich öffne den Katalog nach dem Merge neu.',
          then: 'Er zeigt die Änderung.',
          tests: ['src/test/designSystemRules.test.ts › AC6.1 the catalogue is published on GitHub Pages after every change of main'],
          manual: 'Braucht einen weiteren Merge.',
          poCheck: 'Zeigt der Katalog nach dem nächsten Merge den neuen Stand?'
        }
      ]
    },
    {
      id: 'AC7',
      story: 'S9',
      title: 'Das Design System wird automatisch abgesichert',
      cases: [
        {
          id: 'AC7.1',
          title: 'Kontrast aller Farbpaare',
          link: '#/board',
          given: 'Die Farben der Token-Datei in Hell und Dunkel.',
          when: 'Nichts: ein Test prüft Text auf Flächen und Epic-Farben auf Karten und Spalten.',
          then: 'Alle Paare erreichen mindestens 4,5:1 (Text) beziehungsweise 3:1 (Epic-Farben). Wird ein Paar schlechter, schlägt die Prüfung fehl.',
          tests: [
            'src/styles/contrast.test.ts › AC7.1 text and surfaces reach 4.5:1 in the ${theme} theme',
            'src/styles/contrast.test.ts › AC7.1 epic colours reach 3:1 on cards and columns in the ${theme} theme'
          ]
        },
        {
          id: 'AC7.2',
          title: 'Barrierefreiheit pro Baustein',
          link: '#/board',
          given: 'Jeder Baustein im Katalog, in Hell und Dunkel.',
          when: 'Nichts: die Prüfung läuft bei jedem Push.',
          then: 'Es gibt keine Verstösse. Baue ich absichtlich einen Button ohne Namen ein, schlägt die Prüfung fehl.',
          tests: ['e2e/designSystemStories.spec.ts › AC7.2 every story of the catalogue passes the accessibility check in the ${theme} theme']
        },
        {
          id: 'AC7.3',
          title: 'Bildvergleich pro Baustein',
          link: '#/board',
          given: 'Jeder Baustein im Katalog, in Hell und Dunkel, mit Referenzbild.',
          when: 'Nichts: die Prüfung läuft bei jedem Push.',
          then: 'Ändert sich das Aussehen eines Bausteins, schlägt die Prüfung fehl, bis die Änderung bewusst als neue Referenz übernommen wird.',
          tests: ['e2e/designSystemStories.spec.ts › AC7.3 every story of the catalogue looks like its reference image in the ${theme} theme']
        }
      ]
    },
    {
      id: 'AC8',
      story: 'S8',
      title: 'Alle Bedienelemente kommen aus den gemeinsamen Bausteinen',
      cases: [
        {
          id: 'AC8.1',
          title: 'App sieht gleich aus und funktioniert gleich',
          link: '#/board',
          given: 'Web-Vorschau und «main» nebeneinander, Demo-Daten.',
          when: 'Ich bediene Karten, Filter-Chips, Griffe zum Verschieben, Umschalter und Kontrollkästchen auf Backlog, Board, Story Map, Einstellungen und Hilfe.',
          then: 'Alles sieht aus und funktioniert wie vorher: Story per Drag & Drop in «Done» ziehen, Filter umschalten, Einstellung ein- und ausschalten.',
          tests: ['e2e/designSystem.spec.ts › AC8.1 switches a feature on and off, opens the help and keeps working as before'],
          manual: 'Den optischen Vergleich mit «main» macht nur eine Person.',
          poCheck: 'Sieht die App aus und verhält sie sich wie vorher?'
        },
        {
          id: 'AC8.2',
          title: 'Keine rohen Bedienelemente mehr (automatisch geprüft)',
          link: '#/board',
          given: 'Der Code der App.',
          when: 'Nichts: ein Test sucht nach rohen Tags.',
          then: 'Ausserhalb des Ordners der gemeinsamen Bausteine gibt es keine rohen Buttons und Eingabefelder. Ein neues rohes Element lässt den Test fehlschlagen.',
          tests: ['src/styles/designSystem.test.ts › AC8.2 buttons and form fields come from src/ui, no raw tags elsewhere']
        }
      ]
    }
  ]
};
