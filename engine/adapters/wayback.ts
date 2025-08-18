// engine/adapters/wayback.ts
// Generic Wayback Machine adapter (async-iterable).
// Accepts targets from either scope.targets or scope.wayback.targets.
// Targets can be domains (e.g., "github.com/mozilla") or full URLs.

import { request } from "undici";

type AnyScope = Record<string, any>;

type ArtifactYield = {
  id: string;
  artifact: string;
  blob: string;
  meta?: Record<string, any>;
};

function safeLog(ctx: any, msg: string) {
  (ctx?.log || console.log)(`[wayback] ${msg}`);
}

function normalizeTargets(scope: AnyScope | undefined): string[] {
  if (!scope || typeof scope !== "object") return [];
  const local = Array.isArray((scope as any).targets) ? (scope as any).targets : [];
  const section = Array.isArray((scope as any)?.wayback?.targets) ? (scope as any).wayback.targets : [];
  const raw = [...local, ...section];

  const out: string[] = [];
  for (const t of raw) {
    if (!t) continue;
    if (typeof t === "string") out.push(t.trim());
    else if (typeof t === "object") {
      const s = (t as any).url || (t as any).domain || (t as any).host || (t as any).name;
      if (typeof s === "string" && s.trim()) out.push(s.trim());
    }
  }
  // de-dup
  const seen = new Set<string>();
  return out.filter(v => (seen.has(v.toLowerCase()) ? false : (seen.add(v.toLowerCase()), true)));
}

// Query Wayback CDX API for recent captures of a domain or URL prefix.
async function listCaptures(target: string, limit = 50): Promise<{ original: string; timestamp: string }[]> {
  // Normalize: if it's a bare domain, search http(s)://<domain>/*
  const isUrl = /^https?:\/\//i.test(target);
  const query = isUrl ? target : `http://${target}/*`;
  const url = new URL("https://web.archive.org/cdx/search/cdx");
  url.searchParams.set("url", query);
  url.searchParams.set("output", "json");
  url.searchParams.set("fl", "timestamp,original");
  url.searchParams.set("filter", "statuscode:200");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("collapse", "digest"); // dedupe identical captures

  const { body, statusCode } = await request(url);
  if (statusCode >= 400) return [];
  const json = await body.json().catch(() => null);
  if (!Array.isArray(json) || json.length === 0) return [];

  // first row is headers; skip it if present
  const rows = (Array.isArray(json[0]) && json[0][0] === "timestamp") ? json.slice(1) : json;
  return rows
    .map((r: any[]) => ({ timestamp: String(r[0] ?? ""), original: String(r[1] ?? "") }))
    .filter(r => r.timestamp && r.original);
}

async function fetchArchived(original: string, timestamp: string): Promise<string | null> {
  // e.g. https://web.archive.org/web/20220101000000if_/http://example.com/page.txt
  const url = `https://web.archive.org/web/${timestamp}if_/${original}`;
  const { body, statusCode } = await request(url);
  if (statusCode >= 400) return null;
  return body.text();
}

export const wayback = {
  name: "wayback",

  async *fetch({ scope, ctx }: { scope: AnyScope; ctx?: any }): AsyncGenerator<ArtifactYield> {
    const targets = normalizeTargets(scope);
    if (!targets.length) {
      safeLog(ctx, "No Wayback targets found under scope.targets or scope.wayback.targets. Skipping.");
      return;
    }

    // politeness caps
    const perTarget = ctx?.dryRun ? 20 : 120;

    for (const t of targets) {
      safeLog(ctx, `Listing captures for ${t}`);
      let caps: { original: string; timestamp: string }[] = [];
      try {
        caps = await listCaptures(t, perTarget);
      } catch (e: any) {
        safeLog(ctx, `CDX query failed for ${t}: ${e?.message ?? e}`);
        continue;
      }
      if (!caps.length) {
        safeLog(ctx, `No captures for ${t}`);
        continue;
      }

      // Prefer newer captures first
      const pick = caps.slice(-perTarget);

      for (const c of pick) {
        const content = await fetchArchived(c.original, c.timestamp).catch(() => null);
        if (!content) continue;

        yield {
          id: `wayback:${c.timestamp}:${c.original}`,
          artifact: `https://web.archive.org/web/${c.timestamp}/${c.original}`,
          blob: content,
          meta: { original: c.original, timestamp: c.timestamp, source: "wayback" },
        };
      }
    }
  },
};

export default wayback;
