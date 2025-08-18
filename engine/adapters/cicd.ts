// engine/adapters/cicd.ts
// Generic CI/CD artifacts/logs adapter.
// Reads explicit URLs from either:
//   - local scope:   { targets: ["https://...", ...], artifacts?: { targets: ["https://..."] } }
//   - global scope:  { cicd: { targets: [...] }, artifacts: { targets: [...] } }
// No vendor hard-codes; you decide what URLs to place in scope.

import { request } from "undici";

type Finding = {
  type: "finding";
  source: "cicd";
  fileUrl: string;
  patternName: string;
  matchedString: string;
  severity: "low" | "medium" | "high" | "critical";
};

type LocalScope = { targets?: string[]; artifacts?: { targets?: string[] } } | undefined;
type GlobalScope = { cicd?: { targets?: string[] }; artifacts?: { targets?: string[] } } | undefined;
type Ctx = { redact?: boolean; dryRun?: boolean; log?: (msg: string) => void } | undefined;

const PATTERNS: { name: string; re: RegExp; sev: Finding["severity"] }[] = [
  { name: "Netlify Token", re: /(?i)\bNETLIFY\w{0,10}(AUTH|TOKEN)\b['":= ]+([A-Za-z0-9\-_]{20,})/g, sev: "critical" },
  { name: "AWS Secret",    re: /(?i)\baws\W{0,20}(secret|access)_?(key|token)\b['":= ]+([A-Za-z0-9\/+=]{32,})/g, sev: "critical" },
  { name: "Generic Bearer",re: /\bBearer\s+[A-Za-z0-9\.\-_]{20,}/g, sev: "high" },
];

function safeLog(ctx: Ctx, msg: string) {
  (ctx?.log || console.log)(`[cicd] ${msg}`);
}

function redact(s: string) {
  if (!s) return s;
  return s.length <= 6 ? "****" : s.slice(0, 3) + "…" + s.slice(-2);
}

function normTargets(scope: LocalScope | GlobalScope): string[] {
  const a = (scope as any);
  const fromLocal  = Array.isArray(a?.targets) ? a.targets : [];
  const fromGlobal = Array.isArray(a?.cicd?.targets) ? a.cicd.targets : [];
  const urls = [...fromLocal, ...fromGlobal].filter(Boolean).map(String);
  // Keep only absolute http(s) URLs (adapter is generic; you decide the endpoints)
  return Array.from(new Set(urls.filter(u => /^https?:\/\//i.test(u))));
}

function normArtifactUrls(scope: LocalScope | GlobalScope): string[] {
  const a = (scope as any);
  const fromLocal  = Array.isArray(a?.artifacts?.targets) ? a.artifacts.targets : [];
  const fromGlobal = Array.isArray(a?.artifacts?.targets) ? a.artifacts.targets : []; // same key on global
  const urls = [...fromLocal, ...fromGlobal].filter(Boolean).map(String);
  return Array.from(new Set(urls.filter(u => /^https?:\/\//i.test(u))));
}

async function fetchText(url: string) {
  try {
    const { body, statusCode } = await request(url, { headers: { "User-Agent": "GEARZ-LeakFinder" } });
    if (statusCode >= 400) return null;
    return body.text();
  } catch {
    return null;
  }
}

export const cicd = {
  name: "cicd",
  async fetch(scope: LocalScope | GlobalScope, ctx?: Ctx): Promise<Finding[]> {
    const urls = Array.from(new Set([...normTargets(scope), ...normArtifactUrls(scope)]));
    if (!urls.length) {
      safeLog(ctx, "No CI/CD artifact/log URLs found under scope.(cicd|artifacts).targets. Skipping.");
      return [];
    }

    const cap = ctx?.dryRun ? 8 : 40;
    const list = urls.slice(0, cap);

    const findings: Finding[] = [];
    for (const url of list) {
      safeLog(ctx, `Fetching: ${url}`);
      const txt = await fetchText(url);
      if (!txt) continue;

      for (const pat of PATTERNS) {
        pat.re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = pat.re.exec(txt))) {
          const match = m[0];
          findings.push({
            type: "finding",
            source: "cicd",
            fileUrl: url,
            patternName: pat.name,
            matchedString: ctx?.redact ? redact(match) : match,
            severity: pat.sev,
          });
        }
      }
    }
    return findings;
  },
};

export default cicd;
