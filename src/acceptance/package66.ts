import type { Criterion } from './types';

/**
 * Sync with several services, step 0 (#66): the acceptance criteria and their test cases for the product owner, in German.
 * One source for the issue comment, the acceptance panel of the preview and the names of the automated tests. This pull request
 * generalises the shipped GitHub sync (AC1, AC2, AC11) and makes the issue number the ID of a story (AC12, for GitHub); Jira follows
 * in later pull requests. In the preview only GitHub can be chosen, so AC2 is tried by the tests; it can be tried by hand once Jira
 * is available.
 */
const SYNC = 'src/Sync.test.tsx';
const SERIES = 'src/sync/connector.test.ts';
const KEYS = 'src/domain/storyKey.test.ts';
const SQLITE = 'src/data/sqliteRepository.test.ts';
const LOG = 'src/domain/syncLog.test.ts';
const SETTINGS = 'src/sync/github/format.test.ts';

const SETTINGS_PAGE = '#/settings/sync';
const BACKLOG = '#/backlog';

export const PACKAGE_66: { issue: number; pullRequest: number; title: string; criteria: Criterion[] } = {
  issue: 66,
  pullRequest: 69,
  title: 'Sync mit mehreren Diensten: Schritt 0',
  criteria: [
    {
      id: 'AC1',
      story: 'S1',
      title: 'Ein Dienst wählbar, GitHub verhält sich wie vorher',
      cases: [
        {
          id: 'AC1.1',
          title: 'Dienst wählen',
          link: SETTINGS_PAGE,
          target: '.sync-services',
          given: 'Die Funktion «Synchronisation» ist eingeschaltet, GitHub ist verbunden.',
          when: 'Ich öffne Einstellungen → Synchronisation.',
          then: 'Es gibt drei Karten: GitHub (gewählt), Jira und GitLab («geplant», nicht wählbar). Darunter steht das Formular des gewählten Dienstes.',
          tests: [`${SYNC} › AC1.1 shows the services as one choice: GitHub is chosen, the planned ones cannot be chosen`]
        },
        {
          id: 'AC1.3',
          title: 'GitHub verhält sich wie vorher',
          link: BACKLOG,
          given: 'Eine App mit bestehender GitHub-Verbindung (Repository, Token, importierte Stories, Auto-Sync an).',
          when: 'Ich aktualisiere die App auf die neue Version und synchronisiere.',
          then: 'Verbindung, Token, Einstellungen und das Sync-Protokoll sind noch da. Der Abgleich verhält sich wie vorher.',
          tests: [`${SYNC} › AC1.3 keeps working with the connection, the token and the links of the version before`],
          manual: 'Die Umstellung der echten Datenbank und der Schlüsselbund gibt es nur in der Windows-App.',
          poCheck: 'Windows-App mit der echten Datenbank von vorher starten: GitHub-Verbindung, Token (ohne neue Eingabe) und Stories sind da, «Synchronisieren» funktioniert.'
        },
        {
          id: 'AC1.4',
          title: 'Funktion aus und wieder an',
          link: SETTINGS_PAGE,
          given: 'GitHub ist verbunden, eine Story ist mit dem Issue #31 verknüpft.',
          when: 'Ich schalte «Synchronisation» aus und wieder ein.',
          then: 'Beim Ausschalten verschwinden Sync-Zeichen und Issue-Nummer, die Story bleibt mit ihrer eigenen ID. Beim Einschalten ist alles wieder da.',
          tests: [`${SYNC} › AC1.4 hides the issue keys when the feature is switched off, keeps the stories, and brings them back when it is on`]
        }
      ]
    },
    {
      id: 'AC2',
      story: 'S2',
      title: 'Dienst wechseln trennt sauber',
      cases: [
        {
          id: 'AC2.1',
          title: 'Wechsel mit verknüpften Stories fragt nach',
          link: SETTINGS_PAGE,
          given: 'GitHub ist aktiv, 2 Stories sind mit GitHub-Issues verknüpft, ein anderer Dienst ist wählbar.',
          when: 'Ich wähle die Karte des anderen Dienstes.',
          then: 'Ein Dialog sagt: Verbindung und Token werden entfernt, die Stories bleiben ohne Nummer und Link, der erste Abgleich importiert alles neu. Noch ist nichts geändert.',
          tests: [`${SYNC} › AC2.1 asks first and says what happens when stories are linked, and changes nothing yet`],
          manual: 'In der Vorschau ist nur GitHub wählbar; der Fall wird mit einem zweiten, nachgebildeten Dienst getestet.'
        },
        {
          id: 'AC2.2',
          title: 'Wechsel bestätigen',
          link: SETTINGS_PAGE,
          given: 'Der Dialog aus AC2.1 ist offen.',
          when: 'Ich bestätige.',
          then: 'Der andere Dienst ist gewählt. Die Stories sind unverändert da, ohne Nummer und Link und mit ihrer eigenen ID. Das Token ist gelöscht.',
          tests: [`${SYNC} › AC2.2 disconnects and switches: the stories stay without link and with their own key, the token is deleted`]
        },
        {
          id: 'AC2.3',
          title: 'Wechsel abbrechen',
          link: SETTINGS_PAGE,
          given: 'Der Dialog aus AC2.1 ist offen.',
          when: 'Ich wähle «Abbrechen» oder drücke Esc.',
          then: 'GitHub bleibt gewählt und verbunden, nichts ist verändert.',
          tests: [`${SYNC} › AC2.3 changes nothing when I cancel or press Esc`]
        },
        {
          id: 'AC2.4',
          title: 'Wechsel ohne verknüpfte Stories',
          link: SETTINGS_PAGE,
          given: 'GitHub ist gewählt und verbunden, aber keine Story ist verknüpft.',
          when: 'Ich wähle den anderen Dienst.',
          then: 'Es kommt eine kurze Rückfrage (Verbindung und Token werden entfernt), ohne Hinweis auf Stories. Ist gar nichts verbunden, wird sofort gewechselt.',
          tests: [`${SYNC} › AC2.4 asks briefly when no story is linked, and not at all when nothing is connected`]
        }
      ]
    },
    {
      id: 'AC11',
      story: 'S3',
      title: 'Ein Mechanismus, ein Anschluss pro Dienst',
      cases: [
        {
          id: 'AC11.1',
          title: 'Eine Testreihe für alle Dienste',
          link: SETTINGS_PAGE,
          given: 'Der Sync-Motor und die Anschlüsse.',
          when: 'Die gemeinsame Testreihe (Lesen, Schreiben, Fehler, ein Lauf des Motors) läuft.',
          then: 'GitHub (mit dem Fake und mit der Simulation der Vorschau) und ein zweiter, GitLab-ähnlicher Dienst bestehen sie mit demselben Motor.',
          tests: [`${SERIES} › AC11.1 connector series`]
        },
        {
          id: 'AC11.2',
          title: 'Bestehende GitHub-Daten bleiben nutzbar',
          link: SETTINGS_PAGE,
          given: 'Eine Datenbank im Stand von vorher, mit GitHub-Verknüpfungen, Basis, Einstellungen und Protokoll.',
          when: 'Die App startet (und noch einmal).',
          then: 'Alles ist umgestellt und stimmt wie vorher; ein zweiter Start ändert nichts mehr.',
          tests: [
            `${SQLITE} › AC11.2 takes the links and the settings of the GitHub sync as they were stored before the generalisation`,
            `${SETTINGS} › AC11.2 reads the settings of before the generalisation as the synchronisation with GitHub`,
            `${LOG} › AC11.2 reads a log of before the generalisation: issue numbers become keys and the side "github" becomes "remote"`
          ],
          manual: 'Die echte Datenbank und der Schlüsselbund nur in der Windows-App.',
          poCheck: 'Siehe AC1.3 (Windows-App mit der Datenbank von vorher).'
        },
        {
          id: 'AC11.3',
          title: 'Platz für weitere Dienste',
          link: SETTINGS_PAGE,
          given: 'Ein Beispiel-Anschluss mit Issue-Nummern und Scoped-Labels (wie GitLab).',
          when: 'Er wird ohne Änderung am Motor eingehängt.',
          then: 'Das geht. In der Dienstliste steht GitLab als «geplant», Trello gibt es nicht.',
          tests: [`${SERIES} › AC11.3 a service only needs a connector`]
        }
      ]
    },
    {
      id: 'AC12',
      story: 'S4',
      title: 'Die Issue-Nummer ist die ID der Story',
      cases: [
        {
          id: 'AC12.1',
          title: 'Issue-Nummer als ID (GitHub)',
          link: BACKLOG,
          target: '.backlog__row',
          given: 'Eine Story aus GitHub-Issue #31, vorher mit der eigenen ID «S-4».',
          when: 'Ich schaue Board, Backlog, Story Map, Story-Dialog, Suche und Verlauf an.',
          then: 'Überall steht «#31» als ID, nirgends «S-4». Ein Klick auf «#31» öffnet das Issue auf GitHub, ein Klick auf die Story öffnet die Story.',
          tests: [`${SYNC} › AC12.1 shows the issue number as the ID of a linked story, as a link to the issue, and not its own key`, `${KEYS} › AC12.1 is the key of the issue while the sync is on and the story is linked, else its own key`]
        },
        {
          id: 'AC12.3',
          title: 'Eigene ID bleibt erhalten',
          link: BACKLOG,
          given: 'Die Story aus AC12.1.',
          when: 'Ich suche nach «S-4», öffne die Story und trenne die Verbindung.',
          then: 'Die Suche findet die Story. Der Story-Dialog zeigt klein «Lokale ID S-4». Nach dem Trennen steht wieder «S-4».',
          tests: [`${SYNC} › AC12.3 keeps the own key: the story dialog shows it small, and it comes back when the connection is removed`, `${KEYS} › AC12.3 finds a linked story by the issue key and by its own key`]
        },
        {
          id: 'AC12.4',
          title: 'Story ohne Link',
          link: BACKLOG,
          given: 'Eine eigene Story «S-9» ohne Verknüpfung.',
          when: 'Ich schaue sie an.',
          then: 'Überall «S-9», kein Link.',
          tests: [`${SYNC} › AC12.4 shows the own key of a story without a link, and no link`]
        },
        {
          id: 'AC12.5',
          title: 'Neu angelegte Story bekommt die ID',
          link: BACKLOG,
          given: 'Schreiben ist an, «S-9» wird mit «Auf GitHub anlegen» veröffentlicht.',
          when: 'Das Issue ist angelegt.',
          then: 'Die Story zeigt sofort die neue Issue-Nummer als ID, «S-9» steht nur noch klein im Story-Dialog.',
          tests: [`${SYNC} › AC12.5 gives a story that was published the key of its new issue as ID, and keeps its own key small`]
        },
        {
          id: 'AC12.6',
          title: 'Verlauf bleibt lesbar',
          link: BACKLOG,
          given: 'Eine Story hat einen Verlaufseintrag aus der Zeit vor der Verknüpfung (mit «S-4»).',
          when: 'Ich öffne den Verlauf nach dem Import.',
          then: 'Der alte Eintrag zeigt weiter «S-4», neue Einträge zeigen «#31».',
          tests: [`${KEYS} › AC12.6 writes the key a story has now into the history, and leaves earlier entries as they are`]
        }
      ]
    }
  ]
};
