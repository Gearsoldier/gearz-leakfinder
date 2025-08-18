// engine/adapters/ipa.ts
import { Adapter } from "../types";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { tmpdir } from "node:os";

export const ipaAdapter: Adapter = {
  name: "ipa",
  async *fetch({ scope, riskAccepted }) {
    if (!riskAccepted) return; // require explicit acceptance
    const ipas = scope.artifacts?.ipa ?? [];
    for (const file of ipas) {
      if (!fs.existsSync(file)) continue;
      // unzip
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ipa-"));
      const unzip = spawnSync("unzip", ["-o", file, "-d", tmp], { encoding: "utf-8" });
      if (unzip.status !== 0) continue;

      // strings against extracted payload
      const strings = spawnSync("strings", [tmp], { encoding: "utf-8", maxBuffer: 1024*1024*50 });
      const txt = strings.stdout || "";
      if (txt.trim()) yield { id: `ipa:${file}:strings`, artifact: file, blob: txt, meta: { tool: "strings" } };

      // class-dump (if available) on binaries
      const payload = path.join(tmp, "Payload");
      if (fs.existsSync(payload)) {
        const apps = fs.readdirSync(payload).filter(f => f.endsWith(".app"));
        for (const app of apps) {
          const bin = path.join(payload, app, path.basename(app, ".app"));
          const dump = spawnSync("class-dump", ["-H", "-A", "-S", "-s", "-t", bin], { encoding: "utf-8" });
          if (dump.stdout?.trim()) {
            yield { id: `ipa:${file}:classdump`, artifact: file, blob: dump.stdout, meta: { tool: "class-dump", app } };
          }
        }
      }
    }
  }
};
