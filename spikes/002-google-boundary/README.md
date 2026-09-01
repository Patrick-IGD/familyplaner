# 002: Google-Credential-Grenze

## Frage

**Gegeben** fehlende, unsichere oder synthetische Service-Account-Credentials, **wenn** die Google-Probe gestartet wird, **dann** muss sie vor jedem Netzwerkzugriff fail-closed reagieren. Ein echter Netzwerkzugriff ist nur über einen expliziten, getrennten Read-only-Live-Pfad erlaubt.

## Lokale Prüfung ohne Netzwerk

```bash
npm test
```

Die Tests beweisen:

- fehlende Credential-Datei wird vor `fetch` abgelehnt,
- Elternverzeichnisse werden unter Linux komponentenweise über Deskriptoren verankert und mit `O_NOFOLLOW` geöffnet; der finale Credential-Read erfolgt relativ zum geprüften Parent-Deskriptor, sodass ein nachträglicher Parent-Symlink-Swap nicht verfolgt wird,
- Datei, Metadaten und Inhalt stammen aus demselben offenen Deskriptor,
- Eigentümer, Dateirechte und relevante Elternverzeichnisse werden fail-closed geprüft,
- Gruppen-/Weltleserechte werden vor `fetch` abgelehnt,
- ungültige Inhalte werden geheimnisneutral abgelehnt,
- der einzige Live-Scope ist `calendar.readonly`,
- Eventinhalte werden nicht ausgegeben oder zurückgegeben,
- angeforderte und getrennt freigegebene Kalender-ID müssen exakt übereinstimmen,
- Token- und Kalenderaufruf besitzen jeweils einen begrenzten 10-Sekunden-Timeout,
- ohne `GOOGLE_LIVE_TEST_MODE=read` erfolgt kein Live-Aufruf.

## Separater Live-Read-Test

Nur mit einer ausschließlich für den freigegebenen Testkalender vorgesehenen Service-Account-Datei ausführen:

```bash
chmod 600 /geschuetzter/pfad/test-service-account.json
GOOGLE_LIVE_TEST_MODE=read \
GOOGLE_CALENDAR_TEST_CREDENTIAL_FILE=/geschuetzter/pfad/test-service-account.json \
GOOGLE_CALENDAR_TEST_ID='testkalender-id' \
GOOGLE_CALENDAR_ALLOWED_TEST_ID='testkalender-id' \
npm run live:read
```

Der Befehl liest höchstens ein Event, gibt aber weder Eventdaten noch Tokens aus. Es existiert absichtlich kein Schreibpfad. Ein späterer CRUD-Test benötigt eine neue ausdrückliche Freigabe und eine eigene Probe.

## Verdict

- Lokale Credential-/Netzwerkgrenze: **bestanden**.
- Echter Google-Testkalender: **nicht ausgeführt**, bis eine geschützte Testdatei und Testkalender-ID bereitstehen.
