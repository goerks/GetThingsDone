import type { Criterion } from './types';

/**
 * Sync with several services, step 0 and Jira phase 1 (#66): the acceptance criteria and their test cases for the product owner, in
 * German. One source for the issue comment, the acceptance panel of the preview and the names of the automated tests. This pull
 * request generalises the shipped GitHub sync (AC1, AC2, AC11), makes the issue number the ID of a story (AC12) and adds the first
 * phase of Jira (AC3 to AC6, AC8, AC9, AC10.3): connect, import, title, description, labels, criteria, status by transition, create.
 * In the preview Jira is simulated (Demo); the real Jira Cloud is only reached by the Windows app. Epics, fix versions, sprints,
 * points, the list of boards, the table of status names and the message for an expired token follow in later phases.
 */
const SYNC = 'src/Sync.test.tsx';
const SERIES = 'src/sync/connector.test.ts';
const KEYS = 'src/domain/storyKey.test.ts';
const SQLITE = 'src/data/sqliteRepository.test.ts';
const LOG = 'src/domain/syncLog.test.ts';
const SETTINGS = 'src/sync/github/format.test.ts';
const JIRA = 'src/sync/jira/jira.test.ts';
const JIRA_UI = 'src/Jira.test.tsx';

const SETTINGS_PAGE = '#/settings/sync';
const BACKLOG = '#/backlog';

export const PACKAGE_66: { issue: number; pullRequest: number; title: string; criteria: Criterion[] } = {
  issue: 66,
  pullRequest: 69,
  title: 'Sync mit mehreren Diensten: Schritt 0 und Jira Phase 1',
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
          then: 'Es gibt drei Karten: GitHub (gewählt), Jira (wählbar) und GitLab («geplant», nicht wählbar). Darunter steht das Formular des gewählten Dienstes.',
          tests: [`${SYNC} › AC1.1 shows the services as one choice: GitHub is chosen, Jira can be chosen, GitLab is planned`]
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
      id: 'AC3',
      story: 'J1',
      title: 'Jira verbinden',
      cases: [
        {
          id: 'AC3.1',
          title: 'Jira verbinden',
          link: SETTINGS_PAGE,
          target: '.github-settings',
          given: 'Die Funktion «Synchronisation» ist an, ich wähle die Karte «Jira».',
          when: 'Ich trage Adresse «demo.atlassian.net», eine E-Mail-Adresse, Projekt «PROJ» und ein beliebiges Token ein und drücke «Verbindung testen».',
          then: '«Verbindung ok · 4 offene Vorgänge». Das Token ist nur als Punkte zu sehen, das Feld ist danach leer und das Token nie mehr lesbar.',
          tests: [`${JIRA_UI} › AC3.1 connects with site, e-mail, project and token, and keeps the token out of sight`],
          manual: 'Die Liste der Boards gibt es in dieser Phase noch nicht; sie folgt mit den Sprints (Phase 3).',
          poCheck: 'In der Vorschau mit dem simulierten Jira verbinden; in der Windows-App mit der echten Jira-Testinstanz (Adresse, E-Mail, Projekt, API-Token).'
        },
        {
          id: 'AC3.2',
          title: 'Falsche Eingaben',
          link: SETTINGS_PAGE,
          target: '.github-settings',
          given: 'Das Formular von Jira ist offen.',
          when: 'Ich lasse die Adresse leer, trage «beispiel» ein, eine E-Mail ohne «@», das Projekt «GIBTSNICHT» oder das Token «falsch» ein und teste.',
          then: 'Es kommen die Hinweise: Adresse fehlt, Format «name.atlassian.net», E-Mail ungültig, «Projekt oder Site nicht gefunden», «Jira hat das Token abgelehnt».',
          tests: [`${JIRA_UI} › AC3.2 says what is wrong with the entries`, `${JIRA} › AC3.2 accepts the usual forms of the address, the project and the e-mail address, and refuses the rest`, `${JIRA} › AC3.2 keeps nothing for an empty connection and refuses an incomplete one`]
        },
        {
          id: 'AC3.3',
          title: 'Token bleibt im Schlüsselbund',
          link: SETTINGS_PAGE,
          given: 'Jira ist in der Windows-App verbunden.',
          when: 'Ich starte die App neu und synchronisiere.',
          then: 'Es funktioniert ohne erneute Token-Eingabe. Das Token steht weder in einer Exportdatei noch in den Einstellungen.',
          tests: [],
          manual: 'Der Schlüsselbund und der echte HTTP-Weg (Rust) gibt es nur in der Windows-App.',
          poCheck: 'Windows-App: Jira verbinden, App neu starten, «Synchronisieren»: ohne neue Token-Eingabe.'
        },
        {
          id: 'AC3.4',
          title: 'Vorschau ist Demo',
          link: SETTINGS_PAGE,
          target: '.badge--demo',
          given: 'Web-Vorschau.',
          when: 'Ich wähle Jira.',
          then: '«Demo» ist deutlich gekennzeichnet, das Jira ist simuliert, es wird nichts ins Netz gesendet. Knöpfe ändern die Vorgänge des simulierten Jira.',
          tests: [`${JIRA_UI} › AC3.4 marks the preview as a demo with a simulated Jira`]
        },
        {
          id: 'AC3.5',
          title: 'Verbindung trennen',
          link: SETTINGS_PAGE,
          given: 'Jira ist verbunden.',
          when: 'Ich klicke «Verbindung entfernen» und bestätige.',
          then: 'Verbindung und Token sind weg, die Stories bleiben mit ihrer eigenen ID, ohne Link.',
          tests: [`${JIRA_UI} › AC3.5 removes the connection and the token and keeps the stories`]
        }
      ]
    },
    {
      id: 'AC4',
      story: 'J2',
      title: 'Offene Vorgänge importieren',
      cases: [
        {
          id: 'AC4.1',
          title: 'Offene Vorgänge importieren',
          link: BACKLOG,
          target: '.backlog__row',
          given: 'Das simulierte Jira hat 4 offene Stories, 1 erledigten Vorgang, 1 Epic und 1 Unteraufgabe.',
          when: 'Ich klicke das Sync-Zeichen.',
          then: '4 neue Stories mit Schlüssel (zum Beispiel «PROJ-1») als ID und Link, Titel, Beschreibung und Labels. Der erledigte fehlt. Der Hinweis nennt «4 neu».',
          tests: [`${JIRA_UI} › AC4.1 imports the open issues as stories with the issue key as ID, and says what was left out`, `${JIRA} › AC4.1 imports the open issues with key, address, title, text and labels, and not the done one`]
        },
        {
          id: 'AC4.2',
          title: 'Kein Duplikat',
          link: BACKLOG,
          given: 'Die Vorgänge sind schon importiert.',
          when: 'Ich synchronisiere erneut.',
          then: 'Es kommen keine Stories dazu, nichts ist neu.',
          tests: [`${JIRA_UI} › AC4.2 imports nothing twice when I synchronise again`]
        },
        {
          id: 'AC4.3',
          title: 'Filter',
          link: SETTINGS_PAGE,
          given: 'Im Feld «Zusätzlicher Filter» steht «labels = mobil».',
          when: 'Ich synchronisiere.',
          then: 'Nur Vorgänge, die zum Filter passen, werden importiert.',
          tests: [`${JIRA} › AC4.3 sends the filter as part of the search`],
          manual: 'Das simulierte Jira wertet den Filter nicht aus; geprüft wird, dass er mitgeschickt wird.',
          poCheck: 'Windows-App mit der echten Jira-Testinstanz: Filter «labels = …» setzen, nur die passenden Vorgänge kommen.'
        },
        {
          id: 'AC4.4',
          title: 'Epics und Unteraufgaben beim Import',
          link: BACKLOG,
          given: 'Das Projekt hat ein Epic und eine Unteraufgabe.',
          when: 'Ich synchronisiere.',
          then: 'Beide werden nicht zu Stories. Der Hinweis nennt «2 Epics oder Unteraufgaben ausgelassen». Das Epic selbst kommt mit Phase 2.',
          tests: [`${JIRA} › AC4.4 leaves out epics and sub-tasks and counts them`]
        }
      ]
    },
    {
      id: 'AC5',
      story: 'J3',
      title: 'Abgleich in beide Richtungen',
      cases: [
        {
          id: 'AC5.2',
          title: 'Lokale Änderung nach Jira schreiben',
          link: SETTINGS_PAGE,
          given: '«Auch nach Jira schreiben» ist an, «PROJ-1» ist importiert.',
          when: 'Ich ändere Titel und Labels lokal und synchronisiere.',
          then: 'In Jira stehen der neue Titel und die Labels (Labels mit Leerzeichen gibt es in Jira nicht, sie werden gemeldet). Der Abgleich löscht nie etwas in Jira.',
          tests: [`${JIRA} › AC5.2 changes the title and the labels, and says which labels Jira cannot hold`]
        },
        {
          id: 'AC5.9',
          title: 'Neue Story in Jira anlegen',
          link: BACKLOG,
          given: 'Schreiben ist an, ich habe eine eigene Story ohne Verknüpfung.',
          when: 'Ich öffne ihr Menü und wähle «In Jira anlegen».',
          then: 'In Jira gibt es einen neuen Vorgang (Typ Story, sonst Task). Die Story zeigt dessen Schlüssel als ID.',
          tests: [`${JIRA} › AC5.9 creates a story that is then in the list of open issues, with its criteria`]
        }
      ]
    },
    {
      id: 'AC6',
      story: 'J4',
      title: 'Status über Workflow-Übergänge',
      cases: [
        {
          id: 'AC6.2',
          title: 'Status von Jira übernehmen',
          link: BACKLOG,
          given: 'Der Vorgang «PROJ-3» steht in Jira auf «To Do».',
          when: 'Ich drücke «PROJ-3 auf In Progress setzen» (Demo-Knopf) und synchronisiere.',
          then: 'Die Story steht in der Spalte «In Progress» des Boards.',
          tests: [`${JIRA} › AC6.2 takes the name of the workflow status for a column in progress, and the first column for "To Do"`],
          poCheck: 'Der Name der Spalte im Board muss dem Jira-Status entsprechen («In Progress»); eine Tabelle für andere Namen folgt.'
        },
        {
          id: 'AC6.3',
          title: 'Karte verschieben veröffentlicht einen Übergang',
          link: BACKLOG,
          given: 'Schreiben ist an, «PROJ-2» steht in «In Progress».',
          when: 'Ich ziehe die Karte nach «In Review» und synchronisiere.',
          then: 'In Jira steht der Vorgang auf «In Review».',
          tests: [`${JIRA} › AC6.3 moves an issue to a column by a transition of the workflow`, `${JIRA} › AC6.3 uses the map of statuses for a column with another name`]
        },
        {
          id: 'AC6.4',
          title: 'Übergang nicht erlaubt',
          link: BACKLOG,
          given: 'Schreiben ist an. Für «PROJ-7» erlaubt der Workflow «Done» nur mit einer Lösung.',
          when: 'Ich ziehe die Karte nach «Erledigt» und synchronisiere.',
          then: 'Eine Meldung nennt den Grund und bleibt stehen. Die Karte bleibt lokal verschoben und markiert «noch nicht in Jira»; Jira ist unverändert.',
          tests: [`${JIRA} › AC6.4 says "transition" when the workflow does not allow the status, and changes nothing`, `${JIRA} › AC6.4 says "transition" for a column the workflow does not have`]
        },
        {
          id: 'AC6.5',
          title: 'Erledigt in Jira',
          link: BACKLOG,
          given: 'Eine Story ist offen.',
          when: 'Ich drücke «PROJ-2 schliessen» (Demo-Knopf) und synchronisiere; danach öffne ich «PROJ-4» wieder.',
          then: 'Die Story steht in «Erledigt»; wird der Vorgang wieder geöffnet, steht sie wieder in der ersten Spalte.',
          tests: [`${JIRA} › AC6.5 sees an issue in the category done as done`, `${JIRA} › AC6.5 closes an issue and opens it again`]
        }
      ]
    },
    {
      id: 'AC8',
      story: 'J5',
      title: 'Kriterien und Beschreibung',
      cases: [
        {
          id: 'AC8.1',
          title: 'Kriterien aus der Aufgabenliste',
          link: BACKLOG,
          given: 'Die Beschreibung von «PROJ-1» enthält unter «Acceptance criteria» zwei Aufgaben, die zweite ist erledigt.',
          when: 'Ich importiere.',
          then: 'Die Story hat zwei Kriterien in dieser Reihenfolge, das zweite ist abgehakt. Die Liste steht nicht noch einmal in der Beschreibung.',
          tests: [`${JIRA} › AC8.1 reads the task list under "Acceptance criteria" as criteria and keeps it out of the description`, `${JIRA} › AC8.1 reads the German heading, and a list without the heading stays in the description`]
        },
        {
          id: 'AC8.2',
          title: 'Kriterien nach Jira schreiben',
          link: BACKLOG,
          given: 'Schreiben ist an.',
          when: 'Ich hake ein Kriterium ab, füge eines hinzu und synchronisiere.',
          then: 'In Jira steht die Aufgabenliste unter «Acceptance criteria» mit den neuen Haken. Der übrige Text bleibt unverändert.',
          tests: [`${JIRA} › AC8.2 writes the criteria and leaves the rest of the text as it is`, `${JIRA} › AC8.2 keeps every other node when only the criteria change`]
        },
        {
          id: 'AC8.3',
          title: 'Beschreibung mit Tabelle',
          link: BACKLOG,
          given: 'Die Jira-Beschreibung enthält eine Tabelle. Schreiben ist an.',
          when: 'Ich ändere den Titel und die Beschreibung lokal und synchronisiere.',
          then: 'Die Tabelle in Jira bleibt unangetastet, die Beschreibung wird nie nach Jira geschrieben.',
          tests: [`${JIRA} › AC8.3 never rewrites a description it cannot show completely`, `${JIRA} › AC8.3 calls a text with a table, an image or formatting lossy`],
          manual: 'Der Hinweis in der Story, dass die Beschreibung schreibgeschützt ist, folgt in einer späteren Phase.'
        }
      ]
    },
    {
      id: 'AC9',
      story: 'J6',
      title: 'Fehlermeldungen',
      cases: [
        {
          id: 'AC9.1',
          title: 'Fehlermeldungen',
          link: SETTINGS_PAGE,
          given: 'Jira ist verbunden.',
          when: 'Es gibt kein Netz, ein falsches Token, keine Schreibrechte oder ein unbekanntes Projekt, oder Jira bremst.',
          then: 'Jede Situation hat ihre eigene Meldung; Board und Backlog bleiben benutzbar, die lokalen Daten unverändert.',
          tests: [`${JIRA} › AC9.1 tells a wrong token, a project that is not there, a refused write and a missing network apart`, `${JIRA} › AC9.1 tells that Jira asks to slow down`],
          manual: 'Die Meldung für ein abgelaufenes Token und die Wartezeit in Minuten folgen später.'
        }
      ]
    },
    {
      id: 'AC10',
      story: 'J7',
      title: 'Hilfe und Sprachen',
      cases: [
        {
          id: 'AC10.3',
          title: 'Hilfe',
          link: BACKLOG,
          given: 'Die App ist offen.',
          when: 'Ich suche in der Hilfe nach «Jira».',
          then: 'Es gibt ein Thema, das mit dem Einschalten unter Einstellungen → Synchronisation beginnt und auf die Einstellungen verweist (in vier Sprachen). Die ersten Schritte sind unverändert.',
          tests: [`${JIRA_UI} › AC10.3 has a help topic that starts with switching the feature on and links to the settings`]
        }
      ]
    },
    {
      id: 'AC12J',
      story: 'J8',
      title: 'Jira-Schlüssel als ID',
      cases: [
        {
          id: 'AC12.2',
          title: 'Issue-Nummer als ID (Jira)',
          link: BACKLOG,
          target: '.backlog__row',
          given: 'Eine Story aus dem Jira-Vorgang «PROJ-1».',
          when: 'Wie AC12.1.',
          then: 'Überall steht «PROJ-1» als ID, als Link zu Jira.',
          tests: [`${JIRA} › AC12.2 uses the issue key as the key of the story and tells which issue an address points to`]
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
