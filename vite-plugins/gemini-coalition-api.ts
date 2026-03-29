import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

import { runCoalitionAnalysis, validateCoalitionBody } from "../src/lib/gemini/coalitionAnalyze";
import {
  readCoalitionDiskCacheByQuery,
  readCoalitionDiskCacheForBody,
  writeCoalitionDiskCache,
} from "../src/lib/gemini/coalitionDiskCache";

const PATH = "/api/gemini/coalition";

/**
 * Dev-server: coalition-analyse met schijfcache onder `data/coalition-cache/`.
 *
 * Beveiliging: GEMINI_API_KEY staat niet in de browser, maar dit endpoint is wél bereikbaar
 * voor iedereen die je dev-host kan bereiken — die kan dan POST-stormen doen tegen je
 * quota (tot de cache gevuld is). Gebruik geen productie-key op een open `--host`, of
 * zet een reverse proxy met auth/rate-limit.
 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export function geminiCoalitionApiPlugin(apiKey: string | undefined): Plugin {
  return {
    name: "gemini-coalition-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith(PATH)) {
          next();
          return;
        }
        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type");
          res.end();
          return;
        }

        if (req.method === "GET") {
          try {
            const u = new URL(url, "http://localhost");
            const gmCode = u.searchParams.get("gmCode")?.trim() ?? "";
            const statementKey = u.searchParams.get("statementKey")?.trim() ?? "";
            const fp = u.searchParams.get("fp")?.trim() ?? "";
            if (!gmCode || !statementKey || !fp) {
              sendJson(res, 400, { ok: false, error: "gmCode, statementKey en fp zijn verplicht." });
              return;
            }
            const hit = await readCoalitionDiskCacheByQuery(gmCode, statementKey, fp);
            if (hit) {
              sendJson(res, 200, { ok: true, hit: true, text: hit.text, savedAt: hit.savedAt });
            } else {
              sendJson(res, 200, { ok: true, hit: false });
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            sendJson(res, 500, { ok: false, error: msg });
          }
          return;
        }

        if (req.method !== "POST") {
          next();
          return;
        }

        const key = apiKey?.trim();
        if (!key) {
          sendJson(res, 503, {
            ok: false,
            error:
              "GEMINI_API_KEY ontbreekt. Zet de key in .env in de projectroot en herstart `npm run dev`.",
          });
          return;
        }

        let raw: string;
        try {
          raw = await readBody(req);
        } catch {
          sendJson(res, 400, { ok: false, error: "Kon request body niet lezen." });
          return;
        }

        try {
          const parsed = JSON.parse(raw) as unknown;
          const body = validateCoalitionBody(parsed);

          const cached = await readCoalitionDiskCacheForBody(body);
          if (cached) {
            sendJson(res, 200, {
              ok: true,
              text: cached.text,
              source: "disk",
              savedAt: cached.savedAt,
            });
            return;
          }

          const text = await runCoalitionAnalysis(key, body);
          const savedAt = await writeCoalitionDiskCache(body, text);
          sendJson(res, 200, { ok: true, text, source: "gemini", savedAt });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          sendJson(res, 500, { ok: false, error: msg });
        }
      });
    },
  };
}
