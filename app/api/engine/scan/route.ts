// app/api/engine/scan/route.ts
import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { TextEncoder } from 'node:util';

function tsxPath() {
  return path.join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
}
function cliPath() {
  return path.join(process.cwd(), 'engine', 'cli.ts');
}

function buildArgs(params: URLSearchParams) {
  const adapters = params.get('adapters') || 'github,wayback,dockerhub,npm,pypi,cicd';
  const scope = params.get('scope') || './scope.yaml';
  const ai = params.get('ai') || 'openchat';
  const risk = params.get('risk') === 'false' ? false : true;
  const redact = params.get('redact') === 'false' ? false : true;
  const dryRun = params.get('dryRun') === 'true';
  const concurrency = params.get('concurrency') || '6';

  const args = [
    cliPath(),
    'scan',
    '--adapters', adapters,
    '--scope', scope,
    '--ai', ai,
    '--concurrency', concurrency,
  ];
  if (risk) args.push('--i-accept-risk');
  if (redact) args.push('--redact');
  if (dryRun) args.push('--dry-run');

  return { args, summary: { adapters, scope, ai, risk, redact, dryRun, concurrency } };
}

export async function GET(req: Request) {
  // SSE streaming run
  const { searchParams } = new URL(req.url);
  const { args, summary } = buildArgs(searchParams);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Kickoff message
      send('start', summary);

      const child = spawn(tsxPath(), args, {
        cwd: process.cwd(),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      child.stdout.on('data', (d) => send('log', d.toString()));
      child.stderr.on('data', (d) => send('log', d.toString()));

      child.on('close', (code) => {
        // Conventionally, outputs go to ./data/out (cli.ts default)
        send('done', { code, outDir: path.join('data', 'out') });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // nginx proxies
    },
  });
}

function runOnce(args: string[]) {
  return new Promise<{ code: number; logs: string }>((resolve) => {
    const child = spawn(tsxPath(), args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let logs = '';
    child.stdout.on('data', (d) => (logs += d.toString()));
    child.stderr.on('data', (d) => (logs += d.toString()));
    child.on('close', (code) => resolve({ code: code ?? 0, logs }));
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const params = new URLSearchParams();
    if (body.adapters) params.set('adapters', String(body.adapters));
    if (body.scope) params.set('scope', String(body.scope));
    if (body.ai) params.set('ai', String(body.ai));
    if (body.risk !== undefined) params.set('risk', String(body.risk));
    if (body.redact !== undefined) params.set('redact', String(body.redact));
    if (body.dryRun !== undefined) params.set('dryRun', String(body.dryRun));
    if (body.concurrency) params.set('concurrency', String(body.concurrency));

    const { args } = buildArgs(params);
    const { code, logs } = await runOnce(args);

    return NextResponse.json({
      ok: code === 0,
      code,
      outDir: path.join('data', 'out'),
      logs,
    });
  } catch (e: any) {
    return new NextResponse(String(e?.message || e), { status: 500 });
  }
}
