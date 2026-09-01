# ADR-0002: SvelteKit und Svelte 5 als Full-Stack-Webplattform

**Status:** accepted
**Date:** 2026-08-17
**Deciders:** Patrick und Hermes Agent

## Context

Der Familienplaner benötigt eine responsive, installierbare PWA für Smartphone, PC und ein Full-HD-Wanddisplay. Die Anwendung wird selbst auf einer ressourcenbegrenzten Synology betrieben, soll eine interaktive Kinderoberfläche ermöglichen und langfristig von einer Person mit KI-Unterstützung wartbar bleiben.

Verglichen wurden SvelteKit/Svelte, Next.js/React, Nuxt/Vue sowie Django mit zusätzlichem Frontend.

SvelteKit besitzt einen offiziellen Node-Adapter für einen eigenständigen Server.[7]

Service Worker werden direkt gebündelt und registriert.[8]

Next.js unterstützt Self-Hosting und PWAs ebenfalls, bringt für diesen Anwendungsfall jedoch ein umfangreicheres Rendering-, Server-Component- und Cache-Modell mit.[11][12]

Nuxt ist die stärkste Alternative im Vue-Ökosystem und lässt sich ebenfalls als Node-Server betreiben.[13]

## Decision

Der Familienplaner wird mit SvelteKit 2, Svelte 5 und TypeScript im Strict-Modus entwickelt. Der Produktionsbetrieb erfolgt über `@sveltejs/adapter-node` auf der aktuellen unterstützten Node.js-LTS-Linie. Abhängigkeiten werden exakt fixiert, Produktions-Builds außerhalb des NAS erzeugt und nur getestete, versionierte Images ausgerollt. Vor der vollständigen Umsetzung validiert ein technischer Spike Passkeys, PWA-Verhalten und realen Speicherverbrauch auf der DS225+.

Der Datenzugriff erfolgt mit dem SQL-nahen Drizzle ORM und seinem PostgreSQL-Support.[10]

Better Auth verwendet den dazugehörigen Drizzle-Adapter.[16]

Generierte SQL-Migrationen werden geprüft und als separater Deploy-Schritt ausgeführt; beim normalen Anwendungsstart werden keine Schemaänderungen vorgenommen.

## Rationale

1. **SvelteKit/Svelte:** einheitlicher TypeScript-Stack, direkte Node- und Service-Worker-Unterstützung, wenig unnötige Framework-Komplexität für eine private Kiosk-PWA.
2. **Next.js/React:** größtes Ökosystem und sehr reif, aber für diesen kleinen selbst gehosteten Anwendungsfall mehr Cache-, RSC- und Betriebssemantik als erforderlich.
3. **Nuxt/Vue:** sehr gute und selbsthostingfreundliche Alternative, jedoch ohne entscheidenden Vorteil gegenüber SvelteKit.
4. **Django plus Frontend:** starkes Admin, ORM und Auth, aber zwei Technologieebenen und mehr Integrationsaufwand für die reaktive PWA.

## Consequences

- UI, serverseitige Aktionen und Integrationsendpunkte verwenden TypeScript.
- Servergeheimnisse und Integrationscode müssen ausschließlich in serverseitigen Modulen liegen.
- Die PWA cached zunächst nur versionierte App-Shell-Ressourcen; authentifizierte Antworten werden nicht unkontrolliert zwischengespeichert.
- Das kleinere Svelte-Ökosystem kann bei exotischen UI-Bausteinen mehr Eigenarbeit erfordern.
- Framework- und Auth-Updates benötigen automatisierte Upgrade-, Sicherheits- und Regressionstests.
- Drizzle- und Migrationsversionen werden exakt fixiert; komplexe Invarianten dürfen explizites SQL verwenden.
- Ein erfolgreicher technischer Spike ist Voraussetzung für die verbindliche Ressourcenplanung.

## Sources

[7] https://svelte.dev/docs/kit/adapter-node — SvelteKit – Node servers
[8] https://svelte.dev/docs/kit/service-workers — SvelteKit – Service workers
[10] https://orm.drizzle.team/docs/overview — Drizzle ORM – Overview
[11] https://nextjs.org/docs/app/guides/self-hosting — Next.js – Self-hosting
[12] https://nextjs.org/docs/app/guides/progressive-web-apps — Next.js – Progressive Web Apps
[13] https://nuxt.com/docs/4.x/getting-started/deployment — Nuxt 4 – Deployment
[16] https://www.better-auth.com/docs/adapters/drizzle — Better Auth – Drizzle adapter
