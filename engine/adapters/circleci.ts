// engine/adapters/circleci.ts
import { Adapter } from "../types";
import { request } from "undici";

export const circleci: Adapter = {
  name: "circleci",
  async *fetch({ scope }) {
    const urls = scope.ci?.circleci_artifact_urls ?? [];
    for (const u of urls) {
      try {
        const txt = await (await request(u)).body.text();
        if (txt.trim()) yield { id: u, artifact: u, blob: txt, meta: { artifact: true } };
      } catch {}
    }
  }
};
