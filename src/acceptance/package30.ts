import type { Criterion } from './types';

/**
 * GitHub issues (#30): the acceptance criteria and their test cases for the product owner, in German.
 * One source for the issue comment, the acceptance panel of the preview and the names of the automated tests.
 * Design: variant B (switch in Settings → Features, section "GitHub", "Synchronisieren" in the backlog).
 * The preview has a simulated GitHub: the repository goerks/GetThingsDone with the open issues #31 "Login" (two criteria),
 * #35 "Export as CSV" and #38 "Dark mode", the closed issue #29 and a pull request. Under Settings → GitHub the section
 * "Demo" has buttons to change these issues; any text is accepted as a token, except "falsch".
 */
const COMPONENT = 'src/Github.test.tsx';
const E2E = 'e2e/github.spec.ts';
const DOMAIN = 'src/domain/github.test.ts';
const REST = 'src/github/restSource.test.ts';

const FEATURES = '#/settings/features';
const SETTINGS = '#/settings/github';
const BACKLOG = '#/backlog';

export const PACKAGE_30: { issue: number; pullRequest: number; title: string; criteria: Criterion[] } = {
  issue: 30,
  pullRequest: 48,
  title: 'GitHub-Issues importieren und abgleichen',
  criteria: [
    {
      id: 'AC1',
      story: 'G1',
      title: 'GitHub in den Einstellungen verbinden',
      cases: [
        {
          id: 'AC1.1',
          title: 'Funktion ist standardmässig aus',
          link: FEATURES,
          target: '.features',
          given: 'Frische App, ich habe nichts eingestellt.',
          when: 'Ich öffne Einstellungen → Funktionen und den Backlog.',
          then: '„GitHub-Anbindung“ steht auf „Aus“. In den Einstellungen gibt es keinen Abschnitt „GitHub“, im Backlog keinen Knopf „Synchronisieren“.',
          tests: [`${COMPONENT} › AC1.1 is off by default: no section, no button in the backlog`, `${DOMAIN} › AC1.1 is off by default and has no repository`]
        },
        {
          id: 'AC1.2',
          title: 'Funktion einschalten',
          link: FEATURES,
          target: '.features',
          given: '„GitHub-Anbindung“ ist aus.',
          when: 'Ich schalte sie ein.',
          then: 'In den Einstellungen erscheint der Abschnitt „GitHub“ mit den Feldern Repository und Zugriffstoken.',
          tests: [`${COMPONENT} › AC1.2 shows the section "GitHub" with repository and token as soon as the feature is on`, `${E2E} › AC1.2 and AC1.3 switch the feature on, connect the repository and show a working connection`]
        },
        {
          id: 'AC1.3',
          title: 'Verbindung speichern',
          link: SETTINGS,
          target: '.github-settings',
          given: 'Funktion ist an, Abschnitt „GitHub“ ist offen.',
          when: 'Ich trage Repository „goerks/GetThingsDone“ und ein beliebiges Token ein und klicke „Verbindung testen“.',
          then: '„Verbindung ok · 3 offene Issues“. Das Token ist nur als Punkte zu sehen und nach dem Speichern nie mehr lesbar.',
          tests: [`${COMPONENT} › AC1.3 tests the connection, never shows the token again and keeps the repository`]
        },
        {
          id: 'AC1.4',
          title: 'Ungültiges Repository',
          link: SETTINGS,
          target: '.github-settings',
          given: 'Abschnitt „GitHub“ ist offen, ein Token ist eingetragen.',
          when: 'Ich teste das Repository leer, mit „abc“ und mit „goerks/gibtesnicht“.',
          then: 'Leer: „Das Repository fehlt.“ „abc“: „Bitte im Format owner/name angeben.“ „goerks/gibtesnicht“: „Repository nicht gefunden …“.',
          tests: [`${COMPONENT} › AC1.4 says what is wrong with the repository "%s"`, `${COMPONENT} › AC1.4 says "Repository not found" for a repository that does not exist`, `${E2E} › AC1.4 says what is wrong with the repository`]
        },
        {
          id: 'AC1.5',
          title: 'Funktion wieder ausschalten',
          link: FEATURES,
          target: '.features',
          given: 'Funktion an, Stories wurden importiert.',
          when: 'Ich schalte „GitHub-Anbindung“ aus und später wieder ein.',
          then: 'Aus: Abschnitt „GitHub“, Sync-Knopf und #-Nummern sind weg. Wieder an: die Stories und die Verbindung sind wieder da.',
          tests: [`${COMPONENT} › AC1.5 hides the section, the button and the issue numbers when switched off, and brings them back with the connection`, `${COMPONENT} › AC1.5 lets me disconnect: the repository and the token are removed`, `${DOMAIN} › AC1.5 keeps the repository and the time of the last sync when the feature is switched`]
        },
        {
          id: 'AC1.6',
          title: 'Token nur für die Sitzung (Browser)',
          link: SETTINGS,
          target: '.github-settings',
          given: 'Verbindung eingerichtet im Browser.',
          when: 'Ich lade die Seite neu.',
          then: 'Das Repository steht noch da, das Token-Feld ist leer mit Hinweis „Gib das Token erneut ein …“.',
          tests: [`${COMPONENT} › AC1.6 keeps the repository after a reload but asks for the token again`, `${E2E} › AC1.6 keeps the repository after a reload but asks for the token again`],
          manual: 'In der Windows-App liegt das Token im Schlüsselbund (Anmeldeinformationsverwaltung) und überlebt einen Neustart; das kann nur dort geprüft werden.',
          poCheck: 'Nur in der Windows-App: Verbinde ein echtes Repository mit einem echten Token (nur Lesen), starte die App neu und synchronisiere ohne das Token erneut einzugeben. In der Anmeldeinformationsverwaltung von Windows steht ein Eintrag „io.github.goerks.getitdone“.'
        },
        {
          id: 'AC1.7',
          title: 'Vorschau ist Demo',
          link: SETTINGS,
          target: '.github-settings',
          given: 'Öffentliche Vorschau.',
          when: 'Ich schalte die Funktion ein und verbinde.',
          then: 'Deutlich als „Demo“ gekennzeichnet, simulierte Issues, es wird kein echtes Token benötigt oder gesendet.',
          tests: [`${COMPONENT} › AC1.7 labels the preview "Demo" and works with any token`, `${E2E} › AC1.7 marks the preview as a demo`],
          poCheck: 'Bitte ansehen: Ist die Kennzeichnung „Demo“ und der Kasten „Demo: simuliertes GitHub“ deutlich genug?'
        }
      ]
    },
    {
      id: 'AC2',
      story: 'G2',
      title: 'Offene Issues importieren',
      cases: [
        {
          id: 'AC2.1',
          title: 'Offene Issues importieren',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Verbunden mit goerks/GetThingsDone: 3 offene Issues (#31, #35, #38), 1 geschlossenes, 1 Pull Request.',
          when: 'Ich öffne den Backlog und drücke „Synchronisieren“ (erster Import).',
          then: '3 neue Stories „Login“, „Export as CSV“, „Dark mode“ mit Titel, Beschreibung und Labels. Das geschlossene Issue und der Pull Request fehlen.',
          tests: [`${COMPONENT} › AC2.1 imports the open issues as stories with title, description, labels and the link`, `${E2E} › AC2.1 imports the open issues, AC2.2 imports them only once and AC4.1 shows number and link`, `${DOMAIN} › AC2.1 makes a story of every open issue with title, description, labels, criteria and the link`, `${REST} › AC2.1 reads title, text, labels and address of the open issues and asks with a token that only reads`]
        },
        {
          id: 'AC2.2',
          title: 'Kein Duplikat',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Die 3 Issues sind schon importiert.',
          when: 'Ich synchronisiere nochmal.',
          then: 'Weiterhin 3 Stories. Das Ergebnis sagt „0 neu importiert“.',
          tests: [`${COMPONENT} › AC2.2 does not import the same issues again`, `${DOMAIN} › AC2.2 does not import an issue twice`]
        },
        {
          id: 'AC2.3',
          title: 'Pull Requests werden nicht importiert',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Das Repository hat auch einen offenen Pull Request („Pull request: fix typo“).',
          when: 'Ich importiere.',
          then: 'Nur die Issues werden Stories, der Pull Request nicht.',
          tests: [`${REST} › AC2.3 leaves out pull requests`]
        }
      ]
    },
    {
      id: 'AC3',
      story: 'G3',
      title: 'Abgleichen und Änderungen sehen',
      cases: [
        {
          id: 'AC3.1',
          title: 'Änderungen übernehmen',
          link: SETTINGS,
          target: '.github-demo',
          given: 'Importierte Story „Login“ (#31).',
          when: 'Unter „Demo: simuliertes GitHub“ drücke ich „#31 umbenennen, neues Label“ und synchronisiere im Backlog.',
          then: 'Die Story heisst „Login-Seite“ und hat das Label „bug“. Das Ergebnis nennt „Titel geändert: „Login“ → „Login-Seite““.',
          tests: [`${COMPONENT} › AC3.1 shows the changes of a synced story and says that GitHub wins`, `${E2E} › AC3.1 brings the changes of GitHub into the stories and shows them (also AC3.2, AC3.3 and AC3.7)`, `${DOMAIN} › AC3.1 takes title, description and labels from GitHub and tells what changed`]
        },
        {
          id: 'AC3.2',
          title: 'Geschlossen und wieder geöffnet',
          link: SETTINGS,
          target: '.github-demo',
          given: 'Importierte Story „Export as CSV“ (#35).',
          when: 'Ich schliesse #35 mit dem Demo-Knopf und synchronisiere; danach öffne ich es mit „#35 wieder öffnen“ und synchronisiere erneut.',
          then: 'Erst steht die Story in „Erledigt“ (Ergebnis: „erledigt (auf GitHub geschlossen)“), danach wieder im ersten Status („Offen“).',
          tests: [`${COMPONENT} › AC3.2 puts a story into Done when its issue is closed, and back to the first status when it is opened again`, `${DOMAIN} › AC3.2 puts a story whose issue was closed into Done, and back to the start when it is opened again`, `${DOMAIN} › AC3.2 leaves a story that was finished here alone while its issue is still open`]
        },
        {
          id: 'AC3.3',
          title: 'GitHub gewinnt',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Ich habe den Titel einer importierten Story lokal geändert.',
          when: 'Ich synchronisiere.',
          then: 'Der Titel ist wieder der von GitHub. Das Ergebnis sagt, dass lokale Änderungen überschrieben wurden.',
          tests: [`${COMPONENT} › AC3.3 and AC3.4 let GitHub win on the title and keep the plan of the story`, `${DOMAIN} › AC3.3 lets GitHub win over a local change of the title`]
        },
        {
          id: 'AC3.4',
          title: 'Lokale Planung bleibt',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Importierte Story liegt im Sprint 2, hat 5 Punkte und steht in „In Arbeit“.',
          when: 'Auf GitHub ändert sich nur der Titel, ich synchronisiere.',
          then: 'Sprint 2, 5 Punkte und „In Arbeit“ sind unverändert.',
          tests: [`${DOMAIN} › AC3.4 keeps sprint, points, epic, rank and the column of an open story`]
        },
        {
          id: 'AC3.5',
          title: 'Aufgabenliste wird zu Kriterien',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Issue #31 enthält unter „Acceptance criteria“ die Aufgaben „Login possible“ und (abgehakt) „Error message for a wrong password“.',
          when: 'Ich importiere.',
          then: 'Die Story „Login“ hat zwei Kriterien in dieser Reihenfolge, das zweite ist abgehakt. Die Aufgabenliste steht nicht zusätzlich in der Beschreibung.',
          tests: [`${COMPONENT} › AC3.5 shows the task list under "Acceptance criteria" as the criteria of the story`, `${DOMAIN} › AC3.5 turns the task list under "Acceptance criteria" into criteria and takes it out of the description`, `${DOMAIN} › AC3.5 also knows the German headings, other bullets and capital X`]
        },
        {
          id: 'AC3.6',
          title: 'Aufgaben ohne passende Überschrift',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Ein Issue hat eine Aufgabenliste unter der Überschrift „Todo“.',
          when: 'Ich importiere.',
          then: 'Keine Kriterien; die Liste bleibt Teil der Beschreibung.',
          tests: [`${COMPONENT} › AC3.6 keeps a task list under another heading in the description`, `${DOMAIN} › AC3.6 leaves tasks under another heading, and a heading without tasks, in the description`]
        },
        {
          id: 'AC3.7',
          title: 'Kriterien ändern sich auf GitHub',
          link: SETTINGS,
          target: '.github-demo',
          given: 'Story „Login“ mit 2 Kriterien, ich habe lokal eines abgehakt.',
          when: 'Ich drücke „Kriterien von #31 ändern“ (eine Aufgabe neu) und synchronisiere.',
          then: 'Kriterien und Haken entsprechen GitHub (mein lokaler Haken ist überschrieben). Das Ergebnis nennt die neuen und entfernten Kriterien.',
          tests: [`${COMPONENT} › AC3.7 takes added, removed and ticked criteria from GitHub and overwrites my tick`, `${DOMAIN} › AC3.7 adds, removes and ticks criteria as GitHub has them and overwrites a local tick`]
        },
        {
          id: 'AC3.8',
          title: 'Sync zeigt eine Zusammenfassung',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Auf GitHub ist ein Issue neu, zwei sind geändert, eines ist geschlossen.',
          when: 'Ich synchronisiere.',
          then: 'Ein Dialog mit „1 neu importiert, 2 aktualisiert, 1 erledigt“ und einer Liste der Änderungen je Issue. „Schliessen“ und Esc schliessen ihn, der Fokus ist danach auf „Synchronisieren“.',
          tests: [`${COMPONENT} › AC3.8 shows the summary of the sync and closes it with the button and with Esc`, `${COMPONENT} › AC3.8 shows the time of the last sync next to the button`, `${DOMAIN} › AC3.8 counts new, updated and closed issues apart`],
          poCheck: 'Bitte ansehen: Ist der Ergebnisdialog gut lesbar (Zahlen, Liste der Änderungen, Hinweis „GitHub gewinnt“), auch in einem schmalen Browserfenster?'
        }
      ]
    },
    {
      id: 'AC4',
      story: 'G4',
      title: 'Issue-Nummer und Link',
      cases: [
        {
          id: 'AC4.1',
          title: 'Nummer und Link',
          link: BACKLOG,
          target: '.github-badge',
          given: 'Importierte Story aus Issue #31.',
          when: 'Ich sehe Backlog und Story-Dialog an und klicke den Link.',
          then: 'Überall „#31“; der Link öffnet das Issue auf GitHub in einem neuen Tab und öffnet nicht die Story.',
          tests: [`${COMPONENT} › AC4.1 shows the number as a link to GitHub in the backlog and in the story`]
        },
        {
          id: 'AC4.2',
          title: 'Eigene Story',
          link: BACKLOG,
          target: '.backlog__row',
          given: 'Eine Story, die ich selbst angelegt habe.',
          when: 'Ich sehe sie im Backlog und im Dialog an.',
          then: 'Keine #-Nummer, kein GitHub-Link.',
          tests: [`${COMPONENT} › AC4.2 shows no number and no link on the stories of the team`]
        }
      ]
    },
    {
      id: 'AC5',
      story: 'G5',
      title: 'Klare Meldung bei Fehlern',
      cases: [
        {
          id: 'AC5.1',
          title: 'Ohne Netz',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Verbindung eingerichtet, ich bin offline (zum Beispiel in den Browser-Werkzeugen „Offline“ eingestellt).',
          when: 'Ich synchronisiere.',
          then: 'Meldung „Keine Verbindung zu GitHub. Die App arbeitet mit den lokalen Daten weiter.“ Board und Backlog bleiben unverändert benutzbar.',
          tests: [`${COMPONENT} › AC5.1 says there is no connection and keeps the local data`, `${E2E} › AC5.1 tells me when there is no network, AC5.2 when the token is refused, and the app keeps working`, `${COMPONENT} › AC5.1 tells me to set up the connection when repository or token are missing`, `${REST} › AC5.1 says "network" when there is no connection`]
        },
        {
          id: 'AC5.2',
          title: 'Falsches Token',
          link: SETTINGS,
          target: '.github-settings',
          given: 'Das Token ist falsch (in der Vorschau: der Text „falsch“).',
          when: 'Ich synchronisiere oder teste die Verbindung.',
          then: 'Meldung „Token wurde von GitHub abgelehnt …“. Lokale Stories sind unverändert.',
          tests: [`${COMPONENT} › AC5.2 says the token was refused and keeps the local data`, `${REST} › AC5.2 and AC1.4 tell a wrong token, a missing repository and the limit apart`]
        }
      ]
    },
    {
      id: 'AC6',
      story: 'G6',
      title: 'Sprachen und Tastatur',
      cases: [
        {
          id: 'AC6.1',
          title: 'Sprachen',
          link: SETTINGS,
          target: '.github-settings',
          given: 'Die App in Deutsch, Englisch, Französisch und Italienisch.',
          when: 'Ich wechsle die Sprache und sehe Abschnitt, Schalter, Meldungen, Sync-Dialog und Hilfe-Thema „GitHub-Issues“ an.',
          then: 'Alles ist in der gewählten Sprache; der Sprachwechsel wirkt sofort.',
          tests: [`${COMPONENT} › AC6.1 has every text of the GitHub connection in German, English, French and Italian`, `${COMPONENT} › AC6.1 shows the section and the sync button in German`]
        },
        {
          id: 'AC6.2',
          title: 'Nur Tastatur',
          link: FEATURES,
          target: '.features',
          given: 'Die App, nur Tastatur.',
          when: 'Ich schalte die Funktion ein, trage Repository und Token ein, teste die Verbindung, synchronisiere und schliesse den Ergebnisdialog, alles mit Tab, Leertaste, Enter und Esc.',
          then: 'Alles ist erreichbar, der Fokus ist sichtbar und kehrt nach dem Dialog zum Sync-Knopf zurück.',
          tests: [`${E2E} › AC6.2 works with the keyboard only, from the switch to the closed result dialog`]
        },
        {
          id: 'AC6.3',
          title: 'Optik des Ergebnisdialogs und der Vorschau-Kennzeichnung',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Importierte Stories, ein Sync-Ergebnis.',
          when: 'Ich sehe den Dialog auf Handy- und Desktop-Breite an.',
          then: 'Der Dialog ist lesbar; die „Demo“-Kennzeichnung ist gut sichtbar.',
          tests: [],
          manual: 'Optische Details (Lesbarkeit, Breite) beurteilt nur ein Mensch.',
          poCheck: 'Bitte ansehen: Der Ergebnisdialog ist auf Handy- und Desktop-Breite lesbar, die „Demo“-Kennzeichnung ist gut sichtbar.'
        }
      ]
    }
  ]
};
