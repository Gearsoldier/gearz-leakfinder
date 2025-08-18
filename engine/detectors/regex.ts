// engine/detectors/regex.ts
import { RulePack } from "../types";

export function* runRegex(blob: string, rules: RulePack["rules"]) {
  for (const r of rules) {
    const re = new RegExp(r.regex, r.flags ?? "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(blob))) {
      const match = m[0];
      const idx = (m.index ?? 0);
      const start = Math.max(0, idx - 60);
      const end = Math.min(blob.length, idx + match.length + 60);
      yield { rule: r, match, before: blob.slice(start, idx), after: blob.slice(idx + match.length, end) };
    }
  }
}

