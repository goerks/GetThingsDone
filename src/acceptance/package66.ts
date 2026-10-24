import type { Criterion } from './types';

/**
 * Sync with several services, step 0 and Jira phase 1 (#66): the acceptance criteria and their test cases for the product owner, in
 * German. One source for the issue comment, the acceptance panel of the preview and the names of the automated tests. This pull
 * request generalises the shipped GitHub sync (AC1, AC2, AC11), makes the issue number the ID of a story (AC12) and adds the first
 * phase of Jira (AC3 to AC10.3, without the list of boards): connect, import, title, description, labels, criteria, status by transition, create, epics, fix versions, points, sprints, assignees.
 * In the preview Jira is simulated (Demo); the real Jira Cloud is only reached by the Windows app. The order of new stories follows the rank in Jira (read only), sub-tasks and issue links are not synchronised.
 */
const SYNC = 'src/Sync.test.tsx';
const SERIES = 'src/sync/connector.test.ts';
const KEYS = 'src/domain/storyKey.test.ts';
const SQLITE = 'src/data/sqliteRepository.test.ts';
const LOG = 'src/domain/syncLog.test.ts';
const SETTINGS = 'src/sync/github/format.test.ts';
const JIRA = 'src/sync/jira/jira.test.ts';
const JIRA_UI = 'src/Jira.test.tsx';
const PEOPLE = 'src/domain/syncPeople.test.ts';
const STATUSES = 'src/domain/syncStatuses.test.ts';
const SPRINTS = 'src/domain/syncSprints.test.ts';
const MEMBERS = 'src/domain/syncMembers.test.ts';

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
          tests: [`${JIRA_UI} › AC3.1 connects with site, e-mail, project and token, and keeps the token out of sight`, `${JIRA_UI} › AC3.1 offers the boards when there are several, and keeps the choice in the connection`, `${JIRA} › AC3.1 lists the scrum boards of the project and reads the sprints of the chosen one`],
          manual: 'Hat das Projekt mehrere Scrum-Boards, kann ich eines wählen; sonst ist das einzige Board gewählt und nicht änderbar (AC3.1 Boards).',
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
          then: 'Beide werden nicht zu Stories. Der Hinweis nennt «2 Epics oder Unteraufgaben ausgelassen». Das Epic kommt als Epic der Story (AC7.1).',
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
          tests: [`${JIRA} › AC6.2 takes the name of the workflow status as the column`],
          poCheck: 'Der Name der Spalte im Board muss dem Jira-Status entsprechen («In Progress»); eine Tabelle für andere Namen folgt.'
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
      id: 'AC7',
      story: 'J9',
      title: 'Epics und Fix-Versionen',
      cases: [
        {
          id: 'AC7.1',
          title: 'Epic',
          link: BACKLOG,
          given: 'Im simulierten Jira gehört «PROJ-2» zum Epic «Payments»; lokal gibt es das Epic nicht.',
          when: 'Ich synchronisiere; danach ordne ich lokal ein anderes Epic zu und synchronisiere mit Schreiben an.',
          then: 'Es gibt das Epic «Payments», die Story gehört dazu. Nach dem zweiten Abgleich gehört der Vorgang in Jira zum anderen Epic (fehlt es, wird es angelegt). Es entstehen keine Labels.',
          tests: [
            `${JIRA} › AC7.1 reads the epic of an issue as its epic`,
            `${JIRA} › AC7.1 puts an issue into another epic, makes the epic when the project has none, and takes it out again`,
            `${JIRA} › AC7.1 puts the epic of a new issue into its parent`
          ]
        },
        {
          id: 'AC7.2',
          title: 'Release und Fix-Version',
          link: BACKLOG,
          given: 'Im simulierten Jira hat «PROJ-1» die Fix-Version «v1.0» (Veröffentlichung 31.12.2026).',
          when: 'Ich synchronisiere; danach ordne ich lokal ein neues Release «v3.0» mit Daten zu und synchronisiere mit Schreiben an.',
          then: 'Es gibt das Release «v1.0» mit dem Datum, die Story gehört dazu. Das Release «v3.0» geht als Fix-Version mit Start und Veröffentlichung nach Jira (fehlt sie dort, wird sie angelegt) und wird nie gelöscht.',
          tests: [
            `${JIRA} › AC7.2 reads the fix version as the release and the versions with their due date as the releases of the service`,
            `${JIRA} › AC7.2 sets another version, makes a missing one with its dates, and never deletes one`
          ]
        },
        {
          id: 'AC7.4',
          title: 'Story Points',
          link: BACKLOG,
          given: 'Im simulierten Jira hat «PROJ-1» 5 Punkte.',
          when: 'Ich synchronisiere, ändere lokal auf 8 und synchronisiere erneut (Schreiben an).',
          then: 'Erst 5, dann 8 in Jira. Ein Vorgang ohne Punkte hat 0.',
          tests: [`${JIRA} › AC7.4 reads the story points of an issue, and 0 when it has none`, `${JIRA} › AC7.4 writes the story points, and clears them with 0`]
        },
        {
          id: 'AC7.3',
          title: 'Sprint',
          link: BACKLOG,
          given: 'Im simulierten Jira hat das Board «Sprint 14» (läuft, mit Ziel und Daten); «PROJ-2» ist darin.',
          when: 'Ich synchronisiere; danach ziehe ich die Story lokal in «Sprint 15» und synchronisiere mit Schreiben an.',
          then: 'Es gibt den Sprint «Sprint 14» mit Daten, die Story liegt darin (der Sprint ist lokal «geplant»; starten und abschliessen tut nur die App). Danach liegt «PROJ-2» in Jira im Sprint 15. Ein Projekt ohne Scrum-Board hat keinen Sprint-Abgleich.',
          tests: [
            `${JIRA} › AC7.3 reads the sprint of an issue and the open sprints of the board with their dates and goal`,
            `${JIRA} › AC7.3 puts an issue into another sprint, makes a missing sprint, and back into the backlog`,
            `${JIRA} › AC7.3 compares no sprint when the project has no scrum board`,
            `${PEOPLE} › AC7.3 makes a planned sprint from the sprint of the service and puts the new story into it`,
            `${PEOPLE} › AC7.3 uses the sprint of the same name that exists here`
          ]
        },
        {
          id: 'AC7.5',
          title: 'Zuständige',
          link: BACKLOG,
          given: 'Das Team hat «Anna Meier»; im simulierten Jira ist «PROJ-1» Anna Meier zugewiesen. «PROJ-2» ist niemandem zugewiesen.',
          when: 'Ich synchronisiere.',
          then: 'Hat das Team «Anna Meier», ist die Story ihr zugewiesen. Gibt es keinen Treffer, nennt der Hinweis den Namen («kein Teammitglied für …»), die Story bleibt unverändert und nichts wird geraten oder zurückgeschrieben. Eine lokale Zuweisung geht mit Schreiben an nach Jira, wenn dort jemand denselben Namen hat.',
          tests: [
            `${JIRA} › AC7.5 reads the name of the assignee`,
            `${JIRA} › AC7.5 changes nothing for a name that nobody has in Jira`,
            `${PEOPLE} › AC7.5 assigns the member of the team with the name of the assignee`,
            `${PEOPLE} › AC7.5 reports an assignee nobody of the team has, leaves the story as it is and does not publish it back`
          ]
        },
        {
          id: 'AC7.6',
          title: 'Nie löschen',
          link: BACKLOG,
          given: 'Schreiben ist an. Ich lösche lokal ein Release, ein Epic und eine Story, die der Sync in Jira angelegt hat.',
          when: 'Ich synchronisiere.',
          then: 'In Jira bleibt alles bestehen: Version, Epic und Vorgang sind noch da.',
          tests: [`${JIRA} › AC7.6 never deletes: nothing is removed from Jira by a write`]
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
      id: 'AC13',
      story: 'J10',
      title: 'Die Spalten kommen von Jira',
      cases: [
        {
          id: 'AC13.1',
          title: 'Spalten kommen aus Jira',
          link: BACKLOG,
          given: 'Jira ist verbunden, der Workflow hat «To Do», «In Progress», «In Review», «Done»; lokal gibt es die Standard-Spalten und «Blockiert».',
          when: 'Ich synchronisiere.',
          then: 'Das Board hat genau die vier Spalten in dieser Reihenfolge. Die Story aus «Blockiert» steht in der ersten Spalte mit gleicher Kategorie. Die Tabelle «Status-Zuordnung» gibt es nicht mehr.',
          tests: [
            `${JIRA_UI} › AC13.1 takes the columns of the board from the statuses of Jira when I synchronise`,
            `${STATUSES} › AC13.1 takes names, categories and order from the service and keeps the ids of the columns it can reuse`,
            `${STATUSES} › AC13.1 changes nothing when the service names no status`
          ]
        },
        {
          id: 'AC13.2',
          title: 'Neuer Status in Jira',
          link: BACKLOG,
          given: 'In Jira kommt der Status «Testing» dazu.',
          when: 'Ich synchronisiere.',
          then: 'Es gibt die Spalte «Testing» an der Stelle des Workflows; Stories in diesem Status stehen dort. Ein zweiter Abgleich ändert nichts.',
          tests: [`${STATUSES} › AC13.2 adds a column for a new status of the service at its place, and a second run changes nothing`]
        },
        {
          id: 'AC13.3',
          title: 'Karte verschieben',
          link: BACKLOG,
          given: 'Schreiben ist an.',
          when: 'Ich ziehe eine Karte nach «In Review» und synchronisiere.',
          then: 'In Jira steht der Vorgang auf «In Review». Erlaubt der Workflow das nicht, bleibt die Karte markiert «noch nicht in Jira» mit Meldung.',
          tests: [`${JIRA} › AC13.3 moves an issue to a column by a transition of the workflow`, `${JIRA} › AC13.3 says "transition" when the workflow does not allow the status, and changes nothing`]
        },
        {
          id: 'AC13.4',
          title: 'Spalten sind in der App gesperrt',
          link: '#/settings/statuses',
          target: '.status-settings',
          given: 'Jira ist verbunden.',
          when: 'Ich öffne die Einstellungen der Status-Werte.',
          then: 'Ein Hinweis sagt, dass die Spalten von Jira kommen; Anlegen, Umbenennen, Löschen und Umordnen sind gesperrt. Nach «Verbindung entfernen» geht alles wieder.',
          tests: [`${JIRA_UI} › AC13.4 locks the columns in the settings while Jira is connected`]
        }
      ]
    },
    {
      id: 'AC14',
      story: 'J11',
      title: 'Das Team kommt von Jira',
      cases: [
        {
          id: 'AC14.1',
          title: 'Team kommt aus Jira',
          link: '#/settings/team',
          target: '.team',
          given: 'Jira hat die zuweisbaren Personen «Anna Meier» und «Tom Keller» und einen Bot «Automation»; lokal gibt es «Max Muster».',
          when: 'Ich synchronisiere.',
          then: 'Das Team besteht aus «Anna Meier» und «Tom Keller» (AM, TK), ohne den Bot. «Max Muster» ist entfernt, seine Zuweisungen sind weg. Die Funktion «Team» ist eingeschaltet.',
          tests: [
            `${JIRA_UI} › AC14.1 makes the people of Jira the team, switches the feature on, and assigns the story of Anna`,
            `${MEMBERS} › AC14.1 makes the people of the service the team: keeps the members it knows, adds the new ones, removes the others and their assignments`,
            `${MEMBERS} › AC14.1 changes nothing when the service names nobody, or nothing is different`,
            `${JIRA} › AC14.1 lists the people who can be assigned and leaves out bots`
          ]
        },
        {
          id: 'AC14.2',
          title: 'Zuweisung',
          link: BACKLOG,
          given: '«PROJ-1» ist in Jira Anna Meier zugewiesen.',
          when: 'Ich synchronisiere; danach weise ich lokal Tom Keller zu und synchronisiere erneut (Schreiben an).',
          then: 'Erst Anna, dann Tom in Jira. Es gibt keine Meldung «kein Teammitglied» mehr.',
          tests: [`${JIRA} › AC14.2 assigns a person by name and takes the assignment away again`]
        },
        {
          id: 'AC14.3',
          title: 'Team ist gesperrt',
          link: '#/settings/team',
          target: '.team',
          given: 'Jira ist verbunden.',
          when: 'Ich öffne die Team-Einstellungen.',
          then: 'Ein Hinweis nennt Jira als Quelle; Hinzufügen, Ändern und Entfernen sind gesperrt. Nach «Verbindung entfernen» geht alles wieder.',
          tests: [`${JIRA_UI} › AC14.3 locks the team in the settings while Jira is connected`]
        }
      ]
    },
    {
      id: 'AC15',
      story: 'J12',
      title: 'Die Sprints in beide Richtungen',
      cases: [
        {
          id: 'AC15.1',
          title: 'Sprint aus Jira',
          link: BACKLOG,
          given: 'Das Board hat «Sprint 14» (läuft, 2.–15. November, Ziel «Login ready») und «Sprint 15» (geplant).',
          when: 'Ich synchronisiere.',
          then: '«Sprint 14» läuft mit Daten und Ziel, die Stories darin sind im Sprint; «Sprint 15» ist geplant.',
          tests: [
            `${JIRA_UI} › AC15.1 takes the sprints of the board: the running one runs here with its goal and dates, the future one is planned`,
            `${SPRINTS} › AC15.1 makes a planned sprint for a sprint of the service, with its dates and goal, and starts it when it runs`,
            `${JIRA} › AC15.1 reads a sprint by its id, also a completed one, and nothing for an unknown id`
          ]
        },
        {
          id: 'AC15.2',
          title: 'Sprint ändern',
          link: BACKLOG,
          given: 'Schreiben ist an; ein Sprint ist verbunden.',
          when: 'Ich ändere lokal Name und Enddatum und synchronisiere; danach ändere ich in Jira das Ziel und synchronisiere.',
          then: 'In Jira heisst der Sprint neu und hat das neue Enddatum, danach steht das neue Ziel auch hier. Es entsteht kein zweiter Sprint.',
          tests: [
            `${SPRINTS} › AC15.2 takes what only the service changed, and publishes what only we changed`,
            `${SPRINTS} › AC15.2 publishes nothing when writing is off`,
            `${SPRINTS} › AC15.2 follows the rule when both changed the same field`,
            `${JIRA} › AC15.2 changes name, goal and dates of a sprint`
          ]
        },
        {
          id: 'AC15.3',
          title: 'Neuer lokaler Sprint',
          link: BACKLOG,
          given: 'Schreiben ist an.',
          when: 'Ich lege lokal «Sprint 16» an (mit Daten und Ziel) und synchronisiere.',
          then: '«Sprint 16» gibt es in Jira (geplant), auch ohne Story darin.',
          tests: [`${SPRINTS} › AC15.3 makes a sprint that exists only here in the service, also without a story, but not a completed one`, `${JIRA} › AC15.3 makes a planned sprint on the board with its dates and goal`]
        },
        {
          id: 'AC15.4',
          title: 'Sprint starten und abschliessen',
          link: BACKLOG,
          given: 'Schreiben ist an.',
          when: 'Ich starte lokal einen geplanten Sprint und synchronisiere; danach schliesse ich ihn in Jira ab und synchronisiere.',
          then: 'In Jira läuft der Sprint; nach dem Abschluss in Jira ist er hier abgeschlossen, mit Ergebnis (erledigte Punkte), die offenen Stories gehen ins Backlog.',
          tests: [`${SPRINTS} › AC15.4 starts a sprint here that the service started, completes one that it completed, and publishes a start and a completion made here`, `${JIRA} › AC15.4 starts a sprint, and completes it, also one that was never started`]
        },
        {
          id: 'AC15.5',
          title: 'Zwei aktive Sprints in Jira',
          link: BACKLOG,
          given: 'In Jira laufen zwei Sprints.',
          when: 'Ich synchronisiere.',
          then: 'Hier läuft nur einer; der andere ist geplant und die Meldung nennt ihn. Es geht nichts verloren.',
          tests: [`${SPRINTS} › AC15.5 lets only one sprint run: the second sprint of the service stays planned and is named`]
        },
        {
          id: 'AC15.6',
          title: 'Nie löschen',
          link: BACKLOG,
          given: 'Schreiben ist an.',
          when: 'Ich synchronisiere mit Sprints in beide Richtungen.',
          then: 'In Jira wird nie ein Sprint gelöscht (die App kann Sprints auch nicht löschen, nur abschliessen).',
          tests: [`${JIRA} › AC15.6 never deletes: there is no way to remove a sprint`]
        },
        {
          id: 'AC15.7',
          title: 'Bestehende Daten',
          link: BACKLOG,
          given: 'Eine Datenbank von vorher mit Sprints ohne Jira-Verknüpfung.',
          when: 'Ich starte die App und verbinde Jira.',
          then: 'Sprints mit gleichem Namen werden verknüpft, die übrigen in Jira angelegt; nichts doppelt.',
          tests: [`${SPRINTS} › AC15.7 connects a sprint with the same name instead of making a second one, and takes the service for the first link`],
          manual: 'Die Migration der echten Datenbank (Ziel und Verknüpfung der Sprints) gibt es nur in der Windows-App.',
          poCheck: 'Windows-App mit der Datenbank von vorher starten, Jira verbinden und synchronisieren: die Sprints sind nicht doppelt.'
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
