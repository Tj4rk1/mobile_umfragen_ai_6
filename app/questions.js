// Fragebogen auf Basis von „Interviewleitfaden – Trust (Entwurf v2)“, überarbeitet nach dem Team-Call (22.11.2026).
// Alle Texte zweisprachig: { de, en }. Gespeichert wird immer der deutsche Wortlaut,
// damit die Auswertung unabhängig von der Sprache der Teilnehmenden ist.
// "ref" verweist auf die Fragenummer im Leitfaden (F1–F21).
(function () {
  const cfg = window.STUDY_CONFIG;
  const T = (de, en) => ({ de, en });
  const S = cfg.website.exposureSeconds;

  const sections = [
    { id: "intro", title: T("Willkommen", "Welcome"), minutes: 1 },
    { id: "kontext", title: T("Ihr Arbeitsalltag", "Your day-to-day"), minutes: 5 },
    { id: "website", title: T("Website-Test", "Website test"), minutes: 10 },
    { id: "vertrauen", title: T("Vertrauen", "Trust"), minutes: 5 },
    { id: "info", title: T("Informationsverhalten", "Finding solutions"), minutes: 3 },
    { id: "abschluss", title: T("Abschluss", "Wrap-up"), minutes: 1 },
  ];

  const AGREE = { min: 1, max: 5, left: T("Trifft gar nicht zu", "Strongly disagree"), right: T("Trifft voll zu", "Strongly agree") };
  const OPEN = { min: 1, max: 5, left: T("Gar nicht offen", "Not open at all"), right: T("Sehr offen", "Very open") };
  const DONT_KNOW = T("Weiß ich nicht", "I don't know");

  const AI_USE = [
    T("Ja, im Chat", "Yes, in chat"),
    T("Ja, per Voice (Telefon)", "Yes, via voice (phone)"),
    T("Ja, beides", "Yes, both"),
    T("Im Test / Pilot", "Testing / pilot"),
    T("Nein, aber geplant", "No, but planned"),
    T("Nein, gar nicht", "No, not at all"),
    DONT_KNOW,
  ];

  const DECIDERS = [
    T("IT", "IT"),
    T("Datenschutz", "Data protection"),
    T("Informationssicherheit", "Information security"),
    T("Betriebsrat", "Works council"),
    T("Einkauf", "Procurement"),
    T("Rechtsabteilung / Compliance", "Legal / compliance"),
    T("Geschäftsführung / Vorstand", "Management / board"),
    T("Fachbereich Kundenservice", "Customer service department"),
  ];

  const steps = [
    {
      id: "sprache",
      section: "intro",
      kind: "language",
      title: T("Sprache wählen", "Choose your language"),
    },
    {
      id: "intro",
      section: "intro",
      kind: "intro",
      eyebrow: T(cfg.study.institution, "Master's project · Macromedia University"),
      title: T("Kundenservice im KI-Zeitalter", "Customer service in the age of AI"),
      lead: T(
        "Wir sind Masterstudierende und untersuchen gemeinsam mit einem KI-Startup, wie Verantwortliche im Kundenservice KI-Lösungen wahrnehmen und verstehen. Die Studie bezieht sich auf das Thema Markenwahrnehmung und Kommunikation.",
        "We are master's students researching, together with an AI start-up, how customer service leaders perceive and understand AI solutions. The study focuses on brand perception and communication."
      ),
      facts: [
        [T("ca. " + cfg.study.minutes + " Minuten", "approx. " + cfg.study.minutes + " minutes"), T("Fragen zu Ihrem Alltag, ein Website-Test und Ihre Einschätzung.", "Questions about your work, a website test and your assessment.")],
        [T("Kritik erwünscht", "Criticism welcome"), T("Es gibt keine falschen Antworten. Gerade kritische Eindrücke helfen uns am meisten.", "There are no wrong answers. Critical impressions help us most.")],
      ],
      privacy: {
        title: T("Datenschutz", "Privacy"),
        text: T(
          "Die Umfrage ist anonym. Wir speichern keine personenbezogenen Daten wie Ihren Namen oder Ihre E-Mail-Adresse, sondern nur Ihre Antworten. Die einzige Ausnahme: Am Ende können Sie freiwillig eine E-Mail-Adresse angeben, damit wir Ihnen Rückfragen zu Ihren Antworten stellen können. Nur dann, und nur wenn Sie sie dort ausdrücklich eintragen, ist Ihre E-Mail-Adresse mit Ihren Antworten verknüpft. Bitte nennen Sie in Freitext-Antworten keine Namen von Personen.",
          "This survey is anonymous. We don't store any personal data such as your name or email address, only your answers. The only exception: at the end you can voluntarily leave an email address so we can ask follow-up questions about your answers. Only then, and only if you explicitly enter it there, is your email address linked to your answers. Please don't mention names of people in your free-text answers."
        ),
      },
      questions: [
        {
          key: "einwilligung",
          type: "consent",
          label: T(
            "Ich habe den Datenschutzhinweis gelesen und bin einverstanden, dass meine Antworten anonym gespeichert und im Rahmen des Studienprojekts ausgewertet werden.",
            "I have read the privacy notice and agree that my answers are stored anonymously and analysed as part of the study project."
          ),
          required: true,
        },
      ],
    },

    // ── 1. Kontext ──────────────────────────────────────────────
    {
      id: "k1",
      section: "kontext",
      title: T("Zuerst ein paar Worte zu Ihnen.", "First, a little about you."),
      questions: [
        {
          key: "rolle",
          ref: "F1",
          type: "single",
          label: T("Was ist Ihre Rolle?", "What is your role?"),
          options: [
            T("Leitung Kundenservice / Contact Center", "Head of customer service / contact centre"),
            T("Service-Strategie / Customer Experience", "Service strategy / customer experience"),
            T("Schadensregulierung / Sachbearbeitung", "Claims handling / case processing"),
            T("IT / Digitalisierung", "IT / digital transformation"),
            T("Geschäftsführung", "Management"),
          ],
          other: true,
        },
        {
          key: "branche",
          type: "single",
          label: T("In welcher Branche arbeiten Sie?", "Which industry do you work in?"),
          options: [
            T("Versicherung", "Insurance"),
            T("Krankenkasse / Gesundheit", "Health insurance / healthcare"),
            T("Mobilität / Autovermietung / Pannenhilfe", "Mobility / car rental / roadside assistance"),
            T("Energie / Versorger", "Energy / utilities"),
            T("Banken / Finanzdienstleistung", "Banking / financial services"),
            T("Handel / E-Commerce", "Retail / e-commerce"),
          ],
          other: true,
        },
        {
          key: "beruehrungspunkte",
          ref: "F1",
          type: "text",
          rows: 2,
          label: T("Welche Berührungspunkte haben Sie mit dem Kundenservice?", "How are you involved with customer service?"),
          placeholder: T("z. B. „Ich leite das Team“ oder „Ich entscheide über neue Tools mit“", "e.g. “I lead the team” or “I'm involved in choosing new tools”"),
        },
      ],
    },
    {
      id: "k2",
      section: "kontext",
      title: T("Wie läuft der Kundenkontakt bei Ihnen ab?", "How does customer contact work for you?"),
      questions: [
        {
          key: "kanaele",
          ref: "F2",
          type: "multi",
          label: T("Über welche Kanäle kommen Anfragen herein?", "Through which channels do requests come in?"),
          options: [
            T("Telefon", "Phone"),
            T("E-Mail", "Email"),
            T("Kontaktformular", "Contact form"),
            T("Live-Chat / Chatbot", "Live chat / chatbot"),
            T("Messenger (z. B. WhatsApp)", "Messenger (e.g. WhatsApp)"),
            T("Social Media", "Social media"),
            T("Brief / Post", "Letter / mail"),
            DONT_KNOW,
          ],
          other: true,
        },
        {
          key: "volumen",
          ref: "F2",
          type: "single",
          label: T("Wie viele Kundenanfragen gibt es ungefähr pro Jahr?", "Roughly how many customer requests are there per year?"),
          options: [
            T("unter 10.000", "under 10,000"),
            T("10.000 – 50.000", "10,000 – 50,000"),
            T("50.000 – 100.000", "50,000 – 100,000"),
            T("100.000 – 500.000", "100,000 – 500,000"),
            T("über 500.000", "over 500,000"),
            DONT_KNOW,
          ],
          columns: 3,
        },
      ],
    },
    {
      id: "k3",
      section: "kontext",
      title: T("Wo hakt es, und wie ist der Service aufgestellt?", "Where are the pain points, and how is service set up?"),
      questions: [
        {
          key: "engpaesse",
          ref: "F4",
          type: "multi",
          label: T("Wo hakt es aktuell am meisten?", "Where are the biggest problems right now?"),
          hint: T("Mehrfachauswahl möglich", "Select all that apply"),
          options: [
            T("Lange Wartezeiten", "Long waiting times"),
            T("Zu wenig Personal", "Not enough staff"),
            T("Erreichbarkeit außerhalb der Geschäftszeiten", "Availability outside business hours"),
            T("Lastspitzen (z. B. Unwetter, Saison)", "Peaks (e.g. storms, seasons)"),
            T("Einarbeitung / Fluktuation", "Onboarding / staff turnover"),
            T("Uneinheitliche Antwortqualität", "Inconsistent answer quality"),
            T("Kosten pro Kontakt", "Cost per contact"),
            T("Medienbrüche zwischen Systemen", "Gaps between systems"),
            DONT_KNOW,
          ],
          other: true,
        },
        {
          key: "outsourcing",
          type: "single",
          label: T("Ist Ihr Kundenservice ganz oder teilweise an einen Dienstleister ausgelagert?", "Is your customer service fully or partly outsourced to a service provider?"),
          options: [T("Ja, komplett", "Yes, fully"), T("Teilweise", "Partly"), T("Nein", "No"), DONT_KNOW],
          columns: 2,
        },
        {
          key: "outsourcing_zufriedenheit",
          type: "scale",
          showIf: (a) => ["Ja, komplett", "Teilweise"].includes(a.outsourcing),
          label: T("Wie zufrieden sind Sie mit dem Dienstleister?", "How satisfied are you with the provider?"),
          scale: { min: 1, max: 5, left: T("Gar nicht zufrieden", "Not at all satisfied"), right: T("Sehr zufrieden", "Very satisfied") },
        },
        {
          key: "tools",
          ref: "F5",
          type: "multi",
          label: T("Mit welchen Tools bzw. Systemen arbeitet Ihr Service?", "Which tools or systems does your service team use?"),
          hint: T("z. B. CRM oder Ticketsystem", "e.g. CRM or ticketing system"),
          options: [
            T("Salesforce", "Salesforce"),
            T("Zendesk", "Zendesk"),
            T("Microsoft Dynamics", "Microsoft Dynamics"),
            T("SAP", "SAP"),
            T("ServiceNow", "ServiceNow"),
            T("Freshdesk", "Freshdesk"),
            T("HubSpot", "HubSpot"),
            T("Genesys", "Genesys"),
            T("Eigenentwicklung", "In-house system"),
            DONT_KNOW,
          ],
          other: true,
          columns: 3,
        },
      ],
    },
    {
      id: "k4",
      section: "kontext",
      title: T("Und wie stehen Sie zu KI im Service?", "And how do you feel about AI in service?"),
      lead: T("Wir unterscheiden zwischen KI im Chat und KI am Telefon.", "We distinguish between AI in chat and AI on the phone."),
      questions: [
        {
          key: "ki_offenheit",
          type: "grid",
          label: T("Wie offen sind Sie dafür, Anfragen von KI erledigen zu lassen?", "How open are you to letting AI handle requests?"),
          scale: OPEN,
          items: [
            { key: "ki_offenheit_chat", label: T("per Chat / Chatbot", "via chat / chatbot") },
            { key: "ki_offenheit_voice", label: T("am Telefon (KI-Stimme)", "on the phone (AI voice)") },
          ],
        },
        {
          key: "ki_einsatz",
          type: "single",
          label: T("Setzen Sie bereits KI im Kundensupport ein?", "Do you already use AI in customer support?"),
          options: AI_USE,
          columns: 3,
        },
        {
          key: "aufmerksamkeit",
          type: "scale",
          required: true,
          attention: 2,
          label: T("Kurzer Aufmerksamkeitscheck: Bitte wählen Sie hier die 2.", "Quick attention check: please select 2 here."),
          scale: { min: 1, max: 5, left: T("", ""), right: T("", "") },
        },
      ],
    },

    // ── 2. Website-Test ─────────────────────────────────────────
    {
      id: "w0",
      section: "website",
      kind: "fivesec",
      ref: "F6",
      title: T("Der erste Eindruck", "First impression"),
      lead: T(`Gleich zeigen wir Ihnen die Startseite eines Unternehmens, aber nur für ${S} Sekunden.`, `In a moment we'll show you a company's homepage, but only for ${S} seconds.`),
      instructions: [
        [T("Bildschirm bereit machen", "Get your screen ready"), T("Am besten das Browserfenster maximieren. Die Seite erscheint bildschirmfüllend.", "Ideally maximise your browser window. The page will fill the screen.")],
        [T("Einfach anschauen", "Just look"), T("Schauen Sie hin wie bei jeder anderen Website auch. Sie dürfen scrollen und klicken.", "Look at it like any other website. You may scroll and click.")],
        [T(`Nach ${S} Sekunden ist sie weg`, `After ${S} seconds it's gone`), T("Die Seite wird automatisch ausgeblendet. Oben läuft die verbleibende Zeit mit, ein Countdown kündigt den Start an.", "The page is hidden automatically. A bar at the top shows the remaining time; a countdown announces the start.")],
        [T("Danach fragen wir", "Then we ask"), T("was hängen geblieben ist. Es gibt kein Richtig oder Falsch, der erste Eindruck zählt.", "what stuck with you. There's no right or wrong, your first impression counts.")],
      ],
    },
    {
      id: "w1",
      section: "website",
      title: T("Was ist hängen geblieben?", "What stuck with you?"),
      note: T(
        "Kein Problem, wenn etwas unklar geblieben ist: Schreiben Sie es einfach genau so hin. Uns interessiert, wie die Website auf Sie wirkt und was beim Produkt hängen bleibt, nicht, ob Sie alles richtig verstanden haben.",
        "No problem if something remained unclear: just write it down exactly like that. We're interested in how the website comes across and what sticks about the product, not whether you understood everything correctly."
      ),
      questions: [
        {
          key: "fivesec_angebot",
          ref: "F6",
          type: "text",
          required: true,
          rows: 3,
          label: T("Was glauben Sie: Was verkauft dieses Unternehmen?", "What do you think this company sells?"),
          placeholder: T("Ihre Vermutung in eigenen Worten", "Your guess, in your own words"),
        },
        {
          key: "elba_satz",
          type: "text",
          rows: 2,
          label: T("Was macht Elba konkret? Beschreiben Sie es in einem Satz.", "What exactly does Elba do? Describe it in one sentence."),
        },
        {
          key: "markenklarheit",
          ref: "F9",
          type: "single",
          label: T("Ist Ihnen klar, was Kolsetu, Elba und die „digitalen Mitarbeiter“ jeweils sind?", "Is it clear to you what Kolsetu, Elba and the “digital employees” each are?"),
          options: [T("Ja, völlig klar", "Yes, completely"), T("Teilweise", "Partly"), T("Nein", "No")],
          columns: 3,
        },
        {
          key: "integration_klar",
          ref: "F10",
          type: "single",
          label: T("Wäre Ihnen klar, ob sich das Produkt in Ihre Systeme integrieren lässt?", "Would it be clear whether the product integrates with your systems?"),
          options: [T("Ja", "Yes"), T("Eher ja", "Rather yes"), T("Eher nein", "Rather no"), T("Nein", "No")],
          columns: 4,
        },
        {
          key: "elba_aufgaben",
          type: "text",
          rows: 2,
          label: T("Welche Aufgaben könnte Elba in Ihrem Service übernehmen?", "Which tasks could Elba take over in your service?"),
        },
        {
          key: "fivesec_erinnerung",
          ref: "F6",
          type: "text",
          rows: 2,
          label: T("Was ist Ihnen sonst noch in Erinnerung geblieben?", "What else do you remember?"),
          placeholder: T("Wörter, Bilder, Farben, Gefühl … (optional)", "Words, images, colours, feelings … (optional)"),
        },
      ],
    },
    {
      id: "w2",
      section: "website",
      layout: "website",
      title: T("Jetzt in Ruhe ansehen.", "Now take your time."),
      task: T(
        "Die Seite ist jetzt wieder da. Scrollen und klicken Sie frei. Schreiben Sie Ihre Gedanken ruhig ungefiltert auf.",
        "The page is back. Scroll and click freely. Feel free to write down your thoughts unfiltered."
      ),
      questions: [
        {
          key: "erster_eindruck",
          ref: "F7",
          type: "text",
          required: true,
          rows: 4,
          label: T("Was ist Ihr erster Eindruck?", "What is your first impression?"),
          placeholder: T("Was fällt Ihnen auf, was gefällt Ihnen, was irritiert Sie?", "What stands out, what do you like, what confuses you?"),
        },
        {
          key: "verstaendnis",
          ref: "F7",
          type: "scale",
          label: T("Ich verstehe direkt, was das Produkt macht.", "I immediately understand what the product does."),
          scale: AGREE,
        },
      ],
    },
    {
      id: "w3",
      section: "website",
      layout: "website",
      title: T("Was suchen Sie, und was bleibt offen?", "What are you looking for, and what's unclear?"),
      questions: [
        {
          key: "erste_suche",
          ref: "F8",
          type: "text",
          rows: 3,
          label: T("Wonach würden Sie als Erstes suchen?", "What would you look for first?"),
        },
        {
          key: "offene_fragen",
          ref: "F9",
          type: "text",
          required: true,
          rows: 4,
          label: T("Welche Fragen bleiben offen, zum Produkt, zur Marke oder zur Funktionsweise?", "What questions remain about the product, the brand or how it works?"),
        },
      ],
    },
    {
      id: "w5",
      section: "website",
      layout: "website",
      title: T("Datenschutz und Sicherheit", "Data protection and security"),
      task: T(
        "Bitte suchen Sie auf der Website nach Informationen zu Datenschutz und Sicherheit und schauen Sie sie sich kurz an.",
        "Please look for information about data protection and security on the website and take a quick look."
      ),
      questions: [
        {
          key: "datenschutz_gefunden",
          ref: "F11",
          type: "single",
          label: T("Haben Sie die Informationen gefunden?", "Did you find the information?"),
          options: [T("Ja, sofort", "Yes, immediately"), T("Ja, nach etwas Suchen", "Yes, after some searching"), T("Nein", "No")],
          columns: 3,
        },
        {
          key: "datenschutz_verstaendlich",
          ref: "F11",
          type: "scale",
          label: T("Die Informationen sind für mich verständlich.", "The information is understandable to me."),
          scale: AGREE,
        },
        {
          key: "datenschutz_vertrauen",
          ref: "F11",
          type: "single",
          required: true,
          label: T("Würden Sie dem Produkt auf Basis dieser Infos Ihre Kundendaten anvertrauen?", "Based on this information, would you trust the product with your customer data?"),
          options: [T("Ja", "Yes"), T("Eher ja", "Rather yes"), T("Eher nein", "Rather no"), T("Nein", "No")],
          columns: 4,
        },
        {
          key: "datenschutz_warum",
          ref: "F11",
          type: "text",
          required: true,
          rows: 3,
          label: T("Warum bzw. warum nicht?", "Why or why not?"),
        },
      ],
    },
    {
      id: "w6",
      section: "website",
      layout: "website",
      title: T("Gesamteindruck der Website", "Overall impression of the website"),
      questions: [
        {
          key: "aufmachung",
          ref: "F12",
          type: "grid",
          label: T("Wie empfinden Sie die Website insgesamt?", "How do you perceive the website overall?"),
          scale: { min: 1, max: 5, left: T("nicht ansprechend", "not appealing"), right: T("ansprechend", "appealing") },
          items: [
            { key: "aufmachung_design", label: T("Design", "Design") },
            { key: "aufmachung_texte", label: T("Texte", "Copy") },
          ],
        },
        {
          key: "hauptbotschaft_verstaendlich",
          ref: "F12",
          type: "scale",
          showClaim: true,
          label: T("Wie verständlich ist die Hauptbotschaft der Seite?", "How understandable is the page's main message?"),
          scale: { min: 1, max: 10, left: T("gar nicht verständlich", "not understandable at all"), right: T("sehr verständlich", "very understandable") },
        },
        {
          key: "naechster_schritt",
          ref: "F13",
          type: "single",
          label: T("Wäre klar, was Sie als Nächstes tun würden, wenn Sie Interesse hätten?", "Would it be clear what to do next if you were interested?"),
          options: [T("Ja", "Yes"), T("Unsicher", "Unsure"), T("Nein", "No")],
          columns: 3,
        },
      ],
    },

    // ── 3. Vertrauen ────────────────────────────────────────────
    {
      id: "v1",
      section: "vertrauen",
      title: T("Würden Sie diesem Produkt Ihre Kundengespräche anvertrauen?", "Would you trust this product with your customer conversations?"),
      questions: [
        {
          key: "vertrauen_gespraeche",
          ref: "F14",
          type: "scale",
          required: true,
          label: T("Meine Einschätzung:", "My assessment:"),
          scale: { min: 1, max: 5, left: T("Auf keinen Fall", "Definitely not"), right: T("Auf jeden Fall", "Definitely") },
        },
        {
          key: "bedenken",
          ref: "F14",
          type: "text",
          required: true,
          rows: 3,
          label: T("Welche Bedenken haben Sie?", "What concerns do you have?"),
        },
        {
          key: "infos_fehlen",
          ref: "F14",
          type: "text",
          rows: 3,
          label: T("Welche Informationen fehlen Ihnen noch?", "What information is still missing for you?"),
        },
      ],
    },
    {
      id: "v2",
      section: "vertrauen",
      title: T("Was würde Ihr Vertrauen stärken?", "What would strengthen your trust?"),
      questions: [
        {
          key: "vertrauen_faktoren",
          ref: "F14",
          type: "multi",
          max: 3,
          label: T("Wählen Sie bis zu drei Punkte, die für Sie am meisten zählen.", "Choose up to three points that matter most to you."),
          options: [
            T("Referenzkunden aus meiner Branche", "Reference customers from my industry"),
            T("Zertifizierungen (z. B. ISO 27001)", "Certifications (e.g. ISO 27001)"),
            T("Kostenlose Testphase / Pilot", "Free trial / pilot"),
            T("Übergabe an Menschen bei schwierigen Fällen", "Handover to humans for difficult cases"),
            T("Serverstandort in Deutschland / EU", "Servers located in Germany / EU"),
            T("Datenschutz-Dokumentation (AVV, DSGVO)", "Data protection documentation (DPA, GDPR)"),
            T("Live-Demo: selbst mit dem Agenten sprechen", "Live demo: talk to the agent myself"),
            T("Transparente Preise", "Transparent pricing"),
            T("Persönliche Ansprechperson", "A personal contact person"),
          ],
          other: true,
        },
        {
          key: "no_go",
          ref: "F15",
          type: "text",
          rows: 2,
          label: T("Was wäre für Sie ein No-Go?", "What would be a deal-breaker for you?"),
        },
      ],
    },
    {
      id: "v3",
      section: "vertrauen",
      title: T("Wer entscheidet mit?", "Who is involved in the decision?"),
      questions: [
        {
          key: "entscheider",
          ref: "F16",
          type: "multi",
          label: T("Wer wäre bei Ihnen an so einer Entscheidung beteiligt?", "Who would be involved in such a decision at your company?"),
          options: DECIDERS,
          other: true,
          columns: 2,
        },
        {
          key: "blocker",
          ref: "F16",
          type: "multi",
          label: T("Und wer könnte sie stoppen?", "And who could stop it?"),
          options: DECIDERS,
          other: true,
          columns: 2,
        },
      ],
    },

    // ── 4. Informationsverhalten ────────────────────────────────
    {
      id: "i1",
      section: "info",
      title: T("Wie finden Sie neue Lösungen?", "How do you find new solutions?"),
      questions: [
        {
          key: "letzte_einfuehrung",
          ref: "F18",
          type: "text",
          rows: 4,
          label: T(
            "Denken Sie an das letzte neue Tool, das Sie eingeführt haben: Wie sind Sie auf die Anbieter gekommen, und wie haben Sie entschieden?",
            "Think of the last new tool you introduced: how did you find the vendors, and how did you decide?"
          ),
          hint: T("z. B. gegoogelt und verglichen, Empfehlung, Integration war ausschlaggebend …", "e.g. searched and compared, a recommendation, integration was decisive …"),
        },
        {
          key: "infoquellen",
          ref: "F19",
          type: "multi",
          required: true,
          label: T("Wo informieren Sie sich über solche Lösungen?", "Where do you find information about such solutions?"),
          options: [
            T("Google-Suche", "Google search"),
            T("LinkedIn", "LinkedIn"),
            T("Fachmedien / Newsletter", "Trade media / newsletters"),
            T("Podcasts", "Podcasts"),
            T("Messen / Konferenzen", "Trade fairs / conferences"),
            T("Empfehlungen aus dem Netzwerk", "Recommendations from my network"),
            T("Analysten / Vergleichsportale", "Analysts / comparison sites"),
            T("Gar nicht aktiv: Anbieter kommen auf mich zu", "Not actively: vendors approach me"),
          ],
          other: true,
          columns: 2,
        },
      ],
    },

    // ── 5. Abschluss ────────────────────────────────────────────
    {
      id: "a1",
      section: "abschluss",
      title: T("Fast geschafft.", "Almost done."),
      questions: [
        {
          key: "noch_wichtig",
          ref: "F21",
          type: "text",
          rows: 3,
          label: T("Gibt es noch etwas, das wir nicht gefragt haben und das Ihnen wichtig ist?", "Is there anything we didn't ask that matters to you?"),
        },
        {
          key: "empfehlung",
          type: "text",
          rows: 2,
          label: T("Kennen Sie jemanden, mit dem wir auch sprechen sollten?", "Do you know someone else we should talk to?"),
          placeholder: T("Rolle oder Unternehmen genügt (optional)", "Role or company is enough (optional)"),
        },
        {
          key: "kontakt",
          type: "email",
          label: T("Dürfen wir uns bei Rückfragen bei Ihnen melden?", "May we contact you with follow-up questions?"),
          hint: T(
            "Freiwillig. Wenn Sie hier Ihre E-Mail-Adresse eintragen, wird sie mit Ihren Antworten verknüpft, damit wir gezielt nachfragen können. Ohne Eintrag bleibt Ihre Teilnahme vollständig anonym.",
            "Optional. If you enter your email address here, it will be linked to your answers so we can ask specific follow-up questions. Without it, your participation stays completely anonymous."
          ),
          placeholder: T("E-Mail-Adresse (optional)", "Email address (optional)"),
        },
      ],
    },
    {
      id: "end",
      section: "abschluss",
      kind: "end",
      title: T("Vielen Dank!", "Thank you!"),
      lead: T(
        "Ihre Antworten sind gespeichert. Sie helfen uns sehr dabei zu verstehen, wie KI im Kundenservice wahrgenommen wird. Sie können das Fenster jetzt schließen.",
        "Your answers have been saved. They really help us understand how AI in customer service is perceived. You can close this window now."
      ),
    },
  ];

  window.STUDY = { sections, steps };
})();
