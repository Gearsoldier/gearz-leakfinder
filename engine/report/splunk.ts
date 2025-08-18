// engine/report/splunk.ts
import fs from "node:fs";
import { request } from "undici";

export async function pushToSplunk(hecUrl: string, token: string, file: string) {
  const lines = fs.readFileSync(file, "utf-8").trim().split("\n").filter(Boolean);
  for (const l of lines) {
    const payload = { event: JSON.parse(l) };
    await request(hecUrl, {
      method: "POST",
      headers: { "Authorization": `Splunk ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => null);
  }
}
