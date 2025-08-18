// engine/index.ts
import { Adapter, AdapterInput, Finding, RulePack, Scope } from "./types";
import { runRegex } from "./detectors/regex";
import { shannonEntropy } from "./detectors/entropy";
import { awsSecretLen as vAws, jwtFormat as vJwt, timeDecay } from "./detectors/validators";
import { redact } from "./safety/redact";
import { inScope } from "./safety/scopeGuard";
import { appendAuditLine } from "./safety/merkleAudit";
import { loadRulePacks } from "./ruleLoader";
import { writeJSONL } from "./report/jsonl";
import { writeSarif } from "./report/sarif";
import { loadIgnore, shouldIgnore } from "./ignore";
import { ScanCache } from "./cache/sqlite";
import { FingerprintBloom } from "./cache/bloom";
import { runPriority } from "./scheduler";
import { createHash } from "node:crypto";

function validate(name: string, match: string): boolean {
  switch (name) {
    case "aws_secret_len": return vAws(match);
    case "jwt_format":     return vJwt(match);
    default:               return true;
  }
}

export async function scan(adapters: Adapter[], scope: Scope, outDir: string, opts: { riskAccepted?: boolean; cacheDir?: string; concurrency?: number } = {}) {
  const pack: RulePack = loadRulePacks();
  const riskAccepted = !!opts.riskAccepted;
  const cacheDir = opts.cacheDir ?? ".cache";
  const concurrency = opts.concurrency ?? 6;

  const cache = new ScanCache(cacheDir);
  const bloom = new FingerprintBloom();
  const ignore = loadIgnore();

  const input: AdapterInput = { scope, riskAccepted, cacheDir };
  const findings: Finding[] = [];

  // Priority: APK/IPA, DockerHub, Wayback, CI, registries
  const prio = (name: string) =>
    name.includes("apk") || name.includes("ipa") ? 5 :
    name.includes("docker") ? 4 :
    name.includes("wayback") ? 3 :
    name.includes("jenkins") || name.includes("circleci") ? 3 :
    2;

  const tasks = adapters.map(a => ({
    prio: prio(a.name),
    run: async () => {
      for await (const item of a.fetch(input)) {
        if (!inScope(item.artifact, scope)) continue;
        if (cache.seen(a.name, item.artifact)) continue;
        cache.record(a.name, item.artifact);

        for (const hit of runRegex(item.blob, pack.rules)) {
          const ent = shannonEntropy(hit.match);
          const entScore = Math.min(1, Math.max(0, (ent - 3) / 2));
          const valid = (hit.rule.validators ?? []).every(v => validate(v, hit.match));
          const ageScore = item.meta?.tsEpoch ? timeDecay(item.meta.tsEpoch) : 1.0;
          const score = (valid ? 0.6 : 0.3) * 0.6 + entScore * 0.3 + ageScore * 0.1;

          const fp = createHash("sha256").update(`${a.name}|${item.artifact}|${hit.rule.name}|${hit.match}`).digest("hex");
          if (bloom.has(fp)) continue; // dedup across sources
          bloom.add(fp);

          if (shouldIgnore({ artifact: item.artifact, secretType: hit.rule.name, match: hit.match }, ignore)) continue;

          const f: Finding = {
            id: `${a.name}:${item.id}:${hit.rule.name}:${hit.match.slice(0,12)}`,
            source: a.name,
            artifact: item.artifact,
            secretType: hit.rule.name,
            score,
            severity: hit.rule.severity,
            preview: redact(hit.match),
            evidence: { match: hit.match, before: hit.before, after: hit.after },
            meta: item.meta,
            ts: new Date().toISOString()
          };
          appendAuditLine(outDir, { adapter: a.name, artifact: item.artifact, rule: hit.rule.name, preview: f.preview });
          findings.push(f);
        }
      }
    }
  }));

  await runPriority(tasks, concurrency);

  writeJSONL(findings, outDir);
  writeSarif(findings, outDir);
  return findings;
}
