# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Ein Haushalt aus zwei Erwachsenen und zwei Kindern (7 und 10 Jahre).
Die Erwachsenen verwalten Aufgaben, Belohnungen und Bestätigungen; die
Kinder erledigen Aufgaben, melden Erledigungen und lösen Belohnungen ein.
Drittpublikum existiert nicht: die Anwendung ist privat und nur über das
Tailnet erreichbar.

## Product Purpose

Der Familienplaner ist die gemeinsame digitale Anlaufstelle der Familie für
Aufgaben und motivierende Haushaltsbeiträge. Kinder sammeln Beitragspunkte
aus bestätigten Haushaltsaufgaben und lösen sie gegen familial festgelegte
Belohnungen ein. Erfolg heißt: der Alltag läuft ohne Papierzettel und
Verbale-Mahnungen über eine gemeinsame, vertrauenswürdige Oberfläche.

## Positioning

Anders Kalender- oder Aufgaben-Apps: kindgerechtes Punkte- und
Belohnungssystem mit bewusst gleichberechtigten Erwachsenenrollen,
append-only-Punktedaten (Punkte werden nie als Strafe entzogen) und einem
gemeinsamen Wanddisplay als Familienzentrum.

## Operating Context

- Wanddisplay im Haushalt: gewöhnlicher Monitor, verbundene Formate sind
  16:9 (1920×1080) und 4:3; Berührung, Maus und Tastatur gleichermaßen.
- PWA auf den Smartphones der Erwachsenen und (später) Tablets der Kinder.
- Betrieb auf Synology DS225+ hinter Tailscale Serve, keine öffentliche
  Freigabe.
- Alltagssituation: kurze Blicke aus der Distanz aufs Display (Haushaltsmodus),
  gelegentliche bewusste Anmeldung am Display, Nutzung unterwegs per PWA.

## Capabilities and Constraints

Bestätigt (MVP-Stand 2026-09-02):
- Haushaltsmodus ohne Anmeldung, PIN-Login für alle Mitglieder
- Aufgaben mit Erledigungsmeldung, Erwachsenenbestätigung, Punktegutschrift
- Append-only Punkte-Ledger mit Reservierung für Belohnungseinlösungen
- SvelteKit 2 / Svelte 5 / TypeScript strict / Drizzle / PostgreSQL

Offene Produktentscheidungen:
- Kalenderintegration (Google, wartet auf Zugänge)
- Passkeys statt Erwachsenen-PIN (wartet auf finalen Tailscale-Origin)
- wiederkehrende Aufgaben, Aufgabenpool-Übernahme, Erwachsenen-Verwaltungs-UI

Fachliche Wahrheiten (aus CONTEXT.md, bindend):
- Der Planer ist das Gesamtsystem, nicht nur Kalenderansicht oder Wanddisplay.
- Der Haushaltsmodus zeigt keine Einzelpunktstände.
- Kinderprofile zeigen keinen Geschwistervergleich.
- Punkte sind kein Geld und kein Maß für den Wert eines Familienmitglieds.
- Einmal bestätigte Beitragspunkte werden nicht entzogen.

## Brand Commitments

- Deutsch als Systemsprache; Ansprache der Kinder altersgerecht, warm,
  ohne Dauerreize.
- Keine Kinderfotos; Avatare als Farbe und Initial.
- Ruhiges, kontrastreiches Design für das Wanddisplay; spielerischere
  Kinderprofile, aber ohne Geschwister-Ranking.

## Product Principles

1. Das Wanddisplay ist das Familienzentrum: aus der Distanz lesbar,
   auf Distanz ruhig, bei Interaktion sofort verständlich.
2. Vertrauen schlägt Kontrolle: Punkte sind dauerhaft, Entscheidungen sind
   begründet, nichts passiert still.
3. Kinder stärken, nicht vergleichen: Fortschritt ja, Rangliste nie.
4. Alles funktioniert offline vom Internet — nur das NAS muss erreichbar sein.
5. Geheimnisse und Familieninhalte verlassen das Tailnet nicht.

## Accessibility & Inclusion

- Kinder (7/10) als Nutzer: große Touchziele, einfache Sprache, PIN-Eingabe
  mit numerischem Keypad.
- Aus der Distanz lesbar (Wanddisplay): hohe Kontraste, große Typografie.
