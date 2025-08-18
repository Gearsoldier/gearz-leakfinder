// engine/detectors/validators.ts
import { createHash } from "node:crypto";

export function jwtFormat(s: string): boolean {
  const parts = s.split(".");
  return parts.length === 3 && parts.every(p => /^[A-Za-z0-9_-]+$/.test(p));
}

export function awsSecretLen(s: string): boolean {
  return /[A-Za-z0-9/+]{40}/.test(s);
}

export function luhn(s: string): boolean {
  let sum = 0, alt = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let n = parseInt(s[i], 10); if (Number.isNaN(n)) return false;
    if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt;
  }
  return (sum % 10) === 0;
}

export function hash256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

// Time decay downweights old artifacts (Accuracy++)
export function timeDecay(epochMs: number, now = Date.now()) {
  const years = (now - epochMs) / (1000 * 60 * 60 * 24 * 365);
  if (years > 5) return 0.5;
  if (years > 2) return 0.8;
  return 1.0;
}
