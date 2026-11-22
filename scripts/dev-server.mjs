// Lokaler Testserver, der das Routing aus vercel.json nachbildet.
// Start: node --experimental-detect-module scripts/dev-server.mjs  (Port 4173)
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import handler from "../api/site.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

function routeFor(req, url) {
  const p = url.pathname;
  if (p === "/") {
    if (url.searchParams.has("studie-website") || req.headers["sec-fetch-dest"] === "iframe" || req.headers.rsc) {
      return { proxy: "/" };
    }
    return { file: "app/index.html" };
  }
  if (p === "/admin") return { file: "app/index.html" };
  if (p.startsWith("/app/") || p.startsWith("/archive/")) return { file: p.slice(1) };
  return { proxy: p };
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const route = routeFor(req, url);
    try {
      if (route.file) {
        const filePath = normalize(join(root, decodeURIComponent(route.file)));
        if (!filePath.startsWith(root)) throw new Error("bad path");
        await stat(filePath);
        res.writeHead(200, { "content-type": types[extname(filePath)] || "application/octet-stream", "cache-control": "no-store" });
        res.end(await readFile(filePath));
        return;
      }
      const target = new URL(`http://localhost:${port}/api/site`);
      target.searchParams.set("__p", route.proxy);
      for (const [k, v] of url.searchParams) target.searchParams.append(k, v);
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const request = new Request(target, {
        method: req.method,
        headers: Object.entries(req.headers).filter(([, v]) => typeof v === "string"),
        body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
      });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) {
        for await (const chunk of response.body) res.write(chunk);
      }
      res.end();
    } catch (error) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
    }
  })
  .listen(port, () => console.log(`Dev server: http://localhost:${port}  (Admin: /admin)`));
