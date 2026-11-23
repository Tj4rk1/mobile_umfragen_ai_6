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
- Alle Fragen sind Pflicht: wird am Ende von `questions.js` automatisch gesetzt. Einzige Ausnahme ist die Kontakt-E-Mail (freiwillig, Anonymität); sie bekommt das Badge „freiwillig“.
- Bei Mehrfachauswahl (`type: "multi"`) ist „Weiß ich nicht“ (`DONT_KNOW`) exklusiv: Auswahl löscht die anderen Antworten (Logik in `app/survey.js`, Klick-Handler).
- Intro: 3 Kacheln (`facts` + `voice` als Mikrofon-Kachel, Grid `.facts` in `app/app.css`), darunter Datenschutz als aufklappbares `<details>` (Kurzfassung `privacy.summary`, Rest inkl. Spracheingabe-Anbieter beim Aufklappen).

## Prüfen

- `for f in app/*.js; do node --check "$f"; done`
- Lokal: `node --experimental-detect-module scripts/dev-server.mjs` (http://localhost:4173), Vorschau mit `/?preview=1`, damit nichts in Supabase landet.

## Website-Test (`startFivesec` in `app/survey.js`)

- Die 60 s (`exposureSeconds` in `app/config.js`) starten erst, wenn die Seite sichtbar ist: iframe-`load`, Schriften fertig, Bilder im sichtbaren Bereich geladen (max. ~10 s Zusatzwartezeit), dann kurze Pause.
- Lädt die Live-Seite nach 30 s nicht, wird auf den Screenshot gewechselt; der Timer startet, wenn das Bild geladen ist. In `meta.fivesec` steht dann `fallback_after_timeout: true`.

## Fallback / Zurückrollen

- Jede Änderung ist ein Git-Commit; zurück mit `git revert <sha>` + Push. Vor größeren Umbauten einen Tag setzen (z. B. `vor-fragen-umbau-2026-11-23`).
- Vercel behält alte Deployments: im Dashboard unter Deployments → „Instant Rollback“.

## Spracheingabe (Mikrofon in allen Freitext-Feldern)

- Anbieter: **AssemblyAI** (Standard, EU-Server, `universal-3-6-pro`) und **ElevenLabs Scribe v3 Live** (Fallback, `scribe_v3_live`); beide erkennen DE/EN automatisch. Reihenfolge in `plan()` in `voice.js`. `api/stt-token.js` holt beide Tokens parallel (Env: `ELEVENLABS_API_KEY`, `ASSEMBLYAI_API_KEY`). `voice.js` probiert AssemblyAI → ElevenLabs → abwechselnd mit Wartezeit; ein abgelehnter Anbieter wird 60 s lang übersprungen (sessionStorage `stt-avoid-*`). Audio bleibt währenddessen gepuffert.
- ElevenLabs-Key ist auf Speech to Text beschränkt (kein `user_read`), Verbrauch daher nur im ElevenLabs-Dashboard sichtbar. EU-Residency-Host funktioniert mit diesem Account nicht, daher `api.elevenlabs.io`.

- `app/voice.js`: Mikrofon → AudioWorklet (PCM16) → WebSocket `wss://streaming.eu.assemblyai.com/v3/ws`, Modell `universal-3-6-pro` (DE + EN automatisch, auch gemischt). Text erscheint live im Feld.
- `api/stt-token.js`: holt einen kurzlebigen Streaming-Token (EU, 60 s zum Verbinden, max. 10 min). Nur mit Origin der eigenen Domain. Der Key steht ausschließlich in der Vercel-Umgebungsvariable `ASSEMBLYAI_API_KEY`, nie im Code.
- Mic-Button in jedem Textfeld (`case "text"`) und in „Andere, und zwar …“ (`optionButtons`) über `micHtml`; nicht im E-Mail-Feld; Aufnahme stoppt automatisch beim Seitenwechsel (`render`).
- Lokal testen: `ASSEMBLYAI_API_KEY=… node --experimental-detect-module scripts/dev-server.mjs`.
- Datenschutzhinweis im Intro erwähnt AssemblyAI; bei Anbieterwechsel anpassen.
- Audio wird ab dem Klick sofort aufgenommen und gepuffert, bis der Server bereit ist (kein Verlust der ersten Wörter). Jede Aufnahme ist eine eigene Session; Feldwechsel startet sofort, die alte schließt im Hintergrund ab. „Weiter“/„Zurück“ warten, bis der letzte Satz da ist (`finishMics`).
- AssemblyAI-Limit: Free-Account = 5 neue Streaming-Sessions pro Minute (Fehler 1008 „Too many concurrent sessions“). `voice.js` wiederholt dann automatisch mit Backoff und puffert bis ~60 s Audio. Für echte Erhebungen den Account upgraden (100–200/Minute).
- Browser-Test ohne echtes Mikrofon: Puppeteer mit überschriebenem `getUserMedia`, das eine WAV-Datei (`say` + `afconvert`) als Stream liefert. Der Fake-Device-Modus von Chrome headless liefert nur Stille.
- Hängt eine Verbindung (keine Bestätigung vom Anbieter), wird nach 4 s (`CONNECT_TIMEOUT_MS`) zum nächsten Anbieter gewechselt; der Status zeigt dann „Verbindung wird aufgebaut …“. Fehlersuche: Browser-Konsole, alle Schritte sind mit `[Spracheingabe]` geloggt (Anbieter, Versuch, Ablehnungsgrund, gepufferte Blöcke).
- Ein Klick auf das Mikrofon reicht, das Textfeld muss vorher nicht angeklickt werden.
- Ein gemeinsamer `AudioContext` für alle Aufnahmen (`getCtx()` in `voice.js`), nicht pro Aufnahme neu anlegen: Browser begrenzen die Anzahl, danach scheitert der Start stumm.
- Diagnose für Nutzer: `/?preview=1&debug=1` blendet unten links ein Log-Panel mit allen `[Spracheingabe]`-Schritten ein.
- Sprache: nur DE/EN. Umfragesprache zuerst (`lang` an `Voice.start`): AssemblyAI `language_codes=["de","en"]` (nur als JSON-Liste gültig), ElevenLabs `language_code` + `secondary_languages`. Dazu Fachbegriffe (`KEYTERMS`: Kolsetu, Elba …).
- Erste Wörter: Mikrofon-Stream bleibt nach der letzten Aufnahme 60 s offen (`MIC_KEEP_MS`, kein Hardware-Anlauf beim nächsten Feld), 300 ms Stille als Vorlauf (`LEAD_IN_MS`), nach Stopp 350 ms Nachlauf.
- Testen mit Puppeteer: ein dauerhafter Fake-Mikrofon-Stream (`MediaStreamDestination`), Testsätze werden erst beim Klick eingespielt (sonst passt es nicht mehr zum geteilten Stream).
