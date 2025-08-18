// engine/report/compliance.ts
import fs from "node:fs";
import path from "node:path";

export function writeCompliancePack(findingsFile: string, merkleFile: string, outDir: string) {
  const findings = fs.existsSync(findingsFile) ? fs.readFileSync(findingsFile, "utf-8") : "";
  const merkle = fs.existsSync(merkleFile) ? fs.readFileSync(merkleFile, "utf-8") : "{}";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "README.md"),
`# Compliance Evidence Pack

- Findings: findings.jsonl
- Merkle Root: audit.merkle.json

Use this pack to demonstrate:
- Evidence integrity (Merkle root)
- Redaction policy
- Detection rule versions
`);
  fs.copyFileSync(merkleFile, path.join(outDir, "audit.merkle.json"));
  fs.writeFileSync(path.join(outDir, "findings.jsonl"), findings);
}
