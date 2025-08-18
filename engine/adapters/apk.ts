// engine/adapters/apk.ts
import { Adapter } from "../types";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const apkAdapter: Adapter = {
  name: "apk",
  async *fetch({ scope, riskAccepted, cacheDir }) {
    if (!riskAccepted) return; // require explicit acceptance
    const apks = scope.artifacts?.apk ?? [];
    for (const file of apks) {
      if (!fs.existsSync(file)) continue;
      const outDir = path.join(cacheDir, "apk", path.basename(file, ".apk"));
      fs.mkdirSync(outDir, { recursive: true });

      // Run strings as a lightweight baseline
      const strings = spawnSync("strings", [file], { encoding: "utf-8", maxBuffer: 1024*1024*50 });
      const txt = strings.stdout || "";
      if (txt.trim()) yield { id: `apk:${file}:strings`, artifact: file, blob: txt, meta: { tool: "strings" } };

      // apktool decode if available
      const apktool = spawnSync("apktool", ["d", "-o", outDir, "-f", file], { encoding: "utf-8" });
      if (apktool.status === 0) {
        const guess = ["AndroidManifest.xml", "assets", "res", "smali"];
        for (const g of guess) {
          const p = path.join(outDir, g);
          if (fs.existsSync(p)) {
            try {
              const content = fs.statSync(p).isDirectory()
                ? fs.readdirSync(p).slice(0, 50).map(f => fs.readFileSync(path.join(p, f), "utf-8")).join("\n")
                : fs.readFileSync(p, "utf-8");
              if (content) yield { id: `apk:${file}:${g}`, artifact: `${file}:${g}`, blob: content, meta: { tool: "apktool" } };
            } catch {}
          }
        }
      }
    }
  }
};
