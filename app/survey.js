// Teilnehmenden-Ansicht: Sprachwahl, Fragebogen, Website-Test, Website-Split-View.
(function () {
  const { cfg, sections, steps, db, OTHER, L, optValue, esc, uid, isVisible, buildResponseRows } = window.Common;
  const W = cfg.website;

  const params = new URLSearchParams(location.search);
  const PREVIEW = params.has("preview");
  const STORAGE_KEY = cfg.storageKey + (PREVIEW ? "-preview" : "");

  // ── Oberflächentexte ───────────────────────────────────────
  const UI = {
    de: {
      next: "Weiter", back: "Zurück", submit: "Absenden", start: "Los geht’s",
      required: "Pflicht", optional: "freiwillig", answerThis: "Bitte beantworten Sie diese Frage.", emailInvalid: "Bitte eine gültige E-Mail-Adresse angeben.",
      other: "Andere, und zwar …", otherPh: "Bitte kurz angeben", maxNote: (n, m) => `${n} von max. ${m} gewählt`, unknown: "Weiß ich nicht",
      preview: "Vorschau · speichert nicht", offline: "Offline",
      save: { pending: "Speichert …", error: "Nicht gespeichert", ok: "Gespeichert", idle: "Automatisch gespeichert" },
      dbDown: "Die Datenbank ist nicht erreichbar. Bitte laden Sie die Seite neu.",
      siteLang: "Sprache der Website", ready: "Ich bin bereit", preparing: "Seite wird vorbereitet …",
      cdHint: (c, e) => `Countdown ${c} s, dann ${e} s Website`,
      part1: "Website-Test · Teil 1", part2: "Website-Test · Teil 2",
      startingSoon: "Gleich geht’s los", loading: "Die Seite lädt noch, einen Moment …",
      timeUp: "Zeit ist um.", timeUpSub: "Die Seite ist ausgeblendet. Jetzt ein paar Fragen dazu.",
      reload: "Seite neu laden", gutter: "Ziehen, um die Breite zu ändern · Doppelklick: zurücksetzen", gutterAria: "Breite anpassen",
      siteTitle: "Website im Test", screenshot: "Screenshot",
      previewEnd: "Vorschau: Es wurde nichts gespeichert.", restart: "Neu starten",
      endErr: "Ihre letzten Antworten konnten nicht übertragen werden. Bitte prüfen Sie Ihre Verbindung.", retry: "Erneut senden", sent: "Übertragen. Danke!",
      newline: "Shift + Enter: neue Zeile", progress: (p) => `Fortschritt ${p} Prozent`,
      mic: "Antwort einsprechen", micStop: "Aufnahme beenden", micConnecting: "Mikrofon wird gestartet …", micRec: "Sprechen Sie einfach los. Zum Beenden aufs Mikrofon klicken.", micFinishing: "Text wird fertiggestellt …",
      micErr: { denied: "Kein Zugriff auf das Mikrofon. Bitte im Browser erlauben (Schloss-Symbol in der Adresszeile).", nomic: "Kein Mikrofon gefunden.", busy: "Die Spracheingabe ist gerade ausgelastet. Bitte in einer Minute erneut versuchen oder tippen.", other: "Spracheingabe gerade nicht verfügbar. Bitte tippen Sie Ihre Antwort." },
    },
    en: {
      next: "Next", back: "Back", submit: "Submit", start: "Let’s start",
      required: "Required", optional: "optional", answerThis: "Please answer this question.", emailInvalid: "Please enter a valid email address.",
      other: "Other, namely …", otherPh: "Please specify", maxNote: (n, m) => `${n} of max. ${m} selected`, unknown: "I don't know",
      preview: "Preview · not saved", offline: "Offline",
      save: { pending: "Saving …", error: "Not saved", ok: "Saved", idle: "Saved automatically" },
      dbDown: "The database can't be reached. Please reload the page.",
      siteLang: "Website language", ready: "I'm ready", preparing: "Preparing the page …",
      cdHint: (c, e) => `${c} s countdown, then ${e} s website`,
      part1: "Website test · Part 1", part2: "Website test · Part 2",
      startingSoon: "Starting soon", loading: "The page is still loading, one moment …",
      timeUp: "Time's up.", timeUpSub: "The page is hidden. Now a few questions about it.",
      reload: "Reload page", gutter: "Drag to resize · double-click to reset", gutterAria: "Resize",
      siteTitle: "Website under test", screenshot: "Screenshot",
      previewEnd: "Preview: nothing was saved.", restart: "Start over",
      endErr: "Your latest answers couldn't be sent. Please check your connection.", retry: "Send again", sent: "Sent. Thank you!",
      newline: "Shift + Enter: new line", progress: (p) => `Progress ${p} percent`,
      mic: "Dictate your answer", micStop: "Stop recording", micConnecting: "Starting microphone …", micRec: "Just start talking. Click the microphone to stop.", micFinishing: "Finishing text …",
      micErr: { denied: "No access to the microphone. Please allow it in your browser (lock icon in the address bar).", nomic: "No microphone found.", busy: "Voice input is busy right now. Please try again in a minute or type.", other: "Voice input isn't available right now. Please type your answer." },
    },
  };
  const SURVEY_LANGS = [
    { code: "de", label: "Deutsch", hint: "Umfrage auf Deutsch" },
    { code: "en", label: "English", hint: "Survey in English" },
  ];

  let state;
  let root;
  let websiteMode = "checking"; // "live" | "screenshot"
  let stepEnteredAt = Date.now();
  let saveChain = Promise.resolve();
  let saveStatus = "idle";
  let fsTimers = [];

  const lang = () => (state && UI[state.lang] ? state.lang : "de");
  const u = () => UI[lang()];
  const t = (v) => L(v, lang());

  // ── State ──────────────────────────────────────────────────
  function freshState() {
    return {
      anonymousId: uid(),
      participantId: null,
      stepIndex: 0,
      lang: null,
      answers: {},
      fivesecDone: false,
      siteLang: W.defaultLanguage,
      siteLangChosen: false,
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

  const step = () => steps[state.stepIndex];

  // ── Backend ────────────────────────────────────────────────
  async function ensureParticipant() {
    if (PREVIEW || state.participantId || !db) return;
    const { data, error } = await db.rpc("assign_participant", {
      p_anonymous_id: state.anonymousId,
      p_user_agent: null, // bewusst nicht gespeichert (keine personenbezogenen Daten)
    });
    if (error) throw error;
    state.participantId = data.id;
    persist();
  }

  function collectMeta() {
    const att = steps.flatMap((s) => s.questions || []).find((q) => q.attention);
    return {
      ...state.meta,
      survey_lang: lang(),
      viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 },
      website_mode: websiteMode,
      website_lang: siteLang().code,
      website_path: siteLang().path,
      attention_ok: att && state.answers[att.key] !== undefined ? state.answers[att.key] === att.attention : null,
      last_step: step().id,
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
    if (PREVIEW) return u().preview;
    if (!db) return u().offline;
    return u().save[saveStatus];
  }

  // ── Website / Proxy ────────────────────────────────────────
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
      <span class="lang-label" id="lang-lbl">${esc(u().siteLang)}</span>
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
      return `<iframe id="${id}" src="${esc(siteSrc())}" title="${esc(u().siteTitle)}"
        sandbox="allow-scripts allow-same-origin allow-popups" referrerpolicy="no-referrer"></iframe>`;
    }
    return `<div class="shot" id="${id}"><img src="${esc(W.fallbackImage)}" alt="${esc(u().siteTitle)}"><span class="shot-note">${esc(t(W.fallbackLabel))}</span></div>`;
  }

  // Enter in der eingebetteten Website: weiter zur nächsten Frage (gleiche Domain, daher möglich)
  function bindIframeKeys(iframe) {
    if (!iframe) return;
    const attach = () => {
      try {
        iframe.contentDocument.addEventListener("keydown", (e) => {
          if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
          const tag = e.target?.tagName;
          const editable = e.target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(tag);
          if (editable && !(e.metaKey || e.ctrlKey)) return;
          e.preventDefault();
          next();
        });
      } catch (err) {}
    };
    iframe.addEventListener("load", attach);
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
  const PANEL_KEY = "kolsetu-interview-panel-width";
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
  const visibleQuestions = (s) => (s.questions || []).filter((q) => isVisible(q, state.answers));

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
    return visibleQuestions(step()).filter((q) => q.required && !isAnswered(q));
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
    if (document.querySelector(".fs")) return;
    await finishMics();
    const s = step();
    if (s.kind === "language" && !state.lang) return;
    if (s.kind === "fivesec" || s.kind === "end") return;
    const missing = missingRequired();
    if (missing.length || emailInvalid()) {
      document.querySelectorAll(".q").forEach((el) => {
        const bad = missing.some((q) => q.key === el.dataset.key) || (el.dataset.type === "email" && emailInvalid());
        el.classList.toggle("invalid", bad);
      });
      document.querySelector(".q.invalid")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    trackStepTime();
    if (s.kind === "intro" && !state.startedAt) state.startedAt = new Date().toISOString();

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
    if (state.stepIndex > 1) saveProgress(false);
  }

  async function back() {
    await finishMics();
    trackStepTime();
    let target = state.stepIndex - 1;
    if (steps[target]?.kind === "fivesec" && state.fivesecDone) target--;
    state.stepIndex = Math.max(0, target);
    persist();
    render();
  }

  function chooseSurveyLang(code) {
    state.lang = code;
    if (!state.siteLangChosen) state.siteLang = code === "en" ? "en" : "de";
    persist();
    trackStepTime();
    state.stepIndex = 1;
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
        <div class="sh-brand"><span class="sh-title">${esc(t(cfg.study.title))}</span></div>
        <div class="sh-progress" aria-label="${esc(u().progress(progress()))}">
          <span class="sh-sec">${idx > 0 ? `<span class="sh-n">${idx}/${sections.length - 1}</span>` : ""}${esc(t(sec.title))}</span>
          <div class="meter"><i style="width:${progress()}%"></i></div>
        </div>
        <div class="sh-save"><span data-save class="save-state">${saveLabel()}</span></div>
      </header>`;
  }

  function navHtml({ nextLabel, showBack = true, accent = false } = {}) {
    const n = steps.filter((s) => s.kind !== "end" && s.kind !== "language").length;
    const hasText = visibleQuestions(step()).some((q) => q.type === "text");
    return `
      <div class="nav">
        ${showBack && state.stepIndex > 0 ? `<button class="btn ghost" data-act="back" type="button">${esc(u().back)}</button>` : ""}
        <span class="count">${String(state.stepIndex).padStart(2, "0")} / ${String(n).padStart(2, "0")}</span>
        <span class="spacer"></span>
        <span class="kbd"><b>Enter ↵</b>${hasText ? ` · ${esc(u().newline)}` : ""}</span>
        <button class="btn ${accent ? "lg" : ""}" data-act="next" type="button">${esc(nextLabel || u().next)} <span class="arr">→</span></button>
      </div>`;
  }

  // ── Rendering: questions ───────────────────────────────────
  function labelHtml(q) {
    return `<div class="q-label" id="lbl-${q.key}" data-err="${esc(q.type === "email" ? u().emailInvalid : u().answerThis)}">${esc(t(q.label))}${!q.required ? `<span class="req opt-badge">${esc(u().optional)}</span>` : ""}</div>${q.hint ? `<div class="q-hint">${esc(t(q.hint))}</div>` : ""}`;
  }

  function optionButtons(q, { multi = false } = {}) {
    const a = state.answers[q.key];
    const selected = (v) => (multi ? Array.isArray(a) && a.includes(v) : a === v);
    const full = multi && q.max && Array.isArray(a) && a.length >= q.max;
    const opts = q.options.map((o) => ({ value: optValue(o), label: t(o) }));
    if (q.other) opts.push({ value: OTHER, label: u().other });
    return `<div class="opts" data-cols="${q.columns || 2}" style="--cols:${q.columns || 2}" role="${multi ? "group" : "radiogroup"}" aria-labelledby="lbl-${q.key}">
      ${opts
        .map(({ value, label }) => {
          const on = selected(value);
          return `<button type="button" class="opt ${multi ? "multi" : ""}" role="${multi ? "checkbox" : "radio"}" aria-checked="${on}" data-opt="${esc(value)}" ${full && !on ? "disabled" : ""}><span class="box"></span><span>${esc(label)}</span></button>`;
        })
        .join("")}
    </div>
    ${q.other && selected(OTHER) ? `<div class="ta-wrap is-input"><input class="other-input" type="text" data-other="${q.key}" placeholder="${esc(u().otherPh)}" value="${esc(state.answers[q.key + "__andere"] || "")}">${micHtml(q.key + "__andere")}</div>` : ""}
    ${q.max ? `<div class="limit-note">${esc(u().maxNote(Array.isArray(a) ? a.length : 0, q.max))}</div>` : ""}`;
  }

  function scaleButtons(key, scale) {
    const v = state.answers[key];
    const nums = [];
    for (let i = scale.min; i <= scale.max; i++) nums.push(i);
    return `<div class="scale-btns" style="--n:${nums.length}" role="radiogroup">
      ${nums.map((n) => `<button type="button" data-scale="${key}" data-val="${n}" aria-pressed="${v === n}">${n}</button>`).join("")}
    </div>`;
  }

  function scaleEnds(scale) {
    const l = t(scale.left);
    const r = t(scale.right);
    return l || r ? `<div class="scale-ends"><span>${esc(l)}</span><span>${esc(r)}</span></div>` : "";
  }

  function questionInner(q) {
    const a = state.answers;
    switch (q.type) {
      case "consent":
        return `<button type="button" class="consent" data-consent="${q.key}" aria-checked="${a[q.key] === true}"><span class="box"></span><span>${esc(t(q.label))}</span></button>`;
      case "text":
        return `${labelHtml(q)}<div class="ta-wrap"><textarea rows="${q.rows || 3}" data-text="${q.key}" placeholder="${esc(t(q.placeholder) || "")}" aria-labelledby="lbl-${q.key}">${esc(a[q.key] || "")}</textarea>${micHtml(q.key)}</div>`;
      case "email":
        return `${labelHtml(q)}<input type="email" autocomplete="email" data-text="${q.key}" placeholder="${esc(t(q.placeholder) || "")}" value="${esc(a[q.key] || "")}">`;
      case "single":
        return `${labelHtml(q)}${optionButtons(q)}`;
      case "multi":
        return `${labelHtml(q)}${optionButtons(q, { multi: true })}`;
      case "scale": {
        const claim = q.showClaim ? `<blockquote class="claimq">${lang() === "en" ? "“" : "„"}${esc(W.claims[siteLang().code] || W.claims.de)}“</blockquote>` : "";
        return `${labelHtml(q)}${claim}<div class="scale">${scaleButtons(q.key, q.scale)}${scaleEnds(q.scale)}</div>`;
      }
      case "grid":
        return `${labelHtml(q)}<div class="grid-q">
          <div class="grid-head"><span></span>${scaleEnds(q.scale)}</div>
          ${q.items.map((it) => `<div class="grid-row"><span>${esc(t(it.label))}</span>${scaleButtons(it.key, q.scale)}</div>`).join("")}
        </div>`;
      case "percent": {
        const v = a[q.key];
        const unknown = v === "unknown";
        const has = v !== undefined && !unknown;
        return `${labelHtml(q)}<div class="percent ${unknown ? "is-unknown" : ""}">
          <input type="range" min="0" max="100" step="5" value="${has ? v : 50}" data-percent="${q.key}" style="--p:${has ? v : 0}%" aria-labelledby="lbl-${q.key}">
          <output class="${has ? "" : "empty"}" data-out="${q.key}">${has ? v + " %" : "– %"}</output>
          <div class="percent-ticks"><span>0 %</span><span>50 %</span><span>100 %</span></div>
        </div>
        ${q.allowUnknown ? `<div><button type="button" class="opt multi unknown-btn" role="checkbox" aria-checked="${unknown}" data-unknown="${q.key}"><span class="box"></span><span>${esc(u().unknown)}</span></button></div>` : ""}`;
      }
      default:
        return "";
    }
  }

  // ── Spracheingabe (app/voice.js) ───────────────────────────
  const MIC_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>`;
  const micSessions = {}; // key → { session, state, startedAt, timer }

  function micHtml(key) {
    if (!window.Voice || !window.Voice.supported()) return "";
    return `<button type="button" class="mic" data-mic="${key}" aria-pressed="false" aria-label="${esc(u().mic)}" title="${esc(u().mic)}"><span class="mic-ring"></span>${MIC_SVG}</button><div class="mic-status" data-mic-status="${key}" aria-live="polite"></div>`;
  }

  function micField(key) {
    return key.endsWith("__andere")
      ? document.querySelector(`input[data-other="${key.slice(0, -8)}"]`)
      : document.querySelector(`textarea[data-text="${key}"]`);
  }

  const fmtTime = (ms) => { const sec = Math.floor(ms / 1000); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`; };

  function micUi(key) {
    const m = micSessions[key];
    const st = m ? m.state : "idle";
    const btn = document.querySelector(`[data-mic="${key}"]`);
    const status = document.querySelector(`[data-mic-status="${key}"]`);
    const field = micField(key);
    if (!btn) return;
    const active = st === "starting" || st === "recording";
    btn.dataset.state = st;
    btn.setAttribute("aria-pressed", String(active));
    btn.setAttribute("aria-label", active ? u().micStop : u().mic);
    btn.title = active ? u().micStop : u().mic;
    if (field) {
      field.readOnly = active || st === "finishing";
      field.closest(".ta-wrap")?.classList.toggle("is-listening", active);
    }
    if (status) {
      let html = "";
      if (st === "starting") html = `<span class="dot"></span>${esc(u().micConnecting)}`;
      else if (st === "recording") html = `<span class="dot"></span><b>${fmtTime(Date.now() - m.startedAt)}</b> ${esc(u().micRec)}`;
      else if (st === "finishing") html = `<span class="spin"></span>${esc(u().micFinishing)}`;
      else if (st === "error") html = esc(u().micErr[m.err] || u().micErr.other);
      status.className = "mic-status" + (html ? " show" : "") + (st === "error" ? " is-error" : "") + (st === "recording" ? " is-rec" : "");
      status.innerHTML = html;
    }
  }

  function toggleMic(key) {
    const m = micSessions[key];
    if (m && (m.state === "starting" || m.state === "recording")) {
      window.Voice.finish(m.session);
      return;
    }
    if (m && m.state === "finishing") return;
    const field = micField(key);
    if (!field) return;
    const entry = { state: "starting", startedAt: Date.now(), err: null };
    micSessions[key] = entry;
    entry.timer = setInterval(() => { if (entry.state === "recording") micUi(key); }, 500);
    entry.session = window.Voice.start({
      baseText: field.value,
      onText: (text) => {
        const el = micField(key);
        if (el) { el.value = text; el.scrollTop = el.scrollHeight; el.scrollLeft = el.scrollWidth; el.closest(".q")?.classList.remove("invalid"); }
        state.answers[key] = text;
        persist();
      },
      onLevel: (lvl) => {
        const btn = document.querySelector(`[data-mic="${key}"]`);
        if (btn) btn.style.setProperty("--lvl", lvl.toFixed(2));
      },
      onState: (st, err) => {
        if (micSessions[key] !== entry) return;
        if (st === "recording" && entry.state === "starting") entry.startedAt = Date.now();
        entry.state = st;
        entry.err = err || null;
        if (st === "idle" || st === "error") clearInterval(entry.timer);
        if (st === "idle") delete micSessions[key];
        micUi(key);
        if (st === "error") setTimeout(() => { if (micSessions[key] === entry) { delete micSessions[key]; } }, 0);
      },
    });
  }

  // Vor „Weiter“/„Zurück“: laufende Aufnahmen beenden und auf den letzten Satz warten.
  async function finishMics() {
    if (!window.Voice || !window.Voice.busy()) return;
    document.querySelectorAll(".nav .btn").forEach((b) => b.classList.add("is-waiting"));
    await window.Voice.stopAll();
    document.querySelectorAll(".nav .btn").forEach((b) => b.classList.remove("is-waiting"));
  }

  function questionsHtml(s) {
    return `<div class="questions">${visibleQuestions(s)
      .map((q) => `<div class="q" data-key="${q.key}" data-type="${q.type}">${questionInner(q)}</div>`)
      .join("")}</div>`;
  }

  function rerenderQuestion(key) {
    const s = step();
    // Bedingte Fragen: ganzen Block neu aufbauen, damit Folgefragen erscheinen/verschwinden
    if ((s.questions || []).some((q) => q.showIf)) {
      const box = document.querySelector(".questions");
      if (box) {
        const invalid = [...box.querySelectorAll(".q.invalid")].map((el) => el.dataset.key);
        box.outerHTML = questionsHtml(s);
        const fresh = document.querySelector(".questions");
        if (fresh) fresh.style.animation = "none";
        invalid.forEach((k) => {
          const q = s.questions.find((x) => x.key === k);
          if (q && !isAnswered(q)) document.querySelector(`.q[data-key="${k}"]`)?.classList.add("invalid");
        });
        const other = document.querySelector(`.q[data-key="${key}"] [data-other]`);
        if (other && !other.value) other.focus();
        return;
      }
    }
    const q = s.questions.find((x) => x.key === key || x.items?.some((i) => i.key === key));
    const el = document.querySelector(`.q[data-key="${q.key}"]`);
    if (!el) return;
    el.innerHTML = questionInner(q);
    if (q.required && isAnswered(q)) el.classList.remove("invalid");
    const other = el.querySelector("[data-other]");
    if (other && !other.value) other.focus();
  }

  // ── Rendering: screens ─────────────────────────────────────
  function render() {
    clearFsTimers();
    if (window.Voice && window.Voice.busy()) window.Voice.stopAll(); // Text wird trotzdem noch gespeichert
    const s = step();
    stepEnteredAt = Date.now();
    document.documentElement.lang = lang();
    document.title = `${t(sections.find((x) => x.id === s.section).title)} · ${t(cfg.study.title)}`;

    if (s.kind === "language") return renderLanguage(s);
    if (s.kind === "end") return renderEnd();
    if (s.layout === "website") return renderWebsite(s);

    const body = s.kind === "intro" ? introHtml(s) : s.kind === "fivesec" ? fivesecBriefHtml(s) : standardHtml(s);

    root.innerHTML = `
      <div class="page">
        ${headerHtml()}
        <main class="main">
          <div class="stage"><div class="content">${body}</div></div>
          ${s.kind === "fivesec" ? "" : navHtml({ nextLabel: s.kind === "intro" ? u().start : nextLabelFor(), accent: s.kind === "intro" })}
        </main>
      </div>`;
    window.scrollTo(0, 0);
  }

  function renderLanguage() {
    root.innerHTML = `
      <div class="page">
        <header class="sheader">
          <div class="sh-brand"><span class="sh-title">${esc(L(cfg.study.title, "de"))} · ${esc(L(cfg.study.title, "en"))}</span></div>
          <div></div>
          <div class="sh-save"><span data-save class="save-state">${saveLabel()}</span></div>
        </header>
        <main class="main">
          <div class="stage"><div class="content">
            <div class="eyebrow">${esc(cfg.study.institution)}</div>
            <h1 class="headline">Sprache wählen<br><span class="muted-head">Choose your language</span></h1>
            <div class="langpick">
              ${SURVEY_LANGS.map((l) => `<button type="button" class="langcard" data-survey-lang="${l.code}" aria-pressed="${state.lang === l.code}">
                ${flag(l.code)}
                <span class="langcard-text"><strong>${esc(l.label)}</strong><span>${esc(l.hint)}</span></span>
                <span class="arr">→</span>
              </button>`).join("")}
            </div>
          </div></div>
        </main>
      </div>`;
    window.scrollTo(0, 0);
  }

  function nextLabelFor() {
    return steps[state.stepIndex + 1]?.kind === "end" ? u().submit : u().next;
  }

  function introHtml(s) {
    return `
      <div class="eyebrow">${esc(t(s.eyebrow))}</div>
      <h1 class="headline">${esc(t(s.title))}</h1>
      <p class="lead">${esc(t(s.lead))}</p>
      <div class="facts">${s.facts.map(([ti, d]) => `<div class="fact"><strong>${esc(t(ti))}</strong><span>${esc(t(d))}</span></div>`).join("")}</div>
      ${s.voice ? `<div class="privacy voice-box"><div class="voice-ic">${MIC_SVG}</div><div><strong>${esc(t(s.voice.title))}</strong><p>${esc(t(s.voice.text))}</p></div></div>` : ""}
      ${s.privacy ? `<div class="privacy"><strong>${esc(t(s.privacy.title))}</strong><p>${esc(t(s.privacy.text))}</p>${s.privacy.voice ? `<div class="privacy-sub"><strong>${esc(t(s.privacy.voice.title))}</strong><p>${esc(t(s.privacy.voice.text))}</p>
        <p class="voice-links">${s.privacy.voice.links.map(([l, href]) => `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(t(l))} ↗</a>`).join("")}</p></div>` : ""}</div>` : ""}
      ${questionsHtml(s)}
      ${!db && !PREVIEW ? `<div class="notice">${esc(u().dbDown)}</div>` : ""}`;
  }

  function standardHtml(s) {
    return `
      <div class="eyebrow">${esc(t(sections.find((x) => x.id === s.section).title))}</div>
      <h1 class="headline">${esc(t(s.title))}</h1>
      ${s.lead ? `<p class="lead">${esc(t(s.lead))}</p>` : ""}
      ${s.note ? `<p class="note">${esc(t(s.note))}</p>` : ""}
      ${s.task ? `<div class="task">${esc(t(s.task))}</div>` : ""}
      ${questionsHtml(s)}`;
  }

  function fivesecBriefHtml(s) {
    return `
      <div class="eyebrow">${esc(u().part1)}</div>
      <h1 class="headline">${esc(t(s.title))}</h1>
      <p class="lead">${esc(t(s.lead))}</p>
      ${langPickerHtml()}
      <ol class="brief">${s.instructions.map(([ti, d]) => `<li><div><strong>${esc(t(ti))}</strong><span>${esc(t(d))}</span></div></li>`).join("")}</ol>
      <div class="fivesec-cta">
        <button class="btn lg" data-act="fivesec" type="button" ${websiteMode === "checking" ? "disabled" : ""}>${esc(u().ready)} <span class="arr">→</span></button>
        <span class="hint">${esc(websiteMode === "checking" ? u().preparing : u().cdHint(W.countdownSeconds, W.exposureSeconds))}</span>
      </div>
      <div style="margin-top:28px"><button class="btn ghost" data-act="back" type="button">${esc(u().back)}</button></div>`;
  }

  function renderWebsite(s) {
    const existing = root.querySelector(".split");
    const panel = `
      <div class="panel-scroll">
        <div class="eyebrow">${esc(u().part2)}</div>
        <h1 class="headline">${esc(t(s.title))}</h1>
        ${s.lead ? `<p class="lead">${esc(t(s.lead))}</p>` : ""}
        ${s.task ? `<div class="task">${esc(t(s.task))}</div>` : ""}
        ${questionsHtml(s)}
      </div>
      ${navHtml({ nextLabel: nextLabelFor() })}`;

    if (existing) {
      // iframe behalten (Scrollposition bleibt erhalten), nur Panel + Kopfzeile tauschen
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
                <span class="tag ${websiteMode === "live" ? "live" : ""}">${websiteMode === "live" ? "● live" : esc(u().screenshot)}</span>
                <button class="tool" type="button" data-act="reload-site" title="${esc(u().reload)}">↻</button>
                <button class="tool mobile-full" type="button" data-act="toggle-full">⤢</button>
              </div>
              <div class="viewport">${siteMarkup("site")}</div>
            </section>
            <div class="gutter" role="separator" aria-orientation="vertical" aria-label="${esc(u().gutterAria)}" tabindex="0" title="${esc(u().gutter)}"><span></span></div>
            <aside class="panel">${panel}</aside>
          </div>
        </main>
      </div>`;
    window.scrollTo(0, 0);
    bindIframeKeys(document.getElementById("site"));
    setupGutter();
    watchFit();
  }

  function renderEnd() {
    const s = step();
    root.innerHTML = `
      <div class="center-screen">
        <div class="content" style="max-width:640px">
          <div class="end-mark"></div>
          <h1 class="headline">${esc(t(s.title))}</h1>
          <p class="lead">${esc(t(s.lead))}</p>
          <div data-end-status></div>
          ${PREVIEW ? `<div class="notice info">${esc(u().previewEnd)} <button class="btn ghost" data-act="restart" type="button" style="margin-left:8px;height:38px">${esc(u().restart)}</button></div>` : ""}
        </div>
      </div>`;
  }

  function renderEndError() {
    const el = document.querySelector("[data-end-status]");
    if (!el) return;
    el.innerHTML = `<div class="notice">${esc(u().endErr)} <button class="btn" data-act="retry-save" type="button" style="margin-top:10px;height:40px">${esc(u().retry)}</button></div>`;
  }

  // ── Website-Test (Teil 1) ──────────────────────────────────
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
    let loaded = false;
    let loadedAt = null;
    let waitingForLoad = false;
    let usedFallback = false;

    // Die Anzeigezeit startet erst, wenn die Seite wirklich sichtbar ist:
    // iframe geladen + Schriften fertig + Bilder im sichtbaren Bereich geladen.
    const markLoaded = () => {
      if (loaded) return;
      loaded = true;
      loadedAt = performance.now();
      if (waitingForLoad) expose();
    };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const withTimeout = (p, ms) => Promise.race([p, wait(ms)]);

    async function settleIframe(iframe) {
      try {
        const doc = iframe.contentDocument;
        if (doc) {
          await withTimeout(doc.fonts?.ready || Promise.resolve(), 4000);
          const vh = iframe.clientHeight || window.innerHeight;
          const imgs = [...doc.images].filter((img) => !img.complete && img.getBoundingClientRect().top < vh);
          await withTimeout(Promise.all(imgs.map((img) => new Promise((r) => { img.addEventListener("load", r, { once: true }); img.addEventListener("error", r, { once: true }); }))), 6000);
        }
      } catch (e) {}
      // zwei Frames + kurze Pause, damit die Seite auch gemalt ist
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await wait(300);
    }

    function watchShot(root) {
      const img = root.querySelector(".shot img");
      if (!img || img.complete) return markLoaded();
      img.addEventListener("load", markLoaded, { once: true });
      img.addEventListener("error", markLoaded, { once: true });
    }

    // Lädt die Live-Seite gar nicht, auf den Screenshot ausweichen (Timer startet erst, wenn der da ist).
    function switchToScreenshot() {
      if (loaded) return;
      usedFallback = true;
      frame.innerHTML = `<div class="shot" id="fs-site"><img src="${esc(W.fallbackImage)}" alt="${esc(u().siteTitle)}"><span class="shot-note">${esc(t(W.fallbackLabel))}</span></div>`;
      watchShot(frame);
    }

    const iframe = stage.querySelector("iframe");
    if (iframe) {
      iframe.addEventListener("load", () => settleIframe(iframe).then(markLoaded), { once: true });
      fsTimers.push(setTimeout(switchToScreenshot, 30000));
    } else {
      watchShot(stage);
    }

    let n = W.countdownSeconds;
    const tick = () => {
      if (n > 0) {
        countEl.innerHTML = `<span class="num">${n}</span><span class="sub">${esc(u().startingSoon)}</span>`;
        n--;
        fsTimers.push(setTimeout(tick, 1000));
      } else if (loaded) {
        expose();
      } else {
        waitingForLoad = true;
        countEl.innerHTML = `<div class="fs-msg"><div class="spinner"></div><p>${esc(u().loading)}</p></div>`;
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
      try { stage.querySelector("iframe")?.focus(); } catch (e) {}

      fsTimers.push(
        setTimeout(() => {
          const shownMs = Math.round(performance.now() - shownAt);
          frame.remove();
          bar.remove();
          timer.remove();
          stage.insertAdjacentHTML("beforeend", `<div class="fs-msg"><h2>${esc(u().timeUp)}</h2><p>${esc(u().timeUpSub)}</p></div>`);
          state.fivesecDone = true;
          state.meta.fivesec = {
            mode: usedFallback ? "screenshot" : websiteMode,
            fallback_after_timeout: usedFallback,
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
              trackStepTime();
              state.stepIndex++;
              persist();
              render();
              saveProgress(false);
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
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      const a = state.answers;

      if (b.dataset.surveyLang) return chooseSurveyLang(b.dataset.surveyLang);
      if (b.dataset.mic) return toggleMic(b.dataset.mic);
      if (b.dataset.act === "next") return next();
      if (b.dataset.act === "back") return back();
      if (b.dataset.act === "fivesec") return startFivesec();
      if (b.dataset.act === "lang-toggle") {
        const menu = b.parentElement.querySelector(".lang-menu");
        const open = menu.hidden;
        menu.hidden = !open;
        b.setAttribute("aria-expanded", String(open));
        if (open) menu.querySelector('[aria-selected="true"]')?.focus();
        return;
      }
      if (b.dataset.lang) {
        state.siteLang = b.dataset.lang;
        state.siteLangChosen = true;
        persist();
        b.closest(".lang").outerHTML = langPickerHtml();
        root.querySelector(".lang-btn")?.focus();
        return;
      }
      if (b.dataset.act === "reload-site") {
        const f = document.getElementById("site");
        if (f?.tagName === "IFRAME") f.src = siteSrc();
        return;
      }
      if (b.dataset.act === "toggle-full") {
        document.querySelector(".browser")?.classList.toggle("full");
        return fitSite();
      }
      if (b.dataset.act === "restart") {
        localStorage.removeItem(STORAGE_KEY);
        state = freshState();
        return render();
      }
      if (b.dataset.act === "retry-save") {
        return saveProgress(true).then((ok) => {
          const el = document.querySelector("[data-end-status]");
          if (el && ok) el.innerHTML = `<div class="notice info">${esc(u().sent)}</div>`;
        });
      }

      if (b.dataset.consent) {
        a[b.dataset.consent] = !a[b.dataset.consent];
        persist();
        return rerenderQuestion(b.dataset.consent);
      }
      if (b.dataset.scale) {
        a[b.dataset.scale] = Number(b.dataset.val);
        persist();
        return rerenderQuestion(b.dataset.scale);
      }
      if (b.dataset.unknown) {
        const k = b.dataset.unknown;
        a[k] = a[k] === "unknown" ? undefined : "unknown";
        persist();
        return rerenderQuestion(k);
      }
      if (b.dataset.opt !== undefined) {
        const qEl = b.closest(".q");
        const q = step().questions.find((x) => x.key === qEl.dataset.key);
        const v = b.dataset.opt;
        if (q.type === "multi") {
          // „Weiß ich nicht“ schließt alle anderen Antworten aus (und umgekehrt).
          const UNKNOWN = "Weiß ich nicht";
          let list = Array.isArray(a[q.key]) ? a[q.key].slice() : [];
          const i = list.indexOf(v);
          if (i >= 0) list.splice(i, 1);
          else if (v === UNKNOWN) {
            list = [UNKNOWN];
            delete a[q.key + "__andere"];
          } else {
            list = list.filter((x) => x !== UNKNOWN);
            if (!q.max || list.length < q.max) list.push(v);
          }
          a[q.key] = list;
        } else {
          a[q.key] = a[q.key] === v ? undefined : v;
        }
        persist();
        return rerenderQuestion(q.key);
      }
    });

    root.addEventListener("input", (e) => {
      const el = e.target;
      const a = state.answers;
      if (el.dataset.text) a[el.dataset.text] = el.value;
      if (el.dataset.other) a[el.dataset.other + "__andere"] = el.value;
      if (el.dataset.percent) {
        const k = el.dataset.percent;
        a[k] = Number(el.value);
        el.style.setProperty("--p", el.value + "%");
        const out = document.querySelector(`[data-out="${k}"]`);
        out.textContent = el.value + " %";
        out.classList.remove("empty");
        const qEl = el.closest(".q");
        qEl?.classList.remove("invalid");
        qEl?.querySelector(".percent")?.classList.remove("is-unknown");
        qEl?.querySelector("[data-unknown]")?.setAttribute("aria-checked", "false");
      }
      if (el.dataset.text) {
        const q = el.closest(".q");
        if (q && el.value.trim()) q.classList.remove("invalid");
      }
      persist();
    });

    // Enter = weiter (wie bei Typeform), Shift + Enter = neue Zeile in Textfeldern
    root.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
      const el = e.target;
      if (el.closest?.(".lang-dd") || el.closest?.(".gutter")) return;
      if (el.tagName === "BUTTON") {
        const isAnswerBtn = el.dataset.opt !== undefined || el.dataset.scale || el.dataset.consent || el.dataset.unknown;
        if (!isAnswerBtn) return; // Navigations-Buttons normal auslösen
      }
      const s = step();
      if (s.kind === "fivesec" || s.kind === "end" || s.kind === "language") return;
      e.preventDefault();
      next();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.shiftKey || e.target !== document.body) return;
      const s = step();
      if (s.kind === "fivesec" || s.kind === "end" || s.kind === "language" || document.querySelector(".fs")) return;
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
    if (!state.lang) state.stepIndex = 0;
    if (state.completed) state.stepIndex = steps.length - 1;
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
