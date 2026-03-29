/**
 * Uit party-mapping-strong.jsonl: regels met score < 1 (dus geen exacte match).
 * Schrijft platte tuples per regel naar stdout en naar data/processed/.
 *
 *   npm run data:export-strong-tuples
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const OUT = "data/processed/party-mapping-strong-not-perfect.tuples.txt";

function main(): void {
  const projectRoot = process.cwd();
  const p = resolve(projectRoot, "data/processed/party-mapping-strong.jsonl");
  const lines = readFileSync(p, "utf8")
    .trim()
    .split(/\n/)
    .filter(Boolean);
  const out: string[] = [];
  for (const line of lines) {
    const r = JSON.parse(line) as {
      score: number;
      stemwijzerShortName: string;
      stemwijzerFullName: string;
      nosShortName: string;
      nosFullName: string;
    };
    if (r.score === 1) continue;
    const t = [r.stemwijzerShortName, r.stemwijzerFullName, r.nosShortName, r.nosFullName].map((x) =>
      JSON.stringify(x),
    );
    out.push(`(${t.join(",")})`);
  }
  const body = out.join("\n") + (out.length ? "\n" : "");
  process.stdout.write(body);
  const outPath = resolve(projectRoot, OUT);
  mkdirSync(resolve(projectRoot, "data/processed"), { recursive: true });
  writeFileSync(outPath, body, "utf8");
  console.error(`Geschreven: ${outPath} (${out.length} regels)`);
}

main();
