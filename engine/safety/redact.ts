// engine/safety/redact.ts
export function redact(s: string): string {
  if (!s) return "••••";
  if (s.length <= 8) return "••••";
  return s.slice(0, 4) + "…" + s.slice(-4);
}
