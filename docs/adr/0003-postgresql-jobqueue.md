# ADR-0003: PostgreSQL-basierte Hintergrundjobs mit pg-boss

**Status:** accepted
**Date:** 2026-08-17
**Deciders:** Patrick und Hermes Agent

## Context

Kalenderabgleich, Wiederholungsaufgaben, ausstehende Google-Änderungen, Retry-Verarbeitung und spätere Integrationen benötigen langlebige Hintergrundjobs. Jobs dürfen bei einem Neustart des NAS oder Worker-Containers nicht verloren gehen. Gleichzeitig soll die DS225+ mit 2 GB RAM keinen zusätzlichen Redis-, RabbitMQ- oder Kafka-Dienst betreiben.

pg-boss ist eine Node.js-Jobqueue auf PostgreSQL und unterstützt unter anderem transaktionales Anlegen von Jobs, Cron-Zeitpläne, Dead-Letter-Queues und automatische Wiederholungen mit exponentiellem Backoff.[14]

## Decision

Der Worker verwendet pg-boss in derselben PostgreSQL-Datenbank wie der Familienplaner. Es wird kein Redis oder separater Message Broker betrieben. Der Worker startet zunächst mit Parallelität eins. Fachänderungen und die zugehörige Job- beziehungsweise Outbox-Erzeugung werden, soweit möglich, in derselben Datenbanktransaktion gespeichert. Jeder externe Handler besitzt einen stabilen Idempotenzschlüssel und muss gefahrlos wiederholbar sein.

## Rationale

1. **pg-boss/PostgreSQL:** persistente Queue-Funktionen ohne zusätzlichen zustandsbehafteten Dienst und mit transaktionaler Kopplung an Fachdaten.
2. **Eigene Jobtabellen:** maximale Kontrolle, aber eigener Aufwand für Leases, Retries, Dead Letters, Zeitpläne und Wartung.
3. **Redis/BullMQ:** reifes Queue-Modell, aber weiterer RAM-Verbrauch, zusätzliches Backup-/Monitoringziel und keine gemeinsame Transaktion mit PostgreSQL.
4. **Synology-Aufgabenplaner:** für einfache Backups geeignet, aber nicht für fachliche Outbox-, Retry- und Konfliktabläufe.

## Consequences

- PostgreSQL trägt sowohl Fach- als auch Queuelast; Queue-Aufbewahrung, Autovacuum und Job-Alter müssen überwacht werden.
- Web und Worker verwenden kleine, getrennte Verbindungspools.
- Queue-Migrationen sind Bestandteil des kontrollierten Deployments.
- Die von pg-boss zugesicherte Jobzustellung bedeutet keine exakt-einmalige Wirkung über Netzwerkgrenzen hinweg.
- Google- und spätere Home-Assistant-Aufrufe benötigen Idempotenz, Deduplizierung und regelmäßige Abstimmung mit dem externen System.
- Ein anderer Broker wird erst erwogen, wenn messbare Queue-Überlastung oder mehrere unabhängig deployte Konsumenten entstehen.

## Sources

[14] https://github.com/timgit/pg-boss — pg-boss – PostgreSQL job queue
