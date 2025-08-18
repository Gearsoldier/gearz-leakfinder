// engine/ai/summarize.ts
import { request } from "undici";
import { Finding } from "../types";

export type AIProvider = "huggingface";
export interface SummarizeOpts {
  provider?: AIProvider;                 // "huggingface"
  modelId?: string;                      // default: openchat/openchat_3.5
  hfToken?: string;                      // defaults to process.env.HF_TOKEN
  maxNewTokens?: number;                 // default 700
  temperature?: number;                  // default 0.3
}

/**
 * Builds a safe prompt using ONLY masked previews and metadata.
 * We never send raw secret values; engine already redacts, but we double down here.
 */
function buildPrompt(findings: Finding[]) {
  const bullets = findings.map(f =>
    `- [${f.severity.toUpperCase()} | score=${f.score.toFixed(2)}] ${f.secretType} @ ${f.artifact}
  preview: ${f.preview}
  context: ${f.meta ? JSON.stringify(f.meta).slice(0, 240) : "n/a"}`
  ).join("\n");

  // OpenChat was trained with role tags; this “User/Assistant” style works well.
  return `User:
You are a senior application security analyst. You will analyze discovered credential leaks and produce a thorough, actionable report.

INPUT FINDINGS (masked previews only; never reveal full secrets):
${bullets}

TASK:
1) Executive summary (2–5 bullets) of the most dangerous leaks and why.
2) Technical impact & likely kill chain (step-by-step): how an attacker would leverage these items.
3) Severity table: Critical / High / Medium / Low with brief justification.
4) Dedupe/cluster: group obviously-same secrets across sources into one incident.
5) Immediate actions: revoke/rotate secrets, containment, detection & forensics steps, and long-term prevention.
6) NEVER print full secrets; use masked previews exactly as provided.
7) Keep it structured and concise but detailed; prioritize clarity for security teams.

Assistant:`;
}

export async function summarizeWithHF(
  findings: Finding[],
  opts: SummarizeOpts = {}
): Promise<string> {
  const provider = opts.provider ?? "huggingface";
  if (provider !== "huggingface") throw new Error("Only 'huggingface' provider is supported in this build.");

  const modelId = opts.modelId ?? "openchat/openchat_3.5";
  const hfToken = opts.hfToken ?? process.env.HF_TOKEN;
  if (!hfToken) throw new Error("HF_TOKEN is required to call Hugging Face Inference API.");

  const prompt = buildPrompt(findings);
  const body = {
    inputs: prompt,
    parameters: {
      max_new_tokens: opts.maxNewTokens ?? 700,
      temperature: opts.temperature ?? 0.3,
      top_p: 0.9,
      repetition_penalty: 1.05,
      return_full_text: false
    },
    options: {
      wait_for_model: true,
      use_cache: true
    }
  };

  const res = await request(`https://api-inference.huggingface.co/models/${modelId}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${hfToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const text = await res.body.text();
  // HF responses can be either a string or an array of objects with "generated_text".
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed[0]?.generated_text) {
      return String(parsed[0].generated_text).trim();
    }
    if (typeof parsed === "object" && parsed?.error) {
      throw new Error(parsed.error);
    }
  } catch {
    // fallthrough if not JSON (some deployments return raw text)
  }
  return text.trim();
}
