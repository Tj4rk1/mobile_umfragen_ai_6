// Fragebogen auf Basis von „Interviewleitfaden – Trust (Entwurf v2)“.
// "ref" verweist auf die Fragenummer im Leitfaden (F1–F21).
// Pflichtfragen laut Leitfaden: F3, F6, F7, F9, F11, F14, F19, F20.
(function () {
  const cfg = window.STUDY_CONFIG;

  const sections = [
    { id: "intro", title: "Willkommen", minutes: 1 },
    { id: "kontext", title: "Ihr Arbeitsalltag", minutes: 3 },
    { id: "website", title: "Website-Test", minutes: 6 },
    { id: "vertrauen", title: "Vertrauen konkret", minutes: 3 },
    { id: "claims", title: "Claim-Vergleich", minutes: 1 },
    { id: "info", title: "Informationsverhalten", minutes: 2 },
    { id: "abschluss", title: "Abschluss", minutes: 1 },
  ];

  const AGREE = { min: 1, max: 5, left: "Trifft gar nicht zu", right: "Trifft voll zu" };

  const DECIDERS = [
    "IT",
    "Datenschutz",
    "Informationssicherheit",
    "Betriebsrat",
    "Einkauf",
    "Rechtsabteilung / Compliance",
    "Geschäftsführung / Vorstand",
    "Fachbereich Kundenservice",
  ];

  const steps = [
    {
      id: "intro",
      section: "intro",
      kind: "intro",
      eyebrow: cfg.study.institution,
      title: "Wie viel Vertrauen braucht KI im Kundenservice?",
      lead:
        "Wir sind Masterstudierende und untersuchen gemeinsam mit einem KI-Startup, wie Verantwortliche im Kundenservice KI-Lösungen wahrnehmen und was ihnen fürs Vertrauen fehlt. Es geht um Kommunikation, nicht um Verkauf.",
      facts: [
        ["ca. " + cfg.study.minutes + " Minuten", "Fragen zu Ihrem Alltag, ein kurzer Website-Test und Ihre Einschätzung."],
        ["Anonym", "Wir speichern keine Namen. Die Antworten werden nur für das Studienprojekt ausgewertet."],
        ["Kritik erwünscht", "Es gibt keine falschen Antworten. Gerade kritische Eindrücke helfen uns am meisten."],
      ],
      questions: [
        {
          key: "einwilligung",
          type: "consent",
          label:
            "Ich bin einverstanden, dass meine Antworten anonym gespeichert und im Rahmen des Studienprojekts ausgewertet werden.",
          required: true,
        },
      ],
    },

    // ── 1. Kontext ──────────────────────────────────────────────
    {
      id: "k1",
      section: "kontext",
      title: "Zuerst ein paar Worte zu Ihnen.",
      lead: "So können wir Ihre Antworten besser einordnen.",
      questions: [
        {
          key: "rolle",
          ref: "F1",
          type: "single",
          label: "Was ist Ihre Rolle?",
          options: [
            "Leitung Kundenservice / Contact Center",
            "Service-Strategie / Customer Experience",
            "Schadensregulierung / Sachbearbeitung",
            "IT / Digitalisierung",
            "Geschäftsführung",
          ],
          other: true,
        },
        {
          key: "branche",
          type: "single",
          label: "In welcher Branche arbeiten Sie?",
          options: [
            "Versicherung",
            "Krankenkasse / Gesundheit",
            "Mobilität / Autovermietung / Pannenhilfe",
            "Energie / Versorger",
            "Banken / Finanzdienstleistung",
            "Handel / E-Commerce",
          ],
          other: true,
        },
        {
          key: "beruehrungspunkte",
          ref: "F1",
          type: "text",
          rows: 2,
          label: "Welche Berührungspunkte haben Sie mit dem Kundenservice?",
          placeholder: "z. B. „Ich verantworte das Team“ oder „Ich entscheide über neue Tools mit“",
        },
      ],
    },
    {
      id: "k2",
      section: "kontext",
      title: "Wie läuft der Kundenkontakt bei Ihnen heute ab?",
      questions: [
        {
          key: "kanaele",
          ref: "F2",
          type: "multi",
          label: "Über welche Kanäle kommen Anfragen herein?",
          options: ["Telefon", "E-Mail", "Kontaktformular", "Live-Chat / Chatbot", "Messenger (z. B. WhatsApp)", "Social Media", "Brief / Post", "Vor Ort"],
          other: true,
        },
        {
          key: "volumen",
          ref: "F2",
          type: "single",
          label: "Wie viele Kundenanfragen gibt es ungefähr pro Jahr?",
          options: ["unter 10.000", "10.000 – 50.000", "50.000 – 100.000", "100.000 – 500.000", "über 500.000", "Weiß ich nicht"],
          columns: 3,
        },
        {
          key: "standardanteil",
          ref: "F3",
          type: "percent",
          required: true,
          label: "Wie viel davon sind Standardanfragen, die sich immer wiederholen?",
          hint: "z. B. „Wann kommt mein Paket?“ oder „Mein Gerät funktioniert nicht.“ Eine grobe Schätzung reicht.",
        },
      ],
    },
    {
      id: "k3",
      section: "kontext",
      title: "Wo hakt es, und womit arbeiten Sie?",
      questions: [
        {
          key: "engpaesse",
          ref: "F4",
          type: "multi",
          label: "Wo hakt es aktuell am meisten?",
          hint: "Mehrfachauswahl möglich",
          options: [
            "Lange Wartezeiten",
            "Zu wenig Personal",
            "Erreichbarkeit außerhalb der Geschäftszeiten",
            "Lastspitzen (z. B. Unwetter, Saison)",
            "Einarbeitung / Fluktuation",
            "Uneinheitliche Antwortqualität",
            "Kosten pro Kontakt",
            "Medienbrüche zwischen Systemen",
          ],
          other: true,
        },
        {
          key: "engpaesse_text",
          ref: "F4",
          type: "text",
          rows: 2,
          label: "Möchten Sie das kurz beschreiben?",
          placeholder: "optional",
        },
        {
          key: "tools",
          ref: "F5",
          type: "multi",
          label: "Mit welchen Tools bzw. Systemen arbeitet Ihr Service?",
          hint: "z. B. CRM oder Ticketsystem",
          options: ["Salesforce", "Zendesk", "Microsoft Dynamics", "SAP", "ServiceNow", "Freshdesk", "HubSpot", "Genesys", "Eigenentwicklung", "Weiß ich nicht"],
          other: true,
          columns: 3,
        },
      ],
    },
    {
      id: "k4",
      section: "kontext",
      title: "Und wie stehen Sie zu KI im Service?",
      questions: [
        {
          key: "ki_offenheit",
          type: "scale",
          label: "Wie offen sind Sie dafür, wiederkehrende Abläufe im Kundenservice von KI erledigen zu lassen?",
          scale: { min: 1, max: 5, left: "Gar nicht offen", right: "Sehr offen" },
        },
        {
          key: "ki_einsatz",
          type: "single",
          label: "Setzen Sie im Service bereits KI ein?",
          options: ["Ja, im Regelbetrieb", "Ja, im Test / Pilot", "Nein, aber es ist geplant", "Nein"],
          columns: 2,
        },
      ],
    },

    // ── 2. Website-Test ─────────────────────────────────────────
    {
      id: "w0",
      section: "website",
      kind: "fivesec",
      ref: "F6",
      title: "Der 5-Sekunden-Test",
      lead: "Gleich zeigen wir Ihnen die Startseite eines Unternehmens, aber nur für " + cfg.website.exposureSeconds + " Sekunden.",
      instructions: [
        ["Bildschirm bereit machen", "Am besten das Browserfenster maximieren. Die Seite erscheint bildschirmfüllend."],
        ["Einfach anschauen", "Schauen Sie hin wie bei jeder anderen Website auch. Sie dürfen scrollen."],
        ["Nach " + cfg.website.exposureSeconds + " Sekunden ist sie weg", "Die Seite wird automatisch ausgeblendet. Ein Countdown kündigt den Start an."],
        ["Danach fragen wir", "was hängen geblieben ist. Es gibt kein Richtig oder Falsch, der erste Eindruck zählt."],
      ],
    },
    {
      id: "w1",
      section: "website",
      title: "Was ist hängen geblieben?",
      lead: "Bitte antworten Sie spontan, ohne nachzuschauen.",
      questions: [
        {
          key: "fivesec_angebot",
          ref: "F6",
          type: "text",
          required: true,
          rows: 3,
          label: "Was glauben Sie: Was verkauft dieses Unternehmen?",
          placeholder: "Ihre Vermutung in eigenen Worten",
        },
        {
          key: "fivesec_erinnerung",
          ref: "F6",
          type: "text",
          rows: 2,
          label: "Was ist Ihnen sonst noch in Erinnerung geblieben?",
          placeholder: "Wörter, Bilder, Farben, Gefühl … (optional)",
        },
      ],
    },
    {
      id: "w2",
      section: "website",
      layout: "website",
      title: "Jetzt in Ruhe ansehen.",
      task: "Die Seite ist jetzt wieder da. Scrollen und klicken Sie frei. Schreiben Sie Ihre Gedanken ruhig ungefiltert auf, so als würden Sie laut denken.",
      questions: [
        {
          key: "erster_eindruck",
          ref: "F7",
          type: "text",
          required: true,
          rows: 4,
          label: "Was ist Ihr erster Eindruck?",
          placeholder: "Was fällt Ihnen auf, was gefällt Ihnen, was irritiert Sie?",
        },
        {
          key: "verstaendnis",
          ref: "F7",
          type: "scale",
          label: "Ich verstehe direkt, was das Produkt macht.",
          scale: AGREE,
        },
      ],
    },
    {
      id: "w3",
      section: "website",
      layout: "website",
      title: "Was suchen Sie, und was bleibt offen?",
      questions: [
        {
          key: "erste_suche",
          ref: "F8",
          type: "text",
          rows: 3,
          label: "Wonach würden Sie als Erstes suchen? Was wäre für Sie das Wichtigste?",
        },
        {
          key: "offene_fragen",
          ref: "F9",
          type: "text",
          required: true,
          rows: 4,
          label: "Welche Fragen bleiben für Sie offen, zum Produkt, zur Marke oder zur Funktionsweise?",
        },
      ],
    },
    {
      id: "w4",
      section: "website",
      layout: "website",
      title: "Marke und Integration",
      questions: [
        {
          key: "markenklarheit",
          ref: "F9",
          type: "single",
          label: "Ist Ihnen klar, was Kolsetu, Elba und die „digitalen Mitarbeiter“ bzw. Agenten jeweils sind?",
          options: ["Ja, völlig klar", "Teilweise", "Nein"],
          columns: 3,
        },
        {
          key: "markenklarheit_text",
          ref: "F9",
          type: "text",
          rows: 2,
          label: "Wie würden Sie den Unterschied in eigenen Worten beschreiben?",
          placeholder: "optional",
        },
        {
          key: "tools_wiedergefunden",
          ref: "F10",
          type: "single",
          label: "Finden Sie die Tools wieder, mit denen Sie arbeiten?",
          options: ["Ja", "Teilweise", "Nein", "Nicht danach gesucht"],
          columns: 2,
        },
        {
          key: "integration_klar",
          ref: "F10",
          type: "single",
          label: "Wäre Ihnen klar, ob sich das Produkt in Ihre Systeme integrieren lässt?",
          options: ["Ja", "Eher ja", "Eher nein", "Nein"],
          columns: 4,
        },
      ],
    },
    {
      id: "w5",
      section: "website",
      layout: "website",
      title: "Datenschutz und Sicherheit",
      task: "Bitte suchen Sie auf der Website nach Informationen zu Datenschutz und Sicherheit und schauen Sie sie sich kurz an.",
      questions: [
        {
          key: "datenschutz_gefunden",
          ref: "F11",
          type: "single",
          label: "Haben Sie die Informationen gefunden?",
          options: ["Ja, sofort", "Ja, nach etwas Suchen", "Nein"],
          columns: 3,
        },
        {
          key: "datenschutz_verstaendlich",
          ref: "F11",
          type: "scale",
          label: "Die Informationen sind verständlich.",
          scale: AGREE,
        },
        {
          key: "datenschutz_vertrauen",
          ref: "F11",
          type: "single",
          required: true,
          label: "Würden Sie dem Produkt auf Basis dieser Infos Ihre Kundendaten anvertrauen?",
          options: ["Ja", "Eher ja", "Eher nein", "Nein"],
          columns: 4,
        },
        {
          key: "datenschutz_warum",
          ref: "F11",
          type: "text",
          required: true,
          rows: 3,
          label: "Warum bzw. warum nicht?",
        },
      ],
    },
    {
      id: "w6",
      section: "website",
      layout: "website",
      title: "Gesamteindruck",
      questions: [
        {
          key: "aufmachung",
          ref: "F12",
          type: "grid",
          label: "Wie finden Sie die Aufmachung insgesamt?",
          scale: { min: 1, max: 5, left: "sehr schlecht", right: "sehr gut" },
          items: [
            { key: "aufmachung_design", label: "Design" },
            { key: "aufmachung_texte", label: "Texte" },
            { key: "aufmachung_claim", label: "Claim / Hauptbotschaft" },
          ],
        },
        {
          key: "aufmachung_text",
          ref: "F12",
          type: "text",
          rows: 2,
          label: "Was würden Sie an Design, Texten oder Claim ändern?",
          placeholder: "optional",
        },
        {
          key: "naechster_schritt",
          ref: "F13",
          type: "single",
          label: "Wäre klar, was Sie als Nächstes tun würden, wenn Sie Interesse hätten?",
          options: ["Ja", "Unsicher", "Nein"],
          columns: 3,
        },
        {
          key: "naechster_schritt_text",
          ref: "F13",
          type: "text",
          rows: 2,
          label: "Was würden Sie tun bzw. was fehlt Ihnen dafür?",
          placeholder: "optional",
        },
      ],
    },

    // ── 3. Vertrauen konkret ────────────────────────────────────
    {
      id: "v1",
      section: "vertrauen",
      title: "Würden Sie diesem Produkt Ihre Kundengespräche anvertrauen?",
      questions: [
        {
          key: "vertrauen_gespraeche",
          ref: "F14",
          type: "scale",
          required: true,
          label: "Meine Einschätzung:",
          scale: { min: 1, max: 5, left: "Auf keinen Fall", right: "Auf jeden Fall" },
        },
        {
          key: "vertrauen_fehlt",
          ref: "F14",
          type: "text",
          required: true,
          rows: 4,
          label: "Was fehlt Ihnen noch dafür?",
        },
      ],
    },
    {
      id: "v2",
      section: "vertrauen",
      title: "Was würde Ihr Vertrauen stärken?",
      lead: "Hier ein paar mögliche Punkte. Wählen Sie bis zu drei, die für Sie am meisten zählen.",
      questions: [
        {
          key: "vertrauen_faktoren",
          ref: "F14",
          type: "multi",
          max: 3,
          label: "Die drei wichtigsten Punkte",
          options: [
            "Referenzkunden aus meiner Branche",
            "Zertifizierungen (z. B. ISO 27001)",
            "Kostenlose Testphase / Pilot",
            "Übergabe an Menschen bei schwierigen Fällen",
            "Serverstandort in Deutschland / EU",
            "Datenschutz-Dokumentation (AVV, DSGVO)",
            "Live-Demo: selbst mit dem Agenten sprechen",
            "Transparente Preise",
            "Persönliche Ansprechperson",
          ],
          other: true,
        },
        {
          key: "no_go",
          ref: "F15",
          type: "text",
          rows: 3,
          label: "Was wäre für Sie ein No-Go?",
        },
      ],
    },
    {
      id: "v3",
      section: "vertrauen",
      title: "Wer entscheidet mit?",
      questions: [
        {
          key: "entscheider",
          ref: "F16",
          type: "multi",
          label: "Wer wäre bei Ihnen in so eine Entscheidung involviert?",
          options: DECIDERS,
          other: true,
          columns: 2,
        },
        {
          key: "blocker",
          ref: "F16",
          type: "multi",
          label: "Und wer könnte sie stoppen?",
          options: DECIDERS,
          other: true,
          columns: 2,
        },
      ],
    },

    // ── 4. Claim-Vergleich ──────────────────────────────────────
    {
      id: "c1",
      section: "claims",
      stimulus: "claims",
      title: "Drei Claims, ohne Absender.",
      lead: "Lesen Sie die drei Sätze und entscheiden Sie aus dem Bauch heraus.",
      questions: [
        {
          key: "claim_verstaendlich",
          ref: "F17",
          type: "claimpick",
          label: "Bei welchem verstehen Sie am schnellsten, was angeboten wird?",
        },
        {
          key: "claim_vertrauen",
          ref: "F17",
          type: "claimpick",
          label: "Welcher wirkt am vertrauenswürdigsten?",
        },
        {
          key: "claim_kommentar",
          ref: "F17",
          type: "text",
          rows: 2,
          label: "Warum?",
          placeholder: "optional",
        },
      ],
    },

    // ── 5. Informationsverhalten & Outreach ─────────────────────
    {
      id: "i1",
      section: "info",
      title: "Wie finden Sie neue Lösungen?",
      questions: [
        {
          key: "letzte_einfuehrung",
          ref: "F18",
          type: "text",
          rows: 4,
          label: "Denken Sie an das letzte neue Tool, das Sie eingeführt haben: Wie sind Sie auf die Anbieter gekommen, und wie haben Sie am Ende entschieden?",
          hint: "z. B. gegoogelt und verglichen, Empfehlung, Integration in bestehende Systeme war ausschlaggebend …",
        },
        {
          key: "infoquellen",
          ref: "F19",
          type: "multi",
          required: true,
          label: "Wo informieren Sie sich über solche Lösungen?",
          options: [
            "Google-Suche",
            "LinkedIn",
            "Fachmedien / Newsletter",
            "Podcasts",
            "Messen / Konferenzen",
            "Empfehlungen aus dem Netzwerk",
            "Analysten / Vergleichsportale",
            "Gar nicht aktiv: Anbieter kommen auf mich zu",
          ],
          other: true,
          columns: 2,
        },
      ],
    },
    {
      id: "i2",
      section: "info",
      stimulus: "linkedin",
      title: "Stellen Sie sich vor, diese Nachricht kommt bei Ihnen an.",
      questions: [
        {
          key: "linkedin_reaktion",
          ref: "F20",
          type: "single",
          required: true,
          label: "Was würden Sie tun?",
          options: [
            "Antworten",
            "Profil bzw. Firma ansehen, aber nicht antworten",
            "An die zuständige Person weiterleiten",
            "Ignorieren",
            "Löschen / Kontakt ablehnen",
          ],
        },
        {
          key: "kaltakquise_wirkung",
          ref: "F20",
          type: "scale",
          label: "Wie wirkt Kaltakquise auf Sie?",
          scale: { min: 1, max: 5, left: "„Haben die das nötig?“", right: "Eher interessant" },
        },
        {
          key: "linkedin_inhalt",
          ref: "F20",
          type: "text",
          rows: 3,
          label: "Was müsste drinstehen, damit Sie antworten?",
        },
      ],
    },

    // ── 6. Abschluss ────────────────────────────────────────────
    {
      id: "a1",
      section: "abschluss",
      title: "Fast geschafft.",
      questions: [
        {
          key: "noch_wichtig",
          ref: "F21",
          type: "text",
          rows: 3,
          label: "Gibt es noch etwas, das wir nicht gefragt haben und das Ihnen wichtig ist?",
        },
        {
          key: "empfehlung",
          type: "text",
          rows: 2,
          label: "Kennen Sie jemanden, mit dem wir auch sprechen sollten?",
          placeholder: "Rolle oder Unternehmen genügt (optional)",
        },
        {
          key: "kontakt",
          type: "email",
          label: "Dürfen wir uns bei Rückfragen melden?",
          hint: "Freiwillig. Ihre E-Mail-Adresse wird getrennt von Ihren Antworten gespeichert.",
          placeholder: "E-Mail-Adresse (optional)",
        },
      ],
    },
    {
      id: "end",
      section: "abschluss",
      kind: "end",
      title: "Vielen Dank!",
      lead: "Ihre Antworten sind gespeichert. Sie helfen uns sehr dabei zu verstehen, was Vertrauen in KI im Kundenservice ausmacht. Sie können das Fenster jetzt schließen.",
    },
  ];

  window.STUDY = { sections, steps };
})();
