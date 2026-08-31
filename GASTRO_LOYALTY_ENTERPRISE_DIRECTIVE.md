# GASTRO_LOYALTY_ENTERPRISE_DIRECTIVE.md
## Restaurant Am-Matt — Mobile Browser Loyalty Platform
### Source of Truth — gespeichert 31.08.2026, Session HERMES

> **STATUS DIESES DOKUMENTS:** Persistente Kopie der Master-Direktive von Eddy (verbatim inhaltlich unverändert, siehe Original-Prompt).
> Projektpfad: `C:\Users\eduar\OneDrive\Desktop\KI\EBOS\projects\am-matt-loyalty\`
> Diese Datei ist die verbindliche Source of Truth dieses Projekts. Keine konkurrierende Masterdirektive erzeugen.
> EBOS-Kernsystem (AGENTS.md, andere Kundenprojekte) bleibt unangetastet — vollständige Isolation in `projects/am-matt-loyalty/`.

---

## 0. Kundenkontext
Pilotkunde: **Restaurant Am-Matt**, Markt 12, 42477 Radevormwald.
Quelle: https://www.am-matt.com/ — QUELLE, NICHT Designvorlage.
Tel: +49 2195 677099 · E-Mail: am-matt@vodafone.de · Verantwortlich: Michael Klacik (lt. Impressum).

## 1. Produktdefinition
**MOBILE-FIRST BROWSER APP.** Kein App-Store, keine Installation für Kernfunktionen.
Reihenfolge: (1) Mobile Browser App → (2) optionale PWA Enhancements → (3) später optional Store Distribution.

## 2–10. Forensik, Source Manifest, Assets
Siehe `audit/SOURCE_MANIFEST.md` und `audit/menue-scan-live.md`. Bestehende Website dient NICHT als UX-Vorbild.
Benchmark-Prinzipien aus Lidl Plus, Starbucks, McDonald's etc. erlaubt, keine 1:1-Kopie.

## 11. Strategisches Produktziel
**WHITE-LABEL GASTRO LOYALTY PLATFORM.** Am-Matt = `TENANT_001`. Architektur: Multi-Tenant von Anfang an,
kein Restaurant-Name hartcodiert im Code — alles in Tenant-Config (`tenant_config` Tabelle / JSON).

## 12–14. Customer App Navigation
Start · Coupons · Punkte/Prämien · Kundenkarte/QR · Profil. Demo-Loyalty-Daten klar als `DEMO LOYALTY DATA` markiert.

## 15–21. Operations First
Was regelmäßig verändert wird (Angebote, Preise, Bilder, Coupons, Öffnungszeiten) = KONFIGURATION, kein Code-Release.
Change-Cost-KPIs (§16): Bildwechsel <2min, Coupon duplizieren <2min, Tagesangebot <5min, Saisonkampagne <10min.
Operations Studio + Template Engine + Recurrence Engine + Campaign Calendar + Campaign Engine (Status: DRAFT→REVIEW→SCHEDULED→LIVE→EXPIRED→ARCHIVED).

## 22–24. Datenmodell-Kernkonzepte
Loyalty Ledger (transaktional, nicht nur Gesamtwert), Coupon Engine (regelbasiert), Staff Mode (Browser, kein separate App).

## 25–33. Qualitätsstandards
Mobile-Browser-First-Test (Installation = FAIL), Multi-Tenant/White-Label, Design System aus echtem Branding abgeleitet
(keine 1:1-Reproduktion der alten Seite), modularer Monolith (keine Microservices ohne Bedarf), Capability Audit zuerst,
Targeted Learning bei Gaps, Self-Repair-Zyklus (DETECT→CLASSIFY→ROOT CAUSE→REPAIR→RETEST→REGRESSION→EVIDENCE), maximale Autonomie.

## 34–35. Vertical Slices (kritischer Beweis-Pfad)
**Slice 1:** Kunde registriert → Account → Staff scannt → Punkte → Kunde sieht Punkte → Coupon → Staff redeemt →
Doppeleinlösung blockiert → Admin sieht Transaktion.
**Slice 2:** Am-Matt Admin erstellt Wochen-/Saisonaktion → Bild wählen → Angebot eingeben → Vorschau → terminieren →
automatisch live → Mobile App zeigt es → automatisch beendet → archiviert. Beweist: laufende Betreuung braucht keinen Entwickler.

## 36. Build-Phasen (22 Phasen)
Reality Audit → Website/Asset-Audit → Capability Matrix → Gap Analysis → Targeted Learning → Systemreparaturen →
Target Architecture → Data Model → Repo/Environments/CI → Vertical Slice Loyalty → Vertical Slice Campaign Ops →
Design System → Mobile Browser App → Operations Studio → Staff Mode → PWA/Push → Analytics → Security/Privacy/Accessibility →
Cross-Device QA → Staging → Enterprise Release Audit → Production Owner Gate.

## 37–45. Automatik, Legal, Performance, Evidence, Production-Gate, Reporting
Nach jeder Phase: VALIDATE → EVIDENCE → REPAIR → REGRESSION → NEXT PHASE (kein Zwischenstopp).
DSGVO/TDDDG/UWG/BFSG beachten, keine pauschale "LEGAL COMPLIANT"-Aussage ohne Prüfung.
Production NUR nach explizitem Owner-Gate — bis Staging maximal autonom.
Owner-Reporting-Format (§44) verbindlich für Status-Updates an Eddy.

## 46. Ausführungsstart
Phase 1 (Reality Audit) + Phase 2 (Website/Asset-Audit) = SOFORT, dann automatisch weitere Phasen.
Nichts erfinden. Fehlende Infos = MISSING/UNVERIFIED. Fehlende Bilder dürfen hochwertig generiert werden (klar als Demo markiert).

---
**Vollständiger Original-Wortlaut der Direktive liegt im Session-Log vom 31.08.2026 (Hermes Chat-Historie).**
Diese Zusammenfassung dient als schnelles Nachschlagewerk; bei Unklarheit gilt der Original-Prompt als bindend.
