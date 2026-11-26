// Auswertung: Login, Kennzahlen, Antworten je Frage, Teilnehmende, Export.
(function () {
  const { cfg, sections, steps, db, OTHER, L, esc, shortId, answerFields, fmtDate, fmtDuration } = window.Common;
  const STUDY_TITLE = L(cfg.study.title);
  const LANG_LABEL = { de: "DE", en: "EN" };
  const attnQ = steps.flatMap((s) => s.questions || []).find((q) => q.attention);
  function attentionPill(p) {
    const ok = p.meta?.attention_ok;
    if (ok === true) return `<span class="pill ok">✓</span>`;
    if (ok === false) return `<span class="pill warn" title="Aufmerksamkeitscheck nicht bestanden">✗ Check</span>`;
    return "–";
  }

  let root;
  const ui = { tab: "fragen", onlyCompleted: false, source: "all", openParticipant: null };
  // Herkunft: Vorschau-Link (?preview=1) oder normaler Link. Ältere Einträge ohne Angabe = normaler Link.
  const SOURCES = { all: "Alle", live: "Nur normaler Link", preview: "Nur Vorschau-Link" };
  const sourceOf = (p) => (p.meta?.source === "preview" ? "preview" : "live");
  const sourcePill = (p) => (sourceOf(p) === "preview" ? `<span class="pill warn">Vorschau</span>` : `<span class="pill">normal</span>`);
  let data = { participants: [], responses: [], contacts: [] };

  async function fetchAll(table, select = "*") {
    const out = [];
    const page = 1000;
    for (let from = 0; ; from += page) {
      const { data: rows, error } = await db.from(table).select(select).range(from, from + page - 1);
      if (error) throw error;
      out.push(...rows);
      if (rows.length < page) break;
    }
    return out;
  }

  async function loadData() {
    const [participants, responses, contacts] = await Promise.all([
      fetchAll("participants"),
      fetchAll("responses"),
      fetchAll("raffle_entries"),
    ]);
    data = {
      participants: participants
        .filter((p) => p.condition_id === cfg.conditionId)
        .sort((a, b) => new Date(b.started_at) - new Date(a.started_at)),
      responses: responses.filter((r) => r.condition_id === cfg.conditionId),
      contacts,
    };
  }

  // ── Derived ────────────────────────────────────────────────
  function sourceParticipants() {
    return data.participants.filter((p) => ui.source === "all" || sourceOf(p) === ui.source);
  }

  function visibleParticipants() {
    return sourceParticipants().filter((p) => !ui.onlyCompleted || p.status === "completed");
  }

  function answersByParticipant() {
    const ids = new Set(visibleParticipants().map((p) => p.id));
    const map = new Map();
    for (const r of data.responses) {
      if (!ids.has(r.participant_id)) continue;
      if (!map.has(r.participant_id)) map.set(r.participant_id, {});
      map.get(r.participant_id)[r.question_key] = r;
    }
    return map;
  }

  function duration(p) {
    if (!p.completed_at) return null;
    return new Date(p.completed_at) - new Date(p.started_at);
  }

  function median(list) {
    if (!list.length) return null;
    const s = list.slice().sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // Freiwillig angegebene E-Mail (raffle_entries, verknüpft über participant_id)
  function contactOf(pid) {
    return data.contacts.find((c) => c.participant_id === pid)?.email || "";
  }
  function mailLink(email) {
    return email ? `<a href="mailto:${esc(email)}" onclick="event.stopPropagation()">${esc(email)}</a>` : "";
  }

  function personTag(answers) {
    const role = answers.rolle?.value || "";
    const branch = answers.branche?.value || "";
    return [role, branch].filter(Boolean).map((x) => x.replace(/^Andere: /, "")).join(" · ");
  }

  // ── Rendering ──────────────────────────────────────────────
  function shell(inner) {
    root.innerHTML = `
      <div class="shell admin">
        <aside class="rail">
          <div class="brandmark"><span class="dot"></span><div><strong>Auswertung</strong><span>${esc(STUDY_TITLE)}</span></div></div>
          <ol class="toc">
            ${[
              ["fragen", "Nach Fragen"],
              ["personen", "Teilnehmende"],
              ["kontakte", "Kontakte"],
              ["export", "Export"],
            ]
              .map(([id, t], i) => `<li class="${ui.tab === id ? "current" : ""}" data-tab="${id}" style="cursor:pointer"><span class="n">${String(i + 1).padStart(2, "0")}</span><span class="t">${t}</span><span class="m"></span></li>`)
              .join("")}
          </ol>
          <div class="rail-foot">
            <a class="btn ghost" href="/?preview=1" target="_blank" rel="noopener" style="justify-content:center">Vorschau öffnen ↗</a>
            <button class="btn ghost" data-act="logout" type="button" style="justify-content:center">Abmelden</button>
          </div>
        </aside>
        <main class="main"><div class="stage"><div class="content">${inner}</div></div></main>
      </div>`;
  }

  function kpisHtml() {
    const all = sourceParticipants();
    const done = all.filter((p) => p.status === "completed");
    const durs = done.map(duration).filter(Boolean);
    const live = all.filter((p) => p.meta?.fivesec?.mode === "live").length;
    const shot = all.filter((p) => p.meta?.fivesec?.mode === "screenshot").length;
    return `<div class="kpis">
      <div class="kpi"><div class="v">${all.length}</div><div class="l">Gestartet</div></div>
      <div class="kpi"><div class="v">${done.length}</div><div class="l">Abgeschlossen</div></div>
      <div class="kpi"><div class="v">${all.length ? Math.round((done.length / all.length) * 100) : 0}%</div><div class="l">Abschlussquote</div></div>
      <div class="kpi"><div class="v">${durs.length ? Math.round(median(durs) / 60000) + "′" : "–"}</div><div class="l">Median-Dauer</div></div>
      <div class="kpi"><div class="v">${live}<span style="font-size:22px;color:var(--muted)"> / ${shot}</span></div><div class="l">Website-Test: live / Screenshot</div></div>
    </div>`;
  }

  function header() {
    return `
      <div class="eyebrow">Auswertung · ${esc(cfg.website.displayUrl)}</div>
      <h1 class="headline">Was die Leute <em>wirklich</em> denken.</h1>
      ${kpisHtml()}
      <div class="toolbar">
        <label>Quelle <select data-filter="source" style="margin-left:6px;height:34px;border:1px solid var(--line);border-radius:10px;background:var(--card);padding:0 8px;font:inherit">${Object.entries(SOURCES)
          .map(([v, t]) => `<option value="${v}" ${ui.source === v ? "selected" : ""}>${t} (${v === "all" ? data.participants.length : data.participants.filter((p) => sourceOf(p) === v).length})</option>`)
          .join("")}</select></label>
        <label><input type="checkbox" data-filter="completed" ${ui.onlyCompleted ? "checked" : ""}> Nur abgeschlossene</label>
        <button class="btn ghost" data-act="refresh" type="button" style="height:38px;padding:0 16px">↻ Aktualisieren</button>
      </div>`;
  }

  function render() {
    let body = "";
    if (ui.tab === "fragen") body = byQuestionHtml();
    if (ui.tab === "personen") body = participantsHtml();
    if (ui.tab === "kontakte") body = contactsHtml();
    if (ui.tab === "export") body = exportHtml();
    document.querySelectorAll('.drawer, .drawer-bg').forEach((el) => el.remove());
    ui.openParticipant = null;
    shell(header() + body);
  }

  function barsHtml(counts, total) {
    const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (!entries.length) return `<div class="empty">Noch keine Antworten.</div>`;
    return `<div class="bars">${entries
      .map(([label, c]) => {
        const pct = total ? Math.round((c / total) * 100) : 0;
        return `<div class="bar"><span>${esc(label)}</span><span class="track"><i style="width:${pct}%"></i></span><span class="c">${c} · ${pct}%</span></div>`;
      })
      .join("")}</div>`;
  }

  function scaleHtml(values, scale) {
    if (!values.length) return `<div class="empty">Noch keine Antworten.</div>`;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const counts = new Map();
    for (let i = scale.min; i <= scale.max; i++) counts.set(i, 0);
    values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
    const max = Math.max(...counts.values());
    return `<div class="stat-line">Ø ${mean.toFixed(2).replace(".", ",")} · Median ${String(median(values)).replace(".", ",")} · ${esc(L(scale.left)) || scale.min} (${scale.min}) → ${esc(L(scale.right)) || scale.max} (${scale.max})</div>
      <div class="bars">${[...counts.entries()]
        .map(([k, c]) => `<div class="bar"><span>${k}</span><span class="track"><i style="width:${max ? (c / max) * 100 : 0}%"></i></span><span class="c">${c}</span></div>`)
        .join("")}</div>`;
  }

  function byQuestionHtml() {
    const byP = answersByParticipant();
    const participants = visibleParticipants();
    let html = "";

    for (const section of sections) {
      const secSteps = steps.filter((s) => s.section === section.id && s.questions?.length);
      const qs = secSteps.flatMap((s) => s.questions).filter((q) => !["consent", "email"].includes(q.type));
      if (!qs.length) continue;
      html += `<h2 class="sec-title">${esc(L(section.title))}</h2>`;

      for (const q of qs) {
        const keys = q.type === "grid" ? q.items.map((i) => i.key) : [q.key];
        const rows = participants
          .map((p) => ({ p, a: byP.get(p.id) || {} }))
          .filter(({ a }) => keys.some((k) => a[k]));
        let inner = "";

        if (q.type === "text") {
          inner = rows.length
            ? `<div class="quotes">${rows
                .map(({ p, a }) => `<div class="quote"><div class="who"><a href="#" data-open="${p.id}">${shortId(p.id)}</a><br>${esc(personTag(a))}${contactOf(p.id) ? `<br>${mailLink(contactOf(p.id))}` : ""}</div><p>${esc(a[q.key].value)}</p></div>`)
                .join("")}</div>`
            : `<div class="empty">Noch keine Antworten.</div>`;
        } else if (q.type === "single" || q.type === "multi") {
          const counts = new Map();
          const others = [];
          for (const { p, a } of rows) {
            const parts = q.type === "multi" ? a[q.key].value.split("; ") : [a[q.key].value];
            for (const part of parts) {
              let label = part;
              if (part.startsWith(OTHER + ":")) {
                others.push({ p, text: part.slice(OTHER.length + 1).trim() });
                label = OTHER;
              }
              counts.set(label, (counts.get(label) || 0) + 1);
            }
          }
          inner = barsHtml(counts, rows.length);
          if (others.length) {
            inner += `<div class="stat-line" style="margin-top:14px">„Andere“-Angaben: ${others.map((o) => esc(o.text)).join(" · ")}</div>`;
          }
        } else if (q.type === "scale") {
          inner = scaleHtml(rows.map(({ a }) => Number(a[q.key].numeric_value)), q.scale);
        } else if (q.type === "percent") {
          const vals = rows.map(({ a }) => Number(a[q.key].numeric_value));
          inner = vals.length
            ? `<div class="stat-line">Ø ${Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)} % · Median ${median(vals)} % · Werte: ${vals.join(", ")}</div>`
            : `<div class="empty">Noch keine Antworten.</div>`;
        } else if (q.type === "grid") {
          inner = q.items
            .map((it) => {
              const vals = rows.filter(({ a }) => a[it.key]).map(({ a }) => Number(a[it.key].numeric_value));
              return `<div style="margin-bottom:16px"><strong style="font-size:14px">${esc(L(it.label))}</strong>${scaleHtml(vals, q.scale)}</div>`;
            })
            .join("");
        }

        html += `<div class="acard">
          <div class="acard-head">${q.ref ? `<span class="ref">${esc(q.ref)}</span>` : ""}<h3>${esc(L(q.label))}${q.attention ? ` <span class="pill">Kontrollfrage, richtig: ${q.attention}</span>` : ""}${q.showIf ? ` <span class="pill">nur bei Outsourcing</span>` : ""}</h3><span class="n">n = ${rows.length}</span></div>
          ${inner}
        </div>`;
      }
    }

    // Claim-Zuordnung zur Info
    return html;
  }

  function lastStepLabel(p) {
    const id = p.meta?.last_step;
    const s = steps.find((x) => x.id === id);
    return s ? L(sections.find((x) => x.id === s.section)?.title) + " · " + L(s.title).slice(0, 28) : "–";
  }

  function participantsHtml() {
    const byP = answersByParticipant();
    const list = visibleParticipants();
    if (!list.length) return `<div class="empty">Noch keine Teilnehmenden.</div>`;
    return `<div class="admin-table-wrap"><table class="pt">
      <thead><tr><th>ID</th><th>Quelle</th><th>Gestartet</th><th>Status</th><th>Dauer</th><th>Rolle · Branche</th><th>Kontakt</th><th>Sprache</th><th>Check</th><th>Website</th><th>Zuletzt</th></tr></thead>
      <tbody>${list
        .map((p) => {
          const a = byP.get(p.id) || {};
          return `<tr class="click" data-open="${p.id}">
            <td class="mono">${shortId(p.id)}</td>
            <td>${sourcePill(p)}</td>
            <td>${fmtDate(p.started_at)}</td>
            <td>${p.status === "completed" ? `<span class="pill ok">fertig</span>` : `<span class="pill warn">offen</span>`}</td>
            <td class="mono">${fmtDuration(duration(p))}</td>
            <td>${esc(personTag(a)) || "–"}</td>
            <td style="font-size:13px">${mailLink(contactOf(p.id)) || "–"}</td>
            <td class="mono">${esc(LANG_LABEL[p.meta?.survey_lang] || "–")}</td>
            <td>${attentionPill(p)}</td>
            <td class="mono">${esc(p.meta?.fivesec?.mode || "–")}${p.meta?.website_lang ? " · " + esc(p.meta.website_lang) : ""}</td>
            <td style="font-size:13px;color:var(--ink-2)">${esc(lastStepLabel(p))}</td>
          </tr>`;
        })
        .join("")}</tbody></table></div>`;
  }

  function openDrawer(id) {
    const p = data.participants.find((x) => x.id === id);
    if (!p) return;
    ui.openParticipant = id;
    const a = answersByParticipant().get(id) || {};
    const fields = answerFields();
    const fs = p.meta?.fivesec;
    const bg = document.createElement("div");
    bg.className = "drawer-bg";
    const dr = document.createElement("div");
    dr.className = "drawer";
    dr.innerHTML = `
      <div class="eyebrow">Teilnehmende ${shortId(p.id)}</div>
      <h1 class="headline" style="font-size:44px">${esc(personTag(a)) || "Ohne Angaben"}</h1>
      ${contactOf(p.id) ? `<div class="contact-box">Kontakt für Rückfragen: ${mailLink(contactOf(p.id))}</div>` : `<div class="stat-line">Kein Kontakt angegeben (anonym).</div>`}
      <div class="stat-line">Quelle: ${sourceOf(p) === "preview" ? "Vorschau-Link" : "normaler Link"} · Gestartet ${fmtDate(p.started_at)} · ${p.status === "completed" ? "abgeschlossen nach " + fmtDuration(duration(p)) : "nicht abgeschlossen"}
      ${fs ? `<br>Website-Test: ${esc(fs.mode)}, Sprache ${esc(p.meta?.website_lang || "–")}, ${fs.shown_ms} ms gezeigt, Viewport ${fs.viewport?.w}×${fs.viewport?.h}` : ""}
      <br>Umfragesprache: ${esc(LANG_LABEL[p.meta?.survey_lang] || "–")} · Aufmerksamkeitscheck: ${p.meta?.attention_ok === true ? "bestanden" : p.meta?.attention_ok === false ? "nicht bestanden" : "–"}</div>
      <dl>${fields
        .filter((f) => a[f.key])
        .map((f) => {
          let v = a[f.key].value;
          return `<dt>${f.q.ref ? esc(f.q.ref) + " · " : ""}${esc(f.label)}</dt><dd>${esc(v)}</dd>`;
        })
        .join("")}</dl>
      <div style="margin-top:28px"><button class="btn ghost" type="button" data-close>Schließen</button></div>`;
    const close = () => {
      ui.openParticipant = null;
      bg.remove();
      dr.remove();
    };
    bg.addEventListener("click", close);
    dr.querySelector("[data-close]").addEventListener("click", close);
    document.body.append(bg, dr);
  }

  function contactsHtml() {
    const ids = new Set(sourceParticipants().map((p) => p.id));
    const contacts = data.contacts.filter((c) => ids.has(c.participant_id));
    if (!contacts.length) return `<div class="empty">Noch keine Kontaktangaben.</div>`;
    const byP = answersByParticipant();
    return `<p class="lead" style="font-size:16px">Freiwillig angegebene E-Mail-Adressen für Rückfragen. Klick auf eine Zeile öffnet die Antworten der Person.</p>
      <div class="admin-table-wrap"><table class="pt"><thead><tr><th>E-Mail</th><th>ID</th><th>Rolle · Branche</th><th>Status</th><th>Angegeben</th></tr></thead><tbody>
      ${contacts
        .map((c) => {
          const p = data.participants.find((x) => x.id === c.participant_id);
          const a = byP.get(c.participant_id) || {};
          return `<tr class="click" data-open="${c.participant_id}"><td>${mailLink(c.email)}</td><td class="mono">${shortId(c.participant_id)}</td><td>${esc(personTag(a)) || "–"}</td><td>${p?.status === "completed" ? `<span class="pill ok">fertig</span>` : `<span class="pill warn">offen</span>`}</td><td>${fmtDate(c.created_at)}</td></tr>`;
        })
        .join("")}
      </tbody></table></div>`;
  }

  function exportHtml() {
    const n = visibleParticipants().length;
    return `
      <div class="notice info" style="margin-bottom:18px">Der Export enthält, was oben gefiltert ist: <strong>${SOURCES[ui.source]}</strong>${ui.onlyCompleted ? ", nur abgeschlossene" : ""} (${n} ${n === 1 ? "Person" : "Personen"}). Quelle oben umstellen für alles, nur Vorschau-Link oder nur normalen Link.</div>
      <div class="acard"><div class="acard-head"><h3>Breit: eine Zeile pro Person</h3></div>
        <p class="empty" style="margin-top:0">Für Excel bzw. Numbers. Spalten = Fragen, mit Kontakt-E-Mail (falls angegeben), Dauer und Website-Test-Metadaten.</p>
        <button class="btn" data-act="csv-wide" type="button">CSV herunterladen</button></div>
      <div class="acard"><div class="acard-head"><h3>Lang: eine Zeile pro Antwort</h3></div>
        <p class="empty" style="margin-top:0">Rohdaten aus der Tabelle <code>responses</code>, gut zum Filtern und Codieren.</p>
        <button class="btn ghost" data-act="csv-long" type="button">CSV herunterladen</button></div>`;
  }

  // ── Export ─────────────────────────────────────────────────
  function csv(rows) {
    const cell = (v) => {
      const s = String(v ?? "");
      return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
  }

  function download(name, content) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportWide() {
    const fields = answerFields();
    const byP = answersByParticipant();
    const head = ["id", "quelle", "kontakt_email", "status", "gestartet", "abgeschlossen", "dauer_min", "umfrage_sprache", "aufmerksamkeit_ok", "website_sprache", "fivesec_modus", "fivesec_ms", "viewport", ...fields.map((f) => (f.q.ref ? f.q.ref + " " : "") + f.key)];
    const rows = visibleParticipants().map((p) => {
      const a = byP.get(p.id) || {};
      const d = duration(p);
      return [
        shortId(p.id), sourceOf(p) === "preview" ? "vorschau" : "normal", contactOf(p.id), p.status, p.started_at, p.completed_at || "", d ? (d / 60000).toFixed(1).replace(".", ",") : "",
        p.meta?.survey_lang || "", p.meta?.attention_ok === true ? "ja" : p.meta?.attention_ok === false ? "nein" : "",
        p.meta?.website_lang || "", p.meta?.fivesec?.mode || "", p.meta?.fivesec?.shown_ms || "",
        p.meta?.viewport ? `${p.meta.viewport.w}x${p.meta.viewport.h}` : "",
        ...fields.map((f) => a[f.key]?.value ?? ""),
      ];
    });
    download(`kolsetu-interviews-breit-${new Date().toISOString().slice(0, 10)}.csv`, csv([head, ...rows]));
  }

  function exportLong() {
    const ids = new Set(visibleParticipants().map((p) => p.id));
    const src = new Map(data.participants.map((p) => [p.id, sourceOf(p) === "preview" ? "vorschau" : "normal"]));
    const head = ["id", "quelle", "abschnitt", "frage_key", "frage", "antwort", "zahl", "zeit"];
    const rows = data.responses
      .filter((r) => ids.has(r.participant_id))
      .map((r) => [shortId(r.participant_id), src.get(r.participant_id), r.construct, r.question_key, r.item_text, r.value, r.numeric_value ?? "", r.created_at]);
    download(`kolsetu-interviews-lang-${new Date().toISOString().slice(0, 10)}.csv`, csv([head, ...rows]));
  }

  // ── Login ──────────────────────────────────────────────────
  function renderLogin(message = "") {
    root.innerHTML = `
      <div class="center-screen">
        <form class="login" data-login>
          <div class="eyebrow">${esc(STUDY_TITLE)}</div>
          <h1>Auswertung</h1>
          <input type="email" name="email" placeholder="E-Mail" autocomplete="username" required>
          <input type="password" name="password" placeholder="Passwort" autocomplete="current-password" required
            style="width:100%;border:1px solid var(--line);background:var(--card);border-radius:12px;padding:14px 16px;font-size:16px">
          <button class="btn" type="submit" style="justify-content:center">Anmelden <span class="arr">→</span></button>
          ${message ? `<div class="notice">${esc(message)}</div>` : ""}
        </form>
      </div>`;
  }

  async function boot() {
    if (!db) return renderLogin("Supabase ist nicht konfiguriert.");
    const { data: s } = await db.auth.getSession();
    if (!s.session) return renderLogin();
    root.innerHTML = `<div class="center-screen"><div class="spinner"></div></div>`;
    try {
      await loadData();
      render();
    } catch (e) {
      renderLogin("Daten konnten nicht geladen werden: " + (e.message || e));
    }
  }

  function bind() {
    root.addEventListener("submit", async (e) => {
      if (!e.target.matches("[data-login]")) return;
      e.preventDefault();
      const f = new FormData(e.target);
      const { error } = await db.auth.signInWithPassword({ email: f.get("email"), password: f.get("password") });
      if (error) return renderLogin("Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.");
      boot();
    });
    root.addEventListener("click", async (e) => {
      const tab = e.target.closest("[data-tab]");
      if (tab) { ui.tab = tab.dataset.tab; return render(); }
      const open = e.target.closest("[data-open]");
      if (open) { e.preventDefault(); return openDrawer(open.dataset.open); }
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "logout") { await db.auth.signOut(); return renderLogin(); }
      if (act === "refresh") { await loadData(); return render(); }
      if (act === "csv-wide") return exportWide();
      if (act === "csv-long") return exportLong();
    });
    root.addEventListener("change", (e) => {
      if (e.target.dataset.filter === "completed") { ui.onlyCompleted = e.target.checked; render(); }
      if (e.target.dataset.filter === "source") { ui.source = e.target.value; render(); }
    });
  }

  function start() {
    root = document.getElementById("app");
    document.title = "Auswertung · " + STUDY_TITLE;
    bind();
    boot();
  }

  window.AdminApp = { start };
})();
