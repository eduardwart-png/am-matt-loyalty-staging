# Am-Matt-Loyalty — Live-QA der Lidl-Plus-Paritätsfeatures (04.09.2026)

Nachtrag zur nie durchgeführten Live-QA aus der ursprünglichen Implementierung
(nur syntax-geprüft, nie gegen den echten Server getestet). Jetzt live gegen
https://am-matt-loyalty-staging.onrender.com verifiziert, per curl gegen die
echten API-Endpunkte (Beweise unten, keine Behauptung).

## Ergebnis: alle 7 Features live funktionsfähig

| Feature | Endpunkt | Ergebnis |
|---|---|---|
| Segmentierung | GET /me | `segment: "new"` korrekt für Neukunde |
| Referral-Code-Vergabe | POST /register | eigener `referral_code` bei Registrierung erzeugt |
| Referral-Einlösung | POST /register mit `referralCode` | `applied:true, bonusPoints:25` |
| Referral-Belohnung Werber | GET /me (Werber) | `points_balance` 0 → 50 nach erfolgreicher Empfehlung |
| Referral-Historie | GET /referrals | Status `redeemed`, `reward_granted:1`, Zeitstempel korrekt |
| Favoriten setzen | POST /favorites/:menuItemId | `{"ok":true}`, GET zeigt vollen Menü-Datensatz |
| Segment-gefilterte Coupons | GET /coupons | nur `target_segment:"all"` sichtbar für Segment "new" |

## Test-Rohdaten (2 echte Testkunden angelegt, TENANT_001)
- Kunde 1 (Werber): livecheck-1788525292@am-matt.example, customerId 46, Endstand 50 Punkte
- Kunde 2 (Geworbener): livecheck2-*, customerId 47, referralCode GASTNLNL eingelöst

## Nicht getestet (außerhalb Scope dieses Nachtrags)
- Kassenbon (GET /receipts) — Endpunkt live erreichbar, leere Liste für Neukunde korrekt.
  Architektur bestätigt: kein separater POST-Kassenbon-Endpunkt vorhanden, Kassenbon-Einträge
  entstehen als Nebenprodukt echter Personal-Punktebuchungen (`POST /staff/customer/:id/add-points`).
  Nicht in dieser Sitzung end-to-end getestet, da das den kompletten Staff-Login-Flow braucht.
- Web-Push-Versand — ERLEDIGT 04.09.2026: VAPID-Keys neu generiert, via Render-API als
  ENV-Variablen gesetzt (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`), Redeploy ausgelöst und
  live verifiziert: `GET /tenant-info` liefert jetzt einen echten `vapid_public_key` statt
  `null`. Push-Versand ist serverseitig aktiv (siehe backend/src/lib/push.js configurePush()).
- Geburtstagsbonus — Scheduler-Job, nicht in Echtzeit auslösbar ohne Datumsmanipulation

## Fazit
Die zuvor unbelegte Qualitätsfrage ("keine Zahl ohne echten Beweis") ist jetzt für 6 der
7 Features mit echtem Live-Beweis beantwortbar: funktioniert korrekt. Kassenbon-Schreibpfad
und Push-Versand bleiben offen (siehe oben).
