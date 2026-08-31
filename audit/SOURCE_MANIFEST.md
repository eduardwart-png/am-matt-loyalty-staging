# SOURCE MANIFEST — Restaurant Am-Matt (TENANT_001)

Alle übernommenen Inhalte, Quelle, Rechtsstatus. Erstellt: 31.08.2026, Session HERMES Enterprise Master Execution.

| # | SOURCE_URL | SOURCE_TYPE | EXTRACTED_AT | CONTENT_TYPE | DESCRIPTION | USED_FOR | RIGHTS_STATUS |
|---|---|---|---|---|---|---|---|
| 1 | https://www.am-matt.com/ | Website (Home) | 2026-08-31 | Text | Restaurantbeschreibung, Räumlichkeiten, Terrasse, saisonale Themen | Tenant-Content-Config, Startseite Demo | First-Party (Kundenwebsite) — vor Production bestätigen lassen |
| 2 | https://www.am-matt.com/ | Website (Home) | 2026-08-31 | Text | Adresse: Markt 12, 42477 Radevormwald | Tenant-Stammdaten | First-Party |
| 3 | https://www.am-matt.com/ | Website (Home) | 2026-08-31 | Text | Telefon +49 2195 677099, E-Mail am-matt@vodafone.de | Tenant-Kontakt | First-Party |
| 4 | https://www.am-matt.com/ | Website (Home) | 2026-08-31 | Text | Öffnungszeiten Mo–Sa 11:30–14:30 / 17:00–22:30, So Ruhetag | Tenant-Config Öffnungszeiten (zentral, einmalig) | First-Party |
| 5 | https://www.am-matt.com/ | Website (Home) | 2026-08-31 | Bild (Screenshot) | Mittagsangebot-Grafik (3 Gerichte, gültig ab 18.08.2026) | Demo-Wochenangebot-Beispiel (Struktur, nicht Dauerinhalt) | First-Party — Bildgrafik-Rechte beim Kunden/Ersteller, vor Production klären |
| 6 | https://www.am-matt.com/menue/ | Website (Menü, gescannt via Screenshot) | 2026-08-31 | Bild (Scan/Grafik) | Vollständige Speisekarte: Aperitif, Vorspeisen, Suppen, Fleisch, Beilagen, Fisch, Salate, Deftig Rustikal, Vegetarisch, Pfannkuchen, Dessert, Heiße Getränke | Speisekarten-Datenmodell (siehe menue-scan-live.md) | First-Party — Scan-Grafik-Urheberschaft unklar, vor Production klären |
| 7 | https://www.am-matt.com/impressum/ | Website (Impressum) | 2026-08-31 | Text | Verantwortlich: Michael Klacik; Amtsgericht Wipperfürth; Bildnachweis: Andreas Palmer, Aleksandar Trajkov (Google-Maps-Contributor-Fotos) | Impressum-Pflichtangaben, rechtliche Verantwortlichkeit | First-Party |
| 8 | https://www.am-matt.com/datenschutz/ | Website (Datenschutz) | 2026-08-31 | Text | Google Analytics via Jimdo, gemeinsame Verantwortlichkeit, 50 Monate Speicherfrist | Referenz für DSGVO-Anforderungen des Bestandssystems (NICHT 1:1 für neue App übernehmen — eigene Datenschutzerklärung nötig) | First-Party (Referenz) |
| 9 | https://www.am-matt.com/kontakt/ | Website (Kontakt) | 2026-08-31 | Text | Kontaktformular-Consent-Text, Adresse, Telefon | Referenz für Consent-Formulierung | First-Party (Referenz) |
| 10 | https://www.am-matt.com/aktionen/ | Website (Aktionen) | 2026-08-31 | — | Seite bei Extraktion leer/nur Cookie-Banner (JS-Inhalt nicht vollständig erfasst) | UNVERIFIED — Nachtrag nötig via Screenshot | Offen |

## Bildnachweis-Hinweis (kritisch, aus Impressum)
Die Website nennt **Andreas Palmer** und **Aleksandar Trajkov** (Google-Maps-Contributoren) als Bildnachweis für vorhandene Fotos. Das bedeutet: NICHT alle Bilder auf am-matt.com sind zwingend vom Kunden lizenziert — mindestens ein Teil stammt von Google-Maps-Nutzern. **Vor Production-Nutzung von Fotos aus dieser Quelle: explizite Freigabe von Michael Klacik (Inhaber) einholen.** Für die Demo/Prototype-Phase gilt die Website als First-Party-Referenzquelle (Text/Struktur), Fotos aus Drittquellen (Google Maps Contributor) werden NICHT direkt in die Demo übernommen — stattdessen hochwertige neutrale Demo-Assets (Prio 3 gemäß Direktive §7).

## Demo-Loyalty-Daten (klar gekennzeichnet, KEINE realen Angebote)
| # | Content | USED_FOR | STATUS |
|---|---|---|---|
| 11 | — | 540 Demo-Punkte, "Noch 60 Punkte bis zur nächsten Prämie", Geburtstagsbonus, Wochen-Coupon | Demo-Loyalty-UI | DEMO LOYALTY DATA — erfunden für Prototyp, kein reales Angebot |

## Offene Punkte / TODO Phase 2 Nachtrag
- Aktionen-Seite (JS-Inhalt) erneut per Screenshot prüfen.
- Kalte Getränke/Biere/Weine-Karte noch nicht gescannt.
- Logo (falls vorhanden als eigene Bilddatei) noch nicht extrahiert — Website nutzt evtl. nur Textlogo/Header ohne Bildlogo.
