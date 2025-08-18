'use client';

import { useEffect, useRef, useState } from 'react';

const ADAPTERS = ['github', 'wayback', 'dockerhub', 'npm', 'pypi', 'cicd'];

export default function ScanPanel() {
  const [selected, setSelected] = useState<string[]>(['github', 'wayback', 'dockerhub', 'npm', 'pypi', 'cicd']);
  const [scope, setScope] = useState('./scope.yaml');
  const [dryRun, setDryRun] = useState(false);
  const [risk, setRisk] = useState(true);
  const [redact, setRedact] = useState(true);
  const [ai, setAi] = useState('openchat');
  const [concurrency, setConcurrency] = useState(6);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState('');
  const [doneInfo, setDoneInfo] = useState<{ code: number; outDir: string } | null>(null);

  const logsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  function toggleAdapter(a: string) {
    setSelected((prev) => (prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]));
  }

  async function runScan() {
    if (!selected.length) return;

    setRunning(true);
    setLogs('');
    setDoneInfo(null);

    const params = new URLSearchParams({
      adapters: selected.join(','),
      scope,
      ai,
      risk: String(risk),
      redact: String(redact),
      dryRun: String(dryRun),
      concurrency: String(concurrency),
    });

    const res = await fetch(`/api/engine/scan?${params.toString()}`, { method: 'GET' });
    if (!res.ok || !res.body) {
      setLogs(`❌ Failed to start scan: ${res.status}`);
      setRunning(false);
      return;
    }

    // Read SSE stream
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      for (const chunk of parts) {
        const lines = chunk.split('\n');
        let event = 'message';
        let data = '';
        for (const line of lines) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (event === 'log') {
          setLogs(prev => prev + data + '\n');
        }
        if (event === 'start') {
          setLogs(prev => prev + `▶ Starting with: ${data}\n`);
        }
        if (event === 'done') {
          try {
            const obj = JSON.parse(data);
            setDoneInfo(obj);
            setLogs(prev => prev + `\n✅ Done (exit ${obj.code}). Out: ${obj.outDir}\n`);
          } catch {
            setLogs(prev => prev + `\n✅ Done.\n`);
          }
        }
      }
    }

    setRunning(false);
  }

  return (
    <div className="w-full max-w-5xl bg-black/60 p-5 rounded-2xl border border-gray-800 shadow-xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Controls */}
        <div className="lg:col-span-1 space-y-4">
          <div>
            <div className="text-sm text-gray-300 mb-1">Adapters</div>
            <div className="grid grid-cols-2 gap-2">
              {ADAPTERS.map(a => (
                <label key={a} className={`text-sm flex items-center gap-2 px-2 py-1 rounded border ${selected.includes(a) ? 'border-orange-600 bg-orange-500/10 text-orange-300' : 'border-gray-800 bg-gray-900/60 text-gray-300'}`}>
                  <input
                    type="checkbox"
                    checked={selected.includes(a)}
                    onChange={() => toggleAdapter(a)}
                  />
                  {a}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-300">Scope file</label>
            <input
              className="w-full rounded bg-gray-900 border border-gray-800 p-2 text-sm"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="./scope.yaml"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={dryRun} onChange={() => setDryRun(v => !v)} />
              Dry run
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={risk} onChange={() => setRisk(v => !v)} />
              Accept risk
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={redact} onChange={() => setRedact(v => !v)} />
              Redact secrets
            </label>
            <div className="flex items-center gap-2 text-sm">
              <span>Concurrency</span>
              <input
                type="number"
                min={1}
                max={16}
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value || 6))}
                className="w-16 rounded bg-gray-900 border border-gray-800 p-1 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm text-gray-300">AI</label>
              <select
                className="w-full rounded bg-gray-900 border border-gray-800 p-2 text-sm"
                value={ai}
                onChange={(e) => setAi(e.target.value)}
              >
                <option value="openchat">OpenChat 3.5 (HF)</option>
                {/* Add more later */}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={runScan}
              disabled={running}
              className="inline-flex items-center justify-center bg-orange-600 hover:bg-orange-500 disabled:opacity-60 transition rounded-lg px-4 py-2.5 font-semibold"
            >
              {running ? 'Running…' : 'Run scan + AI summary'}
            </button>

            {doneInfo && (
              <a
                href="/api/export"
                className="inline-flex items-center justify-center bg-gray-800 hover:bg-gray-700 transition rounded-lg px-4 py-2.5 text-sm border border-gray-700"
              >
                Download Export Pack
              </a>
            )}
          </div>
        </div>

        {/* Live Logs */}
        <div className="lg:col-span-2">
          <div className="text-sm text-gray-300 mb-1">Live Logs</div>
          <div
            ref={logsRef}
            className="h-[360px] rounded border border-gray-800 bg-black/60 p-3 overflow-auto font-mono text-xs whitespace-pre-wrap"
          >
            {logs || 'Logs will appear here…'}
          </div>

          {/* Tutor Mode — inline explainers for newcomers */}
          <details className="mt-3 rounded border border-gray-800 bg-black/50 p-3">
            <summary className="cursor-pointer text-sm text-orange-300">Tutor Mode — explain what’s happening</summary>
            <div className="text-xs text-gray-300 mt-2 space-y-2">
              <p><strong>Adapters</strong> are plugins (GitHub, DockerHub, etc.). Each yields artifacts (files/README text) → the engine runs regex + entropy + validators → redacts → saves findings.</p>
              <p><strong>Concurrency</strong> controls parallel fetches. Too high can hit rate limits; start ~6–8.</p>
              <p><strong>Redaction</strong> masks secrets in outputs (bounty-safe). Keep ON when sharing.</p>
              <p><strong>Export Pack</strong> bundles JSONL, SARIF, AI summary, and Merkle audit for clean reports/submissions.</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
