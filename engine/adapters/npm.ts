// engine/adapters/npm.ts
// Generic npm adapter (async-iterable).
// Accepts targets from either scope.targets or scope.npm.targets.
// Targets can be:
//   - npm org scopes: "@mozilla"
//   - name prefixes:  "mozilla-*"
//   - exact package:  "some-package"
//
// Strategy:
//  - For @scope: use registry search with `scope:<name>`
//  - For prefix*: use registry search text=<prefix> and prefix-filter locally
//  - For exact name: fetch that package directly
//
// Output: README/description blobs; metadata has { package, version }

import { request } from "undici";

type AnyScope = Record<string, any>;
type Artifact = { id: string; artifact: string; blob: string; meta?: Record<string, any> };

function log(ctx: any, msg: string) {
  (ctx?.log || console.log)(`[npm] ${msg}`);
}

function normalizeTargets(scope: AnyScope | undefined): string[] {
  if (!scope || typeof scope !== "object") return [];
  const local = Array.isArray((scope as any).targets) ? (scope as any).targets : [];
  const section = Array.isArray((scope as any)?.npm?.targets) ? (scope as any).npm.targets : [];
  const raw = [...local, ...section];
  const out: string[] = [];
  for (const t of raw) {
    if (!t) continue;
    if (typeof t === "string") out.push(t.trim());
    else if (typeof t === "object") {
      const s = (t as any).name ?? (t as any).pkg ?? (t as any).pattern ?? (t as any).url;
      if (typeof s === "string" && s.trim()) out.push(s.trim());
    }
  }
  const seen = new Set<string>();
  return out.filter(v => (seen.has(v.toLowerCase()) ? false : (seen.add(v.toLowerCase()), true)));
}

async function searchRegistry(text: string, size = 100) {
  const url = new URL("https://registry.npmjs.org/-/v1/search");
  url.searchParams.set("text", text);
  url.searchParams.set("size", String(size));
  const { body, statusCode } = await request(url);
  if (statusCode >= 400) return [];
  const json = await body.json().catch(() => null);
  if (!json || !Array.isArray(json.objects)) return [];
  return json.objects as any[];
}

async function getPackageInfo(name: string) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
  const { body, statusCode } = await request(url);
  if (statusCode >= 400) return null;
  const json = await body.json().catch(() => null);
  return json;
}

export const npmAdapter = {
  name: "npm",

  async *fetch({ scope, ctx }: { scope: AnyScope; ctx?: any }): AsyncGenerator<Artifact> {
    const targets = normalizeTargets(scope);
    if (!targets.length) {
      log(ctx, "No npm targets found under scope.targets or scope.npm.targets. Skipping.");
      return;
    }

    const perQuery = ctx?.dryRun ? 20 : 120;

    for (const t of targets) {
      if (!t) continue;

      // @scope
      if (t.startsWith("@") && !t.includes("*")) {
        const sc = t.replace(/^@/, "");
        log(ctx, `Searching npm scope:${sc}`);
        let results: any[] = [];
        try {
          results = await searchRegistry(`scope:${sc}`, perQuery);
        } catch (e: any) {
          log(ctx, `Search failed for scope:${sc} → ${e?.message || e}`);
          continue;
        }
        for (const obj of results) {
          const name = obj?.package?.name;
          if (!name) continue;
          const meta = await getPackageInfo(name).catch(() => null);
          if (!meta) continue;
          const latest = meta["dist-tags"]?.latest;
          const readme = typeof meta.readme === "string" ? meta.readme : "";
          const ver = latest || Object.keys(meta.versions || {}).pop() || "unknown";
          yield {
            id: `npm:${name}@${ver}`,
            artifact: `https://www.npmjs.com/package/${encodeURIComponent(name)}`,
            blob: readme,
            meta: { package: name, version: ver, source: "npm" },
          };
        }
        continue;
      }

      // prefix*
      if (t.endsWith("*")) {
        const prefix = t.slice(0, -1);
        log(ctx, `Searching npm prefix "${prefix}*"`);
        let results: any[] = [];
        try {
          results = await searchRegistry(prefix, perQuery);
        } catch (e: any) {
          log(ctx, `Search failed for prefix ${prefix}* → ${e?.message || e}`);
          continue;
        }
        for (const obj of results) {
          const name = obj?.package?.name;
          if (!name || !name.startsWith(prefix)) continue;
          const meta = await getPackageInfo(name).catch(() => null);
          if (!meta) continue;
          const latest = meta["dist-tags"]?.latest;
          const readme = typeof meta.readme === "string" ? meta.readme : "";
          const ver = latest || Object.keys(meta.versions || {}).pop() || "unknown";
          yield {
            id: `npm:${name}@${ver}`,
            artifact: `https://www.npmjs.com/package/${encodeURIComponent(name)}`,
            blob: readme,
            meta: { package: name, version: ver, source: "npm" },
          };
        }
        continue;
      }

      // exact package name
      log(ctx, `Fetching npm package ${t}`);
      const meta = await getPackageInfo(t).catch(() => null);
      if (!meta) {
        log(ctx, `Package not found: ${t}`);
        continue;
      }
      const latest = meta["dist-tags"]?.latest;
      const readme = typeof meta.readme === "string" ? meta.readme : "";
      const ver = latest || Object.keys(meta.versions || {}).pop() || "unknown";
      yield {
        id: `npm:${t}@${ver}`,
        artifact: `https://www.npmjs.com/package/${encodeURIComponent(t)}`,
        blob: readme,
        meta: { package: t, version: ver, source: "npm" },
      };
    }
  },
};

export default npmAdapter;
