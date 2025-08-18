// engine/report/jsonl.ts
import fs from "node:fs";
import path from "node:path";
import { Finding } from "../types";

export function writeJSONL(findings: Finding[], outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, "findings.jsonl");
  fs.writeFileSync(file, findings.map(f => JSON.stringify(f)).join("\n") + "\n");
}
