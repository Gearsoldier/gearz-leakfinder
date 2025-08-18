#!/usr/bin/env node
// engine/cli.ts
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { scan } from "./index";
import { Scope } from "./types";

// ---- Built-in adapters you already had ----
import { wayback } from "./adapters/wayback";
import { dockerhub } from "./adapters/dockerhub";
import { npmAdapter } from "./adapters/npm";
import { pypi } from "./adapters/pypi";
import { dnsAxfr } from "./adapters/dns";
import { sentry } from "./adapters/sentry";
import { crashlytics } from "./adapters/crashlytics";
import { jenkins } from "./adapters/jenkins";
import { circleci } from "./adapters/circleci";
import { apkAdapter } from "./adapters/apk";
import { ipaAdapter } from "./adapters/ipa";

// ---- Reporting / extras you already had ----
import { computeDelta } from "./report/delta";
import { writeDriftTimeline } from "./report/drift";
import { pushToSplunk } from "./report/splunk";
import { writeCompliancePack } from "./report/compliance";
import { merkleSeal } from "./safety/merkleAudit";
import { summarizeWithHF } from "./ai/summarize";

// ---------- Helpers ----------
function usage() {
  console.log(`Usage:
  npm run scan -- scan --adapters a,b,c --scope ./scope.yaml --out ./data/out [--i-accept-risk] [--ai openchat] [--ai-model openchat/openchat_3.5] [--concurrency 6]
  npm run delta -- --prev ./data/prev/findings.jsonl --curr ./data/out/findings.jsonl --out ./data/out
  npm run siem-splunk -- --url <HEC_URL> --token <HEC_TOKEN> --file ./data/out/findings.jsonl
  npm run export:compliance
`);
}

// HF token runtime check (kept exactly as your original contract)
function checkHFToken() {
  const tok = process.env.HF_TOKEN;
  if (!tok) {
    console.warn("⚠️  HF_TOKEN is not set. Hugging Face AI enrichment will be disabled.");
    return false;
  }
  if (!tok.startsWith("hf_")) {
    console.warn("⚠️  HF_TOKEN looks malformed. It should start with 'hf_'.");
    return false;
  }
  return true;
}

// Dynamically (safely) load optional adapters without crashing if missing.
// Accepts any of these export names: github/runGithubAdapter/default, cicd/runCiCdAdapter/default.
async function loadOptionalAdapter(modulePath: string, exportNames: string[]) {
  try {
    const m = await import(modulePath);
    for (const k of exportNames) {
      if ((m as any)?.[k]) return (m as any)[k];
    }
    return null;
  } catch {
    return null;
  }
}

// Build the adapter registry at runtime so we can include optional ones (github/cicd) if present.
// If a custom cicd adapter isn’t present, we alias `cicd` → existing `circleci` for compatibility.
async function buildAdapters(): Promise<Record<string, any>> {
  const registry: Record<string, any> = {
    wayback,
    dockerhub,
    npm: npmAdapter,
    pypi,
    "dns-axfr": dnsAxfr,
    sentry,
    crashlytics,
    jenkins,
    circleci,
    apk: apkAdapter,
    ipa: ipaAdapter,
  };

  const githubOpt = await loadOptionalAdapter("./adapters/github", [
    "github",
    "runGithubAdapter",
    "default",
  ]);
  if (githubOpt) registry.github = githubOpt;

  const cicdOpt = await loadOptionalAdapter("./adapters/cicd", [
    "cicd",
    "runCiCdAdapter",
    "default",
  ]);
  if (cicdOpt) {
    registry.cicd = cicdOpt;
  } else {
    // convenience alias so `--adapters cicd` still works by using your existing circleci adapter
    registry.cicd = circleci;
  }

  return registry;
}

// ---------- Commands ----------
async function cmdScan(args: string[]) {
  const get = (k: string) => {
    const i = args.indexOf(`--${k}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const has = (k: string) => args.includes(`--${k}`);

  const list = (get("adapters") ?? "wayback")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const scopePath = get("scope") ?? "./scope.yaml";
  const outDir = get("out") ?? "./data/out";
  const riskAccepted = has("i-accept-risk");
  const concurrency = +(get("concurrency") ?? "6");

  const ai = get("ai"); // e.g. "openchat"
  const aiModel = get("ai-model") ?? "openchat/openchat_3.5";

  // Parse YAML scope (same behavior as original)
  const scope = YAML.parse(fs.readFileSync(scopePath, "utf-8")) as Scope;

  // Build adapter registry and resolve selected adapters.
  const ADAPTERS = await buildAdapters();

  const selected: any[] = [];
  const skipped: string[] = [];
  for (const n of list) {
    const a = ADAPTERS[n];
    if (!a) {
      skipped.push(n);
      continue;
    }
    selected.push(a);
  }
  if (skipped.length) {
    console.warn(`⚠️  Skipping unknown adapters: ${skipped.join(", ")}`);
  }
  if (!selected.length) {
    throw new Error("No valid adapters selected. Check your --adapters list.");
  }

  console.log(`▶ Running adapters: ${list.join(", ")} | out=${outDir}`);
  const findings = await scan(selected, scope, outDir, { riskAccepted, concurrency });
  console.log(`✅ Findings: ${findings.length}`);
  console.log(
    `↳ JSONL: ${path.join(outDir, "findings.jsonl")} | SARIF: ${path.join(
      outDir,
      "findings.sarif.json"
    )}`
  );
  const root = merkleSeal(outDir);
  if (root) console.log(`🔏 Merkle root sealed: ${root}`);

  if (ai && ai.toLowerCase() === "openchat") {
    if (!checkHFToken()) {
      console.error("❌ Cannot run AI summarization without a valid HF_TOKEN.");
    } else {
      console.log("🧠 Summarizing via Hugging Face (OpenChat 3.5)...");
      const summary = await summarizeWithHF(findings, {
        provider: "huggingface",
        modelId: aiModel,
      });
      const file = path.join(outDir, "summary.md");
      fs.writeFileSync(file, summary + "\n");
      console.log(`📝 Summary written → ${file}`);
    }
  }
}

async function cmdDelta(args: string[]) {
  const get = (k: string) => {
    const i = args.indexOf(`--${k}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const prev = get("prev");
  const curr = get("curr");
  const out = get("out") ?? "./data/out";
  if (!prev || !curr) throw new Error("Missing --prev or --curr");
  const d = computeDelta(prev, curr);
  fs.writeFileSync(path.join(out, "delta.json"), JSON.stringify(d, null, 2));
  const runs = [{ ts: new Date().toISOString(), count: d.new.length + d.still.length }];
  writeDriftTimeline(runs, out);
  console.log(`Δ Delta written: ${path.join(out, "delta.json")} & drift.csv`);
}

async function cmdSplunk(args: string[]) {
  const get = (k: string) => {
    const i = args.indexOf(`--${k}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const url = get("url");
  const token = get("token");
  const file = get("file");
  if (!url || !token || !file) throw new Error("Missing --url or --token or --file");
  await pushToSplunk(url, token, file);
  console.log("📤 Sent to Splunk HEC.");
}

async function cmdCompliance(args: string[]) {
  const get = (k: string) => {
    const i = args.indexOf(`--${k}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const findings = get("findings") ?? "./data/out/findings.jsonl";
  const audit = get("audit") ?? "./data/out/audit.merkle.json";
  const out = get("out") ?? "./data/out/compliance";
  writeCompliancePack(findings, audit, out);
  console.log(`📦 Compliance pack at ${out}`);
}

// ---------- Main ----------
(async function main() {
  const [, , cmd, ...args] = process.argv;
  try {
    if (cmd === "scan") return cmdScan(args);
    if (cmd === "delta") return cmdDelta(args);
    if (cmd === "siem-splunk") return cmdSplunk(args);
    if (cmd === "compliance") return cmdCompliance(args);
    usage();
  } catch (e: any) {
    console.error("Error:", e.message);
    process.exit(1);
  }
})();
