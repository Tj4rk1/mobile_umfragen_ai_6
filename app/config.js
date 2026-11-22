// Zentrale Konfiguration der Kolsetu-Interviewstudie.
window.STUDY_CONFIG = {
  supabaseUrl: "https://vkvpvidfhkuxvczckzdl.supabase.co",
  // Öffentlicher Anon-Key (darf im Frontend stehen, Zugriff regelt RLS).
  supabaseAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrdnB2aWRmaGt1eHZjemNremRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUzNDI3MDAsImV4cCI6MjExMDkxODcwMH0.dpHqOwqJouyEJxifAXaS1w0G2t_KMNuBBCutlwrA0u8",

  conditionId: "kolsetu_website",
  storageKey: "kolsetu-interview-v1",

  study: {
    title: "Vertrauen in KI im Kundenservice",
    institution: "Masterprojekt · Macromedia Hochschule",
    minutes: 15,
  },

  website: {
    // Angezeigte Adresse in der Browserleiste
    displayUrl: "kolsetu.com",
    // Sprachversionen von kolsetu.com (Auswahl vor dem Website-Test, Standard: defaultLanguage)
    languages: [
      { code: "de", label: "Deutsch", path: "/de" },
      { code: "en", label: "English", path: "/" },
      { code: "fr", label: "Français", path: "/fr" },
      { code: "es", label: "Español", path: "/es" },
      { code: "cs", label: "Čeština", path: "/cs" },
    ],
    defaultLanguage: "de",
    exposureSeconds: 25,
    // In der Split-Ansicht wird die Seite in dieser Breite gerendert und verkleinert,
    // damit auch neben dem Fragen-Panel das Desktop-Layout zu sehen ist.
    desktopWidth: 1280,
    countdownSeconds: 3,
    // Cookie-Banner von kolsetu.com vorab mit „nur essenzielle Cookies“ beantworten,
    // damit er im 5-Sekunden-Test nichts verdeckt (und kein Analytics-Tracking läuft).
    preConsent: true,
    // Fallback, falls der Live-Proxy nicht erreichbar ist (z. B. lokal ohne Server)
    fallbackImage: "/app/stimuli/kolsetu-startseite-2026-11-13.jpg",
    fallbackLabel: "Screenshot vom 13.11.2026",
  },

  // Claim-Vergleich (Reihenfolge wird pro Person zufällig gemischt, ohne Absender)
  claims: [
    { id: "kolsetu", text: "Digitale Mitarbeiter für profitables Wachstum." },
    { id: "parloa", text: "AI Agents, die Kundengespräche in Loyalität verwandeln." },
    { id: "retell", text: "KI-Sprachagenten der nächsten Generation für Ihr Contact Center." },
  ],

  // LinkedIn-Test: fiktive Anbieter-Nachricht
  linkedinMessage: {
    sender: "Lena M.",
    senderRole: "Account Executive · KI-Sprachagenten für den Kundenservice",
    body:
      "Hallo [Name],\n\nich habe gesehen, dass Sie den Kundenservice bei [Unternehmen] verantworten. Viele Teams in Ihrer Branche nutzen inzwischen KI-Sprachagenten, um Standardanfragen rund um die Uhr abschließend zu bearbeiten, DSGVO-konform und mit Übergabe an Ihr Team, wenn es komplex wird.\n\nHätten Sie nächste Woche 15 Minuten für einen kurzen Austausch? Ich zeige Ihnen gern, wie das bei einem vergleichbaren Unternehmen aussieht.\n\nViele Grüße\nLena",
  },
};
