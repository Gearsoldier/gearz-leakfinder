// engine/adapters/sentry.ts
import { Adapter } from "../types";
import { request } from "undici";

export const sentry: Adapter = {
  name: "sentry",
  async *fetch({ scope }) {
    const links = scope.telemetry?.sentry_shared ?? [];
    for (const url of links) {
      try {
        const res = await request(url);
        const txt = await res.body.text();
        yield { id: url, artifact: url, blob: txt, meta: { kind: "sentry" } };
      } catch {/* ignore */}
    }
  }
};
