# ADR-0007: Tailscale-only-Zugriff mit einem stabilen HTTPS-Origin

**Status:** accepted
**Date:** 2026-08-17
**Deciders:** Patrick und Hermes Agent

## Context

Der Familienplaner enthält sensible Familien- und Kinderdaten, soll aber auch unterwegs von autorisierten Geräten erreichbar sein. Eine eigene öffentliche Domain ist derzeit nicht vorhanden. Passkeys und installierbare PWAs benötigen einen stabilen vertrauenswürdigen HTTPS-Origin; wechselnde LAN-IP-, Synology- und VPN-Namen würden Anmeldung, Cookies und Installation verkomplizieren.

Tailscale unterstützt Synology und erlaubt Zugriff ohne geöffnete Router-Ports.[4]

Tailscale kann für den Tailnet-Namen öffentlich vertrauenswürdige HTTPS-Zertifikate bereitstellen.[5]

Tailscale Serve kann einen lokalen Dienst ausschließlich für Geräte im Tailnet unter einem HTTPS-Namen veröffentlichen.[6]

## Decision

NAS, Raspberry-Pi-Kiosk und alle autorisierten persönlichen Geräte treten demselben Tailnet bei und verwenden immer denselben Tailscale-HTTPS-Namen, auch im Heimnetz. Tailscale Serve leitet diesen Origin an den internen Web-Container weiter. Die vollständige Anwendung wird weder über Router-Portfreigaben noch über Tailscale Funnel oder einen öffentlichen Reverse Proxy veröffentlicht.

Der PostgreSQL-Port bleibt ausschließlich im internen Container-Netz. Der Kiosk erhält eine eigene widerrufbare Geräteidentität. Tailscale-Mitgliedschaft begrenzt die Netzwerkerreichbarkeit, ersetzt jedoch nicht die rollenbasierte Authentifizierung der Anwendung.

## Rationale

1. **Tailscale-only:** geringe Angriffsfläche, ein stabiler HTTPS-Origin und einfache Geräteverwaltung.
2. **Öffentliche Domain und Port 443:** clientloser Zugriff, aber erheblich größere Angriffsfläche und höherer Patch-/Monitoringdruck.
3. **Zwei Namen für LAN und VPN:** weniger Tailscale-Abhängigkeit zuhause, aber problematisch für Passkey-Relying-Party, Cookies, PWA-Installation und Support.
4. **Selbstverwaltetes WireGuard:** geringere Anbieterabhängigkeit, aber mehr Schlüssel-, DNS- und Routingbetrieb.

## Consequences

- Alle Nutzgeräte einschließlich Pi benötigen einen funktionierenden Tailscale-Client.
- Passkeys werden an den gewählten `*.ts.net`-Origin gebunden; ein späterer Namenswechsel erfordert erneute Registrierung.
- Der in Zertifikaten verwendete vollständige Hostname erscheint in öffentlichen Certificate-Transparency-Protokollen; deshalb wird ein neutraler, zufälliger Tailnet-Name verwendet.
- Funnel bleibt deaktiviert und ist nicht Teil des Wiederanlaufplans.
- Fällt Tailscale auf einem Gerät aus, ist die Anwendung dort trotz funktionierendem LAN nicht über einen alternativen unsicheren IP-Origin erreichbar.
- Eine spätere öffentliche Bereitstellung ist eine neue Sicherheitsentscheidung mit Threat Model, Rate Limits, MFA-, Patch- und Monitoringanforderungen.

## Sources

[4] https://tailscale.com/kb/1131/synology — Tailscale on Synology
[5] https://tailscale.com/kb/1153/enabling-https — Tailscale HTTPS certificates
[6] https://tailscale.com/kb/1312/serve — Tailscale Serve
