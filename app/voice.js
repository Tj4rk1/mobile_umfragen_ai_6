// Spracheingabe in Echtzeit für Freitext-Felder.
// Anbieter: AssemblyAI Universal Streaming (EU, Standard) und ElevenLabs Scribe v3 Live (Fallback).
//
// Ablauf pro Aufnahme (eine Session pro Feld):
//   Klick → AudioContext (synchron, wegen Autoplay-Regeln) → Mikrofon → Audio wird SOFORT
//   aufgenommen und gepuffert → parallel Token von /api/stt-token + WebSocket → Puffer wird
//   nachgeschickt → Zwischen- und Endergebnisse landen live im Feld.
// Beim Beenden wird der letzte Satz noch abgeschlossen (ForceEndpoint → Terminate → Termination).
// Sessions sind unabhängig: Ein neues Feld startet sofort, das alte schließt im Hintergrund ab.
// Deutsch und Englisch werden automatisch erkannt (auch gemischt).
(function () {
  // Reihenfolge der Versuche: Standard, Fallback, dann abwechselnd mit Wartezeit (Audio bleibt gepuffert).
  const ATTEMPT_DELAYS = [0, 0, 1500, 3000, 5000, 8000, 12000];
  const AVOID_MS = 60000; // nach einer Ablehnung den Anbieter 60 s lang zuerst überspringen
  const ELEVEN_RATES = [8000, 16000, 22050, 24000, 44100, 48000];
  const KEYTERMS = ["Kolsetu", "Elba", "KI", "Kundenservice", "digitale Mitarbeiter"];
  const LEAD_IN_MS = 300; // kurze Stille vor der Aufnahme, damit das erste Wort nicht am Rand klebt
  const MIC_KEEP_MS = 60000; // Mikrofon nach der letzten Aufnahme 60 s bereithalten (kein Anlauf beim nächsten Feld)
  const CONNECT_TIMEOUT_MS = 4000; // kommt bis dahin keine Bestätigung vom Anbieter → nächster Anbieter
  const DEBUG = /[?&]debug=1/.test(location.search);
  const T0 = performance.now();
  const log = (...a) => {
    try { console.info("[Spracheingabe]", ...a); } catch (e) {}
    if (!DEBUG) return;
    let box = document.getElementById("voice-debug");
    if (!box) {
      box = document.createElement("pre");
      box.id = "voice-debug";
      box.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:9999;max-width:min(560px,90vw);max-height:40vh;overflow:auto;margin:0;padding:8px 10px;font:11px/1.4 ui-monospace,monospace;background:rgba(0,0,0,.82);color:#9f9;border-radius:8px;white-space:pre-wrap;user-select:text";
      document.body.appendChild(box);
    }
    box.textContent += ((performance.now() - T0) / 1000).toFixed(1) + "s " + a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ") + "\n";
    box.scrollTop = box.scrollHeight;
  };

  function b64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  const avoid = (name) => { try { sessionStorage.setItem("stt-avoid-" + name, String(Date.now() + AVOID_MS)); } catch (e) {} };
  const avoided = (name) => { try { return Number(sessionStorage.getItem("stt-avoid-" + name) || 0) > Date.now(); } catch (e) { return false; } };

  // ── Anbieter-Adapter ────────────────────────────────────────
  const PROVIDERS = {
    eleven: {
      ok: (rate) => ELEVEN_RATES.includes(rate),
      url: (token, rate, langs) => "wss://api.elevenlabs.io/v1/speech-to-text/realtime?" + new URLSearchParams({ token, model_id: "scribe_v3_live", audio_format: "pcm_" + rate, commit_strategy: "vad", language_code: langs[0], secondary_languages: JSON.stringify(langs.slice(1)), keyterms: JSON.stringify(KEYTERMS) }),
      binary: false,
      send: (ws, pcm, rate, commit) => ws.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: b64(pcm), commit: !!commit, sample_rate: rate })),
      // liefert "begin" | "text" | "fail" | null
      handle(s, m) {
        if (m.message_type === "session_started") return "begin";
        if (m.message_type === "partial_transcript") { if (m.text || !s.el.partial) s.el.partial = m.text || ""; return "text"; }
        if (m.message_type === "committed_transcript") {
          if (m.text) s.el.committed.push(m.text);
          s.el.partial = "";
          if (s.ending) setTimeout(() => closeWs(s), 50); // letzter Satz da → fertig
          return "text";
        }
        if (m.message_type && m.message_type !== "warning" && /error|exceeded|limit|throttled|overflow|exhausted|terms|invalid/.test(m.message_type)) return "fail";
        return null;
      },
      text: (s) => [...s.el.committed, s.el.partial].filter(Boolean).join(" "),
      end(s) {
        const rate = s.ctx.sampleRate;
        try { this.send(s.ws, new Int16Array(Math.round(rate / 10)).buffer, rate, true); } catch (e) {}
        setTimeout(() => closeWs(s), 2500); // falls kein Commit mehr kommt
      },
    },
    assembly: {
      ok: (rate) => rate >= 8000 && rate <= 96000,
      url: (token, rate, langs) => "wss://streaming.eu.assemblyai.com/v3/ws?" + new URLSearchParams({ token, sample_rate: String(rate), encoding: "pcm_s16le", speech_model: "universal-3-6-pro", language_codes: JSON.stringify(langs), keyterms_prompt: JSON.stringify(KEYTERMS) }),
      binary: true,
      send: (ws, pcm) => ws.send(pcm),
      handle(s, m) {
        if (m.type === "Begin") return "begin";
        if (m.type === "Turn") { const t = (m.end_of_turn && m.utterance) || m.transcript || ""; if (t) s.turns.set(m.turn_order, t); return "text"; }
        if (m.type === "Termination") { setTimeout(() => closeWs(s), 0); return null; }
        if (m.type === "Error") return "fail";
        return null;
      },
      text: (s) => [...s.turns.keys()].sort((a, b) => a - b).map((k) => s.turns.get(k)).filter(Boolean).join(" "),
      end(s) {
        try { s.ws.send(JSON.stringify({ type: "ForceEndpoint" })); } catch (e) {}
        setTimeout(() => { try { s.ws.readyState === 1 && s.ws.send(JSON.stringify({ type: "Terminate" })); } catch (e) {} }, 400);
      },
    },
  };

  function plan(rate) {
    const order = ["assembly", "eleven"].filter((n) => PROVIDERS[n].ok(rate));
    order.sort((a, b) => avoided(a) - avoided(b)); // gemiedene Anbieter nach hinten
    return ATTEMPT_DELAYS.map((delay, i) => ({ provider: order[i % order.length], delay }));
  }

  const fetchTokens = () => fetch("/api/stt-token", { method: "POST" }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("token"))));
  const MAX_BUFFER_CHUNKS = 600; // bis ~60 s Audio puffern, falls die Verbindung länger braucht

  // AudioWorklet: Float32 → Int16 in ~100-ms-Blöcken, plus Pegel für die Anzeige
  const WORKLET = `
    class Pcm16 extends AudioWorkletProcessor {
      constructor() { super(); this.buf = []; this.len = 0; this.target = Math.round(sampleRate / 10); this.peak = 0; }
      process(inputs) {
        const ch = inputs[0] && inputs[0][0];
        if (ch) {
          const out = new Int16Array(ch.length);
          for (let i = 0; i < ch.length; i++) {
            const s = Math.max(-1, Math.min(1, ch[i]));
            out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            const a = s < 0 ? -s : s; if (a > this.peak) this.peak = a;
          }
          this.buf.push(out); this.len += out.length;
          if (this.len >= this.target) {
            const all = new Int16Array(this.len); let o = 0;
            for (const b of this.buf) { all.set(b, o); o += b.length; }
            this.port.postMessage({ pcm: all.buffer, level: this.peak }, [all.buffer]);
            this.buf = []; this.len = 0; this.peak = 0;
          }
        }
        return true;
      }
    }
    registerProcessor("pcm16", Pcm16);`;

  let workletUrl = null;
  let sharedStream = null;
  let releaseTimer = null;
  async function getStream() {
    clearTimeout(releaseTimer);
    if (sharedStream && sharedStream.getAudioTracks().some((t) => t.readyState === "live")) return sharedStream;
    sharedStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    log("Mikrofon geöffnet", sharedStream.getAudioTracks()[0]?.label || "");
    return sharedStream;
  }
  function scheduleRelease() {
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => {
      if (sessions.size || !sharedStream) return;
      sharedStream.getTracks().forEach((t) => t.stop());
      sharedStream = null;
      log("Mikrofon freigegeben");
    }, MIC_KEEP_MS);
  }
  window.addEventListener("pagehide", () => { try { sharedStream && sharedStream.getTracks().forEach((t) => t.stop()); } catch (e) {} });
  let sharedCtx = null;
  let workletReady = null;
  function getCtx() {
    if (!sharedCtx || sharedCtx.state === "closed") {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      sharedCtx = new Ctx();
      workletReady = null;
      log("AudioContext angelegt", sharedCtx.sampleRate + " Hz");
    }
    sharedCtx.resume().catch(() => {});
    return sharedCtx;
  }
  const sessions = new Set();
  let current = null;

  const supported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.WebSocket && (window.AudioContext || window.webkitAudioContext));

  function toInt16(f32) {
    const out = new Int16Array(f32.length);
    let peak = 0;
    for (let i = 0; i < f32.length; i++) {
      const s = Math.max(-1, Math.min(1, f32[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      const a = s < 0 ? -s : s; if (a > peak) peak = a;
    }
    return { pcm: out.buffer, level: peak };
  }

  // callbacks: onText(fullText), onState(state, errCode), onLevel(0..1)
  // states: "starting" → "recording" → "finishing" → "idle" | "error"
  function start({ baseText, onText, onState, onLevel, onConn, lang }) {
    if (current) finish(current); // alte Aufnahme im Hintergrund abschließen, nicht darauf warten

    const ctx = getCtx(); // synchron im Klick (Autoplay-Regeln), wird für alle Aufnahmen wiederverwendet

    const s = {
      ctx, onText, onState, onLevel: onLevel || (() => {}), onConn: onConn || (() => {}),
      base: baseText && baseText.trim() ? baseText.replace(/\s+$/, "") + " " : "",
      turns: new Map(), el: { committed: [], partial: "" }, queue: [], ws: null, stream: null, nodes: [], provider: null,
      state: "starting", done: false,
      langs: lang === "en" ? ["en", "de"] : ["de", "en"], // nur Deutsch und Englisch, Umfragesprache zuerst
    };
    sessions.add(s);
    current = s;
    log("Start", "offene Aufnahmen: " + sessions.size);
    setState(s, "starting");
    run(s);
    return s;
  }

  function setState(s, st, err) {
    s.state = st;
    try { s.onState(st, err); } catch (e) {}
  }

  async function run(s) {
    const tokenP = fetchTokens();
    tokenP.catch(() => {});

    // 1) Mikrofon öffnen und SOFORT aufnehmen (Puffer), damit kein Wort verloren geht
    try {
      s.stream = await getStream();
    } catch (err) {
      const n = err && err.name;
      log("Mikrofon-Fehler:", n || String(err));
      return fail(s, n === "NotAllowedError" || n === "SecurityError" ? "denied" : n === "NotFoundError" ? "nomic" : "mic");
    }
    if (s.cleaned) return stopMic(s);
    try {
      await s.ctx.resume();
      await capture(s);
    } catch (err) {
      log("Audio-Fehler:", (err && (err.name + " " + err.message)) || String(err));
      return fail(s, "mic");
    }
    if (s.cleaned) return stopMic(s);
    if (!s.done) setState(s, "recording");

    // 2) Parallel mit dem Server verbinden (bei Ablehnung im Hintergrund erneut versuchen, Audio wird gepuffert)
    s.plan = plan(s.ctx.sampleRate);
    connect(s, tokenP, 0);
  }

  async function connect(s, tokenP, attempt) {
    if (s.cleaned) return;
    const { provider: name } = s.plan[attempt];
    const P = PROVIDERS[name];
    let token;
    try {
      const tokens = await (tokenP || fetchTokens());
      token = tokens[name];
      if (!token) throw new Error("no token");
    } catch (err) {
      return next(s, attempt, "token", name);
    }
    if (s.cleaned) return;
    const ws = new WebSocket(P.url(token, s.ctx.sampleRate, s.langs));
    if (P.binary) ws.binaryType = "arraybuffer";
    s.ws = ws;
    s.provider = name;
    s.P = P;
    let begun = false;
    let failed = false;
    log("verbinde", name, "Versuch", attempt + 1, "@", s.ctx.sampleRate, "Hz");
    // Hängt die Verbindung (kein Fehler, aber auch keine Bestätigung), nicht ewig warten
    const timeout = setTimeout(() => {
      if (begun || s.cleaned || s.ws !== ws) return;
      log(name, "antwortet nicht – wechsle");
      next(s, attempt, "connection", name);
      try { ws.close(); } catch (err) {}
    }, CONNECT_TIMEOUT_MS);
    ws.onmessage = (e) => {
      if (s.ws !== ws) return;
      let m;
      try { m = JSON.parse(e.data); } catch (err) { return; }
      const r = P.handle(s, m);
      if (r === "begin") {
        begun = true;
        clearTimeout(timeout);
        log(name, "verbunden,", s.queue.length, "gepufferte Blöcke nachgeschickt");
        s.onConn(true, name);
        for (const chunk of s.queue) P.send(ws, chunk, s.ctx.sampleRate);
        s.queue = [];
        s.live = true;
        if (s.flushed) endStream(s); // schon beendet, während die Verbindung aufgebaut wurde
      } else if (r === "text") {
        emit(s);
      } else if (r === "fail" && !begun) {
        log(name, "abgelehnt:", m.error || m.message_type);
        failed = true;
        try { ws.close(); } catch (err) {}
      }
    };
    ws.onerror = () => {};
    ws.onclose = (e) => {
      clearTimeout(timeout);
      if (s.cleaned || s.ws !== ws) return;
      log(name, "geschlossen", e.code, e.reason || "");
      if (begun && s.done) return cleanup(s);
      if (!begun || failed) return next(s, attempt, e.code === 1008 ? "busy" : "connection", name); // abgelehnt → anderer Anbieter
      fail(s, "connection");
    };
  }

  function next(s, attempt, code, name) {
    if (s.cleaned) return;
    s.ws = null;
    s.live = false;
    s.onConn(false, null);
    avoid(name);
    if (attempt + 1 >= s.plan.length) return fail(s, code);
    if (s.flushed && !s.queue.length) return cleanup(s); // nichts mehr zu übertragen
    setTimeout(() => connect(s, null, attempt + 1), s.plan[attempt + 1].delay);
  }

  function closeWs(s) {
    if (s.cleaned) return;
    try { s.ws && s.ws.readyState <= 1 && s.ws.close(); } catch (e) {}
    cleanup(s);
  }

  async function capture(s) {
    const { ctx, stream } = s;
    const src = ctx.createMediaStreamSource(stream);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    mute.connect(ctx.destination);
    const onChunk = ({ pcm, level }) => {
      if (s.flushed) return;
      s.onLevel(Math.min(1, level * 2.2));
      if (s.ws && s.ws.readyState === 1 && !s.queue.length && s.live) s.P.send(s.ws, pcm, ctx.sampleRate);
      else if (s.queue.length < MAX_BUFFER_CHUNKS) s.queue.push(pcm);
    };
    let node;
    try {
      if (!ctx.audioWorklet) throw new Error("no worklet");
      if (!workletUrl) workletUrl = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
      if (!workletReady) workletReady = ctx.audioWorklet.addModule(workletUrl);
      await workletReady;
      node = new AudioWorkletNode(ctx, "pcm16");
      node.port.onmessage = (e) => onChunk(e.data);
    } catch (e) {
      // Fallback für Browser ohne AudioWorklet
      node = ctx.createScriptProcessor(4096, 1, 1);
      node.onaudioprocess = (e) => onChunk(toInt16(e.inputBuffer.getChannelData(0)));
    }
    s.queue.push(new Int16Array(Math.round((ctx.sampleRate * LEAD_IN_MS) / 1000)).buffer);
    src.connect(node);
    node.connect(mute);
    s.nodes = [src, node, mute];
  }

  function emit(s) {
    const spoken = s.P ? s.P.text(s) : "";
    try { s.onText(s.base + spoken); } catch (e) {}
  }

  // Aufnahme beenden: Mikrofon aus, letzten Satz abschließen lassen, dann aufräumen.
  function finish(s) {
    if (!s || s.done) return;
    log("Stopp geklickt", s.provider || "(noch nicht verbunden)", "live=" + !!s.live);
    s.done = true;
    if (current === s) current = null;
    s.onLevel(0);
    if (!s.cleaned) setState(s, "finishing");
    // noch ~350 ms weiter aufnehmen, damit das letzte Wort nicht abgeschnitten wird
    setTimeout(() => {
      s.flushed = true;
      stopMic(s);
      if (s.cleaned) return;
      if (s.live && s.ws && s.ws.readyState === 1) endStream(s); // sonst erledigt das der Begin-Handler nach dem Nachsenden
      setTimeout(() => cleanup(s), 45000); // Sicherheitsnetz (inkl. Wiederholungen)
    }, 350);
  }

  function endStream(s) {
    if (s.ending) return;
    s.ending = true;
    s.P.end(s);
  }

  function stopMic(s) {
    for (const n of s.nodes) { try { n.disconnect(); } catch (e) {} }
    s.nodes = [];
    s.stream = null; // Stream bleibt kurz offen (getStream/scheduleRelease)
  }

  function fail(s, code) {
    if (s.cleaned) return;
    log("Fehler:", code);
    setState(s, "error", code);
    cleanup(s, true);
  }

  function cleanup(s, keepState) {
    if (s.cleaned) return;
    s.cleaned = true;
    s.done = true;
    s.flushed = true;
    if (current === s) current = null;
    stopMic(s);
    try { s.ws && s.ws.readyState <= 1 && s.ws.close(); } catch (e) {}
    log("Aufnahme beendet", s.provider || "-", keepState ? "(Fehler)" : "");
    sessions.delete(s);
    if (!sessions.size) scheduleRelease();
    s.onLevel(0);
    if (!keepState) setState(s, "idle");
  }

  // Alle Aufnahmen beenden und warten, bis der Text vollständig da ist (z. B. vor „Weiter“).
  function stopAll() {
    const open = [...sessions];
    if (!open.length) return Promise.resolve();
    open.forEach((s) => finish(s));
    return new Promise((resolve) => {
      const t0 = Date.now();
      const check = () => (open.every((s) => s.cleaned) || Date.now() - t0 > 15000 ? resolve() : setTimeout(check, 100));
      check();
    });
  }

  window.Voice = { start, finish, stopAll, supported, current: () => current, busy: () => sessions.size > 0, provider: (s) => s && s.provider };
})();
