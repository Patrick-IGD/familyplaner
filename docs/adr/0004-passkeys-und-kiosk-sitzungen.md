# ADR-0004: Passkeys und gerätegebundene Kiosk-Sitzungen

**Status:** accepted
**Date:** 2026-08-17
**Deciders:** Patrick und Hermes Agent

## Context

Der Familienplaner verarbeitet private Kalender-, Aufgaben- und Kinderdaten. Tailscale begrenzt die Netzwerkerreichbarkeit, ersetzt aber keine fachliche Authentifizierung. Erwachsene benötigen sichere persönliche Zugänge; Kinder im Alter von sieben und zehn Jahren brauchen eine einfache Anmeldung; das gemeinsam zugängliche Wanddisplay darf keine dauerhafte Erwachsenen-Sitzung besitzen.

Better Auth dokumentiert eine SvelteKit-Integration, einen Drizzle-Adapter und datenbankgestützte Sitzungsverwaltung.[15][16][17]

Das Passkey-Plugin verwendet SimpleWebAuthn als technische Grundlage.[9]

## Decision

Erwachsene verwenden Better Auth mit Passkey-Plugin und serverseitigen, widerrufbaren PostgreSQL-Sitzungen. Jeder Erwachsene registriert möglichst mindestens zwei Passkeys und bewahrt einmalige Wiederherstellungscodes offline auf. Es gibt keine öffentliche Selbstregistrierung und keine dauerhaften JWT-Sitzungen.

Kinder sind elternverwaltete Familienprofile und keine gleichwertigen Erwachsenen-Auth-Konten. Zurechenbare Kinderaktionen werden mit Avatar und kurzer, rate-limitierter PIN freigeschaltet. Der gekoppelte Kiosk besitzt eine widerrufbare Geräte-Sitzung mit minimalen Grundrechten für den Haushaltsmodus. Eine Kinder- oder Erwachsenen-PIN erzeugt dort nur eine kurzlebige, rollenbeschränkte Erhöhung; nach Inaktivität kehrt das Gerät automatisch in den Haushaltsmodus zurück.

## Rationale

1. **Better Auth und Passkeys:** passwortlose Erwachsenen-Anmeldung, widerrufbare Sitzungen und passende SvelteKit-/Drizzle-Integration.
2. **Direktes SimpleWebAuthn:** weniger Framework-Abhängigkeit, aber vollständige Eigenverantwortung für Enrollment, Sitzungen, Recovery und Widerruf.
3. **Auth.js plus Eigenbau:** etabliertes Ökosystem, aber zusätzliche eigene Passkey-, PIN- und Recovery-Logik.
4. **Externer Identity-Provider:** starke zentrale Funktionen, aber auf 2 GB zusätzlicher Betrieb, RAM und Ausfallpfad.

## Consequences

- Der Tailscale-Zugang und die Anwendungsautorisierung bleiben getrennte Sicherheitsschichten.
- Passkey-Origin und Relying-Party-ID hängen am stabilen Tailscale-HTTPS-Namen.
- Recovery, Session-Widerruf, Geräteverlust, PIN-Rate-Limits und automatische Kiosk-Sperre benötigen eigene End-to-End-Tests.
- Kinder-PINs werden ausschließlich als geeignete Passwort-Hashes gespeichert; Roh-PINs erscheinen weder in Logs noch Backups.
- Rollen- und Objektberechtigungen werden bei jeder serverseitigen Mutation fail-closed geprüft.
- Das jüngere Better-Auth-Ökosystem erfordert fixierte Versionen, Sicherheitsscans und kontrollierte Upgrades.

## Sources

[9] https://www.better-auth.com/docs/plugins/passkey — Better Auth – Passkey plugin
[15] https://www.better-auth.com/docs/integrations/svelte-kit — Better Auth – SvelteKit integration
[16] https://www.better-auth.com/docs/adapters/drizzle — Better Auth – Drizzle adapter
[17] https://www.better-auth.com/docs/concepts/session-management — Better Auth – Session management
