// engine/adapters/pypi.ts
// Generic PyPI adapter (async-iterable).
// Accepts targets from either scope.targets or scope.pypi.targets.
// Targets can be:
//   - exact package: "mozlog"
//   - prefix pattern: "mozilla*"  (best-effort search)
//
// Strategy:
//  - Exact: GET https://pypi.org/pypi/<name>/json → use info.description or summary
//  - Prefix: Use Warehouse search page JSON (best-effort), then fetch top matches

import { request } from "undici";

type AnyScope = Record<string, any>;
type Artifact = { id: string; artifact: string; blob: string; meta?: Record<string, any> };

function log(ctx: any, msg: string) {
  (ctx?.log || console.log)(`[pypi] ${msg}`);
}

function normalizeTargets(scope: AnyScope | undefined): string[] {
  if (!scope || typeof scope !== "object") return [];
  const local = Array.isArray((scope as any).targets) ? (scope as any).targets : [];
  const section = Array.isArray((scope as any)?.pypi?.targets) ? (scope as any).pypi.targets : [];
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

async function getPackageJSON(name: string) {
  const url = `https://pypi.org/pypi/${encodeURIComponent(name)}/json`;
  const { body, statusCode } = await request(url);
  if (statusCode >= 400) return null;
  const json = await body.json().catch(() => null);
  return json;
}

/**
 * Best-effort search: PyPI doesn't have a stable public JSON search API,
 * but the HTML search endpoint sometimes returns small JSON when asked.
 * We'll try `/search/?q=<query>&format=json` and fall back gracefully.
 */
async function searchPrefix(prefix: string, size = 50): Promise<string[]> {
  const url = new URL("https://pypi.org/search/");
  url.searchParams.set("q", prefix);
  url.searchParams.set("format", "json");
  const { body, statusCode } = await request(url);
  if (statusCode >= 400) return [];
  const json = await body.json().catch(() => null);
  const names: string[] = [];

  // Try common shapes seen from Warehouse search responses
  // (If this fails, we just return an empty array gracefully.)
  if (Array.isArray(json?.projects)) {
    for (const p of json.projects) {
      if (p?.name && String(p.name).toLowerCase().startsWith(prefix.toLowerCase().replace(/\*$/, ""))) {
        names.push(String(p.name));
        if (names.length >= size) break;
      }
    }
  } else if (Array.isArray(json?.results)) {
    for (const r of json.results) {
      const n = r?.name ?? r?.project ?? r?.title;
      if (n && String(n).toLowerCase().startsWith(prefix.toLowerCase().replace(/\*$/, ""))) {
        names.push(String(n));
        if (names.length >= size) break;
      }
    }
  }

  return names;
}

export const pypi = {
  name: "pypi",

  async *fetch({ scope, ctx }: { scope: AnyScope; ctx?: any }): AsyncGenerator<Artifact> {
    const targets = normalizeTargets(scope);
    if (!targets.length) {
      log(ctx, "No PyPI targets found under scope.targets or scope.pypi.targets. Skipping.");
      return;
    }

    const perQuery = ctx?.dryRun ? 15 : 80;

    for (const t of targets) {
      if (!t) continue;

      // prefix pattern
      if (t.endsWith("*")) {
        const prefix = t.slice(0, -1);
        log(ctx, `Searching PyPI prefix "${prefix}*"`);
        let names: string[] = [];
        try {
          names = await searchPrefix(`${prefix}*`, perQuery);
        } catch (e: any) {
          log(ctx, `Search failed for ${prefix}*: ${e?.message || e}`);
          continue;
        }
        if (!names.length) {
          log(ctx, `No search matches for ${prefix}* (best-effort).`);
          continue;
        }
        for (const name of names) {
          const meta = await getPackageJSON(name).catch(() => null);
          if (!meta) continue;
          const ver = meta.info?.version || "unknown";
          const desc = meta.info?.description || meta.info?.summary || "";
          yield {
            id: `pypi:${name}@${ver}`,
            artifact: `https://pypi.org/project/${encodeURIComponent(name)}/`,
            blob: desc,
            meta: { package: name, version: ver, source: "pypi" },
          };
        }
        continue;
      }

      // exact package
      log(ctx, `Fetching PyPI package ${t}`);
      const meta = await getPackageJSON(t).catch(() => null);
      if (!meta) {
        log(ctx, `Package not found: ${t}`);
        continue;
      }
      const ver = meta.info?.version || "unknown";
      const desc = meta.info?.description || meta.info?.summary || "";
      yield {
        id: `pypi:${t}@${ver}`,
        artifact: `https://pypi.org/project/${encodeURIComponent(t)}/`,
        blob: desc,
        meta: { package: t, version: ver, source: "pypi" },
      };
    }
  },
};

export default pypi;
