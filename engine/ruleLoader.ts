// engine/ruleLoader.ts
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { RulePack } from "./types";

export function loadRulePacks(dir = path.join(process.cwd(), "engine", "rules")): RulePack {
  const file = path.join(dir, "default.yaml");
  const doc = YAML.parse(fs.readFileSync(file, "utf-8"));
  return doc as RulePack;
}
