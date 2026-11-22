// Gemeinsame Helfer für Umfrage und Admin.
(function () {
  const cfg = window.STUDY_CONFIG;
  const { sections, steps } = window.STUDY;

  const db =
    window.supabase && cfg.supabaseUrl && cfg.supabaseAnonKey
      ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
      : null;

  // Interner Wert für „Andere“; Antworten werden immer mit deutschem Wortlaut gespeichert.
  const OTHER = "Andere";
  const UNKNOWN = "Weiß ich nicht";

  // Text in der gewünschten Sprache (Strings bleiben unverändert)
  function L(value, lang = "de") {
    if (value && typeof value === "object" && !Array.isArray(value)) return value[lang] ?? value.de ?? "";
    return value ?? "";
  }

  // Kanonischer (deutscher) Wert einer Option
  const optValue = (o) => L(o, "de");

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function uid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function shortId(id) {
    return "#" + String(id || "").replace(/-/g, "").slice(0, 5);
  }

  // Alle Antwortfelder in Fragebogen-Reihenfolge (Grid-Items einzeln), Beschriftung deutsch.
  function answerFields() {
    const fields = [];
    for (const step of steps) {
      for (const q of step.questions || []) {
        if (q.type === "grid") {
          for (const item of q.items) {
            fields.push({ key: item.key, label: `${L(q.label)} · ${L(item.label)}`, short: L(item.label), q, step, numeric: true });
          }
        } else if (q.type !== "email") {
          fields.push({ key: q.key, label: L(q.label), q, step, numeric: ["scale", "percent"].includes(q.type) });
        }
      }
    }
    return fields;
  }

  function formatChoice(value, otherText) {
    if (value === OTHER) return otherText ? `${OTHER}: ${otherText}` : OTHER;
    return value;
  }

  function isVisible(q, answers) {
    return !q.showIf || q.showIf(answers);
  }

  function valueFor(field, answers) {
    const q = field.q;
    if (!isVisible(q, answers)) return null;
    const raw = answers[field.key];
    if (raw === undefined || raw === null || raw === "" || (Array.isArray(raw) && !raw.length)) return null;
    switch (q.type) {
      case "multi":
        return raw.map((v) => formatChoice(v, answers[q.key + "__andere"])).join("; ");
      case "single":
        return formatChoice(raw, answers[q.key + "__andere"]);
      case "consent":
        return raw ? "ja" : null;
      case "percent":
        return raw === "unknown" ? UNKNOWN : String(raw);
      default:
        return String(raw);
    }
  }

  function buildResponseRows(answers) {
    const rows = [];
    for (const field of answerFields()) {
      const value = valueFor(field, answers);
      if (value === null) continue;
      const num = Number(answers[field.key]);
      rows.push({
        question_key: field.key,
        construct: field.step.section,
        item_text: field.label,
        value,
        numeric_value: field.numeric && Number.isFinite(num) ? num : null,
      });
    }
    return rows;
  }

  function fmtDate(iso) {
    if (!iso) return "–";
    return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function fmtDuration(ms) {
    if (!ms || ms < 0) return "–";
    const m = Math.floor(ms / 60000);
    const s = Math.round((ms % 60000) / 1000);
    return `${m}:${String(s).padStart(2, "0")} min`;
  }

  window.Common = {
    cfg, sections, steps, db, OTHER, UNKNOWN,
    L, optValue, esc, uid, shortId, isVisible, answerFields, buildResponseRows, fmtDate, fmtDuration,
  };
})();
