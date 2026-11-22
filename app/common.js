// Gemeinsame Helfer für Umfrage und Admin.
(function () {
  const cfg = window.STUDY_CONFIG;
  const { sections, steps } = window.STUDY;

  const db =
    window.supabase && cfg.supabaseUrl && cfg.supabaseAnonKey
      ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
      : null;

  const OTHER = "Andere";

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

  // Alle „Antwortfelder“ in Fragebogen-Reihenfolge (Grid-Items einzeln).
  function answerFields() {
    const fields = [];
    for (const step of steps) {
      for (const q of step.questions || []) {
        if (q.type === "grid") {
          for (const item of q.items) {
            fields.push({ key: item.key, label: `${q.label} · ${item.label}`, short: item.label, q, step, numeric: true });
          }
        } else if (q.type !== "email") {
          fields.push({ key: q.key, label: q.label, q, step, numeric: ["scale", "percent"].includes(q.type) });
        }
      }
    }
    return fields;
  }

  function formatChoice(value, otherText) {
    if (value === OTHER) return otherText ? `${OTHER}: ${otherText}` : OTHER;
    return value;
  }

  function claimText(id) {
    return cfg.claims.find((c) => c.id === id)?.text || id;
  }

  function valueFor(field, answers) {
    const raw = answers[field.key];
    const q = field.q;
    if (raw === undefined || raw === null || raw === "" || (Array.isArray(raw) && !raw.length)) return null;
    switch (q.type) {
      case "multi":
        return raw.map((v) => formatChoice(v, answers[q.key + "__andere"])).join("; ");
      case "single":
        return formatChoice(raw, answers[q.key + "__andere"]);
      case "consent":
        return raw ? "ja" : null;
      default:
        return String(raw);
    }
  }

  function buildResponseRows(answers) {
    const rows = [];
    for (const field of answerFields()) {
      const value = valueFor(field, answers);
      if (value === null) continue;
      rows.push({
        question_key: field.key,
        construct: field.step.section,
        item_text: field.label,
        value,
        numeric_value: field.numeric && value !== "" ? Number(answers[field.key]) : null,
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
    cfg, sections, steps, db, OTHER,
    esc, uid, shortId, answerFields, buildResponseRows, claimText, fmtDate, fmtDuration,
  };
})();
