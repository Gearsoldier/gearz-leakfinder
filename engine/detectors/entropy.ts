// engine/detectors/entropy.ts
export function shannonEntropy(s: string): number {
  const freq: Record<string, number> = {};
  for (const c of s) freq[c] = (freq[c] ?? 0) + 1;
  const len = s.length || 1;
  return Object.values(freq).reduce((h, f) => h - (f/len) * Math.log2(f/len), 0);
}
