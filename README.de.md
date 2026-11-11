![OpenCognit: You think. They build.](docs/img/banner.jpg)

# OpenCognit

**Alle Coding-Agenten in einem Fenster.** OpenCognit ist eine Desktop-App für Linux und Windows. Sie führt Claude Code, Codex, Gemini CLI, Kimi und Hermes nebeneinander in echten Terminal-Sessions aus, lässt einen Agenten die anderen steuern und prüft deren Arbeit, bevor sie in deinem Projekt landet.

Lokal. Ohne Telemetrie. Ohne Konto bei uns. Einmal kaufen.

[Herunterladen](https://github.com/OpenCognitOS/opencognit-releases/releases/latest) · [Website](https://opencognitos.github.io) · [English](README.md)

![Raster mit Agenten-Sessions](docs/img/grid.png)

> **In diesem Repository lag früher die quelloffene Agenten-Plattform OpenCognit.** Dieses Projekt ist eingestellt. Der Code bleibt unter der MIT-Lizenz im Branch [`legacy`](../../tree/legacy) verfügbar. OpenCognit geht als die hier beschriebene Desktop-App weiter. Sie ist ein kommerzielles Produkt und nicht quelloffen. Dieses Repository ist jetzt ihre öffentliche Adresse: Releases, Fehlermeldungen und Austausch.

## Was die App kann

- **Viele Agenten an einem Ort.** Echte Terminal-Sessions je CLI, in Fokus- oder Rasteransicht. Mehrere Logins je CLI (Arbeit und privat) bleiben getrennt.
- **Ein Orchestrator, der Arbeit verteilt.** Ein Agent startet andere, gibt jedem einen nummerierten Auftrag mit eigenem Dateibereich und erfährt, wenn sie berichten. Agenten können nicht außerhalb ihres Bereichs schreiben, und zwei offene Aufträge dürfen sich nicht überschneiden.
- **Guardrails, bevor etwas läuft.** Jeder Shell-Befehl eines Agenten wird gegen deine Regeln geprüft: sperren, nachfragen oder warnen. Vor Commits wird nach Schlüsseln gesucht.
- **Sehen, was passiert.** Ein Live-Graph zeigt, welcher Agent welche Datei liest oder ändert, und warnt, wenn zwei an derselben Stelle arbeiten.
- **Arbeit, die bleibt.** Sessions überleben den Neustart, Checkpoints führen zurück, geplante Aufträge und Nachtaufträge laufen im eigenen Arbeitsbaum und hinterlassen einen Bericht.
- **Dein Verbrauch, zusammengezählt.** Tokens aller CLIs aus ihren lokalen Protokollen, je Tag, Modell und Projekt.

![Live-Graph der Agenten-Aktivität](docs/img/graph.png)

## Datenschutz

OpenCognit läuft auf deinem Rechner und nutzt die Abos, die du bei den Anbietern der CLIs schon hast. Es gibt keinen Server von uns dazwischen und keine Telemetrie. Das Ereignisprotokoll bleibt in einer lokalen Datenbank; vollständige Terminal-Ausgaben werden dort nie gespeichert. Die Update-Prüfung liest eine Versionsdatei und sonst nichts.

## Preis

- **Kostenlos:** bis zu 4 Sessions gleichzeitig.
- **Vollversion:** 69 € einmalig, inklusive 12 Monaten Updates. Die Lizenz wird offline geprüft.

## Installieren

Lade den Installer für dein System aus dem [neuesten Release](https://github.com/OpenCognitOS/opencognit-releases/releases/latest):

| System | Datei |
|---|---|
| Linux | `OpenCognit-linux-x86_64.AppImage` oder `OpenCognit-linux-amd64.deb` |
| Windows | `OpenCognit-windows-setup.exe` |

Du brauchst mindestens eine der unterstützten CLIs, installiert und angemeldet. Der Einrichtungs-Assistent findet sie beim ersten Start.

## Fragen und Probleme

- **Etwas kaputt?** [Fehler melden](../../issues/new/choose).
- **Idee oder Frage?** Dafür gibt es die [Discussions](../../discussions).

## Lizenz

OpenCognit Desktop ist proprietäre Software, © OpenCognit. Das frühere quelloffene Projekt im Branch `legacy` bleibt unter der MIT-Lizenz.
