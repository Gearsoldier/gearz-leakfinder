'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import ThemeToggle from './components/ThemeToggle';

const ScopePanel = dynamic(() => import('./components/ScopePanel'), { ssr: false });
const ScanPanel = dynamic(() => import('./components/ScanPanel'), { ssr: false });

type LeakResult = {
  fileUrl: string;
  repo?: string;
  filePath?: string;
  matchedString: string;
  patternName: string;
  severity: string;
};

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'success' | 'warn' | 'danger' }) {
  const tones = {
    neutral: 'bg-gray-800/70 text-gray-200 border-gray-700',
    success: 'bg-green-900/40 text-green-300 border-green-700/60',
    warn:    'bg-yellow-900/40 text-yellow-300 border-yellow-700/60',
    danger:  'bg-red-900/40 text-red-300 border-red-700/60',
  } as const;
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export default function HomePage() {
  const [company, setCompany] = useState('');
  const [results, setResults] = useState<LeakResult[]>([]);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string>('');
  const [scopeOpen, setScopeOpen] = useState(true);
  const [engineOpen, setEngineOpen] = useState(true);
  const [theme, setTheme] = useState<'dim' | 'sunburst'>('dim');

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.dataset.theme = theme;
    }
  }, [theme]);

  async function handleSearch() {
    setLoading(true);
    setResults([]);
    setSummary('');
    setLogs('');

    try {
      const res = await fetch('/api/leakfinder', {
        method: 'POST',
        body: JSON.stringify({ company }),
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json().catch(() => ({}));
      const leaks: LeakResult[] = data.results || [];
      setResults(leaks);
      setLogs((data.logs ?? '').trim());

      if (leaks.length === 0) {
        setSummary('✅ No leaked credentials were found for this target.');
        return;
      }

      const prompt = `You are a cybersecurity assistant. Analyze the following leaked credentials found for "${company}" and return:
1) The highest-impact secrets.
2) Why they’re risky.
3) Recommended remediation steps.
4) Prioritized action checklist.

Leaks:
${leaks
  .map((r) => `• [${(r.severity || '').toUpperCase()}] ${r.patternName} in ${r.repo ?? 'unknown'}/${r.filePath ?? 'unknown'}\n  ${r.fileUrl}`)
  .join('\n\n')}`;

      try {
        const ollamaRes = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          body: JSON.stringify({ model: 'llama3', prompt, stream: false }),
          headers: { 'Content-Type': 'application/json' },
        });
        const ollamaData = await ollamaRes.json().catch(() => ({}));
        setSummary((ollamaData?.response || '').trim());
      } catch (e: any) {
        setSummary(`(AI summary unavailable) ${String(e?.message ?? e)}`);
      }
    } catch (e: any) {
      setLogs(`❌ Error: ${String(e?.message ?? e)}`);
      setSummary('(Quick search failed)');
    } finally {
      setLoading(false);
    }
  }

  const severityTone = (sev?: string): 'neutral' | 'success' | 'warn' | 'danger' => {
    const s = (sev || '').toLowerCase();
    if (s.includes('critical') || s.includes('high')) return 'danger';
    if (s.includes('medium')) return 'warn';
    if (s.includes('low')) return 'neutral';
    return 'neutral';
  };

  return (
    <div className="relative min-h-screen">
      {/* FIXED BACKDROP (added) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url('/linkfinder.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
        }}
      />

      <main
        className="min-h-screen w-full bg-black/0 text-white"  // was bg-black
        style={{
          backgroundImage:
            theme === 'sunburst'
              ? `radial-gradient(1200px 600px at 80% -10%, rgba(234,88,12,0.22), transparent 60%),
                 radial-gradient(1000px 500px at 10% 0%, rgba(234,88,12,0.16), transparent 55%)`
              : `radial-gradient(1000px 500px at 50% -10%, rgba(148,163,184,0.12), transparent 55%)`,
        }}
      >
        {/* Topbar */}
        <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-black/60 bg-black/80 border-b border-orange-900/30">
          <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 shadow-md" />
              <div>
                <h1 className="text-lg font-bold tracking-wide">GEARZ LeakFinder</h1>
                <p className="text-[11px] text-gray-400 -mt-0.5">OSINT Secret Hunter • Redaction-first</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle onChange={setTheme} />
              <Badge>Redaction ON</Badge>
              <Badge tone="success">HF Connected</Badge>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
          {/* Quick Search */}
          <div className="w-full bg-black/60 p-5 rounded-2xl shadow-xl border border-gray-800 relative">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-orange-400">Quick Company / Keyword Search</h2>
                <p className="text-sm text-gray-400">Fast pass: checks common sources and summarizes. Use Engine Scan for full adapter control.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-3">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="🔍 e.g., mozilla • example.com • my-cool-app"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && company && !loading) handleSearch(); }}
                  className="w-full p-4 text-white bg-gray-900/70 border border-gray-700 placeholder-gray-400 text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/60"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSearch}
                    disabled={loading || !company}
                    className="inline-flex items-center justify-center bg-orange-600 hover:bg-orange-500 disabled:opacity-60 transition rounded-lg px-5 py-2.5 font-semibold"
                  >
                    {loading ? 'Searching…' : 'Find Leaks'}
                  </button>
                </div>

                {/* Logs */}
                {logs && (
                  <div className="mt-4 bg-gray-950/60 rounded-lg p-3 border border-gray-800">
                    <div className="text-xs text-gray-400 mb-1">Logs</div>
                    <pre className="text-xs whitespace-pre-wrap text-gray-300">{logs}</pre>
                  </div>
                )}
              </div>

              {/* Status / Tips */}
              <div className="space-y-3">
                <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
                  <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Status</div>
                  <ul className="text-sm space-y-1.5">
                    <li className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-green-500" />
                      <span>Engine ready</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-green-500" />
                      <span>HF token detected</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-green-500" />
                      <span>GitHub token detected</span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
                  <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Tips</div>
                  <ul className="text-xs text-gray-300 space-y-1.5">
                    <li>Use <strong>Scope Builder</strong> to persist targets into <code>scope.yaml</code>.</li>
                    <li>Switch to <strong>Engine Scan</strong> for adapter-level control.</li>
                    <li>Keep <strong>redaction ON</strong> for bounty-safe outputs.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Results */}
            {results.length > 0 && (
              <div className="mt-6 overflow-hidden rounded-xl border border-gray-800">
                <table className="w-full text-sm">
                  <thead className="bg-gray-950/70">
                    <tr className="text-orange-300 border-b border-orange-900/30">
                      <th className="text-left py-2 px-3">File</th>
                      <th className="text-left py-2 px-3">Match</th>
                      <th className="text-left py-2 px-3">Repo</th>
                      <th className="text-left py-2 px-3">Severity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-900">
                    {results.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-900/50">
                        <td className="py-2 px-3">
                          <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-300 underline">
                            {r.filePath || 'Unknown'}
                          </a>
                        </td>
                        <td className="py-2 px-3">{r.patternName}</td>
                        <td className="py-2 px-3">{r.repo}</td>
                        <td className="py-2 px-3">
                          <Badge tone={severityTone(r.severity)}>{(r.severity || '').toUpperCase() || 'N/A'}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* AI Summary */}
            {summary && (
              <div className="mt-6 w-full rounded-xl border border-gray-800 bg-gray-950/70 p-4">
                <h3 className="text-lg font-semibold mb-2 text-green-400">🤖 AI Summary</h3>
                <p className="whitespace-pre-wrap text-sm text-gray-200">{summary}</p>
              </div>
            )}

            {/* Loading overlay */}
            {loading && (
              <div className="absolute inset-0 rounded-2xl bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <div className="animate-spin size-8 rounded-full border-2 border-orange-500 border-t-transparent" />
              </div>
            )}
          </div>

          {/* Scope + Engine */}
          <div className="grid grid-cols-1 gap-6">
            <div>
              <button
                onClick={() => setScopeOpen(v => !v)}
                className="w-full text-left mb-3 rounded-lg border border-gray-800/80 bg-black/60 hover:bg-black/50 px-4 py-2 flex items-center justify-between"
              >
                <span className="text-sm font-semibold text-orange-300">Scope Builder (writes scope.yaml)</span>
                <span className="text-xs text-gray-400">{scopeOpen ? 'Collapse' : 'Expand'}</span>
              </button>
              {scopeOpen && <ScopePanel />}
            </div>

            <div>
              <button
                onClick={() => setEngineOpen(v => !v)}
                className="w-full text-left mb-3 rounded-lg border border-gray-800/80 bg-black/60 hover:bg-black/50 px-4 py-2 flex items-center justify-between"
              >
                <span className="text-sm font-semibold text-orange-300">Engine Scan (adapters • concurrency • AI)</span>
                <span className="text-xs text-gray-400">{engineOpen ? 'Collapse' : 'Expand'}</span>
              </button>
              {engineOpen && <ScanPanel />}
            </div>
          </div>

          {/* Footer */}
          <footer className="py-8 text-center text-xs text-gray-500">
            <div className="flex items-center justify-center gap-2">
              <span>Built for OSINT hunters • Redaction-first</span>
              <span className="opacity-40">|</span>
              <a href="/api/export" className="underline text-gray-300 hover:text-white">Download Export Pack</a>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
