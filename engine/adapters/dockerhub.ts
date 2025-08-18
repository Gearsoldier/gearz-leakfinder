// engine/adapters/dockerhub.ts
import { Adapter } from "../types";
import { request } from "undici";

/** Accepts targets from:
 *  - local:   scope.targets = ["mozilla", { org: "mozilla" }, "https://hub.docker.com/u/mozilla"]
 *  - global:  scope.dockerhub.targets = same as above
 */
function normalizeTargets(scope: any): string[] {
  const raw =
    Array.isArray(scope?.targets)
      ? scope.targets
      : Array.isArray(scope?.dockerhub?.targets)
      ? scope.dockerhub.targets
      : [];

  const out = new Set<string>();
  for (const t of raw) {
    if (!t) continue;

    if (typeof t === "object" && typeof t.org === "string") {
      out.add(t.org.trim());
      continue;
    }

    if (typeof t === "string") {
      const s = t.trim();
      // URL forms like https://hub.docker.com/u/{org} or .../r/{org}
      const m = s.match(/hub\.docker\.com\/(?:u|r)\/([^\/\s]+)/i);
      if (m?.[1]) { out.add(m[1]); continue; }
      // plain org/user
      out.add(s);
    }
  }
  return Array.from(out).filter(Boolean);
}

async function fetchJson(url: string) {
  try {
    const { body, statusCode } = await request(url, {
      headers: { "User-Agent": "GEARZ-LeakFinder" },
    });
    if (statusCode >= 400) return null;
    const txt = await body.text();
    try { return JSON.parse(txt); } catch { return txt as any; }
  } catch {
    return null;
  }
}

export const dockerhub: Adapter = {
  name: "dockerhub",
  async *fetch({ scope }: { scope: any }) {
    const orgs = normalizeTargets(scope);
    if (!orgs.length) return;

    for (const org of orgs) {
      let page = 1;
      const pageSize = 100;
      const maxPages = 5; // politeness cap

      while (page <= maxPages) {
        const listUrl = `https://hub.docker.com/v2/repositories/${encodeURIComponent(org)}/?page_size=${pageSize}&page=${page}`;
        const data = await fetchJson(listUrl);
        if (!data || !Array.isArray((data as any).results) || !(data as any).results.length) break;

        for (const r of (data as any).results) {
          const repoName = r?.name;
          if (!repoName || typeof repoName !== "string") continue;

          const readmeUrl = `https://hub.docker.com/v2/repositories/${encodeURIComponent(org)}/${encodeURIComponent(repoName)}/readme/`;
          let readmeText = "";

          const readmeRes = await fetchJson(readmeUrl);
          if (readmeRes) {
            if (typeof readmeRes === "string") readmeText = readmeRes;
            else if (typeof (readmeRes as any).content === "string") readmeText = (readmeRes as any).content;
          }

          yield {
            id: readmeUrl,
            artifact: readmeUrl,
            blob: readmeText || "",
            meta: { org, repo: repoName, kind: "readme" },
          };
        }

        if (!(data as any).next) break;
        page += 1;
      }
    }
  },
};

export default dockerhub;
