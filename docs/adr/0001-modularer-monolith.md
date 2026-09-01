# ADR-0001: Modularer Monolith statt Microservices oder Laufzeit-Plugins

**Status:** accepted
**Date:** 2026-08-17
**Deciders:** Patrick und Hermes Agent

## Context

Der Familienplaner wird zunächst von einem Haushalt mit vier Personen genutzt und auf einer Synology DS225+ mit 2 GB RAM betrieben. Kalender, Aufgaben, Belohnungen und spätere Integrationen wie Home Assistant sollen fachlich getrennt, aber gemeinsam entwickelt, getestet, versioniert, gesichert und ausgeliefert werden.

Unabhängig deploybare Microservices würden zusätzliche Netzwerkverträge, Fehlerfälle, Images, Datenkonsistenzprobleme und Betriebsaufwand erzeugen. Ein zur Laufzeit installierbares Plugin-System würde bereits vor einem konkreten Fremdplugin eine stabile Erweiterungs- und Sicherheitsplattform erfordern. Ein ungegliederter Monolith wäre zwar klein, würde spätere Erweiterungen jedoch unnötig erschweren.

## Decision

Der Familienplaner wird als modularer Monolith mit klar getrennten Domänenmodulen und Integrationsadaptern gebaut. Module kommunizieren innerhalb derselben Anwendung über explizite Schnittstellen und nicht über interne HTTP-Microservices. Web/API und Hintergrundverarbeitung werden als zwei getrennte, streng limitierte Laufzeitrollen aus demselben versionierten Anwendungsartefakt gestartet; sie bleiben Bestandteil desselben Releases und desselben fachlichen Systems. Der Worker beginnt mit Parallelität eins. Erweiterungen werden im gemeinsamen Quellcode ergänzt. Ein Laufzeit-Plugin-System wird nicht gebaut.

## Rationale

Berücksichtigt wurden:

1. **Modularer Monolith:** geringer Ressourcen- und Betriebsaufwand bei klaren fachlichen Grenzen.
2. **Microservices:** bessere unabhängige Skalierung und Fehlerisolation, aber für einen Haushalt unverhältnismäßige Komplexität.
3. **Laufzeit-Plugins:** flexible Fremderweiterung, aber hoher Aufwand für API-Stabilität, Berechtigungen, Kompatibilität und sichere Isolation.
4. **Ungegliederter Monolith:** kurzfristig am einfachsten, langfristig schwerer erweiterbar und testbar.

Der modulare Monolith bewahrt Erweiterbarkeit, ohne ein verteiltes System vorzutäuschen.

## Consequences

- Kalender, Aufgaben, Motivation, Identität, Audit und Integrationen erhalten explizite Modulgrenzen.
- Fachlogik bleibt unabhängig von UI, Datenbankzugriff und externen APIs testbar.
- Web/API und Worker werden gemeinsam versioniert, aber getrennt gestartet und überwacht.
- PostgreSQL bleibt die gemeinsame transaktionale Datenbasis.
- Neue Module werden gemeinsam versioniert und ausgerollt.
- Fehlerisolation und unabhängige Skalierung sind geringer als bei Microservices.
- Eine spätere Aufteilung wird erst neu bewertet, wenn ein Modul unabhängig deployt werden muss, dauerhaft ein anderes Ressourcenprofil besitzt oder eine eigene Fehlerdomäne rechtfertigt.
