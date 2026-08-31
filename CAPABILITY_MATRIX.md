GASTRO LOYALTY PLATFORM — CAPABILITY MATRIX
Stand: 31.08.2026 · Phase 3

| Bereich | Status | Evidenz/Begründung |
|---|---|---|
| Node.js/npm | READY | node v24.16.0, npm 12.0.2 lokal geprüft |
| better-sqlite3 (DB) | PARTIAL→READY nach Install | npm-Paket verfügbar, noch zu installieren |
| Express (Backend-Framework) | PARTIAL→READY nach Install | Standard, npm verfügbar |
| Auth (eigene, einfach) | MISSING→wird gebaut | Kein bestehendes Auth-System im EBOS für diesen Zweck |
| QR-Code Erzeugung | PARTIAL | npm-Paket "qrcode" verfügbar |
| QR-Scan (Staff, Browser-Kamera) | PARTIAL | jsQR (Browser-JS, kein Server) — Proof nötig |
| Frontend (Mobile Browser) | MISSING→wird gebaut | Vanilla JS + CSS, kein Framework-Overhead nötig für MVP |
| PWA (Manifest/SW) | MISSING (Phase 16, später) | Bewusst nach Kern-Feature-Set |
| Testing (Playwright) | READY | global installiert, v1.61.1 |
| Lighthouse | READY | global installiert, v13.4.1 |
| Accessibility (axe-core) | READY | global installiert, v4.12.1 |
| Scheduler (Campaign Auto-Live/Expire) | MISSING→wird gebaut | einfacher Intervall-Check im Node-Prozess, kein Cron-System nötig für MVP |
| Multi-Tenant-Datenmodell | MISSING→wird gebaut | tenant_id in allen Tabellen von Anfang an |
| Git/Versionierung | READY | git 2.54, Repo initialisiert in projects/am-matt-loyalty |
| Deployment/Staging | UNPROVEN | lokal zunächst; Staging-URL-Wahl folgt in Phase 20 |
| Security (Passwort-Hashing) | PARTIAL→READY nach Install | bcrypt/scrypt via Node-Crypto (kein Zusatzpaket nötig) |
| DSGVO-Grundpflichten | PARTIAL | Muster aus Bestandswebsite bekannt, eigene Erklärung nötig (Phase 18) |

## Gap Analysis → Targeted Learning Plan
- GAP: kein bestehendes Backend-Repo für Loyalty vorhanden → Neubau als eigenständiges Projekt (isoliert, kein Einfluss auf bestehendes EBOS).
- GAP: QR-Scan im Browser (Kamera-Zugriff, jsQR) noch nicht erprobt in diesem Environment → kleiner Proof in Phase 10 (Vertical Slice 1) einbauen, mit Fallback auf manuelle Code-Eingabe (kritisch für Robustheit, kein Single-Point-of-Failure).
- GAP: Scheduler für Kampagnen-Status-Übergänge → einfacher, getesteter Intervall-Job (setInterval) mit LAST_RUN/LAST_SUCCESS/LAST_FAILURE/STATUS-Tabelle (Direktive §40).

## Architektur-Entscheidung (Phase 7)
MODULARER MONOLITH: Node.js + Express + better-sqlite3 (Datei-DB, kein Server-Setup nötig, einfach zu betreiben von René/Eddy).
Begründung: kein belegter Bedarf für Microservices; SQLite ausreichend für Pilotkunde + wenige weitere Tenants; einfache Wartung ohne DevOps-Overhead; Migration auf Postgres später möglich, wenn Skalierung es erfordert (Lock-in gering, da Standard-SQL).
Frontend: Vanilla JS (kein Build-Step, keine Toolchain-Fragilität) + selbst gehostetes CSS, mobile-first, mit klarer Komponentenstruktur (Design System, Phase 12).
