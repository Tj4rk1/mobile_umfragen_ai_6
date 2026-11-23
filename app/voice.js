// Spracheingabe in Echtzeit für Freitext-Felder (AssemblyAI Streaming, EU-Server).
//
// Ablauf pro Aufnahme (eine Session pro Feld):
//   Klick → AudioContext (synchron, wegen Autoplay-Regeln) → Mikrofon → Audio wird SOFORT
//   aufgenommen und gepuffert → parallel Token von /api/stt-token + WebSocket → Puffer wird
//   nachgeschickt → Zwischen- und Endergebnisse landen live im Feld.
// Beim Beenden wird der letzte Satz noch abgeschlossen (ForceEndpoint → Terminate → Termination).
// Sessions sind unabhängig: Ein neues Feld startet sofort, das alte schließt im Hintergrund ab.
// Deutsch und Englisch werden automatisch erkannt (auch gemischt).
(function () {
  const WS_URL = "wss://streaming.eu.assemblyai.com/v3/ws";
  const SPEECH_MODEL = "universal-3-6-pro";
  const MAX_BUFFER_CHUNKS = 600; // bis ~60 s Audio puffern, falls die Verbindung länger braucht
  const RETRY_DELAYS = [1500, 3000, 5000, 8000, 12000, 15000]; // bei „Too many concurrent sessions“ (Limit neue Sessions/Minute)

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
  function start({ baseText, onText, onState, onLevel }) {
    if (current) finish(current); // alte Aufnahme im Hintergrund abschließen, nicht darauf warten

    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx(); // synchron im Klick anlegen
    ctx.resume().catch(() => {});

    const s = {
      ctx, onText, onState, onLevel: onLevel || (() => {}),
      base: baseText && baseText.trim() ? baseText.replace(/\s+$/, "") + " " : "",
      turns: new Map(), queue: [], ws: null, stream: null, nodes: [],
      state: "starting", done: false,
    };
    sessions.add(s);
    current = s;
    setState(s, "starting");
    run(s);
    return s;
  }

  function setState(s, st, err) {
    s.state = st;
    try { s.onState(st, err); } catch (e) {}
  }

  async function run(s) {
    const tokenP = fetch("/api/stt-token", { method: "POST" }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("token"))));
    tokenP.catch(() => {});

    // 1) Mikrofon öffnen und SOFORT aufnehmen (Puffer), damit kein Wort verloren geht
    try {
      s.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (err) {
      const n = err && err.name;
      return fail(s, n === "NotAllowedError" || n === "SecurityError" ? "denied" : n === "NotFoundError" ? "nomic" : "mic");
    }
    if (s.cleaned) return stopMic(s);
    try {
      await s.ctx.resume();
      await capture(s);
    } catch (err) {
      return fail(s, "mic");
    }
    if (s.cleaned) return stopMic(s);
    if (!s.done) setState(s, "recording");

    // 2) Parallel mit dem Server verbinden (bei Ablehnung im Hintergrund erneut versuchen, Audio wird gepuffert)
    connect(s, tokenP, 0);
  }

  async function connect(s, tokenP, attempt) {
    if (s.cleaned) return;
    let token;
    try {
      token = (await (tokenP || fetch("/api/stt-token", { method: "POST" }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("token")))))).token;
    } catch (err) {
      return retryOr(s, attempt, "token");
    }
    if (s.cleaned) return;
    const params = new URLSearchParams({ token, sample_rate: String(s.ctx.sampleRate), encoding: "pcm_s16le", speech_model: SPEECH_MODEL });
    const ws = new WebSocket(`${WS_URL}?${params}`);
    ws.binaryType = "arraybuffer";
    s.ws = ws;
    let begun = false;
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.type === "Begin") {
        begun = true;
        for (const chunk of s.queue) ws.send(chunk);
        s.queue = [];
        s.live = true;
        if (s.flushed) endStream(s); // schon beendet, während die Verbindung aufgebaut wurde
      } else if (m.type === "Turn") {
        const text = (m.end_of_turn && m.utterance) || m.transcript || "";
        if (text) s.turns.set(m.turn_order, text);
        emit(s);
      } else if (m.type === "Termination") {
        cleanup(s);
      }
    };
    ws.onerror = () => {};
    ws.onclose = (e) => {
      if (s.cleaned || s.ws !== ws) return;
      if (begun && s.done) return cleanup(s);
      if (!begun) return retryOr(s, attempt, e.code === 1008 ? "busy" : "connection"); // abgelehnt, bevor es losging
      fail(s, "connection");
    };
  }

  function retryOr(s, attempt, code) {
    if (s.cleaned) return;
    s.ws = null;
    if (attempt >= RETRY_DELAYS.length) return fail(s, code);
    if (s.flushed && !s.queue.length) return cleanup(s); // nichts mehr zu übertragen
    setTimeout(() => connect(s, null, attempt + 1), RETRY_DELAYS[attempt]);
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
      if (s.ws && s.ws.readyState === 1 && !s.queue.length && s.live) s.ws.send(pcm);
      else if (s.queue.length < MAX_BUFFER_CHUNKS) s.queue.push(pcm);
    };
    let node;
    try {
      if (!ctx.audioWorklet) throw new Error("no worklet");
      if (!workletUrl) workletUrl = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
      await ctx.audioWorklet.addModule(workletUrl);
      node = new AudioWorkletNode(ctx, "pcm16");
      node.port.onmessage = (e) => onChunk(e.data);
    } catch (e) {
      // Fallback für Browser ohne AudioWorklet
      node = ctx.createScriptProcessor(4096, 1, 1);
      node.onaudioprocess = (e) => onChunk(toInt16(e.inputBuffer.getChannelData(0)));
    }
    src.connect(node);
    node.connect(mute);
    s.nodes = [src, node, mute];
  }

  function emit(s) {
    const spoken = [...s.turns.keys()].sort((a, b) => a - b).map((k) => s.turns.get(k)).filter(Boolean).join(" ");
    try { s.onText(s.base + spoken); } catch (e) {}
  }

  // Aufnahme beenden: Mikrofon aus, letzten Satz abschließen lassen, dann aufräumen.
  function finish(s) {
    if (s.done) return;
    s.done = true;
    if (current === s) current = null;
    s.onLevel(0);
    if (!s.cleaned) setState(s, "finishing");
    // noch ~200 ms weiter aufnehmen, damit das letzte Wort nicht abgeschnitten wird
    setTimeout(() => {
      s.flushed = true;
      stopMic(s);
      if (s.cleaned) return;
      if (s.live && s.ws && s.ws.readyState === 1) endStream(s); // sonst erledigt das der Begin-Handler nach dem Nachsenden
      setTimeout(() => cleanup(s), 45000); // Sicherheitsnetz (inkl. Wiederholungen)
    }, 200);
  }

  function endStream(s) {
    if (s.ending) return;
    s.ending = true;
    try { s.ws.send(JSON.stringify({ type: "ForceEndpoint" })); } catch (e) {}
    setTimeout(() => { try { s.ws.readyState === 1 && s.ws.send(JSON.stringify({ type: "Terminate" })); } catch (e) {} }, 400);
  }

  function stopMic(s) {
    for (const n of s.nodes) { try { n.disconnect(); } catch (e) {} }
    s.nodes = [];
    try { s.stream && s.stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
  }

  function fail(s, code) {
    if (s.cleaned) return;
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
    try { s.ctx.close(); } catch (e) {}
    try { s.ws && s.ws.readyState <= 1 && s.ws.close(); } catch (e) {}
    sessions.delete(s);
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

  window.Voice = { start, finish, stopAll, supported, current: () => current, busy: () => sessions.size > 0 };
})();
