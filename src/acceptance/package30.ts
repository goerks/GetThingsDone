import type { Criterion } from './types';

/**
 * GitHub issues (#30): the acceptance criteria and their test cases for the product owner, in German.
 * One source for the issue comment, the acceptance panel of the preview and the names of the automated tests.
 * Design: variant B (switch in Settings → Features, section "GitHub", "Synchronisieren" in the backlog).
 * The roundtrip (AC7–AC11) publishes local changes with "Synchronisieren" when "Auch nach GitHub schreiben" is on. The preview has a simulated GitHub: the repository goerks/GetThingsDone with the open issues #31 "Login" (two criteria),
 * #35 "Export as CSV" and #38 "Dark mode", the closed issue #29 and a pull request. Under Settings → Connections the section
 * "Demo" has buttons to change these issues; any text is accepted as a token, except "falsch".
 */
const COMPONENT = 'src/Github.test.tsx';
const E2E = 'e2e/github.spec.ts';
const DOMAIN = 'src/domain/github.test.ts';
const REST = 'src/github/restSource.test.ts';
const ROUNDTRIP = 'src/GithubRoundtrip.test.tsx';
const RDOMAIN = 'src/domain/githubRoundtrip.test.ts';
const RUN = 'src/github/runSync.test.ts';
const CONNECTOR = 'src/github/connector.test.ts';
const SMAP = 'src/domain/githubStoryMap.test.ts';
const AUTO = 'src/GithubAuto.test.tsx';
const SYNCLOG = 'src/domain/syncLog.test.ts';

const FEATURES = '#/settings/github';
const SETTINGS = '#/settings/github';
const BACKLOG = '#/backlog';

export const PACKAGE_30: { issue: number; pullRequest: number; title: string; criteria: Criterion[] } = {
  issue: 30,
  pullRequest: 62,
  title: 'GitHub-Issues importieren und in beide Richtungen abgleichen',
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
          target: '.feature-tab',
          given: 'Frische App, ich habe nichts eingestellt.',
          when: 'Ich öffne Einstellungen → GitHub-Anbindung und den Backlog.',
          then: '„GitHub-Anbindung“ steht auf „Aus“. Unter „Verbindungen“ gibt es nichts zum Einrichten, im Backlog keinen Knopf „Synchronisieren“.',
          tests: [`${COMPONENT} › AC1.1 is off by default: no section, no button in the backlog`, `${DOMAIN} › AC1.1 is off by default and has no repository`]
        },
        {
          id: 'AC1.2',
          title: 'Funktion einschalten',
          link: FEATURES,
          target: '.feature-tab',
          given: '„GitHub-Anbindung“ ist aus.',
          when: 'Ich schalte sie ein.',
          then: 'In den Einstellungen erscheint der Abschnitt „Verbindungen“ mit den Feldern Repository und Zugriffstoken.',
          tests: [`${COMPONENT} › AC1.2 shows the section "GitHub" with repository and token as soon as the feature is on`, `${E2E} › AC1.2 and AC1.3 switch the feature on, connect the repository and show a working connection`]
        },
        {
          id: 'AC1.3',
          title: 'Verbindung speichern',
          link: SETTINGS,
          target: '.github-settings',
          given: 'Funktion ist an, Abschnitt „Verbindungen“ ist offen.',
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
          target: '.feature-tab',
          given: 'Funktion an, Stories wurden importiert.',
          when: 'Ich schalte „GitHub-Anbindung“ aus und später wieder ein.',
          then: 'Aus: Abschnitt „Verbindungen“, Sync-Knopf und #-Nummern sind weg. Wieder an: die Stories und die Verbindung sind wieder da.',
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
        ,{
          id: 'AC1.8',
          title: 'Schreiben ist standardmässig aus',
          link: SETTINGS,
          target: '.github-options',
          given: 'Verbindung eingerichtet, ich habe nichts weiter eingestellt.',
          when: 'Ich öffne Einstellungen → Verbindungen.',
          then: '„Auch nach GitHub schreiben“ steht auf „aus“. Der Hinweis nennt, dass das Token dafür das Recht „Issues: Lesen und Schreiben“ braucht.',
          tests: [`${ROUNDTRIP} › AC1.8 has writing off by default and says which right the token needs`]
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
          tests: [`${COMPONENT} › AC3.1 shows the changes of a synced story that GitHub changed`, `${E2E} › AC3.1 brings the changes of GitHub into the stories and shows them (also AC3.2, AC3.3 and AC3.7)`, `${DOMAIN} › AC3.1 takes title, description and labels from GitHub and tells what changed`]
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
          title: 'Konflikt: GitHub gewinnt (Standard)',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Titel einer importierten Story lokal in „Anmeldung“ geändert, auf GitHub in „Login-Seite“. Konfliktregel steht auf „GitHub gewinnt“.',
          when: 'Ich synchronisiere.',
          then: 'Der Titel ist „Login-Seite“. Das Ergebnis sagt: „Lokale Änderung überschrieben: Titel „Anmeldung““.',
          tests: [`${ROUNDTRIP} › AC3.3 lets GitHub win by default and names the overwritten local title`, `${RDOMAIN} › AC3.3 lets GitHub win by default and names the lost local title`, `${COMPONENT} › AC3.3 and AC3.4 let GitHub win on the title and keep the plan of the story`]
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
          given: 'Story „Login“ mit 2 Kriterien, lokal nichts geändert.',
          when: 'Ich drücke „Kriterien von #31 ändern“ (eine Aufgabe neu, eine entfernt, eine abgehakt) und synchronisiere.',
          then: 'Kriterien und Haken entsprechen GitHub. Das Ergebnis nennt die neuen und entfernten Kriterien.',
          tests: [`${COMPONENT} › AC3.7 takes added, removed and ticked criteria from GitHub and overwrites my tick`, `${DOMAIN} › AC3.7 adds, removes and ticks criteria as GitHub has them and overwrites a local tick`]
        },
        {
          id: 'AC3.8',
          title: 'Sync meldet das Ergebnis kurz',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Auf GitHub ist ein Issue neu, zwei sind geändert, eines ist geschlossen.',
          when: 'Ich synchronisiere.',
          then: 'Kein Dialog (ab AC17): unten steht kurz „Synchronisiert: 1 neu, 2 aktualisiert, 1 geschlossen“. Die Liste der Änderungen je Issue steht im Sync-Protokoll.',
          tests: [`${COMPONENT} › AC3.8 answers with a short notice and lists the issues in the log`, `${COMPONENT} › AC3.8 shows the time of the last sync next to the button`, `${DOMAIN} › AC3.8 counts new, updated and closed issues apart`],
          poCheck: 'Bitte ansehen: Ist das Protokoll gut lesbar (Zahlen, Liste der Änderungen, Hinweis „GitHub gewinnt“), auch in einem schmalen Browserfenster?'
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
          tests: [`${COMPONENT} › AC4.1 shows the number as a link to GitHub in the backlog and in the story`, `src/github/openExternal.test.ts › AC4.1 opens the issue through the app on the desktop and takes the click over`]
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
          when: 'Ich wechsle die Sprache und sehe Abschnitt, Schalter, Meldungen, Sync-Meldung und Hilfe-Thema „GitHub-Issues“ an.',
          then: 'Alles ist in der gewählten Sprache; der Sprachwechsel wirkt sofort.',
          tests: [`${COMPONENT} › AC6.1 has every text of the GitHub connection in German, English, French and Italian`, `${COMPONENT} › AC6.1 shows the section and the sync button in German`]
        },
        {
          id: 'AC6.2',
          title: 'Nur Tastatur',
          link: FEATURES,
          target: '.feature-tab',
          given: 'Die App, nur Tastatur.',
          when: 'Ich schalte die Funktion ein, trage Repository und Token ein, teste die Verbindung, synchronisiere, alles mit Tab, Leertaste, Enter und Esc.',
          then: 'Alles ist erreichbar, der Fokus ist sichtbar und bleibt nach dem Sync auf dem Sync-Knopf.',
          tests: [`${E2E} › AC6.2 works with the keyboard only, from the switch to the notice after the sync`]
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
    ,{
      id: 'AC7',
      story: 'G7',
      title: 'Lokale Änderungen nach GitHub veröffentlichen',
      cases: [
        {
          id: 'AC7.1',
          title: 'Lokale Änderung wird veröffentlicht',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Schreiben ist an. Story „Login“ (#31) ist importiert.',
          when: 'Ich ändere den Titel lokal in „Login-Seite“ und füge das Label „bug“ hinzu, dann klicke ich „Synchronisieren“.',
          then: 'Auf GitHub heisst Issue #31 „Login-Seite“ und hat das Label „bug“ (in der Vorschau: der Demo-Zustand zeigt es nach erneutem Synchronisieren). Das Ergebnis sagt „2 Änderungen nach GitHub veröffentlicht“ und nennt Titel und Label.',
          tests: [`${ROUNDTRIP} › AC7.1 publishes the change with "Synchronise" and says what was published`, `${RDOMAIN} › AC7.1 publishes a changed title and a new label when writing is on`, `${RUN} › AC7.1 publishes the change, names it in the result and has nothing pending afterwards (AC9.2)`, `${RUN} › AC7.1 reports labels GitHub does not know and keeps them on the story`]
        },
        {
          id: 'AC7.2',
          title: 'Kriterien und Haken werden veröffentlicht',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Schreiben ist an. Story mit Kriterien „Login möglich“ und „Fehlermeldung“.',
          when: 'Ich hake „Login möglich“ ab, füge „Passwort vergessen“ hinzu und synchronisiere.',
          then: 'Das Issue hat unter „Acceptance criteria“ die Aufgaben „- [x] Login möglich“, „- [ ] Fehlermeldung“, „- [ ] Passwort vergessen“; der übrige Text bleibt unverändert.',
          tests: [`${RDOMAIN} › AC7.2 publishes criteria and ticks under "Acceptance criteria" and keeps the rest of the text`]
        },
        {
          id: 'AC7.3',
          title: 'Erledigt wird zu Geschlossen',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Schreiben ist an. Importierte Story „Export as CSV“ (#35).',
          when: 'Ich ziehe die Story nach „Erledigt“ und synchronisiere; danach ziehe ich sie zurück nach „In Arbeit“ und synchronisiere erneut.',
          then: 'Erst ist das Issue geschlossen, danach wieder offen.',
          tests: [`${RDOMAIN} › AC7.3 closes the issue of a story that is done and opens it again when the story is not`, `${RUN} › AC7.3 reopens a closed issue whose story left Done, even though it is not in the list of open issues`]
        },
        {
          id: 'AC7.4',
          title: 'Nichts ohne Knopfdruck',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Schreiben ist an, ich habe lokal drei Stories geändert.',
          when: 'Ich warte und lade die Seite neu, ohne „Synchronisieren“ zu klicken.',
          then: 'Auf GitHub hat sich nichts geändert.',
          tests: [`${ROUNDTRIP} › AC7.4 publishes nothing on its own, however long I wait`, `${RUN} › AC7.4 and AC7.5 send nothing when writing is off, and the change stays pending`]
        },
        {
          id: 'AC7.5',
          title: 'Schreiben aus: nichts wird veröffentlicht',
          link: SETTINGS,
          target: '.github-options',
          given: 'Schreiben ist aus, eine Story wurde lokal geändert.',
          when: 'Ich synchronisiere.',
          then: 'Auf GitHub ändert sich nichts. Die lokale Änderung bleibt als „noch nicht auf GitHub“ markiert. Das Ergebnis sagt, dass Schreiben aus ist.',
          tests: [`${ROUNDTRIP} › AC7.5 publishes nothing when writing is off, says so, and keeps the story marked`, `${RDOMAIN} › AC7.5 publishes nothing when writing is off and counts what stays`]
        },
        {
          id: 'AC7.6',
          title: 'Kein Recht zum Schreiben',
          link: SETTINGS,
          target: '.github-settings',
          given: 'Schreiben ist an, das Token hat nur Leserecht (in der Vorschau: das Token „nurlesen“).',
          when: 'Ich ändere eine Story lokal und synchronisiere.',
          then: 'Meldung „GitHub hat das Schreiben abgelehnt. Das Token braucht das Recht „Issues: Lesen und Schreiben“.“ Die lokale Änderung bleibt erhalten und markiert.',
          tests: [`${ROUNDTRIP} › AC7.6 says what the token needs and keeps the local change when GitHub refuses to write`, `${RUN} › AC7.6 keeps the local change and says "forbidden" when the token may not write`, `${E2E} › AC7.6 says what the token needs when GitHub refuses to write`]
        }
      ]
    },
    {
      id: 'AC8',
      story: 'G8',
      title: 'Konflikte: wer gewinnt',
      cases: [
        {
          id: 'AC8.1',
          title: 'Konflikt: Lokal gewinnt',
          link: SETTINGS,
          target: '.github-options',
          given: 'Konfliktregel „Lokal gewinnt“. Titel lokal „Anmeldung“, auf GitHub „Login-Seite“.',
          when: 'Ich synchronisiere.',
          then: 'Auf GitHub und lokal heisst es „Anmeldung“. Das Ergebnis sagt: „GitHub-Änderung überschrieben: Titel „Login-Seite““.',
          tests: [`${ROUNDTRIP} › AC8.1 lets the local change win and names the overwritten GitHub title`, `${RDOMAIN} › AC8.1 lets the local change win and names the lost GitHub title`, `${RDOMAIN} › AC8.1 keeps the local change but cannot publish it when writing is off`]
        },
        {
          id: 'AC8.2',
          title: 'Konflikt: Ich entscheide',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Konfliktregel „Ich entscheide“. Titel lokal „Anmeldung“, auf GitHub „Login-Seite“.',
          when: 'Ich synchronisiere und wähle im Dialog „Lokale Fassung behalten“ (oder „GitHub-Fassung nehmen“).',
          then: 'Der Dialog zeigt beide Fassungen nebeneinander. Bis zu meiner Wahl ändert sich weder lokal noch auf GitHub etwas. Danach gilt meine Wahl auf beiden Seiten.',
          tests: [`${ROUNDTRIP} › AC8.2 shows both versions and changes nothing until I choose`, `${RDOMAIN} › AC8.2 changes nothing until I decide, then follows my answer on both sides`, `${RUN} › AC8.2 asks and changes nothing until the answer is given`],
          poCheck: 'Bitte ansehen: Ist der Konflikt-Dialog gut lesbar (beide Fassungen nebeneinander, auf dem Handy untereinander)?'
        },
        {
          id: 'AC8.3',
          title: 'Dialog abbrechen',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Der Konflikt-Dialog ist offen.',
          when: 'Ich drücke Esc.',
          then: 'Nichts wurde geändert, der Konflikt bleibt offen und erscheint beim nächsten Synchronisieren wieder.',
          tests: [`${ROUNDTRIP} › AC8.3 keeps the conflict open when I cancel the dialog with Esc`]
        },
        {
          id: 'AC8.4',
          title: 'Verschiedene Felder sind kein Konflikt',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Lokal Titel geändert, auf GitHub nur die Beschreibung.',
          when: 'Ich synchronisiere.',
          then: 'Beides bleibt: neuer Titel lokal und auf GitHub, neue Beschreibung lokal und auf GitHub. Es gibt keine Konfliktmeldung.',
          tests: [`${ROUNDTRIP} › AC8.4 is no conflict when different fields changed`, `${RDOMAIN} › AC8.4 is no conflict when different fields changed: both changes stay`, `${RDOMAIN} › AC8.4 takes the same change on both sides without a conflict`]
        }
      ]
    },
    {
      id: 'AC9',
      story: 'G9',
      title: 'Sehen, was noch nicht auf GitHub ist',
      cases: [
        {
          id: 'AC9.1',
          title: 'Noch nicht auf GitHub sichtbar',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Ich habe lokal bei 3 importierten Stories je den Titel geändert.',
          when: 'Ich öffne den Backlog.',
          then: 'Die 3 Stories sind markiert („nicht auf GitHub“), oben steht „3 Änderungen noch nicht auf GitHub“.',
          tests: [`${ROUNDTRIP} › AC9.1 and AC9.2 marks the changed stories, counts the changes and clears them after the sync`, `${RDOMAIN} › AC9.1 names the fields that changed here since the last sync`, `${RDOMAIN} › AC9.1 marks nothing on a story of the team`]
        },
        {
          id: 'AC9.2',
          title: 'Markierung verschwindet nach dem Abgleich',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Wie AC9.1.',
          when: 'Ich synchronisiere erfolgreich.',
          then: 'Keine Markierung, keine Zahl mehr. Schlägt das Synchronisieren fehl (offline), bleiben Markierung und Zahl stehen.',
          tests: [`${ROUNDTRIP} › AC9.2 keeps the marks and the count when the sync fails`, `${RDOMAIN} › AC9.2 has nothing pending once the published fields are the new base`]
        }
      ]
    },
    {
      id: 'AC10',
      story: 'G10',
      title: 'Neue Story als Issue auf GitHub anlegen',
      cases: [
        {
          id: 'AC10.1',
          title: 'Neue Story auf GitHub anlegen',
          link: BACKLOG,
          target: '.backlog__row',
          given: 'Schreiben ist an. Meine eigene Story „Export als CSV“ ohne #-Nummer.',
          when: 'Ich öffne ihr Menü (Rechtsklick) und wähle „Auf GitHub anlegen“.',
          then: 'Auf GitHub gibt es ein neues Issue „Export als CSV“ mit Beschreibung und Labels. Die Story zeigt jetzt die neue #-Nummer und den Link.',
          tests: [`${ROUNDTRIP} › AC10.1 creates the issue from the menu and links the story to it`, `${RDOMAIN} › AC10.1 makes the issue of title, description with criteria and labels, and links the story to it`, `${RUN} › AC10.1 creates the issue of a story and links the story to it`, `${E2E} › AC10.1 creates an issue from a story of my own, links it, and AC10.3 does not offer it a second time`]
        },
        {
          id: 'AC10.2',
          title: 'Nur auf Wunsch',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Zwei eigene Stories ohne GitHub-Verknüpfung, Schreiben ist an.',
          when: 'Ich synchronisiere.',
          then: 'Es entsteht kein neues Issue. „Auf GitHub anlegen“ ist nur bei Stories ohne Verknüpfung zu sehen und nur, solange Schreiben an ist.',
          tests: [`${ROUNDTRIP} › AC10.2 creates nothing on a sync, and offers the item only for a story without link while writing is on`, `${ROUNDTRIP} › AC10.2 does not offer the item while writing is off`]
        },
        {
          id: 'AC10.3',
          title: 'Nicht doppelt anlegen',
          link: BACKLOG,
          target: '.backlog__row',
          given: '„Export als CSV“ wurde bereits auf GitHub angelegt.',
          when: 'Ich öffne wieder ihr Menü.',
          then: '„Auf GitHub anlegen“ fehlt; stattdessen ist der Link zum Issue da.',
          tests: [`${ROUNDTRIP} › AC10.3 does not offer it again once the issue exists`, `${RDOMAIN} › AC10.3 does not bring back an issue whose story was deleted`]
        }
      ]
    },
    {
      id: 'AC11',
      story: 'G11',
      title: 'Ein allgemeiner Mechanismus, ein Anschluss pro Dienst',
      cases: [
        {
          id: 'AC11.1',
          title: 'Verbindungen und geplante Dienste',
          link: SETTINGS,
          target: '.github-services',
          given: 'Funktion ist an.',
          when: 'Ich öffne Einstellungen → Verbindungen.',
          then: 'GitHub ist als verbunden gelistet. GitLab, Jira und Trello stehen als „geplant“ da und lassen sich nicht auswählen.',
          tests: [`${ROUNDTRIP} › AC11.1 lists GitHub as connected and GitLab, Jira and Trello as planned`, `${E2E} › AC11.1 lists GitHub as connected and the other services as planned`]
        },
        {
          id: 'AC11.2',
          title: 'Verbindung entfernen',
          link: SETTINGS,
          target: '.github-settings',
          given: 'GitHub ist verbunden, 3 Stories sind importiert.',
          when: 'Ich entferne die Verbindung.',
          then: 'Nach einer Rückfrage ist die Verbindung samt Token weg. Die 3 Stories bleiben unverändert, nur ohne Link und #-Nummer und ohne Markierung „nicht auf GitHub“.',
          tests: [`${ROUNDTRIP} › AC11.2 removes the connection after asking, and the stories stay without link and marker`]
        },
        {
          id: 'AC11.3',
          title: 'Ein Mechanismus, ein Anschluss pro Dienst',
          link: SETTINGS,
          target: '.github-services',
          given: 'Rein technisch, deshalb nur automatisiert geprüft.',
          when: 'Eine gemeinsame Testreihe (Lesen, Schreiben, Fehler, Konflikt) läuft gegen den GitHub-Anschluss, die simulierte Vorschau und einen Test-Anschluss.',
          then: 'Alle bestehen sie mit demselben Sync-Motor.',
          tests: [`${CONNECTOR} › AC11.3 connector contract`]
        }
      ]
    },
    {
      id: 'AC12',
      story: 'G12',
      title: 'Releases und Milestones abgleichen',
      cases: [
        {
          id: 'AC12.1',
          title: 'Milestone wird zum Release',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Auf GitHub hat Issue #31 „Login“ den Milestone „v1.0“ (Beschreibung „Erste Version“, fällig am 31.12.2026). In der App gibt es kein Release „v1.0“.',
          when: 'Ich synchronisiere.',
          then: 'Es gibt ein Release „v1.0“ mit Beschreibung und Ende 31.12.2026. Die Story gehört dazu. Das Ergebnis nennt „Release neu: v1.0“.',
          tests: [`${SMAP} › AC12.1 makes a release of a milestone that has none yet and puts the story into it`]
        },
        {
          id: 'AC12.2',
          title: 'Release einer Story von GitHub übernehmen',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Story „Login“ (#31) gehört zu Release „v1.0“, lokal nichts geändert.',
          when: 'Auf GitHub setze ich #31 auf den Milestone „v2.0“ (als Release vorhanden) und synchronisiere.',
          then: 'Die Story gehört zu „v2.0“. Das Ergebnis nennt die Änderung.',
          tests: [`${SMAP} › AC12.2 takes the milestone of the issue as the release of the story`]
        },
        {
          id: 'AC12.3',
          title: 'Release einer Story nach GitHub veröffentlichen',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Schreiben ist an. Release „v2.0“ hat schon einen Milestone auf GitHub.',
          when: 'Ich weise die Story „Login“ lokal dem Release „v2.0“ zu und synchronisiere.',
          then: 'Auf GitHub hat #31 den Milestone „v2.0“. Entferne ich das Release lokal, hat das Issue keinen Milestone mehr.',
          tests: [`${SMAP} › AC12.3 publishes the release of a story as the milestone, and removes it when the story has none`, `${RUN} › AC12.3 publishes the milestone of a release to the issue`]
        },
        {
          id: 'AC12.4',
          title: 'Release ohne Milestone',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Schreiben ist aus. Das Release „Herbst“ hat noch keinen Milestone auf GitHub.',
          when: 'Ich weise eine verknüpfte Story dem Release „Herbst“ zu und synchronisiere.',
          then: 'Auf GitHub ändert sich der Milestone nicht. Das Ergebnis sagt, dass „Herbst“ noch keinen Milestone hat; die Zuweisung bleibt lokal markiert.',
          tests: [`${SMAP} › AC12.4 does not publish a release without a milestone while writing is off, and says so`]
        },
        {
          id: 'AC12.5',
          title: 'Milestone legt der Abgleich an',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Schreiben ist an. Release „Herbst“ (Beschreibung, Ende 30.11.2026) ohne Milestone; eine verknüpfte Story ist diesem Release zugewiesen.',
          when: 'Ich synchronisiere.',
          then: 'Auf GitHub gibt es den Milestone „Herbst“ mit Beschreibung und Fälligkeitsdatum, das Issue ist ihm zugewiesen, und das Ergebnis nennt „Milestone angelegt: Herbst“. Es gibt keinen Knopf dafür.',
          tests: [`${SMAP} › AC12.5 asks the run to make the milestone of a release when writing is on`, `${ROUNDTRIP} › AC12.5 names the milestone that a sync made for a release`, `${RUN} › AC12.5 makes the milestone of a release that a story is in, with description and due date`]
        },
        {
          id: 'AC12.6',
          title: 'Release und Milestone ändern sich beide',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Story „Login“ gehört zu „v1.0“. Lokal setze ich sie auf „v2.0“, auf GitHub auf den Milestone „v3.0“.',
          when: 'Ich synchronisiere.',
          then: 'Es gilt die Konfliktregel der Verbindung (Standard: „v3.0“). Das Ergebnis nennt, was überschrieben wurde; bei „Ich entscheide“ zeigt der Dialog beide Fassungen.',
          tests: [`${SMAP} › AC12.6 lets GitHub win by default when story and issue moved to different releases`]
        },
        {
          id: 'AC12.7',
          title: 'Sprachen und Tastatur',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Die Meldungen und Knöpfe zu Releases und Epics.',
          when: 'Ich wechsle die Sprache und bediene die neuen Knöpfe nur mit der Tastatur.',
          then: 'Alles ist in DE, EN, FR und IT, der Fokus ist sichtbar, die Hilfe nennt Milestones und Epic-Labels.',
          tests: [`${ROUNDTRIP} › AC12.7 has the texts of the new features in German, English, French and Italian`]
        }
      ]
    },
    {
      id: 'AC13',
      story: 'G13',
      title: 'Epics über Labels abgleichen',
      cases: [
        {
          id: 'AC13.1',
          title: 'Epic-Label wird zum Epic',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Auf GitHub hat Issue #31 das Label „epic: Login & Konto“. In der App gibt es kein Epic dieses Namens.',
          when: 'Ich synchronisiere.',
          then: 'Es gibt ein Epic „Login & Konto“, die Story gehört dazu. Das Label erscheint nicht zusätzlich im Feld „Labels“. Das Ergebnis nennt „Epic neu: Login & Konto“.',
          tests: [`${SMAP} › AC13.1 makes an epic of a label "epic: …", takes it out of the labels and puts the story into it`, `${SMAP} › AC13.1 does the same for a story that is imported`]
        },
        {
          id: 'AC13.2',
          title: 'Epic einer Story von GitHub übernehmen',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Story „Login“ gehört zum Epic „Boards“, lokal nichts geändert.',
          when: 'Auf GitHub ersetze ich „epic: Boards“ durch „epic: Backlog“ und synchronisiere.',
          then: 'Die Story gehört zum Epic „Backlog“. Das Ergebnis nennt die Änderung.',
          tests: [`${SMAP} › AC13.2 takes the epic of the issue as the epic of the story`]
        },
        {
          id: 'AC13.3',
          title: 'Epic einer Story nach GitHub veröffentlichen',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Schreiben ist an. Auf GitHub gibt es das Label „epic: Backlog“.',
          when: 'Ich weise die Story „Login“ lokal dem Epic „Backlog“ zu und synchronisiere.',
          then: '#31 trägt „epic: Backlog“; ein altes Epic-Label ist entfernt, andere Labels bleiben. Nehme ich der Story das Epic, verschwindet das Epic-Label.',
          tests: [`${SMAP} › AC13.3 publishes the epic as a label, replaces the old epic label and keeps the other labels`]
        },
        {
          id: 'AC13.4',
          title: 'Epic ohne Label auf GitHub',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Schreiben ist aus. Das Epic „Storage“ hat auf GitHub noch kein Label.',
          when: 'Ich weise eine verknüpfte Story dem Epic „Storage“ zu und synchronisiere.',
          then: 'Auf GitHub wird kein Label angelegt. Das Ergebnis sagt, dass es „epic: Storage“ nicht gibt; die Zuweisung bleibt lokal markiert.',
          tests: [`${SMAP} › AC13.4 names the epic label that GitHub does not have, and keeps the assignment pending`, `${RUN} › AC13.4 and AC15.5 make nothing while writing is off and name the missing labels`]
        },
        {
          id: 'AC13.5',
          title: 'Epic-Label legt der Abgleich an',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Schreiben ist an. Epic „Storage“ ohne Label auf GitHub; eine verknüpfte Story ist diesem Epic zugewiesen.',
          when: 'Ich synchronisiere.',
          then: 'Auf GitHub gibt es das Label „epic: Storage“ in der Farbe des Epics, das Issue trägt es, und das Ergebnis nennt „Label angelegt: epic: Storage“. Es gibt keinen Knopf dafür.',
          tests: [`${RUN} › AC13.5 makes the label of an epic that a story needs before it publishes it, and remembers that it made it`]
        },
        {
          id: 'AC13.6',
          title: 'Mehrere Epic-Labels',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Ein Issue hat zwei Labels „epic: Boards“ und „epic: Backlog“.',
          when: 'Ich synchronisiere.',
          then: 'Es gilt das erste („Boards“). Das Ergebnis weist darauf hin, dass das Issue mehrere Epic-Labels hat.',
          tests: [`${SMAP} › AC13.6 counts only the first epic label and says that there are several`]
        },
        {
          id: 'AC13.7',
          title: 'Sprachen und Tastatur',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Die Meldungen und Knöpfe zu Epics.',
          when: 'Ich wechsle die Sprache und bediene die neuen Knöpfe nur mit der Tastatur.',
          then: 'Alles ist in DE, EN, FR und IT, der Fokus ist sichtbar, die Hilfe nennt die Epic-Labels.',
          tests: [`${ROUNDTRIP} › AC13.7 has the texts of the new features in German, English, French and Italian`]
        }
      ]
    },
    {
      id: 'AC14',
      story: 'G14',
      title: 'Sync-Icon auf Backlog, Board und Story Map',
      cases: [
        {
          id: 'AC14.1',
          title: 'Icon statt Text',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Funktion „GitHub-Anbindung“ ist an und verbunden.',
          when: 'Ich öffne nacheinander Backlog, Board und Story Map.',
          then: 'Auf jeder Seite steht oben ein Icon mit zwei runden Pfeilen im Kreis, kein Text „Synchronisieren“. Mit der Maus darauf erscheint „Synchronisieren“ und der Zeitpunkt des letzten Abgleichs. Ein Screenreader liest „Synchronisieren“.',
          tests: [`${ROUNDTRIP} › AC14.1 shows an icon button instead of the text on backlog, board and story map`]
        },
        {
          id: 'AC14.2',
          title: 'Auf jeder Seite derselbe Abgleich',
          link: "#/board",
          target: '.github-sync',
          given: 'Auf GitHub ist ein Issue neu.',
          when: 'Ich klicke das Icon im Board (danach in der Story Map).',
          then: 'Dieselbe kurze Meldung wie im Backlog („Synchronisiert: 1 neu“). Der Fokus bleibt auf dem Icon.',
          tests: [`${ROUNDTRIP} › AC14.2 synchronises from the board with the same notice and keeps the focus on the icon`]
        },
        {
          id: 'AC14.3',
          title: 'Nur wo es sinnvoll ist',
          link: "#/epics",
          target: '.page-head',
          given: 'Funktion ist an.',
          when: 'Ich öffne Epics, Releases und Einstellungen.',
          then: 'Dort gibt es kein Sync-Icon. Schalte ich die Funktion aus, verschwindet es auch auf Backlog, Board und Story Map.',
          tests: [`${ROUNDTRIP} › AC14.3 has no icon on epics, releases and settings, and none while the feature is off`]
        },
        {
          id: 'AC14.4',
          title: 'Läuft gerade',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Die Verbindung ist langsam.',
          when: 'Ich klicke das Icon und gleich noch einmal.',
          then: 'Solange der Abgleich läuft, dreht sich das Icon und ein zweiter Klick startet nichts Neues. Danach steht es still.',
          tests: [`${ROUNDTRIP} › AC14.4 turns while a sync runs and starts nothing new on a second click`]
        },
        {
          id: 'AC14.5',
          title: 'Noch nicht auf GitHub',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Ich habe lokal bei 3 verknüpften Stories etwas geändert.',
          when: 'Ich sehe mir das Icon an.',
          then: 'Am Icon steht die Zahl 3; der Tooltip sagt „3 Änderungen noch nicht auf GitHub“. Nach erfolgreichem Abgleich ist die Zahl weg.',
          tests: [`${ROUNDTRIP} › AC14.5 shows the number of changes that are not on GitHub yet at the icon`]
        },
        {
          id: 'AC14.6',
          title: 'Nur Tastatur und Sprachen',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Die App, nur Tastatur.',
          when: 'Ich erreiche das Icon mit Tab, löse es mit Enter oder Leertaste aus und wechsle die Sprache.',
          then: 'Der Fokus ist sichtbar, Name und Tooltip sind in DE, EN, FR und IT.',
          tests: [`${ROUNDTRIP} › AC14.6 works with the keyboard`]
        },
        {
          id: 'AC14.7',
          title: 'Optik',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Importierte Stories.',
          when: 'Ich sehe das Icon auf Handy- und Desktop-Breite an, hell und dunkel.',
          then: 'Das Icon passt in die Kopfzeile, ist gut erkennbar, die Zahl ist lesbar und überdeckt nichts.',
          tests: [], manual: 'Optische Details (Lesbarkeit, Platz in der Kopfzeile) beurteilt nur ein Mensch.', poCheck: 'Bitte ansehen: Das Sync-Icon passt auf Handy- und Desktop-Breite, hell und dunkel, und die Zahl ist lesbar.'
        }
      ]
    },
    {
      id: 'AC15',
      story: 'G15',
      title: 'Board-Zwischenstände über Status-Labels',
      cases: [
        {
          id: 'AC15.1',
          title: 'Status-Label wird zur Spalte',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Auf GitHub ist Issue #31 offen und hat das Label „status: in progress“. Die Story „Login“ steht in „Offen“.',
          when: 'Ich synchronisiere.',
          then: 'Die Story steht in „In Arbeit“. Das Label erscheint nicht im Feld „Labels“. Das Ergebnis nennt die Änderung.',
          tests: [`${SMAP} › AC15.1 puts the story into the column a label "status: …" names and keeps the label out of the labels`]
        },
        {
          id: 'AC15.2',
          title: 'Label entfernen bringt in die erste Spalte',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Story „Login“ steht in „Review“ (Issue hat „status: review“), lokal nichts geändert.',
          when: 'Auf GitHub entferne ich das Label und synchronisiere.',
          then: 'Die Story steht in „Offen“.',
          tests: [`${SMAP} › AC15.2 puts the story back into the first column when the label is gone`]
        },
        {
          id: 'AC15.3',
          title: 'Geschlossen bleibt Erledigt',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Issue #31 trägt „status: review“ und wird auf GitHub geschlossen.',
          when: 'Ich synchronisiere.',
          then: 'Die Story steht in „Erledigt“; das Label spielt keine Rolle mehr.',
          tests: [`${SMAP} › AC15.3 keeps a closed issue done whatever its status label says`]
        },
        {
          id: 'AC15.4',
          title: 'Spalte nach GitHub veröffentlichen',
          link: "#/board",
          target: '.github-sync',
          given: 'Schreiben ist an. Auf GitHub gibt es das Label „status: in progress“.',
          when: 'Ich ziehe die Story „Login“ auf dem Board nach „In Arbeit“ und synchronisiere.',
          then: 'Das Issue trägt „status: in progress“; ein altes Status-Label ist entfernt, andere Labels bleiben. Nach „Offen“ verschwindet das Label, nach „Erledigt“ wird das Issue geschlossen.',
          tests: [`${SMAP} › AC15.4 publishes the column as a label, replaces the old one and drops it for the first column and done`]
        },
        {
          id: 'AC15.5',
          title: 'Fehlendes Status-Label',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Schreiben ist aus. Das Label „status: review“ gibt es auf GitHub noch nicht.',
          when: 'Ich ziehe eine verknüpfte Story nach „Review“ und synchronisiere.',
          then: 'Es wird kein Label angelegt. Das Ergebnis sagt, dass „status: review“ fehlt; die Story bleibt als „nicht auf GitHub“ markiert.',
          tests: [`${SMAP} › AC15.5 names the status label that GitHub does not have`, `${SMAP} › AC15.5 keeps a column without a label on GitHub as pending`]
        },
        {
          id: 'AC15.6',
          title: 'Status-Label legt der Abgleich an',
          link: "#/board",
          target: '.github-sync',
          given: 'Schreiben ist an. Das Label „status: review“ fehlt auf GitHub; eine verknüpfte Story steht in „Review“.',
          when: 'Ich synchronisiere.',
          then: 'Auf GitHub gibt es „status: review“, das Issue trägt es, und das Ergebnis nennt „Label angelegt: status: review“. Spalten ohne Story bekommen kein Label. Es gibt keinen Knopf dafür.',
          tests: [`${RUN} › AC15.6 makes the label of a column that a story is in`, `${ROUNDTRIP} › AC15.6 names the status label that a sync made for a column`]
        },
        {
          id: 'AC15.7',
          title: 'Beides geändert',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Story „Login“ lokal in „Review“, auf GitHub mit „status: in progress“.',
          when: 'Ich synchronisiere.',
          then: 'Es gilt die Konfliktregel der Verbindung (Standard: „In Arbeit“). Das Ergebnis nennt, was überschrieben wurde.',
          tests: [`${SMAP} › AC15.7 lets GitHub win by default when both sides changed the column`]
        },
        {
          id: 'AC15.8',
          title: 'Eigene Spaltennamen',
          link: "#/board",
          target: '.github-sync',
          given: 'Es gibt einen eigenen Status „Test“ (Kategorie „In Arbeit“).',
          when: 'Ich ziehe eine Story dorthin und lege die Status-Labels an.',
          then: 'Das Label heisst „status: Test“; die Story landet nach dem Abgleich wieder in „Test“.',
          tests: [`${SMAP} › AC15.8 names a column of its own after its label and finds it again`]
        },
        {
          id: 'AC15.9',
          title: 'Sprachen und Tastatur',
          link: SETTINGS,
          target: '.github-options',
          given: 'Das Ergebnis eines Abgleichs.',
          when: 'Ich wechsle die Sprache.',
          then: 'Meldungen und Hilfe sind in DE, EN, FR und IT.',
          tests: [`${ROUNDTRIP} › AC15.9 has the texts of the new features in German, English, French and Italian`]
        }
      ]
    },
    {
      id: 'AC16',
      story: 'G16',
      title: 'Labels und Milestones legt und löscht der Abgleich selbst',
      cases: [
        {
          id: 'AC16.1',
          title: 'Label des gelöschten Epics wird gelöscht',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Das Label „epic: Alt“ hat die App angelegt. Das Epic „Alt“ ist gelöscht und kein Issue trägt das Label mehr.',
          when: 'Ich synchronisiere.',
          then: 'Das Label ist auf GitHub gelöscht und das Ergebnis nennt „Label gelöscht: epic: Alt“.',
          tests: [`${RUN} › AC16.1 deletes the label the app made when its epic is gone and no issue has it any more`, `${ROUNDTRIP} › AC16.1 names the label that a sync deleted because nothing needs it any more`]
        },
        {
          id: 'AC16.2',
          title: 'Label bleibt, solange das Epic existiert',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Das Epic „Storage“ existiert noch; sein Label hat die App angelegt.',
          when: 'Ich synchronisiere.',
          then: 'Das Label bleibt auf GitHub.',
          tests: [`${RUN} › AC16.2 keeps the label while its epic still exists`]
        },
        {
          id: 'AC16.3',
          title: 'Label einer gelöschten Spalte wird gelöscht',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Die Spalte „Review“ ist gelöscht; ihr Label hat die App angelegt.',
          when: 'Ich synchronisiere.',
          then: 'Das Label „status: review“ ist auf GitHub gelöscht.',
          tests: [`${RUN} › AC16.3 deletes the label of a column that is gone`]
        },
        {
          id: 'AC16.4',
          title: 'Milestone eines gelöschten Releases wird gelöscht',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Das Release „Herbst“ ist gelöscht; seinen Milestone hat die App angelegt.',
          when: 'Ich synchronisiere.',
          then: 'Die Issues verlassen den Milestone, danach ist er auf GitHub gelöscht.',
          tests: [`${RUN} › AC16.4 deletes the milestone of a release that is gone, after the issues have left it`]
        },
        {
          id: 'AC16.5',
          title: 'Fremde Labels und Milestones bleiben',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Auf GitHub gibt es ein Label und einen Milestone, die nicht die App angelegt hat.',
          when: 'Ich synchronisiere.',
          then: 'Beide bleiben unberührt.',
          tests: [`${RUN} › AC16.5 never deletes a label or a milestone that the app did not make`]
        },
        {
          id: 'AC16.6',
          title: 'Ohne Schreiben wird nichts gelöscht',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Schreiben ist aus.',
          when: 'Ich synchronisiere.',
          then: 'Auf GitHub wird nichts angelegt oder gelöscht.',
          tests: [`${RUN} › AC16.6 deletes nothing while writing is off`]
        },
        {
          id: 'AC16.7',
          title: 'Sprachen',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Das Ergebnis eines Abgleichs.',
          when: 'Ich wechsle die Sprache.',
          then: 'Meldungen „angelegt“ und „gelöscht“ sind in DE, EN, FR und IT.',
          tests: [`${ROUNDTRIP} › AC16.7 has the texts of the new features in German, English, French and Italian`]
        }
      ]
    },
    {
      id: 'AC17',
      story: 'G17',
      title: 'Dezente Bestätigung statt Bericht',
      cases: [
        {
          id: 'AC17.1',
          title: 'Bestätigung statt Bericht',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Schreiben ist an; auf GitHub gibt es 2 neue Tickets und bei 3 bekannten Tickets einen neuen Titel.',
          when: 'Ich drücke das Sync-Symbol.',
          then: 'Es öffnet sich kein Fenster. Unten erscheint kurz „Synchronisiert: 2 neu, 3 aktualisiert“ mit „Protokoll“; nach 5 Sekunden ist es weg. Am Symbol erscheint kurz ein Häkchen.',
          tests: [`${COMPONENT} › AC17.1 answers with a short notice with a log button and opens no dialog`]
        },
        {
          id: 'AC17.2',
          title: 'Nichts geändert',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Alles ist schon abgeglichen.',
          when: 'Ich drücke das Sync-Symbol.',
          then: 'Unten steht „Schon auf dem neuesten Stand“.',
          tests: [`${COMPONENT} › AC17.2 says that everything is up to date`]
        },
        {
          id: 'AC17.3',
          title: '„Protokoll“ in der Meldung',
          link: BACKLOG,
          target: '.toast',
          given: 'Eine Meldung nach dem Sync ist sichtbar.',
          when: 'Ich klicke in der Meldung auf „Protokoll“.',
          then: 'Das Sync-Protokoll in den Einstellungen öffnet sich.',
          tests: [`${COMPONENT} › AC17.3 leads from the notice to the sync log`]
        },
        {
          id: 'AC17.4',
          title: 'Fehler bleibt stehen',
          link: BACKLOG,
          target: '.toast',
          given: 'Das Netz ist weg.',
          when: 'Ich drücke das Sync-Symbol.',
          then: 'Eine rote Meldung „Synchronisation fehlgeschlagen: Keine Verbindung“ mit „Protokoll“ bleibt, bis ich sie schliesse.',
          tests: [`${COMPONENT} › AC17.4 keeps an error notice until it is closed`]
        },
        {
          id: 'AC17.5',
          title: 'Entscheidung nötig',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Konfliktregel „Ich entscheide“; Ticket „Login“ wurde beidseitig geändert.',
          when: 'Ich drücke das Sync-Symbol von Hand.',
          then: 'Das bekannte Fenster zur Auswahl öffnet sich (nur hier gibt es ein Fenster).',
          tests: [`${ROUNDTRIP} › AC17.5 opens the choice for a sync by hand with the rule "I decide" and no other dialog`]
        }
      ]
    },
    {
      id: 'AC18',
      story: 'G18',
      title: 'Automatische Synchronisation',
      cases: [
        {
          id: 'AC18.1',
          title: 'Schalter aus',
          link: FEATURES,
          target: '.github-auto',
          given: 'Neu verbundene GitHub-Verbindung.',
          when: 'Ich öffne Einstellungen → GitHub.',
          then: '„Automatisch synchronisieren“ ist aus; es läuft nichts von selbst.',
          tests: [`${COMPONENT} › AC18.1 has the automatic sync off by default and runs nothing by itself`]
        },
        {
          id: 'AC18.2',
          title: 'Lauf beim Start und Zurückkehren',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Schalter an; auf GitHub gibt es ein neues Ticket „Notifications“.',
          when: 'Ich starte die App neu (später: ich wechsle weg und zurück).',
          then: 'Ohne Klick kommt „Notifications“ als Story ins Backlog, mit der kurzen Meldung unten.',
          tests: [`${AUTO} › AC18.2 runs at the start and when the app comes back`]
        },
        {
          id: 'AC18.3',
          title: 'Alle 15 Minuten',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Schalter an, App offen.',
          when: 'Ich warte 15 Minuten, nachdem sich ein Ticket auf GitHub geändert hat.',
          then: 'Die Änderung ist ohne Klick in der Story. Die Einstellungen zeigen „Letzter Lauf“ und „nächster Lauf“ mit neuen Zeiten.',
          tests: [`${AUTO} › AC18.3 runs again every 15 minutes`, `${SYNCLOG} › AC18.3 is due after 15 minutes`]
        },
        {
          id: 'AC18.4',
          title: 'Gleiche Regeln wie der Knopf',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Schreiben ist aus.',
          when: 'Ich ändere eine Story lokal und warte auf die Automatik.',
          then: 'Nichts wird auf GitHub geschrieben; mit eingeschaltetem Schreiben geht die Änderung dorthin.',
          tests: [`${AUTO} › AC18.4 writes to GitHub only while writing is on`]
        },
        {
          id: 'AC18.5',
          title: 'Kein Lauf, wenn ich gerade tippe',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Schalter an; ein Fenster ist offen oder ich tippe in ein Feld.',
          when: 'Ich warte auf den nächsten Lauf.',
          then: 'Der Lauf wartet, bis ich fertig bin; ohne Netz wird übersprungen.',
          tests: [`${SYNCLOG} › AC18.5 waits while a dialog is open or someone types, and while offline`]
        },
        {
          id: 'AC18.6',
          title: 'Schalter bleibt',
          link: FEATURES,
          target: '.github-auto',
          given: 'Schalter an.',
          when: 'Ich lade die App neu; dann entferne ich die Verbindung.',
          then: 'Nach dem Neuladen ist er noch an; nach dem Entfernen der Verbindung aus.',
          tests: [`${AUTO} › AC18.6 keeps the switch and turns it off when the connection is removed`]
        },
        {
          id: 'AC18.7',
          title: 'Knopf geht weiter',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Automatik an.',
          when: 'Ich drücke das Sync-Symbol.',
          then: 'Es läuft sofort; ein gleichzeitiger zweiter Lauf startet nicht.',
          tests: [`${AUTO} › AC18.7 starts no second run while one is going on`]
        }
      ]
    },
    {
      id: 'AC19',
      story: 'G19',
      title: 'Konflikte und Fehler der Automatik',
      cases: [
        {
          id: 'AC19.1',
          title: 'Konflikte bei der Automatik',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Regel „Ich entscheide“, Automatik an, ein Ticket wurde beidseitig geändert.',
          when: 'Ich warte auf den automatischen Lauf.',
          then: 'Es öffnet sich nichts. Das Ticket ist markiert, am Symbol steht „1“, die Meldung sagt „Konflikte warten auf dich: 1“ mit „Prüfen“, das die bekannte Auswahl öffnet.',
          tests: [`${AUTO} › AC19.1 asks nothing in an automatic run and offers to review the conflict`]
        },
        {
          id: 'AC19.2',
          title: 'Pause nach Fehlern',
          link: BACKLOG,
          target: '.github-sync',
          given: 'Automatik an, das Netz ist weg.',
          when: 'Ich warte drei Läufe ab.',
          then: 'Die Automatik pausiert; das Symbol zeigt „!“; das Protokoll nennt den Grund. Ein Klick auf das Symbol startet sie wieder.',
          tests: [`${AUTO} › AC19.2 pauses after three errors in a row and resumes with the icon`]
        }
      ]
    },
    {
      id: 'AC20',
      story: 'G20',
      title: 'Sync-Protokoll',
      cases: [
        {
          id: 'AC20.1',
          title: 'Protokoll pro Lauf',
          link: FEATURES,
          target: '.github-log',
          given: 'Es gab einen Lauf beim Start, einen automatischen und einen von Hand.',
          when: 'Ich öffne Einstellungen → GitHub → Protokoll.',
          then: 'Zeilen mit Zeit, Auslöser (Start / Automatisch / Manuell), Zusammenfassung und Ergebnis.',
          tests: [`${COMPONENT} › AC20.1 logs every run with its trigger`]
        },
        {
          id: 'AC20.2',
          title: 'Einzelne Änderungen',
          link: FEATURES,
          target: '.github-log',
          given: 'Ein Lauf mit Änderungen.',
          when: 'Ich klicke auf die Zeile.',
          then: 'Sie zeigt jedes Ticket mit Feld, von → nach und wer gewonnen hat, dazu angelegte oder gelöschte Labels und Milestones.',
          tests: [`${COMPONENT} › AC20.2 shows the single changes of a run`]
        },
        {
          id: 'AC20.3',
          title: 'Leere Läufe und Fehler',
          link: FEATURES,
          target: '.github-log',
          given: 'Mehrere Läufe ohne Änderung und ein Fehler.',
          when: 'Ich öffne das Protokoll und wechsle den Filter.',
          then: 'Läufe ohne Änderung sind zu einer Zeile zusammengefasst; ein Fehler steht mit Grund drin. Der Filter zeigt jeweils nur das Passende.',
          tests: [`${SYNCLOG} › AC20.3 folds runs without changes and filters the log`]
        },
        {
          id: 'AC20.4',
          title: 'Aufbewahren und leeren',
          link: FEATURES,
          target: '.github-log',
          given: 'Ein Protokoll mit Läufen.',
          when: 'Ich lade neu; dann drücke ich „Leeren“.',
          then: 'Das Protokoll ist nach dem Neuladen noch da; nach „Leeren“ leer. Es bleiben höchstens die letzten 100 Läufe oder 90 Tage.',
          tests: [`${SYNCLOG} › AC20.4 keeps at most 100 runs of 90 days`, `${COMPONENT} › AC20.4 clears the log`]
        },
        {
          id: 'AC20.5',
          title: 'Sprachen und Tastatur',
          link: FEATURES,
          target: '.github-log',
          given: 'Das Protokoll.',
          when: 'Ich wechsle auf Französisch und bediene Schalter, Protokoll und Meldung nur mit der Tastatur.',
          then: 'Alle Texte sind übersetzt, alles ist per Tastatur erreichbar; die Hilfe erklärt die Automatik.',
          tests: [`${ROUNDTRIP} › AC20.5 has the texts of the new features in German, English, French and Italian`],
          manual: 'Echte Tastatur und Übersetzungen in vier Sprachen'
        }
      ]
    }
  ]
};
