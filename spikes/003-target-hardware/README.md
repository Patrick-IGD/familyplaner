# 003: NAS-/Pi-Zielhardware

## Frage

**Gegeben** die DS225+ und der Raspberry Pi 5, **wenn** Stack, NAS-Last und Kiosk-Wiederanlauf geprüft werden, **dann** entstehen maschinenlesbare Nachweise für RAM, Swap, OOM, Neustarts und die Rückkehr zum gesicherten Tailscale-Origin.

## Lokale Tests

```bash
python3 -m unittest nas_metrics_test.py pi_kiosk_probe_test.py
```

Diese Tests prüfen Parser, Tailscale-Origin-Vertrag und den ephemeren Chromium-Profilpfad. Sie ersetzen keinen Zielhardwaretest.

## NAS-Messung

Auf der NAS das Skript mit allen Familyboard-Containern **und** dem bereits vorhandenen PostgreSQL-Container ausführen:

```bash
python3 nas_metrics.py \
  familyboard-web familyboard-worker familyboard-db vorhandenes-postgres
```

Die JSON-Ausgabe enthält Host-RAM/Swap, `docker stats`, Restart-Zähler und `OOMKilled`. Für das endgültige Urteil jeweils vor und während Webstart, Migration, Jobverarbeitung und Backup erfassen. VPS-Werte dürfen nicht als NAS-Nachweis verwendet werden.

## Pi-Kiosk installieren

1. `launch_kiosk.py` und `pi_kiosk_probe.py` nach `~/familyboard-kiosk/` kopieren.
2. `familyboard-kiosk.service` nach `~/.config/systemd/user/` kopieren.
3. `~/.config/familyboard/kiosk.env` mit Modus `0600` anlegen:

   ```ini
   FAMILYBOARD_ORIGIN=https://exakter-name.tailnet.ts.net
   FAMILYBOARD_CHROMIUM=/usr/bin/chromium
   ```

4. Dienst aktivieren:

   ```bash
   systemctl --user daemon-reload
   systemctl --user enable --now -- familyboard-kiosk.service
   ```

Der Chromium-Profilpfad liegt unter `/run/user/<uid>/familyboard-kiosk/profile` und wird beim Dienststopp verworfen. So bleibt keine persönliche Browser-Sitzung dauerhaft im Kioskprofil entsperrt.

Die User-Unit wird nur an die grafische Benutzersitzung gekoppelt. Sie garantiert weder `network-online.target` noch den systemweiten `tailscaled.service`. Tatsächliche Netzwerk- und Tailscale-Bereitschaft ist eine separate Vorbedingung der Zielprüfung und wird von dieser User-Unit nicht zugesichert.

## Pi-Wiederanlauf prüfen

Vom grafischen Benutzer aus:

```bash
python3 pi_kiosk_probe.py https://exakter-name.tailnet.ts.net
```

Die Probe steuert ausschließlich die User-Unit, startet sie neu und liest danach deren `MainPID` und `ControlGroup`. Nur der genau zu dieser Unit gehörende Hauptprozess wird akzeptiert. Seine Kommandozeile muss exakt der von `launch_kiosk.py` erzeugten Chromium-Form entsprechen; zusätzliche Flags führen fail-closed zum Fehlschlag. Außerdem verlangt die Probe einen aktivierten Dienst, Kioskmodus, exakten Origin und ephemeres Profil. Für AC-008 danach zusätzlich einen vollständigen Pi-Neustart ausführen und denselben Befehl wiederholen.

## Verdict

- Zielskripte und lokale Vertragstests: **bestanden**.
- DS225+-Ressourcenmessung: **nicht ausgeführt** – Zielzugang fehlt.
- Pi-Dienst- und Geräteneustart: **nicht ausgeführt** – Zielzugang und finaler Tailscale-Origin fehlen.
