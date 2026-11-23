// Spracheingabe in Echtzeit für Freitext-Felder (AssemblyAI Streaming, EU-Server).
// Ablauf: Token von /api/stt-token holen → Mikrofon → PCM16-Frames per WebSocket streamen
// → Zwischen- und Endergebnisse live ins Textfeld schreiben.
// Deutsch und Englisch werden automatisch erkannt (auch gemischt).
(function () {
  const WS_URL = "wss://streaming.eu.assemblyai.com/v3/ws";
  const SPEECH_MODEL = "universal-3-6-pro"; // mehrsprachig (u. a. DE + EN), mit Code-Switching

  // AudioWorklet: Float32 → Int16, in ~100-ms-Blöcken
  const WORKLET = `
    class Pcm16 extends AudioWorkletProcessor {
      constructor() { super(); this.buf = []; this.len = 0; this.target = Math.round(sampleRate / 10); }
      process(inputs) {
        const ch = inputs[0] && inputs[0][0];
        if (ch) {
          const out = new Int16Array(ch.length);
          for (let i = 0; i < ch.length; i++) { const s = Math.max(-1, Math.min(1, ch[i])); out[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
          this.buf.push(out); this.len += out.length;
          if (this.len >= this.target) {
            const all = new Int16Array(this.len); let o = 0;
            for (const b of this.buf) { all.set(b, o); o += b.length; }
            this.port.postMessage(all.buffer, [all.buffer]); this.buf = []; this.len = 0;
          }
        }
        return true;
      }
    }
    registerProcessor("pcm16", Pcm16);`;

  let session = null;

  const supported = () =>
    !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.AudioWorkletNode && window.WebSocket);

  // onText(fullText) bei jeder Änderung, onState("connecting"|"recording"|"idle"|"error", errCode)
  async function start({ baseText, onText, onState }) {
    await stop();
    const s = { closed: false, turns: new Map(), onText, onState, base: baseText ? baseText.replace(/\s+$/, "") + " " : "" };
    session = s;
    onState("connecting");
    // AudioContext sofort (noch im Klick) anlegen, sonst startet er wegen Autoplay-Regeln pausiert.
    const Ctx = window.AudioContext || window.webkitAudioContext;
    // Native Abtastrate des Geräts verwenden (erzwungene 16 kHz liefern in Chrome teils Stille);
    // AssemblyAI akzeptiert 8–96 kHz, die Rate wird beim Verbinden mitgeschickt.
    const ctx = new Ctx();
    s.ctx = ctx;
    ctx.resume().catch(() => {});
    try {
      const [tokRes, stream] = await Promise.all([
        fetch("/api/stt-token", { method: "POST" }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("token")))),
        navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }),
      ]);
      s.stream = stream;
      if (s.closed) return cleanup(s);

      const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      if (s.closed) return cleanup(s);

      const params = new URLSearchParams({ token: tokRes.token, sample_rate: String(ctx.sampleRate), encoding: "pcm_s16le", speech_model: SPEECH_MODEL });
      const ws = new WebSocket(`${WS_URL}?${params}`);
      ws.binaryType = "arraybuffer";
      s.ws = ws;

      ws.onopen = async () => {
        if (s.closed) return;
        const src = ctx.createMediaStreamSource(stream);
        const node = new AudioWorkletNode(ctx, "pcm16");
        node.port.onmessage = (e) => { if (ws.readyState === 1) ws.send(e.data); };
        // Stummer Ausgang, damit der Browser den Prozessor sicher laufen lässt
        const mute = ctx.createGain();
        mute.gain.value = 0;
        src.connect(node);
        node.connect(mute);
        mute.connect(ctx.destination);
        s.node = node;
        s.src = src;
        s.mute = mute;
        try { await ctx.resume(); } catch (e) {}
        onState("recording");
      };
      ws.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m.type === "Turn") {
          const text = (m.end_of_turn && m.utterance) || m.transcript || "";
          s.turns.set(m.turn_order, text);
          emit(s);
        } else if (m.type === "Termination") {
          cleanup(s);
        }
      };
      ws.onerror = () => { if (!s.closed) fail(s, "connection"); };
      ws.onclose = (e) => { if (!s.closed && !s.stopping) fail(s, e.code === 1008 || e.code === 4001 ? "auth" : "connection"); else cleanup(s); };
    } catch (err) {
      fail(s, err && err.name === "NotAllowedError" ? "denied" : err && err.message === "token" ? "token" : "connection");
    }
  }

  function emit(s) {
    const spoken = [...s.turns.keys()].sort((a, b) => a - b).map((k) => s.turns.get(k)).filter(Boolean).join(" ");
    s.onText(s.base + spoken);
  }

  function fail(s, code) {
    s.onState("error", code);
    cleanup(s, true);
  }

  function cleanup(s, silent) {
    if (s.cleaned) return;
    s.cleaned = true;
    s.closed = true;
    try { s.src && s.src.disconnect(); } catch (e) {}
    try { s.node && s.node.disconnect(); } catch (e) {}
    try { s.mute && s.mute.disconnect(); } catch (e) {}
    try { s.stream && s.stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
    try { s.ctx && s.ctx.close(); } catch (e) {}
    try { s.ws && s.ws.readyState <= 1 && s.ws.close(); } catch (e) {}
    if (!silent) s.onState("idle");
    if (session === s) session = null;
  }

  // Aufnahme beenden: Terminate schicken, letzte Ergebnisse noch kurz abwarten.
  function stop() {
    const s = session;
    if (!s) return Promise.resolve();
    s.stopping = true;
    try { s.stream && s.stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
    if (s.ws && s.ws.readyState === 1) {
      // Erst den laufenden Satz abschließen lassen (vollständige, formatierte Fassung), dann beenden.
      try { s.ws.send(JSON.stringify({ type: "ForceEndpoint" })); } catch (e) {}
      const ws = s.ws;
      setTimeout(() => { try { ws.readyState === 1 && ws.send(JSON.stringify({ type: "Terminate" })); } catch (e) {} }, 700);
      return new Promise((resolve) => {
        const done = () => { cleanup(s); resolve(); };
        const t = setTimeout(done, 3500);
        const prev = s.ws.onclose;
        s.ws.onclose = (e) => { clearTimeout(t); prev && prev(e); done(); };
      });
    }
    cleanup(s);
    return Promise.resolve();
  }

  window.Voice = { start, stop, supported, active: () => (session && !session.closed ? session : null) };
})();
