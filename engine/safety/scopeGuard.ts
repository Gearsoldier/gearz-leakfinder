// engine/safety/scopeGuard.ts
// Flexible, program-agnostic scoping.
// Works with either a global scope object that contains per-adapter sections
//   { github: { targets: [...] }, dockerhub: { targets: [...] }, ... }
// or a legacy flat scope
//   { targets: [...] }
//
// Exported API matches engine/index.ts usage: inScope(item, scope).

type AnyScope = Record<string, any>;

function collectTargets(scope: AnyScope | undefined): string[] {
  if (!scope || typeof scope !== "object") return [];

  // 1) Legacy local shape
  const legacy = Array.isArray((scope as any).targets) ? (scope as any).targets : [];

  // 2) Aggregate all per-adapter targets
  const aggregated: string[] = [];
  for (const [k, v] of Object.entries(scope)) {
    if (!v || typeof v !== "object") continue;
    const t = (v as any).targets;
    if (Array.isArray(t)) aggregated.push(...t);
  }

  // Normalize to strings, unique, non-empty
  const out = new Set<string>();
  for (const val of [...legacy, ...aggregated]) {
    if (val == null) continue;
    if (typeof val === "string") {
      const s = val.trim();
      if (s) out.add(s);
      continue;
    }
    if (typeof val === "object") {
      // Support shapes like { org: "acme" }, { owner: "acme" }, { repo: "acme/app" }, { url: "https://..." }
      const s =
        val.url ?? val.org ?? val.owner ?? val.repo ?? val.name ?? "";
      if (typeof s === "string" && s.trim()) out.add(s.trim());
    }
  }
  return Array.from(out);
}

function haystackForItem(item: any): string {
  // Gather as many identifying strings as possible from the artifact
  const parts: string[] = [];
  const push = (x: any) => {
    if (x == null) return;
    const s = String(x).trim();
    if (s) parts.push(s);
  };

  push(item.id);
  push(item.artifact);
  push(item.url);
  push(item.source);

  // Common meta fields adapters tend to set
  const m = item.meta || {};
  push(m.owner);
  push(m.repo);
  push(m.org);
  push(m.project);
  push(m.path);
  push(m.branch);
  push(m.host);
  push(m.domain);

  // Fallback: include a tiny slice of blob to help simple host/repo matches
  if (typeof item.blob === "string" && item.blob.length) {
    push(item.blob.slice(0, 512)); // keep it small; we only need hostnames/paths
  }

  return parts.join(" | ").toLowerCase();
}

/**
 * Returns true iff the artifact is within scope.
 * If the scope has NO targets at all, we default to false (safer).
 * Matching rule: case-insensitive substring match against common artifact/meta fields.
 */
export function inScope(item: any, scope: AnyScope | undefined): boolean {
  const targets = collectTargets(scope);
  if (targets.length === 0) {
    // Strict-by-default: no declared targets => out of scope
    return false;
  }

  const hay = haystackForItem(item);
  for (const tRaw of targets) {
    const t = String(tRaw).toLowerCase().trim();
    if (!t) continue;

    // Allow a few common normalizations
    // Example: "https://github.com/acme/app" -> "github.com/acme/app"
    const tNorm = t.replace(/^https?:\/\//, "");

    if (hay.includes(tNorm) || hay.includes(t)) {
      return true;
    }
  }
  return false;
}

