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

const FEATURES = '#/settings/features';
const SETTINGS = '#/settings/github';
const BACKLOG = '#/backlog';

export const PACKAGE_30: { issue: number; pullRequest: number; title: string; criteria: Criterion[] } = {
  issue: 30,
  pullRequest: 48,
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
          target: '.features',
          given: 'Frische App, ich habe nichts eingestellt.',
          when: 'Ich öffne Einstellungen → Funktionen und den Backlog.',
          then: '„GitHub-Anbindung“ steht auf „Aus“. In den Einstellungen gibt es keinen Abschnitt „Verbindungen“, im Backlog keinen Knopf „Synchronisieren“.',
          tests: [`${COMPONENT} › AC1.1 is off by default: no section, no button in the backlog`, `${DOMAIN} › AC1.1 is off by default and has no repository`]
        },
        {
          id: 'AC1.2',
          title: 'Funktion einschalten',
          link: FEATURES,
          target: '.features',
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
          target: '.features',
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
          tests: [`${ROUNDTRIP} › AC7.6 says what the token needs and keeps the local change when GitHub refuses to write`, `${RUN} › AC7.6 keeps the local change and says "forbidden" when the token may not write`]
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
          tests: [`${ROUNDTRIP} › AC10.1 creates the issue from the menu and links the story to it`, `${RDOMAIN} › AC10.1 makes the issue of title, description with criteria and labels, and links the story to it`, `${RUN} › AC10.1 creates the issue of a story and links the story to it`]
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
          tests: [`${ROUNDTRIP} › AC11.1 lists GitHub as connected and GitLab, Jira and Trello as planned`]
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
    }
  ]
};
