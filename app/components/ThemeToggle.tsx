'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle({ onChange }: { onChange?: (t: 'dim' | 'sunburst') => void }) {
  const [theme, setTheme] = useState<'dim' | 'sunburst'>('dim');

  useEffect(() => {
    const saved = (localStorage.getItem('lf-theme') as 'dim' | 'sunburst') || 'dim';
    setTheme(saved);
    onChange?.(saved);
  }, [onChange]);

  function toggle() {
    const next = theme === 'dim' ? 'sunburst' : 'dim';
    setTheme(next);
    localStorage.setItem('lf-theme', next);
    onChange?.(next);
  }

  return (
    <button
      onClick={toggle}
      className="rounded-lg px-3 py-1.5 text-xs border border-gray-700 bg-gray-900 hover:bg-gray-800"
      title="Toggle theme"
    >
      Theme: <span className="font-semibold text-orange-300">{theme}</span>
    </button>
  );
}
