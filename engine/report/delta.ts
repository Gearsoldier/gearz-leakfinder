// engine/report/delta.ts
import fs from "node:fs";

export interface Delta { new: any[]; still: any[]; resolved: any[]; }

export function computeDelta(prevFile: string, currFile: string): Delta {
  const prev = fs.existsSync(prevFile) ? fs.readFileSync(prevFile, "utf-8").trim().split("\n").filter(Boolean).map(JSON.parse) : [];
  const curr = fs.existsSync(currFile) ? fs.readFileSync(currFile, "utf-8").trim().split("\n").filter(Boolean).map(JSON.parse) : [];

  const prevSet = new Set(prev.map((f: any) => f.id));
  const currSet = new Set(curr.map((f: any) => f.id));

  const newly = curr.filter((f: any) => !prevSet.has(f.id));
  const still = curr.filter((f: any) => prevSet.has(f.id));
  const resolved = prev.filter((f: any) => !currSet.has(f.id));
  return { new: newly, still, resolved };
}
