// engine/safety/merkleAudit.ts
import fs from "node:fs";
import path from "node:path";
import MerkleTools from "merkle-tools";

export function appendAuditLine(dir: string, line: object) {
  const file = path.join(dir, "audit.jsonl");
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...line }) + "\n");
}

export function merkleSeal(dir: string) {
  const file = path.join(dir, "audit.jsonl");
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, "utf-8").trim().split("\n");
  const mt = new MerkleTools();
  for (const l of lines) mt.addLeaf(l, true);
  mt.makeTree();
  const root = mt.getMerkleRoot().toString("hex");
  fs.writeFileSync(path.join(dir, "audit.merkle.json"), JSON.stringify({ root, count: lines.length }, null, 2));
  return root;
}
