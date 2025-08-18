// engine/ignore.ts
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

export interface IgnoreDB { patterns: string[]; artifacts: string[]; rules: string[]; }

const DEFAULT: IgnoreDB = { patterns: [], artifacts: [], rules: [] };
const FILE = path.join(process.cwd(), "ignore.yaml");

export function loadIgnore(): IgnoreDB {
  if (!fs.existsSync(FILE)) return DEFAULT;
  try { return YAML.parse(fs.readFileSync(FILE, "utf-8")) as IgnoreDB; }
  catch { return DEFAULT; }
}

export function shouldIgnore(find: { artifact: string; secretType: string; match: string }, ig: IgnoreDB): boolean {
  if (ig.artifacts.some(a => find.artifact.includes(a))) return true;
  if (ig.rules.includes(find.secretType)) return true;
  if (ig.patterns.some(p => find.match.includes(p))) return true;
  return false;
}

export function recordIgnore(example: { artifact?: string; rule?: string; pattern?: string }) {
  const db = loadIgnore();
  if (example.artifact && !db.artifacts.includes(example.artifact)) db.artifacts.push(example.artifact);
  if (example.rule && !db.rules.includes(example.rule)) db.rules.push(example.rule);
  if (example.pattern && !db.patterns.includes(example.pattern)) db.patterns.push(example.pattern);
  fs.writeFileSync(FILE, YAML.stringify(db));
}
