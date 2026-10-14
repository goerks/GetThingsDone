---
name: hilfe
description: "Lists and explains the PO commands (/hilfe). /help is built into Claude Code, so this command is called /hilfe."
---

# /hilfe: the commands (#43)

Answer exactly with this overview in German (keep it in line with the other skills in `.claude/skills/`):

```markdown
## Befehle

| Befehl | Wann | Was passiert |
|---|---|---|
| `/start` | Zu Beginn einer Session | Die 5 wichtigsten offenen Issues mit kurzer Beurteilung und 2–3 Fragen, wie es weitergeht |
| `/neu <Text>` | Du hast eine Idee oder ein Anliegen | Ich lege ein Issue in deinen Worten an und stelle die offenen Fragen |
| `/freigabe #<Nr>` | Abnahmekriterien oder Testfälle passen | Ich halte die Freigabe fest. Danach schlage ich Testfälle vor oder frage, ob ich bauen soll |
| `/go #<Nr>` | Bauen starten | Ich baue alles und schicke dir den Pull Request mit dem Link zur Vorschau |
| `/korrektur #<Nr> <Text>` | Beim Testen passt etwas nicht | Ich korrigiere es und schicke den neuen Link |
| `/abgenommen #<Nr>` | Alles passt | Ich übernehme die Änderung in `main` und schliesse das Issue |
| `/stand #<Nr>` | Wo steht etwas? | Stand, was offen ist, und der nächste Schritt |
| `/hilfe` | Jederzeit | Diese Übersicht |

`#<Nr>` ist die Nummer des Issues (oder des Pull Requests). Ohne Nummer nehme ich das Issue, um das es gerade geht.
Du kannst auch normal schreiben („passt“, „bau es“): Die Befehle sind nur eine Abkürzung.
Was du mir sagst, halte ich jeweils selbst im Issue fest; du musst nicht auf GitHub schreiben.
```
