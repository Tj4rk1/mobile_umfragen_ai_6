// Zentrale Konfiguration der Kolsetu-Interviewstudie.
window.STUDY_CONFIG = {
  supabaseUrl: "https://vkvpvidfhkuxvczckzdl.supabase.co",
  // Öffentlicher Anon-Key (darf im Frontend stehen, Zugriff regelt RLS).
  supabaseAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrdnB2aWRmaGt1eHZjemNremRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUzNDI3MDAsImV4cCI6MjExMDkxODcwMH0.dpHqOwqJouyEJxifAXaS1w0G2t_KMNuBBCutlwrA0u8",

  conditionId: "kolsetu_website",
  // v2: Fragebogen nach Team-Call überarbeitet (alter Zwischenstand im Browser wird ignoriert)
  storageKey: "kolsetu-interview-v2",

  study: {
    title: { de: "Kundenservice im KI-Zeitalter", en: "Customer service in the age of AI" },
    institution: "Masterprojekt · Macromedia Hochschule",
    minutes: 25,
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
    // damit er im Website-Test nichts verdeckt (und kein Analytics-Tracking läuft).
    preConsent: true,
    // Fallback, falls der Live-Proxy nicht erreichbar ist (z. B. lokal ohne Server)
    fallbackImage: "/app/stimuli/kolsetu-startseite-2026-11-13.jpg",
    fallbackLabel: { de: "Screenshot vom 13.11.2026", en: "Screenshot from 13 Nov 2026" },
    // Hauptbotschaft (H1) je Sprachversion, wird bei der Verständlichkeitsfrage als Zitat gezeigt
    claims: {
      de: "Digitale Mitarbeiter für profitables Wachstum.",
      en: "Digital employees for profitable growth.",
      fr: "Employés numériques pour une croissance rentable.",
      es: "Empleados digitales para un crecimiento rentable.",
      cs: "Digitální zaměstnanci pro ziskový růst.",
    },
  },
};
