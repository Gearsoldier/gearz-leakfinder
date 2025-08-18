// engine/report/drift.ts
import fs from "node:fs";
import path from "node:path";

export function writeDriftTimeline(runs: { ts: string; count: number }[], outDir: string) {
  const csv = ["ts,count", ...runs.map(r => `${r.ts},${r.count}`)].join("\n");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "drift.csv"), csv);
}
