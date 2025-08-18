// engine/adapters/dns.ts
import { Adapter } from "../types";
import { spawnSync } from "node:child_process";

export const dnsAxfr: Adapter = {
  name: "dns-axfr",
  async *fetch({ scope, riskAccepted }) {
    if (!riskAccepted) return; // require explicit risk acceptance
    for (const t of scope.targets) {
      if (!("domain" in t)) continue;
      const dom = t.domain;
      const dig = spawnSync("dig", ["AXFR", dom], { encoding: "utf-8" });
      const out = dig.stdout || "";
      if (!out.trim() || out.includes("Transfer failed")) continue;
      yield { id: `axfr:${dom}`, artifact: `axfr://${dom}`, blob: out, meta: { domain: dom } };
    }
  }
};
