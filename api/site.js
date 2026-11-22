// Website-Proxy für den Website-Test.
//
// kolsetu.com verbietet das Einbetten per iframe (X-Frame-Options: DENY,
// frame-ancestors 'none'). Diese Edge Function holt die Seite live vom Original,
// entfernt nur diese Header und liefert sie unter unserer Domain aus, damit sie
// im Umfrage-iframe angezeigt werden kann. Inhalte werden nicht verändert,
// außer dass absolute Links auf kolsetu.com relativ gemacht werden, damit
// Klicks innerhalb des iframes bleiben.
//
// Routing: siehe vercel.json. Der Originalpfad kommt im Query-Parameter "__p".

export const config = { runtime: "edge" };

const UPSTREAM = "https://kolsetu.com";
const INTERNAL_PARAMS = ["__p", "studie-website"];

const FORWARD_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "user-agent",
  "content-type",
  "rsc",
  "next-router-state-tree",
  "next-router-prefetch",
  "next-router-segment-prefetch",
  "next-url",
  "next-action",
  "range",
];

const DROP_RESPONSE_HEADERS = [
  "x-frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
  "strict-transport-security",
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "set-cookie",
  "alt-svc",
];

export function upstreamUrlFor(requestUrl) {
  const url = new URL(requestUrl);
  let path = url.searchParams.get("__p") || url.pathname || "/";
  if (!path.startsWith("/")) path = "/" + path;
  const target = new URL(path, UPSTREAM);
  for (const [key, value] of url.searchParams) {
    if (!INTERNAL_PARAMS.includes(key)) target.searchParams.append(key, value);
  }
  return target;
}

function rewriteHtml(html) {
  return html
    .replace(/(\s(?:href|action))="https:\/\/(?:www\.)?kolsetu\.com(?=[/"?#])/g, '$1="')
    .replace("<head>", '<head><meta name="robots" content="noindex,nofollow">');
}

export default async function handler(request) {
  const target = upstreamUrlFor(request.url);

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const init = { method: request.method, headers, redirect: "manual" };
  if (!["GET", "HEAD"].includes(request.method)) init.body = await request.arrayBuffer();

  let upstream;
  try {
    upstream = await fetch(target, init);
  } catch (error) {
    return new Response("Website konnte nicht geladen werden.", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8", "x-study-proxy": "error" },
    });
  }

  const outHeaders = new Headers(upstream.headers);
  for (const name of DROP_RESPONSE_HEADERS) outHeaders.delete(name);
  outHeaders.set("access-control-allow-origin", "*");
  outHeaders.set("x-robots-tag", "noindex, nofollow");
  outHeaders.set("x-study-proxy", "kolsetu");

  const location = outHeaders.get("location");
  if (location) {
    const loc = new URL(location, target);
    if (/(^|\.)kolsetu\.com$/.test(loc.hostname)) {
      outHeaders.set("location", loc.pathname + loc.search + loc.hash);
    }
  }

  const type = outHeaders.get("content-type") || "";
  if (type.includes("text/html") && request.method !== "HEAD") {
    const html = rewriteHtml(await upstream.text());
    return new Response(html, { status: upstream.status, headers: outHeaders });
  }

  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers: outHeaders,
  });
}
