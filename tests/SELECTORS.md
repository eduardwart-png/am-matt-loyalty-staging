# DOM-Selektoren-Referenz — Am-Matt Browser-App

Root Cause der wiederholten Diagnose-Fehlschlaege in dieser Session: Playwright-Diagnoseskripte
wurden mit GERATENEN Selektoren geschrieben (z.B. `#login-username` statt `#admin-username`),
was zu Timeouts fuehrte, die faelschlich als Produktbugs interpretiert wurden.

**Regel: vor JEDEM neuen Diagnose-/Test-Skript diese Datei lesen. Bei Unsicherheit `grep -n 'id="'`
gegen die echte HTML-Datei fahren, nie aus Erinnerung/Analogie raten.**

## Customer App (`frontend/customer/index.html`, `assets/js/app.js`)
| Zweck | Selektor |
|---|---|
| Login-Button (Topbar) | `#topbar-login-btn` |
| Avatar-Button (eingeloggt) | `#topbar-avatar-btn` |
| Login-Sheet Container | `#login-sheet` |
| Login-Sheet Backdrop | `#login-backdrop` |
| E-Mail-Feld | `#auth-email` |
| Passwort-Feld | `#auth-password` |
| Name-Feld (Registrierung) | `#auth-name` |
| Empfehlungscode-Feld | `#auth-referral` |
| Login/Register-Submit | `#auth-submit` |
| Login/Register umschalten | `#auth-toggle-mode` |
| Login-Sheet schliessen | `#login-sheet-close` |
| Logout | `#btn-logout` |
| Bottom-Nav-Item (X = start/menu/coupons/rewards/qr) | `.nav-item[data-view="X"]` |
| View-Container (X wie oben) | `#view-X` |
| Menue-Kategorie-Chip | `.menu-chip` (Text = Kategoriename) |
| Aktive Menue-Kategorie | `.menu-category.active` |
| Punkte-Anzeige (Start) | `#start-points` |
| QR-Code-Canvas | `#qrcode-canvas` |
| Praemien-Liste | `#rewards-list` |
| Coupons-Liste | `#coupons-list` |
| Hero-Titel | `.hero-title` |

## Staff App (`frontend/staff/index.html`, `assets/js/staff.js`)
| Zweck | Selektor |
|---|---|
| Username-Feld | `#staff-username` |
| Passwort-Feld | `#staff-password` |
| Login-Button | `#staff-login-btn` |
| Scan-View | `#view-scan` |
| Manuelle QR-Eingabe | `#manual-qr` |
| Manuelle Suche ausloesen | `#manual-lookup-btn` |
| Gefundener-Kunde-Container | `#customer-found` |
| Kundenname-Anzeige | `#cf-name` |
| Punktestand-Anzeige | `#cf-balance` |
| Punkte-Buchen-Button (X Punkte) | `button[data-pts="X"]` |

## Admin App (`frontend/admin/index.html`, `assets/js/admin.js`)
| Zweck | Selektor |
|---|---|
| Username-Feld | `#admin-username` (NICHT `#login-username`!) |
| Passwort-Feld | `#admin-password` (NICHT `#login-password`!) |
| Login-Button | `#admin-login-btn` (NICHT `#login-submit`!) |
| Haupt-View (nach Login) | `#view-main` |
| Tab-Leiste (X = campaigns/coupons/menu/ledger/jobs) | `.tab[data-panel="X"]` |
| Kampagnen-Tabelle | `#campaigns-table tbody tr` |
| Coupons-Tabelle | `#coupons-table tbody tr` |
| Speisekarten-Tabelle | `#menu-table tbody tr` |
| Ledger-Tabelle | `#ledger-table tbody tr` |
| Job-Status-Karten | `.job-card` |

## Query-Parameter fuer Tenant-Isolation (seit STRUKTURFIX 01.09.)
Alle 3 Frontends lesen `?tenant=XXX` aus der URL (Fallback `TENANT_001`).
**Automatisierte Tests MUESSEN `?tenant=QA_AUTOTEST` anhaengen** — nie ohne Query-Parameter gegen
die Live-URL testen, sonst Kontamination der echten Kundendaten (Root-Cause-Historie siehe unten).

QA-Tenant zuruecksetzen (Admin-Token noetig, gegen TENANT_001 einloggen):
```
POST /api/admin/qa-tenant/reset
Body: {"target_tenant_id": "QA_AUTOTEST"}
```
Sicherheitsgurt: nur IDs mit Praefix `QA_` erlaubt, alles andere wird mit 400 abgelehnt.

## Bekannte Stolperfallen (Root-Cause-Historie)
1. **Rate-Limiter (seit 01.09.) blockiert nach 10 Fehlversuchen/10min pro IP+Tenant+Pfad —
   AUSSER bei Tenants mit Praefix `QA_` (bewusste Ausnahme seit demselben Tag).**
   Diagnose-Skripte, die mehrfach hintereinander falsche Logins gegen ECHTE Tenants probieren,
   sperren sich selbst aus. Bei "429 too_many_attempts" im Playwright-Konsolenlog: KEIN Produktbug,
   sondern eigener Rate-Limit-Treffer gegen einen Nicht-QA-Tenant.
2. Fehlgeschlagener Login lässt `#login-sheet` (Customer-App) bewusst offen (User soll korrigieren
   können) — das ist gewolltes Verhalten, kein Bug, wenn danach `#login-sheet-close` funktioniert.
3. Test-Tenant-IDs im DB-Ledger tauchen als `display_name` bzw. via `customer_name`-Join auf,
   nicht als eigenes flaches Feld — beim Scripten von Ledger-Checks das echte JSON-Schema prüfen,
   nicht raten.
4. **Render Auto-Deploy ist NICHT verlaesslich (bestaetigt 01.09.: 5 Pushes in Folge wurden trotz
   `autoDeploy=yes` nicht automatisch deployed; `gh api repos/.../hooks` zeigt `[]` — keine
   klassischen GitHub-Webhooks, Render nutzt die GitHub-App-Integration, die gelegentlich haengt).**
   `/api/health` liefert seither `commit` (aus `RENDER_GIT_COMMIT`) - IMMER pruefen, dass der
   erwartete Commit-Hash live ist, bevor man einen Testfehler als Produktbug interpretiert.
   Workaround bei haengendem Auto-Deploy: `render deploys create srv-daar7p7avr4c73b9hjng --confirm`
   manuell ausloesen. Der CI-Workflow (`regression-test.yml`) prueft das automatisch und bricht mit
   klarer Warnung ab, statt gegen veralteten Code falsch-positive Bugs zu melden.
5. **Fixe `waitForTimeout(N)`-Werte sind grundsaetzlich fragil bei CI-Netzwerklatenz** (mehrfach
   bestaetigt: Kampagnen-Tabelle, Punktestand, Staff-Login-View). Immer Polling verwenden
   (`waitForVisible`/`waitForRows`/`waitForNonEmptyText` in den jeweiligen Testdateien), nie eine
   fixe Sleep-Dauer als "sollte reichen" behandeln.
