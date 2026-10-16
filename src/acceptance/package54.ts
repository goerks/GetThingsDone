import type { Criterion } from './types';

/**
 * Estimating with cards (#54): the acceptance criteria and their test cases for the product owner, in German.
 * One source for the issue comment, the acceptance panel of the preview and the names of the automated tests.
 * The cases use the demo data of the preview: S-3 "Reorder the backlog by priority" has 5 points, S-1 and S-5 have 3
 * points, and S-1 is the reference of the card 3. Where the approved text names other stories ("Login-Seite",
 * "Profilbild hochladen"), the case uses the stories of the demo data instead.
 */
export const PACKAGE_54: { issue: number; pullRequest: number; title: string; criteria: Criterion[] } = {
  issue: 54,
  pullRequest: 0,
  title: 'Schätzung mit Karten',
  criteria: [
    {
      id: 'AC1',
      story: 'E-1',
      title: 'Neue Story ist ungeschätzt',
      cases: [
        {
          id: 'AC1.1',
          title: 'Neue Story ist ungeschätzt (Dialog „Neue Story“)',
          link: '#/backlog',
          target: '.page-head__action',
          given: 'Ich bin im Backlog.',
          when: 'Ich lege die Story „Profilbild hochladen“ über „Neue Story“ an.',
          then: 'Die Story hat einen gestrichelten Pill mit einem Strich statt einer Zahl. Es steht keine „1“ oder andere Zahl da.',
          tests: [
            'src/Estimation.test.tsx › AC1.1 creates a story from the New story dialog without an estimate',
            'e2e/estimation.spec.ts › AC1.1 creates a story with "New story" without an estimate',
            'src/domain/estimation.test.ts › AC1.1 is not estimated when no points are given'
          ],
          poCheck: 'Bitte einmal ansehen: Ist der gestrichelte Pill mit dem Strich ruhig und gut erkennbar, auch im dunklen Modus?'
        },
        {
          id: 'AC1.2',
          title: 'Neue Story ist ungeschätzt (Schnell hinzufügen)',
          link: '#/board',
          target: '.quick-add',
          given: 'Ich bin auf dem Board.',
          when: 'Ich füge „Passwort-Reset“ über „+ Story“ in der Spalte „To do“ hinzu.',
          then: 'Auch diese Story zeigt den gestrichelten Pill mit Strich.',
          tests: [
            'src/Estimation.test.tsx › AC1.2 creates a story with the quick add without an estimate',
            'e2e/estimation.spec.ts › AC1.2 adds a story with the quick add without an estimate'
          ]
        },
        {
          id: 'AC1.3',
          title: 'Ungeschätzt bleibt nach dem Neuladen',
          link: '#/board',
          target: '.pill--none',
          given: 'Die Story „Profilbild hochladen“ ist ungeschätzt.',
          when: 'Ich lade die App neu.',
          then: '„Profilbild hochladen“ ist weiterhin ungeschätzt.',
          tests: [
            'src/Estimation.test.tsx › AC1.3 keeps a new story not estimated after the app is loaded again',
            'e2e/estimation.spec.ts › AC1.3 keeps a new story not estimated after a reload'
          ]
        }
      ]
    },
    {
      id: 'AC2',
      story: 'E-2',
      title: 'Mit Karten schätzen',
      cases: [
        {
          id: 'AC2.1',
          title: 'Story mit einer Fibonacci-Karte schätzen',
          link: '#/backlog',
          target: '.backlog__row',
          given: 'Ich öffne die Story „Reorder the backlog by priority“ (S-3). Das Feld „Punkte“ zeigt die Karten 1, 2, 3, 5, 8, 13, 21, ? und ☕.',
          when: 'Ich wähle die Karte „3“.',
          then: 'Die Karte „3“ ist hervorgehoben. Im Backlog und auf dem Board zeigt die Story „3“, auch nach dem Neuladen.',
          tests: [
            'src/Estimation.test.tsx › AC2.1 estimates a story by choosing the Fibonacci card 3',
            'e2e/estimation.spec.ts › AC2.1 estimates a story with the card 3 and keeps it after a reload',
            'src/domain/estimation.test.ts › AC2.1 sets a number card and clears a special card'
          ],
          poCheck: 'Bitte einmal ansehen: Passen Aussehen und Platz der Kartenreihe im Fenster der Story?'
        },
        {
          id: 'AC2.2',
          title: 'Schätzung wieder aufheben',
          link: '#/backlog',
          target: '.backlog__row',
          given: 'S-3 ist mit „5“ geschätzt.',
          when: 'Ich klicke die gewählte Karte „5“ noch einmal an.',
          then: 'Die Story ist wieder ungeschätzt (gestrichelter Pill mit Strich).',
          tests: [
            'src/Estimation.test.tsx › AC2.2 takes the estimate back when the chosen card is chosen again',
            'src/domain/estimation.test.ts › AC2.2 takes the estimate back'
          ]
        },
        {
          id: 'AC2.3',
          title: 'Epic mit T-Shirt-Grösse schätzen',
          link: '#/epics',
          target: '.epic-row',
          given: 'Ich öffne das Epic „Boards“.',
          when: 'Ich wähle die Karte „L“.',
          then: 'Zur Auswahl stehen XS, S, M, L und XL. „L“ ist gewählt und bleibt nach dem Neuladen erhalten.',
          tests: [
            'src/Estimation.test.tsx › AC2.3 estimates an epic with a T-shirt size card',
            'src/domain/migrate.test.ts › AC2.3 reads the size of an epic and drops a size that is not a T-shirt size'
          ]
        },
        {
          id: 'AC2.4',
          title: 'Karten nur mit der Tastatur wählen',
          link: '#/backlog',
          target: '.backlog__row',
          given: 'Ich öffne eine Story und stehe im Feld „Punkte“.',
          when: 'Ich wähle mit den Pfeiltasten die Karte „5“ und drücke Enter.',
          then: 'Die Karte „5“ ist gewählt. Ein Screenreader liest „5, gewählt“.',
          tests: [
            'src/Estimation.test.tsx › AC2.4 chooses a card with the arrow keys and Enter',
            'e2e/estimation.spec.ts › AC2.4 chooses a card with the keyboard only'
          ]
        },
        {
          id: 'AC2.5',
          title: 'Sonderkarten „?“ und „☕“',
          link: '#/backlog',
          target: '.backlog__row',
          given: 'S-3 ist ungeschätzt.',
          when: 'Ich wähle die Karte „?“.',
          then: 'Die Story zeigt „?“ und zählt in der Summe als „ohne Schätzung“ (nicht als 0 Punkte). Dasselbe gilt für „☕“.',
          tests: [
            'src/Estimation.test.tsx › AC2.5 treats the cards "?" and the coffee cup as not estimated'
          ]
        }
      ]
    },
    {
      id: 'AC3',
      story: 'E-3',
      title: 'Referenzstories',
      cases: [
        {
          id: 'AC3.1',
          title: 'Story als Referenz markieren',
          link: '#/backlog',
          target: '.backlog__row',
          given: 'S-1 ist mit „3“ geschätzt und noch keine Referenz (zum Prüfen vorher die Markierung wegnehmen).',
          when: 'Ich öffne S-1 und markiere sie als Referenz für „3“.',
          then: 'In jeder Story erscheint S-1 in der Liste „Referenzstories“ bei „3“. Die Karte „3“ hat einen gelben Strich und zeigt den Code der Story.',
          tests: [
            'src/Estimation.test.tsx › AC3.1 marks a story as the reference of its value',
            'src/domain/estimation.test.ts › AC3.1 finds the reference of each value'
          ],
          poCheck: 'Bitte einmal ansehen: Ist der gelbe Strich auf der Karte und die Liste „Referenzstories“ gut lesbar?'
        },
        {
          id: 'AC3.2',
          title: 'Pro Wert nur eine Referenz',
          link: '#/backlog',
          target: '.backlog__row',
          given: 'S-1 ist Referenz für „3“. S-5 ist ebenfalls mit „3“ geschätzt.',
          when: 'Ich markiere S-5 als Referenz für „3“.',
          then: 'Ich sehe eine Meldung, dass S-1 ersetzt wurde. Nur S-5 ist noch Referenz für „3“.',
          tests: [
            'src/Estimation.test.tsx › AC3.2 replaces the reference of a value when a second story is marked',
            'e2e/estimation.spec.ts › AC3.2 replaces the reference of a value with a notice',
            'src/domain/estimation.test.ts › AC3.2 takes the mark from the story that had it when another story with the same value is marked',
            'src/domain/estimation.test.ts › AC3.2 keeps the reference of another value'
          ]
        },
        {
          id: 'AC3.3',
          title: 'Referenz entfernen',
          link: '#/backlog',
          target: '.backlog__row',
          given: 'S-1 ist Referenz für „3“.',
          when: 'Ich nehme die Markierung wieder weg.',
          then: 'Die Liste „Referenzstories“ zeigt bei „3“ keine Story mehr, die Karte hat keinen gelben Strich.',
          tests: [
            'src/Estimation.test.tsx › AC3.3 removes the reference mark'
          ]
        },
        {
          id: 'AC3.4',
          title: 'Referenz öffnen',
          link: '#/backlog',
          target: '.backlog__row',
          given: 'S-1 ist Referenz für „3“. Ich bin in einer anderen Story.',
          when: 'Ich klicke in der Liste auf S-1.',
          then: 'Die Story S-1 öffnet sich.',
          tests: [
            'src/Estimation.test.tsx › AC3.4 opens a reference story from the list'
          ]
        },
        {
          id: 'AC3.5',
          title: 'Referenzstory bekommt einen anderen Wert',
          link: '#/backlog',
          target: '.backlog__row',
          given: 'S-1 ist Referenz für „3“.',
          when: 'Ich schätze S-1 neu mit „5“.',
          then: 'S-1 ist nicht mehr Referenz für „3“.',
          tests: [
            'src/Estimation.test.tsx › AC3.5 removes the reference mark when the reference story gets another estimate',
            'src/domain/estimation.test.ts › AC3.5 removes the mark when the story gets another estimate or none',
            'src/domain/estimation.test.ts › AC3.5 cannot mark a story without a number card'
          ]
        }
      ]
    },
    {
      id: 'AC4',
      story: 'E-1',
      title: 'Bestehende Stories',
      cases: [
        {
          id: 'AC4.1',
          title: 'Bestehende Stories werden ungeschätzt',
          link: '#/backlog',
          target: '.backlog__row',
          given: 'Eine App mit Daten von früher, in denen Stories den alten Standardwert „3“ haben.',
          when: 'Ich öffne die App nach dem Update.',
          then: 'Alle diese Stories sind ungeschätzt. Stories mit anderen Werten behalten ihren Wert. Neu geschätzte Stories behalten ihren Wert beim nächsten Neuladen.',
          tests: [
            'src/Estimation.test.tsx › AC4.1 migrates stories with the old default of 3 points to not estimated',
            'src/domain/migrate.test.ts › AC4.1 turns the old default of 3 points into "not estimated" and keeps other points',
            'src/domain/migrate.test.ts › AC4.1 keeps a 3 that was stored with the cards'
          ]
        }
      ]
    },
    {
      id: 'AC5',
      story: 'E-1',
      title: 'Ungeschätzte Stories in Summen',
      cases: [
        {
          id: 'AC5.1',
          title: 'Summe nennt ungeschätzte Stories',
          link: '#/backlog',
          target: '.backlog__heading',
          given: 'Im Sprint sind S-1 (3) und zwei ungeschätzte Stories.',
          when: 'Ich schaue auf die Summe.',
          then: '„3 Punkte“ und „2 ohne Schätzung“.',
          tests: [
            'src/Estimation.test.tsx › AC5.1 names the stories without estimate in the sum',
            'e2e/estimation.spec.ts › AC5.1 names the stories without estimate in the sum',
            'src/domain/estimation.test.ts › AC5.1 counts a story without a number card as no points and counts it separately'
          ]
        },
        {
          id: 'AC5.2',
          title: 'Ungeschätzt zählt nicht als 0 in der Sprint-Planung',
          link: '#/board',
          target: '.page-head__actions',
          given: 'Ein geplanter Sprint enthält S-1 (3) und S-2 (ungeschätzt).',
          when: 'Ich öffne „Sprint starten“.',
          then: 'Geplant sind 3 Punkte, und ein Hinweis nennt S-2 als Story ohne Schätzung. Der Wert „0“ erscheint für S-2 nirgends als Schätzung.',
          tests: [
            'src/Estimation.test.tsx › AC5.2 does not count a story without estimate in the sprint plan',
            'src/domain/estimation.test.ts › AC5.2 names the stories of a sprint without estimate and does not plan points for them'
          ]
        },
        {
          id: 'AC5.3',
          title: 'Ungeschätzt ist erkennbar ohne Farbe',
          link: '#/backlog',
          target: '.pill--none',
          given: 'Backlog mit einer ungeschätzten Story.',
          when: 'Ich fahre mit der Maus über den Pill und prüfe ihn im dunklen Modus, mit Screenreader.',
          then: 'Der Tooltip sagt „Nicht geschätzt“, der Screenreader liest ebenfalls „Nicht geschätzt“; der Pill ist in hell und dunkel sichtbar.',
          tests: ['src/Estimation.test.tsx › AC5.3 gives the pill of a story without estimate a text for the tooltip and for screen readers'],
          manual: 'Aussehen im hellen und dunklen Modus und der Vorlesetext des Screenreaders lassen sich nicht automatisch beurteilen.',
          poCheck: 'Bitte prüfen: Tooltip, Vorlesetext und dunkler Modus. Das kann kein automatischer Test beurteilen.'
        }
      ]
    }
  ]
};
