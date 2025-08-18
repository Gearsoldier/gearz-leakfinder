// app/api/scope/route.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { NextResponse } from 'next/server';

const SCOPE_PATH = path.join(process.cwd(), 'scope.yaml');

function ensureTargetsArray(x: any): string[] {
  if (!x) return [];
  if (Array.isArray(x)) return x.map(String).map(s => s.trim()).filter(Boolean);
  if (Array.isArray(x?.targets)) return x.targets.map(String).map(s => s.trim()).filter(Boolean);
  return [];
}

export async function GET() {
  try {
    const buf = await fs.readFile(SCOPE_PATH, 'utf-8');
    // Return parsed YAML as JSON
    const parsed = YAML.parse(buf) || {};
    return NextResponse.json(parsed, { status: 200 });
  } catch (e: any) {
    // If file doesn't exist, return an empty shape the panel understands
    const empty = {
      github: { targets: [] },
      dockerhub: { targets: [] },
      npm: { targets: [] },
      pypi: { targets: [] },
      wayback: { targets: [] },
      cicd: { targets: [] },
      artifacts: { targets: [] },
      apk: { targets: [] },
      ipa: { targets: [] },
    };
    return NextResponse.json(empty, { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // Normalize/validate
    const scope = {
      github: { targets: ensureTargetsArray(body?.github?.targets) },
      dockerhub: { targets: ensureTargetsArray(body?.dockerhub?.targets) },
      npm: { targets: ensureTargetsArray(body?.npm?.targets) },
      pypi: { targets: ensureTargetsArray(body?.pypi?.targets) },
      wayback: { targets: ensureTargetsArray(body?.wayback?.targets) },
      cicd: { targets: ensureTargetsArray(body?.cicd?.targets) },
      artifacts: { targets: ensureTargetsArray(body?.artifacts?.targets) },
      apk: { targets: ensureTargetsArray(body?.apk?.targets) },
      ipa: { targets: ensureTargetsArray(body?.ipa?.targets) },
    };

    const yaml = YAML.stringify(scope);
    await fs.writeFile(SCOPE_PATH, yaml, 'utf-8');

    return NextResponse.json({ ok: true, path: 'scope.yaml' }, { status: 200 });
  } catch (e: any) {
    return new NextResponse(`Error saving scope: ${e?.message || e}`, { status: 500 });
  }
}
