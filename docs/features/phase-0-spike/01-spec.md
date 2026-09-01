# Spezifikation: Phase 0 – Technischer Spike

- Status: Freigegeben
- Stand: 2026-09-01
- Bezugs-Scope: Phase 0
- Letzte fachliche Freigabe: 2026-08-17
- Ersetzt: keines

## Ziel

Die riskanten Architekturannahmen durch ausführbare Proben und dokumentierte Messungen validieren, bevor MVP-Produktcode entsteht.

`PLAN.md` ist für den freigegebenen Phase-0-Umfang führend. Lokal nicht ausführbare Punkte bleiben Teil von Phase 0 und werden als `nicht ausgeführt` ausgewiesen; sie dürfen nicht nachträglich als Nicht-Scope oder bestanden umgedeutet werden.

## Nicht-Scope

- fachliche Kalender-, Aufgaben- oder Belohnungsoberfläche,
- produktive Familien- oder Kinderdaten,
- öffentliches Ingress,
- Home Assistant,
- endgültiges visuelles Design,
- produktives NAS-Deployment ohne gesonderte Zielzugänge.

## Funktionale Anforderungen

- REQ-001: Ein Compose-Projekt muss Web, Worker und PostgreSQL reproduzierbar starten.
- REQ-002: Web muss getrennte Liveness- und Readiness-Endpunkte bereitstellen; Readiness muss DB-Ausfall erkennen.
- REQ-003: Worker-Jobs müssen PostgreSQL-persistent, retryfähig und fachlich idempotent sein.
- REQ-004: Laufzeitkonfiguration muss streng validiert werden und bei fehlenden/ungültigen Werten geheimnisneutral scheitern.
- REQ-005: Derselbe Image-Build muss Web- und Worker-Rolle per Startbefehl ausführen.
- REQ-006: Ein PostgreSQL-Dump muss in eine frische Instanz restaurierbar und semantisch prüfbar sein.
- REQ-007: Der Passkey-Stack muss über den konfigurierten Origin initialisierbar und mit einer ausführbaren Browserprobe testbar sein.
- REQ-008: Der Google-Adapter muss fehlende/unsichere Credentials vor jedem Netzwerkaufruf ablehnen und einen getrennten Live-Testpfad besitzen.
- REQ-009: Der Pi-Kiosk muss einen reproduzierbaren Autostart-/Recovery-Testpfad besitzen.
- REQ-010: Der Stack muss messbare CPU-, RSS-, Neustart-, Swap- und OOM-Nachweise liefern.
- REQ-011: Eine Drizzle-Testmigration muss auf einer frischen und einer bereits migrierten Datenbank reproduzierbar laufen.
- REQ-012: Der Google-Testadapter muss Vollabgleich, inkrementellen Abgleich, simulierte Outbox und Doppelversuch ausschließlich mit synthetischen Testkalenderdaten nachweisen.
- REQ-013: Der Pi-Kiosk muss nach Chromium-/Geräteneustart und Inaktivität in den Haushaltsmodus am finalen Tailscale-Origin zurückkehren, ohne persönliche Sitzung offenzuhalten.
- REQ-014: Eine minimale Haushaltsansicht muss auf Full-HD-Pi und Smartphone responsiv bedienbar sein.
- REQ-015: Web und Worker müssen sich nach NAS-/Container-Neustart auf der Zielhardware selbstständig erholen.

## Akzeptanzkriterien

### AC-001 — Compose-Start [REQ-001, REQ-005]
- **Angenommen** ein sauberer Docker-Host
- **Wenn** der Spike per Compose gebaut und gestartet wird
- **Dann** werden Web, Worker und PostgreSQL gesund und Web/Worker verwenden denselben Image-Digest.

### AC-002 — Readiness erkennt DB-Ausfall [REQ-002]
- **Angenommen** Web ist gestartet
- **Wenn** PostgreSQL erreichbar beziehungsweise nicht erreichbar ist
- **Dann** liefert `/health/ready` entsprechend Erfolg beziehungsweise einen nicht-erfolgreichen Status, während `/health/live` den Webprozess getrennt bewertet.

### AC-003 — Persistenter idempotenter Job [REQ-003]
- **Angenommen** ein Job besitzt einen stabilen fachlichen Schlüssel
- **Wenn** der Worker während Verarbeitung neu startet oder derselbe Job erneut gesendet wird
- **Dann** entsteht genau ein fachliches Ergebnis und kein Job geht still verloren.

### AC-004 — Fail-closed Konfiguration [REQ-004]
- **Angenommen** ein Pflichtwert fehlt, ist unbekannt oder ungültig
- **Wenn** Web oder Worker startet
- **Dann** stoppt der Prozess vor DB-/Netzwerkzugriff mit einer stabilen Meldung ohne Wert, Secret oder absoluten Pfad.

### AC-005 — Dump und Restore [REQ-006]
- **Angenommen** Migrationen und ein eindeutiger Probe-Datensatz existieren
- **Wenn** Dump erstellt und in eine frische Datenbank restauriert wird
- **Dann** bestehen Schema-, Datensatz- und Idempotenzprüfungen.

### AC-006 — Passkey-Probe [REQ-007]
- **Angenommen** ein stabiler HTTPS- beziehungsweise zulässiger Localhost-Origin
- **Wenn** Enrollment, Login, Widerruf und Recovery getestet werden
- **Dann** sind Erfolgs- und Negativpfade nachgewiesen, ohne Passwortfallback als Produktvertrag einzuführen.

### AC-007 — Google-Grenze [REQ-008]
- **Angenommen** keine Credentials oder eine geschützte Test-Credential-Datei
- **Wenn** der Adapter geprüft wird
- **Dann** schlägt der erste Fall vor Netzwerkzugriff neutral fehl; der zweite darf nur den freigegebenen Testkalender lesen beziehungsweise in einem gesondert bestätigten CRUD-Test verändern.

### AC-008 — Kiosk-Wiederanlauf und Inaktivität [REQ-009, REQ-013]
- **Angenommen** der Raspberry Pi 5 wurde mit der Spike-Konfiguration versehen und der finale Tailscale-Origin ist erreichbar
- **Wenn** Chromium oder das Gerät neu startet beziehungsweise die Inaktivitätsfrist abläuft
- **Dann** erscheint der Haushaltsmodus wieder im Vollbild und eine persönliche Sitzung bleibt nicht dauerhaft entsperrt.

### AC-009 — Ressourcenurteil [REQ-010]
- **Angenommen** der vollständige Stack und der bereits bestehende NAS-PostgreSQL-Container laufen
- **Wenn** Web, Job, Migration und Backup einzeln belastet werden
- **Dann** werden Spitzenwerte, Neustarts, Swap und OOM dokumentiert und gegen die Go-/No-Go-Grenzen bewertet.

### AC-010 — Drizzle-Migration [REQ-011]
- **Angenommen** eine frische sowie eine bereits migrierte Spike-Datenbank
- **Wenn** die Drizzle-Testmigration jeweils ausgeführt wird
- **Dann** entsteht dasselbe erwartete Schema und die zweite Ausführung bleibt ohne Drift oder doppeltes Objekt.

### AC-011 — Google-Sync und Outbox [REQ-012]
- **Angenommen** ein freigegebener Google-Testkalender mit synthetischen Einträgen
- **Wenn** Vollabgleich, inkrementeller Abgleich, simulierte Outbox und derselbe Schreibversuch zweimal ausgeführt werden
- **Dann** konvergiert der lokale Testzustand, der Sync-Token wird korrekt verwendet und es entsteht höchstens ein externer Termin.

### AC-012 — Responsive Haushaltsansicht [REQ-014]
- **Angenommen** die minimale Haushaltsansicht
- **Wenn** sie in Full-HD-Kioskgröße und typischer Smartphonebreite bedient wird
- **Dann** bleiben Hauptinformationen und primäre Aktionen ohne horizontales Scrollen erreichbar.

### AC-013 — Ziel-Wiederanlauf [REQ-015]
- **Angenommen** der Stack läuft auf der DS225+
- **Wenn** Web-/Worker-Container beziehungsweise die NAS neu starten
- **Dann** werden Healthchecks wieder gesund und ein persistenter Probejob geht nicht still verloren.

## Nichtfunktionale Anforderungen

| ID | Bereich | Prüfbare Anforderung | Nachweis |
| --- | --- | --- | --- |
| NFR-001 | Sicherheit | Container laufen non-root; DB-Port bleibt intern | Image-/Compose-Prüfung |
| NFR-002 | Ressourcen | Limits für Web, Worker und DB sind gesetzt | `docker inspect`/Statistik |
| NFR-003 | Reproduzierbarkeit | Lockfile und gepinnte Major-Versionen vorhanden | Clean Build |
| NFR-004 | Datenschutz | Keine Familien-/Kalendertexte oder Secrets in Logs | Log-/Diff-Scan |
| NFR-005 | Wiederanlauf | Restart-Policies und Healthchecks sind wirksam | Restart-Probe |

## Daten und Datenschutz

Es werden ausschließlich synthetische Probe-IDs und Testkalenderdaten verwendet. Keine Familiennamen, Kinderfotos, realen Termine oder produktiven Zugangsdaten werden eingecheckt.

## Fehler- und Grenzfälle

- DB startet verspätet oder fällt aus.
- Worker stirbt nach externer Wirkung, aber vor Jobabschluss.
- Job wird doppelt eingereiht.
- Konfiguration enthält unbekannte oder secret-ähnliche Felder.
- Migration oder Restore wird zweimal ausgeführt.
- Google-Datei fehlt oder hat zu offene Dateirechte.
- Service Worker beziehungsweise Kiosk lädt einen alten Build.

## Abhängigkeiten, Annahmen und offene Fragen

- DEP-001: Docker/Compose auf lokaler und Zielumgebung.
- DEP-002: späterer Zugriff auf NAS, Pi und Tailscale.
- DEP-003: späterer geschützter Google-Testzugang.
- ASM-001: Lokale VPS-Resultate validieren Funktion, nicht das 2-GB-Ressourcenurteil.
