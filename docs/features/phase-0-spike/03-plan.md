# Umsetzungsplan: Phase 0 – Technischer Spike

- Status: Freigegeben
- Stand: 2026-09-01
- Bezugs-Scope: Phase 0
- Letzte fachliche Freigabe: 2026-08-17
- Ersetzt: keines

## Baseline

- [x] Projektartefakte und ADRs gelesen
- [x] Arbeitsbaum geprüft; noch kein Code vorhanden
- [x] Docker/Compose verfügbar
- [x] Zielzugänge als spätere Abhängigkeit markiert

## Spike-Reihenfolge

| # | Spike | Given / When / Then | Risiko |
| --- | --- | --- | --- |
| 001 | Runtime und Ressourcen | Gegeben ein Clean Host, wenn Compose startet, dann laufen Web/Worker/DB aus begrenzten Artefakten | hoch |
| 002 | Durable Worker | Gegeben Retry/Neustart, wenn Job wiederholt wird, dann entsteht eine Wirkung | hoch |
| 003 | Passkey-Origin | Gegeben stabiler Origin, wenn Enrollment/Login/Widerruf läuft, dann bleibt Auth passwortlos | hoch |
| 004 | Google-Grenze | Gegeben fehlende/Test-Credentials, wenn Adapter läuft, dann scheitert er sicher bzw. greift nur auf Testressource zu | hoch |
| 005 | Kiosk und Recovery | Gegeben Pi/NAS, wenn Prozesse/Geräte neu starten, dann erholt sich die Anzeige messbar | mittel |

## Aufgaben

| ID | Status | Ergebnis | REQ/AC | Prüfung | Abhängigkeit |
| --- | --- | --- | --- | --- | --- |
| TASK-001 | erledigt | Workspace, Lockfile, Gitignore, Featurestatus | REQ-001/004 | Clean install bestanden | keine |
| TASK-002 | erledigt | RED/GREEN für strikte Konfiguration | REQ-004 | 25 Vitest- und 4 Python-Sicherheitstests bestanden | TASK-001 |
| TASK-003 | erledigt | Web Live/Ready im gemeinsamen Image | REQ-001/002/005 | Health + Runtime-Smoke bestanden | TASK-002 |
| TASK-004 | erledigt | Worker + pg-boss + Idempotenz | REQ-003/005 | echter Abbruch nach Wirkung, Retry und dritte Zustellung: 3 Versuche, 1 Wirkung | TASK-003 |
| TASK-005 | erledigt | Compose, non-root, Limits, Healthchecks | NFR-001/002/003 | Runtime-Smoke bestanden | TASK-004 |
| TASK-006 | erledigt | gehärtetes Dump-/Restore-Harness | REQ-006 | 2 Restore- und 2 Migrationsläufe bestanden | TASK-005 |
| TASK-007 | erledigt | Better-Auth-/Passkey-Browserprobe | REQ-007 | Selbstregistrierungsgrenze und Recovery derselben Benutzer-ID per Playwright/WebAuthn bestanden | TASK-005 |
| TASK-008 | teilweise erledigt | Google Credential-/Adapterprobe | REQ-008 | lokale Contract-Tests bestanden; Live ausstehend | TASK-002 |
| TASK-009 | teilweise erledigt | NAS-/Pi-Zielskripte und Messformat | REQ-009/010 | lokale Verträge bestanden; Zielhardware ausstehend | TASK-005 |
| TASK-010 | in Arbeit | QA-Matrix und Go-/No-Go | alle | lokales Teilurteil dokumentiert; Gesamturteil ausstehend | TASK-006–009 |
| TASK-011 | offen | Drizzle-Testmigration | REQ-011 | frische + zweite Migration | TASK-005 |
| TASK-012 | offen | Google-Voll-/Deltaabgleich, Outbox und Dedupe | REQ-012 | bestätigter Testkalender-Live-Test | TASK-008 |
| TASK-013 | offen | Kiosk-Inaktivität und Haushaltsrückkehr | REQ-013 | Pi-Inaktivitäts-/Sitzungstest | TASK-009 |
| TASK-014 | offen | Responsive minimale Haushaltsansicht | REQ-014 | Playwright-Viewport-Matrix | TASK-007 |
| TASK-015 | offen | NAS-/Container-Wiederanlauf | REQ-015 | Zielhardware-Neustartprobe | TASK-009 |

## Traceability

| Anforderung | Akzeptanzkriterium | Aufgabe | Test/Nachweis |
| --- | --- | --- | --- |
| REQ-001/005 | AC-001 | TASK-003/005 | Compose Smoke |
| REQ-002 | AC-002 | TASK-003 | Health Integration |
| REQ-003 | AC-003 | TASK-004 | Restart/Dedupe |
| REQ-004 | AC-004 | TASK-002 | Config Mutation Tests |
| REQ-006 | AC-005 | TASK-006 | Restore Probe |
| REQ-007 | AC-006 | TASK-007 | Playwright/WebAuthn |
| REQ-008 | AC-007 | TASK-008 | No-network + Live Gate |
| REQ-009 | AC-008 | TASK-009 | Pi Restart Probe |
| REQ-010 | AC-009 | TASK-009/010 | NAS Metrics |
| REQ-011 | AC-010 | TASK-011 | Drizzle Migration Repeat |
| REQ-012 | AC-011 | TASK-012 | Google Full/Delta/Outbox/Dedupe |
| REQ-013 | AC-008 | TASK-013 | Pi Inaktivität/Sitzung |
| REQ-014 | AC-012 | TASK-014 | Playwright Viewport Matrix |
| REQ-015 | AC-013 | TASK-015 | NAS-/Container-Restart |

## Risiken und Entscheidungen

- RISK-001: 2 GB plus zwei PostgreSQL-Instanzen können Zieltest invalidieren; dann 6-GB-Ausbau empfehlen.
- RISK-002: VPS-Ergebnis ist kein NAS-Ressourcennachweis.
- RISK-003: Passkey-Origin-Wechsel invalidiert Credentials; Zielname vor finaler Live-Probe festlegen.
- RISK-004: Live-Google-Test ist ohne geschützte Credential-Datei nicht ausführbar.

## Abschlussbedingungen

- [ ] Alle lokal ausführbaren AC besitzen reale Toolausgabe.
- [ ] Zielhardware-AC sind bestanden, fehlgeschlagen oder ausdrücklich nicht ausgeführt.
- [ ] Kein Secret und keine produktive Personendatei im Diff.
- [ ] QA-Bericht und Status sind aktuell.
- [ ] Go-/No-Go ist mit Einschränkungen begründet.
