// Spracheingabe (Echtzeit) für Freitext-Fragen: gibt kurzlebige Tokens für beide Anbieter aus.
//
//   ElevenLabs Scribe v3 Live (Standard)   – Key: ELEVENLABS_API_KEY  (Single-Use-Token, 15 min gültig)
//   AssemblyAI Universal Streaming (EU)    – Key: ASSEMBLYAI_API_KEY  (60 s zum Verbinden, max. 10 min)
//
// Beide Tokens werden parallel geholt, damit der Browser bei einer Ablehnung ohne weitere
// Wartezeit auf den anderen Anbieter wechseln kann. Die API-Keys verlassen nie den Server.
// Audio wird nicht gespeichert; in der Umfrage landet nur der Text im Antwortfeld.

export const config = { runtime: "edge" };

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });

async function elevenToken(key) {
  const r = await fetch("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe?max_session_duration_seconds=600", {
    method: "POST",
    headers: { "xi-api-key": key },
  });
  if (!r.ok) throw new Error("eleven " + r.status);
  return (await r.json()).token;
}

async function assemblyToken(key) {
  const r = await fetch("https://token.eu.assemblyai.com/v1/token", {
    method: "POST",
    headers: { authorization: key, "content-type": "application/json" },
    body: JSON.stringify({ product: "streaming", expires_in_seconds: 60, max_session_duration_seconds: 600 }),
  });
  if (!r.ok) throw new Error("assembly " + r.status);
  return (await r.json()).token;
}

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  // Nur von der eigenen Seite aus (kein Fremdverbrauch des Kontingents)
  const origin = req.headers.get("origin");
  try {
    if (!origin || new URL(origin).host !== new URL(req.url).host) return json({ error: "forbidden" }, 403);
  } catch {
    return json({ error: "forbidden" }, 403);
  }

  const el = process.env.ELEVENLABS_API_KEY;
  const as = process.env.ASSEMBLYAI_API_KEY;
  if (!el && !as) return json({ error: "not_configured" }, 503);

  const [eleven, assembly] = await Promise.allSettled([
    el ? elevenToken(el) : Promise.reject(new Error("no key")),
    as ? assemblyToken(as) : Promise.reject(new Error("no key")),
  ]);
  const out = {};
  if (eleven.status === "fulfilled") out.eleven = eleven.value;
  if (assembly.status === "fulfilled") out.assembly = assembly.value;
  if (!out.eleven && !out.assembly) return json({ error: "token_failed" }, 502);
  return json(out);
}
