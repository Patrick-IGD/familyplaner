# Status: Phase 0 – Technischer Spike

- Aktuelle Phase: lokale Phase-0-Lücken AC-010 bis AC-012 geschlossen; Zielzugänge und erneuter unabhängiger Review ausstehend
- Letzte Freigabe: 2026-08-17 („du kannst loslegen“)
- Letzte Aktualisierung: 2026-09-02

## Erledigt

- Projektkontext, ADRs und spec-getriebene Phase-0-Artefakte erstellt
- lokales Git-Repository und Ignore-Verträge eingerichtet
- SvelteKit-/Node-Image mit getrennten Web-/Worker-Rollen aufgebaut
- strikte geheimnisneutrale Laufzeit- und Auth-Konfiguration per TDD umgesetzt
- getrennte Live-/Ready-Healthchecks und DB-Ausfallverhalten verifiziert
- PostgreSQL-Migrationen, pg-boss-Worker, echter Abbruch nach Wirkung und verlustfreier idempotenter Retry verifiziert
- Container als non-root mit CPU-, RAM- und PID-Limits betrieben
- PostgreSQL-Dump zweimal in zurückgesetzte Instanz restauriert, Migration zweimal ausgeführt und semantisch geprüft
- Better-Auth-Passkey-Ablauf mit gesperrter Selbstregistrierung außerhalb des Localhost-Testmodus und Recovery desselben Kontos geprüft
- Google-Credential-Grenze mit fd-basierter Parent-Verankerung, No-follow-Dateiöffnung, exakter Kalender-Allowlist und explizitem Read-only-Live-Pfad per TDD erstellt
- NAS-Metrikcollector, Pi-Kiosk-Unit und Wiederanlaufprobe erstellt
- normale Compose-Konfiguration veröffentlicht keinen PostgreSQL-Hostport
- AC-010: Drizzle-Testmigration (drizzle-orm 0.45.2) mit frischer, bereits migrierter und reparierter Datenbank per TDD umgesetzt und bestanden
- AC-011: Google-Sync-Adapter mit Vollabgleich, syncToken-Delta, simulierter Outbox und Doppelversuch-Dedupe ausschließlich mit synthetischen Daten umgesetzt und bestanden
- AC-012: minimale responsive Haushaltsansicht mit Playwright-Viewport-Matrix (1920×1080 Kiosk, 390×844 Smartphone) umgesetzt und bestanden

## Aktueller Nachweis

- Unit: 26 Vitest-Tests und 16 Python-Restore-/Runtime-Sicherheitstests bestanden
- PostgreSQL-Integration: 6 Tests bestanden (2 bestehende Migrationstests + 3 Drizzle-Tests + Konkurrenzsicherheit)
- Google-Sync: 9 Node-Tests mit synthetischen Daten bestanden
- E2E: 1 Passkey-Test und 2 Viewport-Tests bestanden
- Zielskript-Verträge: 17 Tests bestanden
- Svelte Check: 0 Fehler, 0 Warnungen
- Build und Format: bestanden (geänderte Dateien Prettier-konform)

## Offene Blocker

- geschützte Google-Testcredential-Datei und Testkalender-ID für AC-007-Live und den Live-Teil von AC-011
- finaler Tailscale-HTTPS-Origin und Zugriff auf Raspberry Pi 5 für AC-008
- Zugriff auf DS225+ sowie Name des bestehenden PostgreSQL-Containers für AC-009 und AC-013
- die 13 Credential-Grenzen-Tests sind Linux-spezifisch und auf der Zielplattform (Linux-Container) erneut auszuführen; unter Windows-Node schlagen sie aus Umgebungsgründen fehl

## Geänderte Artefakte

- `spikes/001-runtime-resources/`: Runtime-, Worker-, Restore- und Passkey-Spike; neu: Drizzle-Testmigration, responsive Haushaltsansicht, Viewport-E2E
- `spikes/002-google-boundary/`: fail-closed Credential-Grenze und Read-only-Live-Pfad; neu: synthetischer Sync-/Outbox-/Dedupe-Adapter
- `spikes/003-target-hardware/`: NAS-Metrik- und Pi-Kiosk-Proben
- `docs/features/phase-0-spike/`: Plan, QA und Status

## Entscheidung

- Lokal geprüfter Runtimekern: tragfähig; dies ist kein Gesamt-Go für den freigegebenen Architekturstack.
- Alle lokal ausführbaren Phase-0-Akzeptanzkriterien sind abgedeckt; ausstehend sind ausschließlich zielhardwareabhängige Nachweise.
- Produktives Deployment und endgültiges 2-GB-RAM-Urteil: noch gesperrt.
- Kein Google-Schreibtest, NAS-Rollout oder Pi-Setup ohne separate Zielzugänge beziehungsweise Freigabe.

## Exakt nächster Schritt

1. Vollständigen staged Diff durch zwei unabhängige fail-closed Reviews desselben Hashes prüfen (inklusive der neuen AC-010- bis AC-012-Artefakte).
2. Bei leeren Security-/Logiklisten committen.
3. Zielzugänge beschaffen und AC-007-Live, AC-008, AC-009 und AC-013 auf der Zielhardware ausführen.
4. Die 13 Linux-spezifischen Credential-Grenzen-Tests im Linux-Container erneut bestätigen.
