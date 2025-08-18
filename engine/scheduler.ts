// engine/scheduler.ts
import pLimit from "p-limit";

export interface Task<T> { prio: number; run: () => Promise<T>; }

export async function runPriority<T>(tasks: Task<T>[], concurrency = 4): Promise<T[]> {
  const limit = pLimit(concurrency);
  const sorted = tasks.sort((a, b) => b.prio - a.prio);
  return Promise.all(sorted.map(t => limit(t.run)));
}
