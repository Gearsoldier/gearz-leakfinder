'use client';

import { useEffect, useState } from 'react';

type ScopeForm = {
  githubOrgsRepos: string;   // one per line (org, owner/repo, or URL)
  dockerhubOrgs: string;     // one per line (org or URL)
  npmScopes: string;         // one per line (@scope or prefix*)
  pypiPackages: string;      // one per line (pattern like acme*)
  waybackDomains: string;    // one per line (domains/URLs)
  cicdUrls: string;          // one per line (absolute URLs)
  artifactUrls: string;      // one per line (absolute URLs)
  apkIds: string;            // one per line (e.g., org.mozilla.firefox)
  ipaIds: string;            // one per line (e.g., org.mozilla.ios.Firefox)
};

function arrToTextarea(arr?: unknown): string {
  if (!Array.isArray(arr)) return '';
  return arr.join('\n');
}

function normalizeTextArea(val: string): string[] {
  return val
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

export default function ScopePanel() {
  const [form, setForm] = useState<ScopeForm>({
    githubOrgsRepos: '',
    dockerhubOrgs: '',
    npmScopes: '',
    pypiPackages: '',
    waybackDomains: '',
    cicdUrls: '',
    artifactUrls: '',
    apkIds: '',
    ipaIds: '',
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>('');

  // Load existing scope.yaml (if present)
  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/scope', { method: 'GET' });
        if (!res.ok) throw new Error(`Load failed: ${res.status}`);
        const data = await res.json();

        if (ignore) return;

        setForm({
          githubOrgsRepos: arrToTextarea(data?.github?.targets),
          dockerhubOrgs: arrToTextarea(data?.dockerhub?.targets),
          npmScopes: arrToTextarea(data?.npm?.targets),
          pypiPackages: arrToTextarea(data?.pypi?.targets),
          waybackDomains: arrToTextarea(data?.wayback?.targets),
          cicdUrls: arrToTextarea(data?.cicd?.targets),
          artifactUrls: arrToTextarea(data?.artifacts?.targets),
          apkIds: arrToTextarea(data?.apk?.targets),
          ipaIds: arrToTextarea(data?.ipa?.targets),
        });
      } catch (e: any) {
        // If file not found, just leave form empty
        setMessage('Loaded default empty scope (no existing scope.yaml).');
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  async function onSave() {
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        github: { targets: normalizeTextArea(form.githubOrgsRepos) },
        dockerhub: { targets: normalizeTextArea(form.dockerhubOrgs) },
        npm: { targets: normalizeTextArea(form.npmScopes) },
        pypi: { targets: normalizeTextArea(form.pypiPackages) },
        wayback: { targets: normalizeTextArea(form.waybackDomains) },
        cicd: { targets: normalizeTextArea(form.cicdUrls) },
        artifacts: { targets: normalizeTextArea(form.artifactUrls) },
        apk: { targets: normalizeTextArea(form.apkIds) },
        ipa: { targets: normalizeTextArea(form.ipaIds) },
      };

      const res = await fetch('/api/scope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`Save failed: ${res.status} ${t}`);
      }
      setMessage('✅ Scope saved to scope.yaml');
    } catch (e: any) {
      setMessage(`❌ ${e?.message || 'Save error'}`);
    } finally {
      setSaving(false);
    }
  }

  function Field({
    label,
    placeholder,
    value,
    onChange,
    rows = 4,
  }: {
    label: string;
    placeholder: string;
    value: string;
    onChange: (s: string) => void;
    rows?: number;
  }) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-orange-300">{label}</label>
        <textarea
          className="w-full rounded-md bg-gray-900 text-white border border-gray-700 p-3 text-sm"
          placeholder={placeholder}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl bg-black/60 rounded-2xl border border-gray-800 shadow-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-orange-400">Scope Builder</h2>
        <button
          onClick={onSave}
          disabled={saving || loading}
          className="rounded-lg px-4 py-2 bg-orange-500 hover:bg-orange-600 font-semibold disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Scope'}
        </button>
      </div>

      {loading && <p className="text-sm text-gray-300">Loading scope…</p>}
      {message && <p className="text-sm">{message}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field
          label="GitHub (orgs/repos/URLs)"
          placeholder={`mozilla\nmozilla-mobile\nowner/repo\nhttps://github.com/owner/repo`}
          value={form.githubOrgsRepos}
          onChange={(s) => setForm((f) => ({ ...f, githubOrgsRepos: s }))}
          rows={6}
        />
        <Field
          label="Docker Hub (orgs/URLs)"
          placeholder={`mozilla\nhttps://hub.docker.com/u/mozilla`}
          value={form.dockerhubOrgs}
          onChange={(s) => setForm((f) => ({ ...f, dockerhubOrgs: s }))}
          rows={6}
        />
        <Field
          label="npm scopes/prefixes"
          placeholder={`@mozilla\nmozilla-*`}
          value={form.npmScopes}
          onChange={(s) => setForm((f) => ({ ...f, npmScopes: s }))}
        />
        <Field
          label="PyPI packages/patterns"
          placeholder={`mozilla*\nacme-*`}
          value={form.pypiPackages}
          onChange={(s) => setForm((f) => ({ ...f, pypiPackages: s }))}
        />
        <Field
          label="Wayback domains/URLs"
          placeholder={`github.com/mozilla\nhg.mozilla.org\narchive.mozilla.org`}
          value={form.waybackDomains}
          onChange={(s) => setForm((f) => ({ ...f, waybackDomains: s }))}
        />
        <Field
          label="CI/CD artifact/log URLs"
          placeholder={`https://archive.mozilla.org/pub/\nhttps://ci.example.com/job/app/lastBuild/consoleText`}
          value={form.cicdUrls}
          onChange={(s) => setForm((f) => ({ ...f, cicdUrls: s }))}
          rows={5}
        />
        <Field
          label="Other artifact roots (URLs)"
          placeholder={`https://downloads.example.com/releases/`}
          value={form.artifactUrls}
          onChange={(s) => setForm((f) => ({ ...f, artifactUrls: s }))}
        />
        <Field
          label="APK package IDs"
          placeholder={`org.mozilla.firefox`}
          value={form.apkIds}
          onChange={(s) => setForm((f) => ({ ...f, apkIds: s }))}
        />
        <Field
          label="IPA bundle IDs"
          placeholder={`org.mozilla.ios.Firefox`}
          value={form.ipaIds}
          onChange={(s) => setForm((f) => ({ ...f, ipaIds: s }))}
        />
      </div>

      <p className="text-xs text-gray-400">
        Tip: Enter one item per line. Click <span className="font-semibold text-orange-300">Save Scope</span> to write{' '}
        <code>scope.yaml</code>. The Engine Scan panel will use the saved file automatically.
      </p>
    </div>
  );
}
