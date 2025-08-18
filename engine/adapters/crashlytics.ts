// engine/adapters/crashlytics.ts
import { Adapter } from "../types";
import { request } from "undici";

export const crashlytics: Adapter = {
  name: "crashlytics",
  async *fetch({ scope }) {
    const links = scope.telemetry?.crashlytics_shared ?? [];
    for (const url of links) {
      try {
        const res = await request(url);
        const txt = await res.body.text();
        yield { id: url, artifact: url, blob: txt, meta: { kind: "crashlytics" } };
      } catch {/* ignore */}
    }
  }
};
