# ADR-0006: Unveränderliches Beitrags- und Belohnungsledger

**Status:** accepted
**Date:** 2026-08-17
**Deciders:** Patrick und Hermes Agent

## Context

Bestätigte Haushaltsbeiträge erzeugen Beitragspunkte. Punkte dürfen nicht als Strafe entzogen werden, können aber bei einem sachlichen Fehler nachvollziehbar korrigiert werden. Einlösungswünsche reservieren Punkte; Ablehnung oder Ausfall löst die Reservierung; erst die tatsächlich erfüllte Belohnung verbraucht Punkte. Gemeinsame Aufgaben können mehreren Kindern jeweils den vollen Punktwert gewähren.

Ein direkt überschreibbarer Kontostand könnte doppelte Bestätigungen, verlorene Reservierungen und unbemerkte Korrekturen verdecken. Die Historie muss erklären können, warum ein verfügbarer Punktestand entstanden ist.

## Decision

Beitragspunkte und Belohnungseinlösungen werden als unveränderliche Ledger-Vorgänge modelliert. Der verfügbare Punktestand ist eine aus dem Ledger abgeleitete Projektion und keine frei änderbare Zahl. Vorgangstypen umfassen mindestens Gutschrift, Reservierung, Freigabe einer Reservierung, endgültige Ausgabe und begründete Punktekorrektur. Früher gespeicherte Vorgänge werden weder geändert noch gelöscht.

Jede Gutschrift besitzt einen eindeutigen fachlichen Schlüssel aus Aufgabenvorkommen und begünstigtem Kind, damit Wiederholungen oder Worker-Retries keine Doppelgutschrift erzeugen. Reservierung, Genehmigung, Erfüllung und Freigabe werden transaktional mit dem jeweiligen Einlösungswunsch gespeichert. Korrekturen referenzieren den fehlerhaften Vorgang, nennen einen Grund und werden als eigener Ausgleich gebucht.

## Rationale

1. **Unveränderliches Ledger:** vollständige Nachvollziehbarkeit, sichere Retries und explizite Korrekturen.
2. **Direkt veränderbarer Kontostand:** einfacher zu implementieren, aber unzureichend für Reservierungen, Audit und Fehleranalyse.
3. **Vollständiges Event Sourcing für alle Module:** maximale Historie, jedoch unnötige Komplexität außerhalb des sensiblen Punktebereichs.

Das Ledger wird bewusst nur dort eingesetzt, wo Geld-ähnliche Reservierungs- und Ausgleichsregeln bestehen; der übrige Familienplaner bleibt zustandsorientiert.

## Consequences

- Ein Punktestand kann jederzeit aus den Vorgängen rekonstruiert und gegen seine Projektion geprüft werden.
- Bestätigung, Gutschrift und Audit-Eintrag erfolgen in einer Datenbanktransaktion.
- Verfügbare Punkte dürfen niemals durch parallele Einlösungswünsche negativ werden.
- Rückwirkende sachliche Korrekturen bleiben sichtbar und dürfen nicht als Bestrafungsmechanismus verwendet werden.
- Datenbankmigrationen und Restore-Tests prüfen Ledger-Invarianten und eindeutige fachliche Schlüssel.
- Berichte sind etwas aufwendiger als bei einer einzelnen Kontostandsspalte.
