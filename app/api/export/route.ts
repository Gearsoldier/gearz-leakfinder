// app/api/export/route.ts
import { NextResponse } from 'next/server';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import archiver from 'archiver';

const OUT_DIR = path.join(process.cwd(), 'data', 'out');

export async function GET() {
  try {
    // Verify directory exists
    await fsp.mkdir(OUT_DIR, { recursive: true });

    // Create a PassThrough stream to pipe archiver into Response
    const { PassThrough } = await import('node:stream');
    const pass = new PassThrough();

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      pass.destroy(err);
    });

    // Add the main files if present
    const files = [
      'findings.jsonl',
      'findings.sarif.json',
      'summary.md',
      'audit.merkle.json',
      'drift.csv', // if present
      'delta.json', // if present
    ];
    for (const f of files) {
      const p = path.join(OUT_DIR, f);
      if (fs.existsSync(p)) archive.file(p, { name: f });
    }

    // Include entire compliance pack directory if present
    const compDir = path.join(OUT_DIR, 'compliance');
    if (fs.existsSync(compDir)) {
      archive.directory(compDir, 'compliance');
    }

    archive.finalize().catch(() => { /* handled by error event */ });
    archive.pipe(pass);

    return new NextResponse(pass as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="leakfinder-export-pack.zip"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e: any) {
    return new NextResponse(`Export failed: ${e?.message || e}`, { status: 500 });
  }
}
