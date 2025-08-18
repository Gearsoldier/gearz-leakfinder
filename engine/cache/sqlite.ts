// engine/cache/sqlite.ts
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export class ScanCache {
  private db: Database.Database;
  constructor(dir: string) {
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "cache.sqlite");
    this.db = new Database(file);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS blobs (
        id TEXT PRIMARY KEY,
        artifact TEXT,
        source TEXT,
        ts INTEGER
      );
    `);
  }
  keyFor(source: string, artifact: string) {
    return createHash("sha256").update(source + "::" + artifact).digest("hex");
  }
  seen(source: string, artifact: string) {
    const id = this.keyFor(source, artifact);
    const row = this.db.prepare("SELECT 1 FROM blobs WHERE id=?").get(id);
    return !!row;
  }
  record(source: string, artifact: string) {
    const id = this.keyFor(source, artifact);
    this.db.prepare("INSERT OR IGNORE INTO blobs (id, artifact, source, ts) VALUES (?,?,?,?)")
      .run(id, artifact, source, Date.now());
  }
}
