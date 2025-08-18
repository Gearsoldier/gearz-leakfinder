// engine/types.ts
export type Severity = "low" | "medium" | "high" | "critical";

export interface ScopeDomain { domain: string; allow_subdomains?: boolean }

export interface Scope {
  targets: (ScopeDomain | { org: string })[];
  risk_acceptance?: boolean;
  telemetry?: {
    sentry_shared?: string[];        // public Sentry shared links
    crashlytics_shared?: string[];   // public crash dumps/URLs
  };
  ci?: {
    jenkins_bases?: string[];        // public Jenkins bases
    jenkins_console_urls?: string[]; // direct consoleText URLs
    circleci_artifact_urls?: string[]; // public CircleCI artifact URLs
  };
  artifacts?: {
    apk?: string[];                  // absolute paths
    ipa?: string[];                  // absolute paths
  };
}

export interface Finding {
  id: string;
  source: string;           // adapter name
  artifact: string;         // URL or identifier
  secretType: string;
  score: number;            // 0..1
  severity: Severity;
  preview: string;          // redacted
  evidence: { match: string; before?: string; after?: string };
  meta?: Record<string, any>;
  ts: string;
}

export interface AdapterInput { scope: Scope; riskAccepted: boolean; cacheDir: string; }
export interface Adapter {
  name: string;
  fetch: (input: AdapterInput) => AsyncGenerator<{ id: string; artifact: string; blob: string; meta?: any }>;
}

export interface Rule {
  name: string;
  severity: Severity;
  regex: string;           // string form, compiled at load
  flags?: string;          // e.g. "gi"
  context?: string[];      // words that upscore if nearby (future)
  minEntropy?: number;     // e.g. 3.5
  validators?: string[];   // e.g. ["aws_secret_len","jwt_format"]
}

export interface RulePack { rules: Rule[]; version: string; signedBy?: string; }
