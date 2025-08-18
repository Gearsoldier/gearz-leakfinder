// engine/adapters/github.ts
// Generic, async-iterable GitHub adapter for LeakFinder.
// Yields artifacts (file blobs) for the core pipeline to scan.
// Targets can come from:
//   - local:  scope.targets = ["owner", "owner/repo", "https://github.com/owner/repo", ...]
//   - global: scope.github.targets = same as above

import { request } from "undici";

type AnyScope =
  | { targets?: (string | { owner?: string; repo?: string })[]; github?: never }
  | { github?: { targets?: (string | { owner?: string; repo?: string })[] }; targets?: never }
  | Record<string, unknown>; // accept global scope object too

type ArtifactYield = {
  id: string;           // unique id for the artifact
  artifact: string;     // canonical URL for the artifact
  blob: string;         // content to scan
  meta?: Record<string, any>;
};

function safeLog(ctx: any, msg: string) {
  (ctx?.log || console.log)(`[github] ${msg}`);
}

function normalizeTargets(scope: AnyScope): { owner: string; repo?: string }[] {
  const raw =
    Array.isArray((scope as any)?.targets)
      ? (scope as any).targets
      : Array.isArray((scope as any)?.github?.targets)
      ? (scope as any).github.targets
      : [];

  const out: { owner: string; repo?: string }[] = [];
  for (const t of raw) {
    if (!t) continue;

    if (typeof t === "object") {
      const owner = String((t as any).owner || "").trim();
      const repo  = (t as any).repo ? String((t as any).repo).trim() : undefined;
      if (owner) out.push({ owner, repo });
      continue;
    }

    const s = String(t).trim();

    // URL: https://github.com/owner[/repo]
    const mUrl = s.match(/github\.com\/([^\/\s]+)(?:\/([^\/\s#?]+))?/i);
    if (mUrl) {
      const owner = mUrl[1];
      const repo  = mUrl[2];
      if (owner && repo) out.push({ owner, repo });
      else if (owner)   out.push({ owner });
      continue;
    }

    // owner/repo
    const mPair = s.match(/^([^\/\s]+)\/([^\/\s]+)$/);
    if (mPair) {
      out.push({ owner: mPair[1], repo: mPair[2] });
      continue;
    }

    // owner only
    out.push({ owner: s });
  }

  // de-dup
  const key = (x: { owner: string; repo?: string }) => `${x.owner}///${x.repo || ""}`.toLowerCase();
  const seen = new Set<string>();
  return out.filter(v => (seen.has(key(v)) ? false : (seen.add(key(v)), true)));
}

async function gh<T>(path: string, token?: string, query?: Record<string, any>): Promise<T> {
  const url = new URL(`https://api.github.com${path}`);
  if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const headers: Record<string, string> = {
    "User-Agent": "GEARZ-LeakFinder",
    "Accept": "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const { body, statusCode } = await request(url, { headers });
  if (statusCode >= 400) {
    const txt = await body.text();
    throw new Error(`GitHub API ${statusCode}: ${txt}`);
  }
  return body.json() as Promise<T>;
}

async function listRepos(owner: string, token?: string) {
  // Use /users/{owner}/repos so it works for orgs AND users
  let page = 1;
  const repos: { name: string; full_name: string; default_branch?: string }[] = [];
  while (true) {
    const batch = await gh<any[]>(`/users/${owner}/repos`, token, { per_page: 100, page, type: "public", sort: "updated" });
    if (!batch.length) break;
    repos.push(...batch);
    page++;
    if (page > 10) break; // politeness cap
  }
  return repos;
}

async function listTree(owner: string, repo: string, ref: string | undefined, token?: string) {
  const sha = ref ?? "main";
  try {
    const tree = await gh<{ tree: { path: string; type: "blob" | "tree" }[] }>(
      `/repos/${owner}/${repo}/git/trees/${sha}`,
      token,
      { recursive: "1" }
    );
    return tree.tree.filter(t => t.type === "blob").map(t => t.path);
  } catch {
    return [];
  }
}

async function fetchRaw(owner: string, repo: string, p: string, ref: string | undefined, token?: string) {
  const url = new URL(`https://raw.githubusercontent.com/${owner}/${repo}/${ref ?? "main"}/${p}`);
  const headers: Record<string, string> = { "User-Agent": "GEARZ-LeakFinder" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const { body, statusCode } = await request(url, { headers });
  if (statusCode >= 400) return null;
  return body.text();
}

export const github = {
  name: "github",

  // IMPORTANT: async generator (async iterable)
  async *fetch({ scope, ctx }: { scope: AnyScope; ctx?: any }): AsyncGenerator<ArtifactYield> {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
    const targets = normalizeTargets(scope);
    if (!targets.length) {
      safeLog(ctx, "No GitHub targets found under scope.targets or scope.github.targets. Skipping.");
      return;
    }
    if (!token) safeLog(ctx, "No GITHUB_TOKEN provided; API will be rate-limited (partial results possible).");

    for (const t of targets) {
      if (t.repo) {
        // Single repo
        const owner = t.owner;
        const repo  = t.repo;
        const branch = "main"; // good default; tree API will fail quietly if different
        safeLog(ctx, `Scanning repo ${owner}/${repo}`);

        const files = await listTree(owner, repo, branch, token);
        const sample = files
          .filter(p =>
            /\.(env|ya?ml|json|js|ts|tsx|py|rb|go|java|swift|gradle|ini|cfg|toml|properties|conf|sh|txt)$/i.test(p)
          )
          .slice(0, ctx?.dryRun ? 120 : 600);

        for (const p of sample) {
          const content = await fetchRaw(owner, repo, p, branch, token);
          if (content == null) continue;

          yield {
            id: `github:${owner}/${repo}:${branch}:${p}`,
            artifact: `https://github.com/${owner}/${repo}/blob/${branch}/${p}`,
            blob: content,
            meta: { owner, repo, branch, path: p },
          };
        }
      } else {
        // Owner/org: enumerate repos
        const owner = t.owner;
        safeLog(ctx, `Enumerating repos for ${owner}`);
        let repos: { name: string; full_name: string; default_branch?: string }[] = [];
        try {
          repos = await listRepos(owner, token);
        } catch (e: any) {
          safeLog(ctx, `listRepos failed for ${owner}: ${e?.message ?? e}`);
          continue;
        }

        const cap = ctx?.dryRun ? 8 : 40;
        for (const r of repos.slice(0, cap)) {
          const [o, repo] = r.full_name.split("/");
          const branch = r.default_branch ?? "main";
          safeLog(ctx, `Scanning ${r.full_name}@${branch}`);

          const files = await listTree(o, repo, branch, token);
          const sample = files
            .filter(p =>
              /\.(env|ya?ml|json|js|ts|tsx|py|rb|go|java|swift|gradle|ini|cfg|toml|properties|conf|sh|txt)$/i.test(p)
            )
            .slice(0, ctx?.dryRun ? 120 : 600);

          for (const p of sample) {
            const content = await fetchRaw(o, repo, p, branch, token);
            if (content == null) continue;

            yield {
              id: `github:${o}/${repo}:${branch}:${p}`,
              artifact: `https://github.com/${o}/${repo}/blob/${branch}/${p}`,
              blob: content,
              meta: { owner: o, repo, branch, path: p },
            };
          }
        }
      }
    }
  },
};

export default github;
