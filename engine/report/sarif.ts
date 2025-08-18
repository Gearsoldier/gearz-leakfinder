// engine/report/sarif.ts
import fs from "node:fs";
import path from "node:path";
import { Finding } from "../types";

export function writeSarif(findings: Finding[], outDir: string) {
  const sarif = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [{
      tool: { driver: { name: "GEARZ LeakFinder Engine", rules: [] as any[] } },
      results: findings.map(f => ({
        ruleId: f.secretType,
        message: { text: `${f.severity.toUpperCase()} ${f.secretType} at ${f.artifact}` },
        locations: [{ physicalLocation: { artifactLocation: { uri: f.artifact } } }],
        properties: { score: f.score, preview: f.preview, source: f.source, ts: f.ts }
      }))
    }]
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "findings.sarif.json"), JSON.stringify(sarif, null, 2));
}
