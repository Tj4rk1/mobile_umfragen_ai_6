# Umfrage-Tool (Kolsetu-Studie)

Teil des Uni-Projekts „Interdisziplinäres Projekt“ (Kolsetu / Elba, Markenwahrnehmung von KI im Kundenservice). Übersicht zu Dateien und Datenmodell: `README.md`.

## Deploy

- Live: https://umfragemarketing.vercel.app/
- Push auf `main` = automatisches Production-Deploy auf Vercel. Kein Build-Schritt, statische Dateien.
- Nach dem Push prüfen, ob die Änderung live ist, z. B. `curl -s "https://umfragemarketing.vercel.app/app/questions.js?x=1" | grep "<neuer Text>"`.
- Commit-Nachrichten auf Deutsch.

## Fragebogen ändern

- Alles in `app/questions.js`. Texte immer als `T(de, en)`, beide Sprachen pflegen.
- Gespeichert wird der deutsche Wortlaut der Optionen. Optionstexte umbenennen oder `key` ändern trennt neue von alten Antworten in der Auswertung, das dem Nutzer sagen.
- Pflichtfragen (`required: true`) sind in der README als Leitfaden-Nummern (F1–F21) gelistet; beim Entfernen dort mitpflegen.
- Bei Mehrfachauswahl (`type: "multi"`) ist „Weiß ich nicht“ (`DONT_KNOW`) exklusiv: Auswahl löscht die anderen Antworten (Logik in `app/survey.js`, Klick-Handler).
- Intro-Kacheln (`facts`) liegen im CSS-Grid `.facts` in `app/app.css`; Spaltenzahl an die Anzahl der Kacheln anpassen (aktuell 2).

## Prüfen

- `for f in app/*.js; do node --check "$f"; done`
- Lokal: `node --experimental-detect-module scripts/dev-server.mjs` (http://localhost:4173), Vorschau mit `/?preview=1`, damit nichts in Supabase landet.
