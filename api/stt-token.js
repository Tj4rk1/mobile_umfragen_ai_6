// Spracheingabe (Echtzeit) für Freitext-Fragen über AssemblyAI Streaming (EU-Server).
//
// Der API-Key liegt nur hier auf dem Server (Vercel-Umgebungsvariable ASSEMBLYAI_API_KEY).
// Der Browser holt sich hier einen kurzlebigen Token (60 s zum Verbinden, max. 10 min Aufnahme)
// und streamt das Mikrofon damit direkt an wss://streaming.eu.assemblyai.com/v3/ws.
// Audio wird nicht gespeichert; in der Umfrage landet nur der Text im Antwortfeld.

export const config = { runtime: "edge" };

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });

export default async function handler(req) {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) return json({ error: "not_configured" }, 503);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  // Nur von der eigenen Seite aus (kein Fremdverbrauch des Kontingents)
  const origin = req.headers.get("origin");
  try {
    if (!origin || new URL(origin).host !== new URL(req.url).host) return json({ error: "forbidden" }, 403);
  } catch {
    return json({ error: "forbidden" }, 403);
  }

  const r = await fetch("https://token.eu.assemblyai.com/v1/token", {
    method: "POST",
    headers: { authorization: key, "content-type": "application/json" },
    body: JSON.stringify({ product: "streaming", expires_in_seconds: 60, max_session_duration_seconds: 600 }),
  });
  if (!r.ok) return json({ error: "token_failed", status: r.status }, 502);
  const { token } = await r.json();
  return json({ token });
}
