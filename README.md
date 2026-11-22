# Kolsetu-Interviewstudie: Vertrauen in KI im Kundenservice

Selbst ausfüllbare Version des Interviewleitfadens „Trust (Entwurf v2)“, überarbeitet nach dem Team-Call vom 22.11.2026. Zweisprachig (Deutsch/Englisch, Auswahl im ersten Schritt), mit Website-Test (25 Sekunden, Dauer in `app/config.js`).
Desktop first, mobil nutzbar. Statisches Frontend auf Vercel, Daten in Supabase (`vkvpvidfhkuxvczckzdl`).

| Pfad | Was |
|---|---|
| `/` | Umfrage |
| `/?preview=1` | Vorschau, speichert nichts |
| `/admin` | Auswertung (Login per Supabase Auth, Selbst-Registrierung ist deaktiviert) |

## Dateien

- `app/questions.js`: Fragebogen, alle Texte als `{ de, en }`. Gespeichert wird immer der deutsche Wortlaut, damit die Auswertung sprachunabhängig ist. `ref` = Fragennummer im Leitfaden (F1–F21). Pflichtfragen laut Leitfaden: F3, F6, F7, F9, F11, F14, F19, F20.
- `app/config.js`: Supabase-Keys, Sprachversionen der Website (Standard Deutsch), Testdauer, Claims, LinkedIn-Beispielnachricht.
- `app/survey.js`: Ablauf, Website-Test (Briefing → Countdown → 25 s → automatisch ausblenden), Split-View.
- `app/admin.js`: Kennzahlen, Antworten je Frage, Teilnehmende, Kontakte, CSV-Export (Excel-kompatibel, `;`).
- `api/site.js` + `vercel.json`: Website-Proxy (siehe unten).
- `supabase/migrations/20261122120000_kolsetu_interview.sql`: Studien-Condition, RPC `save_interview_progress`, gesperrte direkte Schreibrechte.
- `archive/2026-06-ki-markenstudie/`: die alte Studie.

## Warum ein Proxy?

kolsetu.com verbietet das Einbetten per iframe (`X-Frame-Options: DENY`, `frame-ancestors 'none'`).
`api/site.js` holt die Seite live von kolsetu.com und entfernt nur diese Header. Die Seite läuft dann unter
unserer Domain im iframe, bleibt scroll- und klickbar und wird nicht indexiert (`noindex`).
Falls der Proxy nicht antwortet, zeigt die Umfrage automatisch einen Screenshot vom 13.11.2026 (`app/stimuli/`).

## Lokal testen

```bash
node --experimental-detect-module scripts/dev-server.mjs   # http://localhost:4173
```

## Datenmodell

`participants` (eine Zeile pro Person, `meta` mit Viewport, 5-Sek.-Daten, Claim-Reihenfolge, Zeit pro Schritt),
`responses` (eine Zeile pro Antwort, wird nach jedem Schritt gespeichert, auch bei Abbruch),
`raffle_entries` (freiwillige Kontakt-E-Mail, über `participant_id` mit den Antworten verknüpft und in der Auswertung bei der Person angezeigt).
