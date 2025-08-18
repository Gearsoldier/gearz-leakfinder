// engine/adapters/jenkins.ts
import { Adapter } from "../types";
import { request } from "undici";

export const jenkins: Adapter = {
  name: "jenkins",
  async *fetch({ scope }) {
    const bases = scope.ci?.jenkins_bases ?? [];
    for (const base of bases) {
      const listing = `${base}/api/json?tree=jobs[name,url]`;
      try {
        const data = await (await request(listing)).body.json() as any;
        const jobs = data?.jobs ?? [];
        for (const j of jobs) {
          const consoleUrl = `${j.url}lastBuild/consoleText`;
          try {
            const txt = await (await request(consoleUrl)).body.text();
            if (txt.trim()) yield { id: consoleUrl, artifact: consoleUrl, blob: txt, meta: { job: j.name } };
          } catch {}
        }
      } catch {}
    }
    const direct = scope.ci?.jenkins_console_urls ?? [];
    for (const u of direct) {
      try {
        const txt = await (await request(u)).body.text();
        if (txt.trim()) yield { id: u, artifact: u, blob: txt, meta: { direct: true } };
      } catch {}
    }
  }
};
