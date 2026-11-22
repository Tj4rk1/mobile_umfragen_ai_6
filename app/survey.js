// Teilnehmenden-Ansicht: Fragebogen, 5-Sekunden-Test, Website-Split-View.
(function () {
  const { cfg, sections, steps, db, OTHER, esc, uid, buildResponseRows } = window.Common;
  const W = cfg.website;

  const params = new URLSearchParams(location.search);
  const PREVIEW = params.has("preview");
  const STORAGE_KEY = cfg.storageKey + (PREVIEW ? "-preview" : "");

  let state;
  let root;
  let websiteMode = "checking"; // "live" | "screenshot"
  let stepEnteredAt = Date.now();
  let saveChain = Promise.resolve();
  let saveStatus = "idle"; // idle | pending | ok | error
  let fsTimers = [];

  // ── State ──────────────────────────────────────────────────
  function freshState() {
    return {
      anonymousId: uid(),
      participantId: null,
      stepIndex: 0,
      answers: {},
      claimOrder: shuffle(cfg.claims.map((c) => c.id)),
      fivesecDone: false,
      siteLang: cfg.website.defaultLanguage,
      startedAt: null,
      completed: false,
      meta: { step_seconds: {} },
    };
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && saved.anonymousId) return { ...freshState(), ...saved };
    } catch (e) {}
    return freshState();
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const step = () => steps[state.stepIndex];

  // ── Backend ────────────────────────────────────────────────
  async function ensureParticipant() {
    if (PREVIEW || state.participantId || !db) return;
    const { data, error } = await db.rpc("assign_participant", {
      p_anonymous_id: state.anonymousId,
      p_user_agent: navigator.userAgent.slice(0, 400),
    });
    if (error) throw error;
    state.participantId = data.id;
    persist();
  }

  function collectMeta() {
    return {
      ...state.meta,
      viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 },
      website_mode: websiteMode,
      website_lang: siteLang().code,
      website_path: siteLang().path,
      claim_order: state.claimOrder,
      last_step: step().id,
      language: navigator.language,
    };
  }

  function saveProgress(complete = false) {
    if (PREVIEW || !db) return Promise.resolve(true);
    setSaveStatus("pending");
    saveChain = saveChain
      .catch(() => {})
      .then(async () => {
        await ensureParticipant();
        const { error } = await db.rpc("save_interview_progress", {
          p_participant_id: state.participantId,
          p_anonymous_id: state.anonymousId,
          p_responses: buildResponseRows(state.answers),
          p_meta: collectMeta(),
          p_complete: complete,
          p_contact: (state.answers.kontakt || "").trim() || null,
        });
        if (error) throw error;
        setSaveStatus("ok");
        return true;
      })
      .catch((error) => {
        console.error("Speichern fehlgeschlagen", error);
        setSaveStatus("error");
        return false;
      });
    return saveChain;
  }

  function setSaveStatus(s) {
    saveStatus = s;
    const el = document.querySelector("[data-save]");
    if (el) {
      el.className = "save-state " + (s === "pending" ? "pending" : s === "error" ? "error" : "");
      el.textContent = saveLabel();
    }
  }

  function saveLabel() {
    if (PREVIEW) return "Vorschau · speichert nicht";
    if (!db) return "Offline";
    return { pending: "Speichert …", error: "Nicht gespeichert", ok: "Gespeichert", idle: "Automatisch gespeichert" }[saveStatus];
  }

  // ── Website mode / proxy check ─────────────────────────────
  function siteLang() {
    return W.languages.find((l) => l.code === state.siteLang) || W.languages.find((l) => l.code === W.defaultLanguage) || W.languages[0];
  }

  function siteSrc() {
    const path = siteLang().path;
    return path + (path.includes("?") ? "&" : "?") + "studie-website=1";
  }

  function siteUrlLabel() {
    const path = siteLang().path;
    return W.displayUrl + (path === "/" ? "" : path);
  }

  // Runde Flaggen (wie im Sprachmenü auf kolsetu.com)
  const FLAGS = {
    de: '<rect width="30" height="7" fill="#000"/><rect y="7" width="30" height="7" fill="#DD0000"/><rect y="14" width="30" height="6" fill="#FFCE00"/>',
    fr: '<rect width="10" height="20" fill="#0055A4"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#EF4135"/>',
    es: '<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/>',
    cs: '<rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#D7141A"/><path d="M0 0 L15 10 L0 20 Z" fill="#11457E"/>',
    en: '<rect width="30" height="20" fill="#012169"/><path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0L30 20M30 0L0 20" stroke="#C8102E" stroke-width="1.6"/><path d="M15 0V20M0 10H30" stroke="#fff" stroke-width="6"/><path d="M15 0V20M0 10H30" stroke="#C8102E" stroke-width="3.4"/>',
  };
  function flag(code) {
    return `<span class="flag" aria-hidden="true"><svg viewBox="5 0 20 20" preserveAspectRatio="xMidYMid slice">${FLAGS[code] || ""}</svg></span>`;
  }

  function langPickerHtml() {
    const cur = siteLang();
    return `<div class="lang">
      <span class="lang-label" id="lang-lbl">Sprache der Website</span>
      <div class="lang-dd">
        <button type="button" class="lang-btn" data-act="lang-toggle" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="lang-lbl">
          ${flag(cur.code)}<span>${esc(cur.label)}</span><svg class="chev" viewBox="0 0 12 12" width="12" height="12"><path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <ul class="lang-menu" role="listbox" hidden>
          ${W.languages
            .map((l) => `<li><button type="button" role="option" data-lang="${l.code}" aria-selected="${l.code === cur.code}">${flag(l.code)}<span>${esc(l.label)}</span>${l.code === cur.code ? '<span class="tick">✓</span>' : ""}</button></li>`)
            .join("")}
        </ul>
      </div>
    </div>`;
  }

  async function detectWebsiteMode() {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(siteSrc(), { cache: "no-store", signal: ctrl.signal });
      clearTimeout(timer);
      res.body?.cancel?.();
      websiteMode = res.ok && res.headers.get("x-study-proxy") === "kolsetu" ? "live" : "screenshot";
    } catch (e) {
      websiteMode = "screenshot";
    }
    if (websiteMode === "live" && W.preConsent) presetConsent();
  }

  function presetConsent() {
    const now = new Date().toISOString();
    const value = {
      version: 2, timestamp: now, essential: true, analytics: false, consentGiven: true,
      consentWithdrawn: false, dataProcessingBasis: "legitimate_interest", retentionPeriod: "1 year",
      thirdPartyTransfers: [], consentHistory: [{ action: "initial_consent", timestamp: now, choices: { analytics: false } }],
    };
    document.cookie = "novothes=" + encodeURIComponent(JSON.stringify(value)) + "; path=/; max-age=31536000; SameSite=Lax";
  }

  function siteMarkup(id) {
    if (websiteMode === "live") {
      return `<iframe id="${id}" src="${esc(siteSrc())}" title="Website im Test"
        sandbox="allow-scripts allow-same-origin allow-popups" referrerpolicy="no-referrer"></iframe>`;
    }
    return `<div class="shot" id="${id}"><img src="${esc(W.fallbackImage)}" alt="Startseite im Test"><span class="shot-note">${esc(W.fallbackLabel)}</span></div>`;
  }

  // Seite in Desktop-Breite rendern und auf die verfügbare Fläche skalieren
  let fitObserver = null;
  function fitSite() {
    const vp = document.querySelector(".viewport");
    const f = document.getElementById("site");
    const tag = document.querySelector(".chrome .tag");
    if (!vp || !f || f.tagName !== "IFRAME") return;
    const w = vp.clientWidth;
    const h = vp.clientHeight;
    const target = W.desktopWidth || 1280;
    if (window.innerWidth <= 920 || w >= target || !w) {
      Object.assign(f.style, { width: "100%", height: "100%", transform: "" });
      if (tag) tag.textContent = "● live";
      return;
    }
    const scale = w / target;
    Object.assign(f.style, { width: target + "px", height: h / scale + "px", transform: `scale(${scale})` });
    if (tag) tag.textContent = `● live · ${Math.round(scale * 100)} %`;
  }

  function watchFit() {
    fitObserver?.disconnect();
    const vp = document.querySelector(".viewport");
    if (!vp || !window.ResizeObserver) return;
    fitObserver = new ResizeObserver(fitSite);
    fitObserver.observe(vp);
    fitSite();
  }

  // Verstellbare Trennlinie zwischen Website und Fragen
  const PANEL_KEY = cfg.storageKey + "-panel-width";
  const PANEL_DEFAULT = 460;
  function clampPanel(px, split) {
    const max = Math.max(320, split.clientWidth - 420);
    return Math.round(Math.min(max, Math.max(320, px)));
  }
  function setPanelWidth(px, persistIt = true) {
    const split = document.querySelector(".split");
    if (!split) return;
    const w = clampPanel(px, split);
    split.style.setProperty("--panel", w + "px");
    if (persistIt) try { localStorage.setItem(PANEL_KEY, String(w)); } catch (e) {}
    fitSite();
  }
  function setupGutter() {
    const split = document.querySelector(".split");
    const gutter = split?.querySelector(".gutter");
    if (!gutter) return;
    const saved = Number(localStorage.getItem(PANEL_KEY));
    if (saved) setPanelWidth(saved, false);
    gutter.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      gutter.setPointerCapture(e.pointerId);
      split.classList.add("dragging");
      const move = (ev) => setPanelWidth(split.getBoundingClientRect().right - ev.clientX - 6);
      const up = () => {
        split.classList.remove("dragging");
        gutter.removeEventListener("pointermove", move);
        gutter.removeEventListener("pointerup", up);
        gutter.removeEventListener("pointercancel", up);
      };
      gutter.addEventListener("pointermove", move);
      gutter.addEventListener("pointerup", up);
      gutter.addEventListener("pointercancel", up);
    });
    gutter.addEventListener("dblclick", () => setPanelWidth(PANEL_DEFAULT));
    gutter.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const cur = split.querySelector(".panel").getBoundingClientRect().width;
      setPanelWidth(cur + (e.key === "ArrowLeft" ? 32 : -32));
    });
  }

  // ── Validation ─────────────────────────────────────────────
  function isAnswered(q) {
    const a = state.answers;
    switch (q.type) {
      case "grid":
        return q.items.every((it) => a[it.key] !== undefined);
      case "multi":
        return Array.isArray(a[q.key]) && a[q.key].length > 0;
      case "consent":
        return a[q.key] === true;
      case "text":
      case "email":
        return String(a[q.key] || "").trim().length > 0;
      default:
        return a[q.key] !== undefined && a[q.key] !== null && a[q.key] !== "";
    }
  }

  function missingRequired() {
    return (step().questions || []).filter((q) => q.required && !isAnswered(q));
  }

  function emailInvalid() {
    const v = String(state.answers.kontakt || "").trim();
    return step().questions?.some((q) => q.type === "email") && v && !/^\S+@\S+\.\S+$/.test(v);
  }

  // ── Navigation ─────────────────────────────────────────────
  function trackStepTime() {
    const id = step().id;
    const secs = Math.round((Date.now() - stepEnteredAt) / 1000);
    state.meta.step_seconds[id] = (state.meta.step_seconds[id] || 0) + secs;
    stepEnteredAt = Date.now();
  }

  async function next() {
    const missing = missingRequired();
    if (missing.length || emailInvalid()) {
      document.querySelectorAll(".q").forEach((el) => {
        const bad = missing.some((q) => q.key === el.dataset.key) || (el.dataset.type === "email" && emailInvalid());
        el.classList.toggle("invalid", bad);
      });
      const first = document.querySelector(".q.invalid");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    trackStepTime();
    if (step().kind === "intro" && !state.startedAt) state.startedAt = new Date().toISOString();

    let target = state.stepIndex + 1;
    if (steps[target]?.kind === "fivesec" && state.fivesecDone) target++;
    const finishing = steps[target]?.kind === "end";

    state.stepIndex = Math.min(target, steps.length - 1);
    persist();

    if (finishing) {
      state.completed = true;
      persist();
      render();
      const ok = await saveProgress(true);
      if (!ok) renderEndError();
      return;
    }
    render();
    saveProgress(false);
  }

  function back() {
    trackStepTime();
    let target = state.stepIndex - 1;
    if (steps[target]?.kind === "fivesec" && state.fivesecDone) target--;
    state.stepIndex = Math.max(0, target);
    persist();
    render();
  }

  // ── Rendering: chrome ──────────────────────────────────────
  function progress() {
    const total = steps.length - 1;
    return Math.round((state.stepIndex / total) * 100);
  }

  function headerHtml() {
    const sec = sections.find((x) => x.id === step().section);
    const idx = sections.indexOf(sec);
    return `
      <header class="sheader">
        <div class="sh-brand"><span class="sh-title">${esc(cfg.study.title)}</span></div>
        <div class="sh-progress" aria-label="Fortschritt ${progress()} Prozent">
          <span class="sh-sec">${idx > 0 ? `<span class="sh-n">${idx}/${sections.length - 1}</span>` : ""}${esc(sec.title)}</span>
          <div class="meter"><i style="width:${progress()}%"></i></div>
        </div>
        <div class="sh-save"><span data-save class="save-state">${saveLabel()}</span></div>
      </header>`;
  }

  function navHtml({ nextLabel = "Weiter", showBack = true, accent = false } = {}) {
    const n = steps.filter((s) => s.kind !== "end").length;
    return `
      <div class="nav">
        ${showBack && state.stepIndex > 0 ? `<button class="btn ghost" data-act="back" type="button">Zurück</button>` : ""}
        <span class="count">${String(state.stepIndex + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}</span>
        <span class="spacer"></span>
        <span class="kbd"><b>Enter ↵</b></span>
        <button class="btn ${accent ? "lg" : ""}" data-act="next" type="button">${esc(nextLabel)} <span class="arr">→</span></button>
      </div>`;
  }

  // ── Rendering: questions ───────────────────────────────────
  function labelHtml(q) {
    return `<div class="q-label" id="lbl-${q.key}">${esc(q.label)}${q.required ? `<span class="req">Pflicht</span>` : ""}</div>${q.hint ? `<div class="q-hint">${esc(q.hint)}</div>` : ""}`;
  }

  function optionButtons(q, options, { multi = false } = {}) {
    const a = state.answers[q.key];
    const selected = (v) => (multi ? Array.isArray(a) && a.includes(v) : a === v);
    const full = multi && q.max && Array.isArray(a) && a.length >= q.max;
    const all = q.other ? [...options, OTHER] : options;
    return `<div class="opts" data-cols="${q.columns || 2}" style="--cols:${q.columns || 2}" role="${multi ? "group" : "radiogroup"}" aria-labelledby="lbl-${q.key}">
      ${all
        .map((o) => {
          const on = selected(o);
          return `<button type="button" class="opt ${multi ? "multi" : ""}" role="${multi ? "checkbox" : "radio"}" aria-checked="${on}" data-opt="${esc(o)}" ${full && !on ? "disabled" : ""}><span class="box"></span><span>${esc(o === OTHER ? "Andere, und zwar …" : o)}</span></button>`;
        })
        .join("")}
    </div>
    ${q.other && selected(OTHER) ? `<input class="other-input" type="text" data-other="${q.key}" placeholder="Bitte kurz angeben" value="${esc(state.answers[q.key + "__andere"] || "")}">` : ""}
    ${q.max ? `<div class="limit-note">${(Array.isArray(a) ? a.length : 0)} von max. ${q.max} gewählt</div>` : ""}`;
  }

  function scaleButtons(key, scale) {
    const v = state.answers[key];
    const nums = [];
    for (let i = scale.min; i <= scale.max; i++) nums.push(i);
    return `<div class="scale-btns" style="--n:${nums.length}" role="radiogroup">
      ${nums.map((n) => `<button type="button" data-scale="${key}" data-val="${n}" aria-pressed="${v === n}">${n}</button>`).join("")}
    </div>`;
  }

  function questionInner(q) {
    const a = state.answers;
    switch (q.type) {
      case "consent":
        return `<button type="button" class="consent" data-consent="${q.key}" aria-checked="${a[q.key] === true}"><span class="box"></span><span>${esc(q.label)}</span></button>`;
      case "text":
        return `${labelHtml(q)}<textarea rows="${q.rows || 3}" data-text="${q.key}" placeholder="${esc(q.placeholder || "")}" aria-labelledby="lbl-${q.key}">${esc(a[q.key] || "")}</textarea>`;
      case "email":
        return `${labelHtml(q)}<input type="email" autocomplete="email" data-text="${q.key}" placeholder="${esc(q.placeholder || "")}" value="${esc(a[q.key] || "")}">`;
      case "single":
        return `${labelHtml(q)}${optionButtons(q, q.options)}`;
      case "multi":
        return `${labelHtml(q)}${optionButtons(q, q.options, { multi: true })}`;
      case "claimpick": {
        const letters = state.claimOrder.map((id, i) => ({ id, letter: String.fromCharCode(65 + i) }));
        return `${labelHtml(q)}<div class="opts" style="--cols:3" role="radiogroup">
          ${letters.map(({ id, letter }) => `<button type="button" class="opt" role="radio" data-claim="${q.key}" data-val="${id}" aria-checked="${a[q.key] === id}"><span class="box"></span><span>Claim ${letter}</span></button>`).join("")}
        </div>`;
      }
      case "scale":
        return `${labelHtml(q)}<div class="scale">${scaleButtons(q.key, q.scale)}<div class="scale-ends"><span>${esc(q.scale.left)}</span><span>${esc(q.scale.right)}</span></div></div>`;
      case "grid":
        return `${labelHtml(q)}<div class="grid-q">
          <div class="grid-head"><span></span><div class="scale-ends"><span>${esc(q.scale.left)}</span><span>${esc(q.scale.right)}</span></div></div>
          ${q.items.map((it) => `<div class="grid-row"><span>${esc(it.label)}</span>${scaleButtons(it.key, q.scale)}</div>`).join("")}
        </div>`;
      case "percent": {
        const v = a[q.key];
        const has = v !== undefined;
        return `${labelHtml(q)}<div class="percent">
          <input type="range" min="0" max="100" step="5" value="${has ? v : 50}" data-percent="${q.key}" style="--p:${has ? v : 0}%" aria-labelledby="lbl-${q.key}">
          <output class="${has ? "" : "empty"}" data-out="${q.key}">${has ? v + " %" : "– %"}</output>
          <div class="percent-ticks"><span>0 %</span><span>50 %</span><span>100 %</span></div>
        </div>`;
      }
      default:
        return "";
    }
  }

  function questionsHtml(s) {
    return `<div class="questions">${(s.questions || [])
      .map((q) => `<div class="q" data-key="${q.key}" data-type="${q.type}">${questionInner(q)}</div>`)
      .join("")}</div>`;
  }

  function rerenderQuestion(key) {
    const q = step().questions.find((x) => x.key === key || x.items?.some((i) => i.key === key));
    const el = document.querySelector(`.q[data-key="${q.key}"]`);
    if (!el) return;
    el.innerHTML = questionInner(q);
    if (q.required && isAnswered(q)) el.classList.remove("invalid");
    const other = el.querySelector("[data-other]");
    if (other && !other.value) other.focus();
  }

  function stimulusHtml(s) {
    if (s.stimulus === "claims") {
      return `<div class="claims">${state.claimOrder
        .map((id, i) => `<div class="claim"><b>${String.fromCharCode(65 + i)}</b><q>${esc(window.Common.claimText(id))}</q></div>`)
        .join("")}</div>`;
    }
    if (s.stimulus === "linkedin") {
      const m = cfg.linkedinMessage;
      return `<div class="dm" aria-label="Beispielnachricht">
        <div class="dm-head"><span class="dm-avatar">${esc(m.sender[0])}</span><div><strong>${esc(m.sender)}</strong><span>${esc(m.senderRole)}</span></div></div>
        <div class="dm-body"><div class="bubble">${esc(m.body)}</div></div>
      </div>`;
    }
    return "";
  }

  // ── Rendering: screens ─────────────────────────────────────
  function render() {
    clearFsTimers();
    const s = step();
    stepEnteredAt = Date.now();
    document.title = `${sections.find((x) => x.id === s.section).title} · ${cfg.study.title}`;

    if (s.kind === "end") return renderEnd();

    if (s.layout === "website") return renderWebsite(s);

    const body =
      s.kind === "intro" ? introHtml(s) : s.kind === "fivesec" ? fivesecBriefHtml(s) : standardHtml(s);

    root.innerHTML = `
      
      <div class="page">
        ${headerHtml()}
        <main class="main">
          <div class="stage"><div class="content">${body}</div></div>
          ${s.kind === "fivesec" ? "" : navHtml({ nextLabel: s.kind === "intro" ? "Los geht’s" : nextLabelFor(), showBack: s.kind !== "intro", accent: s.kind === "intro" })}
        </main>
      </div>`;
    window.scrollTo(0, 0);
  }

  function nextLabelFor() {
    return steps[state.stepIndex + 1]?.kind === "end" ? "Absenden" : "Weiter";
  }

  function introHtml(s) {
    return `
      <div class="eyebrow">${esc(s.eyebrow)}</div>
      <h1 class="headline">Wie viel Vertrauen braucht <em>KI</em> im Kundenservice?</h1>
      <p class="lead">${esc(s.lead)}</p>
      <div class="facts">${s.facts.map(([t, d]) => `<div class="fact"><strong>${esc(t)}</strong><span>${esc(d)}</span></div>`).join("")}</div>
      ${questionsHtml(s)}
      ${!db && !PREVIEW ? `<div class="notice">Die Datenbank ist nicht erreichbar. Bitte laden Sie die Seite neu.</div>` : ""}`;
  }

  function standardHtml(s) {
    return `
      <div class="eyebrow">${esc(sections.find((x) => x.id === s.section).title)}</div>
      <h1 class="headline">${esc(s.title)}</h1>
      ${s.lead ? `<p class="lead">${esc(s.lead)}</p>` : ""}
      ${s.task ? `<div class="task">${esc(s.task)}</div>` : ""}
      ${stimulusHtml(s)}
      ${questionsHtml(s)}`;
  }

  function fivesecBriefHtml(s) {
    return `
      <div class="eyebrow">Website-Test · Teil 1</div>
      <h1 class="headline">${esc(s.title)}</h1>
      <p class="lead">${esc(s.lead)}</p>
      ${langPickerHtml()}
      <ol class="brief">${s.instructions.map(([t, d]) => `<li><div><strong>${esc(t)}</strong><span>${esc(d)}</span></div></li>`).join("")}</ol>
      <div class="fivesec-cta">
        <button class="btn lg" data-act="fivesec" type="button" ${websiteMode === "checking" ? "disabled" : ""}>Ich bin bereit <span class="arr">→</span></button>
        <span class="hint">${websiteMode === "checking" ? "Seite wird vorbereitet …" : `Countdown ${W.countdownSeconds} s, dann ${W.exposureSeconds} s Website`}</span>
      </div>
      <div style="margin-top:28px"><button class="btn ghost" data-act="back" type="button">Zurück</button></div>`;
  }

  function renderWebsite(s) {
    const existing = root.querySelector(".split");
    const panel = `
      <div class="panel-scroll">
        <div class="eyebrow">Website-Test · Teil 2</div>
        <h1 class="headline">${esc(s.title)}</h1>
        ${s.lead ? `<p class="lead">${esc(s.lead)}</p>` : ""}
        ${s.task ? `<div class="task">${esc(s.task)}</div>` : ""}
        ${questionsHtml(s)}
      </div>
      ${navHtml({ nextLabel: nextLabelFor() })}`;

    if (existing) {
      // iframe behalten (Scrollposition bleibt erhalten), nur Panel + Rail tauschen
      existing.querySelector(".panel").innerHTML = panel;
      existing.querySelector(".panel-scroll").scrollTop = 0;
      root.querySelector(".sheader").outerHTML = headerHtml();
      return;
    }

    root.innerHTML = `
      
      <div class="page is-website">
        ${headerHtml()}
        <main class="main">
          <div class="split">
            <section class="browser" aria-label="Website">
              <div class="chrome">
                <span class="lights"><i></i><i></i><i></i></span>
                <span class="url">${flag(siteLang().code)}${esc(siteUrlLabel())}</span>
                <span class="tag ${websiteMode === "live" ? "live" : ""}">${websiteMode === "live" ? "● live" : "Screenshot"}</span>
                <button class="tool" type="button" data-act="reload-site" title="Seite neu laden">↻</button>
                <button class="tool mobile-full" type="button" data-act="toggle-full">⤢</button>
              </div>
              <div class="viewport">${siteMarkup("site")}</div>
            </section>
            <div class="gutter" role="separator" aria-orientation="vertical" aria-label="Breite anpassen" tabindex="0" title="Ziehen, um die Breite zu ändern · Doppelklick: zurücksetzen"><span></span></div>
            <aside class="panel">${panel}</aside>
          </div>
        </main>
      </div>`;
    window.scrollTo(0, 0);
    setupGutter();
    watchFit();
  }

  function renderEnd() {
    const s = step();
    root.innerHTML = `
      <div class="center-screen">
        <div class="content" style="max-width:640px">
          <div class="end-mark"></div>
          <h1 class="headline">${esc(s.title)}</h1>
          <p class="lead">${esc(s.lead)}</p>
          <div data-end-status></div>
          ${PREVIEW ? `<div class="notice info">Vorschau: Es wurde nichts gespeichert. <button class="btn ghost" data-act="restart" type="button" style="margin-left:8px;height:38px">Neu starten</button></div>` : ""}
        </div>
      </div>`;
  }

  function renderEndError() {
    const el = document.querySelector("[data-end-status]");
    if (!el) return;
    el.innerHTML = `<div class="notice">Ihre letzten Antworten konnten nicht übertragen werden. Bitte prüfen Sie Ihre Verbindung. <button class="btn" data-act="retry-save" type="button" style="margin-top:10px;height:40px">Erneut senden</button></div>`;
  }

  // ── Five-second test ───────────────────────────────────────
  function clearFsTimers() {
    fsTimers.forEach(clearTimeout);
    fsTimers = [];
  }

  function startFivesec() {
    const stage = document.createElement("div");
    stage.className = "fs";
    stage.innerHTML = `<div class="fs-frame">${siteMarkup("fs-site")}</div><div class="fs-count"></div>`;
    document.body.appendChild(stage);
    document.body.style.overflow = "hidden";

    const frame = stage.querySelector(".fs-frame");
    const countEl = stage.querySelector(".fs-count");
    const t0 = performance.now();
    let loaded = websiteMode !== "live";
    let loadedAt = loaded ? t0 : null;
    let waitingForLoad = false;

    const iframe = stage.querySelector("iframe");
    if (iframe) {
      iframe.addEventListener("load", () => {
        loaded = true;
        loadedAt = performance.now();
        if (waitingForLoad) expose();
      });
    }

    let n = W.countdownSeconds;
    const tick = () => {
      if (n > 0) {
        countEl.innerHTML = `<span class="num" key="${n}">${n}</span><span class="sub">Gleich geht’s los</span>`;
        n--;
        fsTimers.push(setTimeout(tick, 1000));
      } else if (loaded) {
        expose();
      } else {
        waitingForLoad = true;
        countEl.innerHTML = `<div class="fs-msg"><div class="spinner"></div><p>Die Seite lädt noch, einen Moment …</p></div>`;
        // spätestens nach 8 s trotzdem zeigen
        fsTimers.push(setTimeout(() => waitingForLoad && expose(), 8000));
      }
    };

    let exposed = false;
    function expose() {
      if (exposed) return;
      exposed = true;
      waitingForLoad = false;
      const ms = W.exposureSeconds * 1000;
      countEl.remove();
      frame.classList.add("show");
      const bar = document.createElement("div");
      bar.className = "fs-bar";
      bar.innerHTML = `<i style="animation-duration:${ms}ms;--d:${ms}ms"></i>`;
      stage.appendChild(bar);
      const timer = document.createElement("div");
      timer.className = "fs-timer";
      stage.appendChild(timer);
      const shownAt = performance.now();
      const upd = () => {
        const left = Math.max(0, ms - (performance.now() - shownAt));
        timer.textContent = (left / 1000).toFixed(1) + " s";
        if (left > 0) fsTimers.push(setTimeout(upd, 100));
      };
      upd();
      // Fokus in die Seite, damit Scrollen per Tastatur/Trackpad sofort geht
      try { stage.querySelector("iframe")?.focus(); } catch (e) {}

      fsTimers.push(
        setTimeout(() => {
          const shownMs = Math.round(performance.now() - shownAt);
          frame.remove();
          bar.remove();
          timer.remove();
          stage.insertAdjacentHTML("beforeend", `<div class="fs-msg"><h2>Zeit ist um.</h2><p>Die Seite ist ausgeblendet. Jetzt ein paar Fragen dazu.</p></div>`);
          state.fivesecDone = true;
          state.meta.fivesec = {
            mode: websiteMode,
            lang: siteLang().code,
            loaded_before_show: loaded,
            wait_after_countdown_ms: Math.max(0, Math.round((loadedAt || performance.now()) - t0 - W.countdownSeconds * 1000)),
            shown_ms: shownMs,
            viewport: { w: window.innerWidth, h: window.innerHeight },
            at: new Date().toISOString(),
          };
          persist();
          fsTimers.push(
            setTimeout(() => {
              stage.remove();
              document.body.style.overflow = "";
              next();
            }, 1800)
          );
        }, ms)
      );
    }

    tick();
  }

  // ── Events ─────────────────────────────────────────────────
  function bind() {
    root.addEventListener("click", (e) => {
      const t = e.target.closest("button");
      if (!t || t.disabled) return;
      const a = state.answers;

      if (t.dataset.act === "next") return next();
      if (t.dataset.act === "back") return back();
      if (t.dataset.act === "fivesec") return startFivesec();
      if (t.dataset.act === "lang-toggle") {
        const menu = t.parentElement.querySelector(".lang-menu");
        const open = menu.hidden;
        menu.hidden = !open;
        t.setAttribute("aria-expanded", String(open));
        if (open) menu.querySelector('[aria-selected="true"]')?.focus();
        return;
      }
      if (t.dataset.lang) {
        state.siteLang = t.dataset.lang;
        persist();
        const picker = t.closest(".lang");
        picker.outerHTML = langPickerHtml();
        root.querySelector(".lang-btn")?.focus();
        return;
      }
      if (t.dataset.act === "reload-site") {
        const f = document.getElementById("site");
        if (f?.tagName === "IFRAME") f.src = siteSrc();
        return;
      }
      if (t.dataset.act === "toggle-full") {
        document.querySelector(".browser")?.classList.toggle("full");
        return fitSite();
      }
      if (t.dataset.act === "restart") {
        localStorage.removeItem(STORAGE_KEY);
        state = freshState();
        return render();
      }
      if (t.dataset.act === "retry-save") {
        return saveProgress(true).then((ok) => {
          const el = document.querySelector("[data-end-status]");
          if (el) el.innerHTML = ok ? `<div class="notice info">Übertragen. Danke!</div>` : el.innerHTML;
        });
      }

      if (t.dataset.consent) {
        a[t.dataset.consent] = !a[t.dataset.consent];
        persist();
        return rerenderQuestion(t.dataset.consent);
      }
      if (t.dataset.scale) {
        a[t.dataset.scale] = Number(t.dataset.val);
        persist();
        return rerenderQuestion(t.dataset.scale);
      }
      if (t.dataset.claim) {
        a[t.dataset.claim] = t.dataset.val;
        persist();
        return rerenderQuestion(t.dataset.claim);
      }
      if (t.dataset.opt !== undefined) {
        const qEl = t.closest(".q");
        const q = step().questions.find((x) => x.key === qEl.dataset.key);
        const v = t.dataset.opt;
        if (q.type === "multi") {
          const list = Array.isArray(a[q.key]) ? a[q.key].slice() : [];
          const i = list.indexOf(v);
          if (i >= 0) list.splice(i, 1);
          else if (!q.max || list.length < q.max) list.push(v);
          a[q.key] = list;
        } else {
          a[q.key] = a[q.key] === v ? undefined : v;
        }
        persist();
        return rerenderQuestion(q.key);
      }
    });

    root.addEventListener("input", (e) => {
      const t = e.target;
      const a = state.answers;
      if (t.dataset.text) a[t.dataset.text] = t.value;
      if (t.dataset.other) a[t.dataset.other + "__andere"] = t.value;
      if (t.dataset.percent) {
        a[t.dataset.percent] = Number(t.value);
        t.style.setProperty("--p", t.value + "%");
        const out = document.querySelector(`[data-out="${t.dataset.percent}"]`);
        out.textContent = t.value + " %";
        out.classList.remove("empty");
        t.closest(".q")?.classList.remove("invalid");
      }
      if (t.dataset.text) {
        const q = t.closest(".q");
        if (q && t.value.trim()) q.classList.remove("invalid");
      }
      persist();
    });

    root.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
      if (e.target.tagName === "TEXTAREA") {
        if (e.metaKey || e.ctrlKey) { e.preventDefault(); next(); }
        return;
      }
      if (e.target.tagName === "BUTTON") return;
      const s = step();
      if (s.kind === "fivesec" || s.kind === "end") return;
      e.preventDefault();
      next();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.target !== document.body) return;
      const s = step();
      if (s.kind === "fivesec" || s.kind === "end" || document.querySelector(".fs")) return;
      e.preventDefault();
      next();
    });

    document.addEventListener("click", (e) => {
      if (e.target.closest(".lang-dd")) return;
      document.querySelectorAll(".lang-menu").forEach((m) => { m.hidden = true; });
      document.querySelectorAll(".lang-btn").forEach((b) => b.setAttribute("aria-expanded", "false"));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      document.querySelectorAll(".lang-menu").forEach((m) => { m.hidden = true; });
    });

    window.addEventListener("pagehide", () => {
      trackStepTime();
      persist();
    });
  }

  // ── Start ──────────────────────────────────────────────────
  async function start() {
    root = document.getElementById("app");
    state = load();
    if (state.completed) state.stepIndex = steps.length - 1;
    // Abgebrochener 5-Sekunden-Test: nicht erneut zeigen, wenn schon gesehen
    if (step().kind === "fivesec" && state.fivesecDone) state.stepIndex++;
    bind();
    render();
    await detectWebsiteMode();
    if (step().kind === "fivesec") render();
    else if (step().layout === "website") {
      root.innerHTML = "";
      render();
    }
  }

  window.SurveyApp = { start };
})();
