# ADR-0005: Google-kanonischer Familienkalender mit Service-Account und Polling

**Status:** accepted
**Date:** 2026-08-17
**Deciders:** Patrick und Hermes Agent

## Context

Die Familie verwendet Google Calendar. Persönliche Kalender sollen nicht ersetzt oder mit vollständigen Inhalten kopiert werden. Der Familienplaner soll einen gemeinsamen Familienkalender lesen und bearbeiten, bei Internetausfall den letzten Stand anzeigen und Änderungen zuverlässig nach Google übertragen. Gleichzeitig bleibt die Anwendung ausschließlich im Tailscale-Netz und besitzt keinen öffentlichen Webhook-Endpunkt.

Google dokumentiert Service-Account-Zugangsdaten und kalenderbezogene Freigaben über ACLs.[18][19]

Die Calendar API unterstützt inkrementelle Synchronisierung mit persistenten Sync-Tokens.[20]

Push-Benachrichtigungen erfordern einen empfangbaren HTTPS-Webhook und ersetzen den anschließenden Abruf der geänderten Daten nicht.[21]

## Decision

Der gemeinsame Google-Familienkalender ist die verbindliche Quelle für Familientermine. Ein eigener Google-Service-Account ohne domänenweite Delegation erhält Schreibrecht auf diesem Kalender. Persönliche Kalender werden dem Service-Account ausschließlich mit Frei/Belegt-Recht zugänglich gemacht; der Familienplaner verarbeitet weder Titel noch Beschreibungen, Orte oder andere persönliche Termindetails.

Der Worker führt alle fünf Minuten einen inkrementellen Abgleich durch und bietet zusätzlich eine manuelle Synchronisierung. Lokal werden die vergangenen 30 Tage und die kommenden zwölf Monate projiziert. Familienterminänderungen bei fehlender Google-Erreichbarkeit werden in einer persistenten serverseitigen Outbox gespeichert und sichtbar als ausstehend markiert. Ein erkannter Versionskonflikt wird nicht mit Last-Write-Wins überschrieben, sondern einem Erwachsenen zur erneuten Prüfung vorgelegt.

## Rationale

1. **Service-Account und gezielte Kalenderfreigaben:** ein eng begrenzter, familieninterner Maschinenzugang ohne mehrere langlebige Benutzer-OAuth-Sitzungen.
2. **Google als kanonische Kalenderquelle:** keine zweite gleichberechtigte Kalenderdatenbank und keine unklare Zwei-Wege-Mastership.
3. **Fünf-Minuten-Polling:** funktioniert ohne öffentliches Ingress; Minutenlatenz wird für den Familienalltag akzeptiert.
4. **Google-Push:** geringere Latenz, aber öffentlicher HTTPS-Callback, Channel-Erneuerung und weiterhin notwendiger Pull.
5. **Persistente Outbox:** lokale Eingaben gehen bei Google-Ausfall nicht verloren und behaupten keinen falschen Synchronisationserfolg.

## Consequences

- Der Familienplaner bleibt bei Google-Ausfall für lokale Aufgaben und Belohnungen vollständig nutzbar; Kalenderdaten zeigen den letzten bestätigten Sync-Stand.
- Kalender-Create, -Update und -Delete benötigen stabile Idempotenzschlüssel, Retries und regelmäßige Reconciliation.
- Google-IDs, ETags, Sync-Tokens und Tombstones werden getrennt von fachlichen Zuordnungen gespeichert.
- Eine ungültige Sync-Markierung darf nur die lokale Google-Projektion neu aufbauen, niemals lokale Aufgaben- oder Belohnungsdaten löschen.
- Direkt in Google angelegte Familientermine ohne Familienmitglied-Zuordnung erscheinen neutral als nicht zugeordnet.
- Ein späterer Wechsel zu OAuth oder öffentlichem Push erfordert eine neue Sicherheits- und Betriebsentscheidung.

## Sources

[18] https://developers.google.com/workspace/guides/create-credentials — Google Workspace – Create service account credentials
[19] https://developers.google.com/workspace/calendar/api/concepts/sharing — Google Calendar API – Sharing and ACLs
[20] https://developers.google.com/workspace/calendar/api/guides/sync — Google Calendar API – Incremental synchronization
[21] https://developers.google.com/workspace/calendar/api/guides/push — Google Calendar API – Push notifications
