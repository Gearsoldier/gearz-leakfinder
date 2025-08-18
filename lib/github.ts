// lib/github.ts

import { leakPatterns } from '@/utils/leakPatterns';
import { LeakMatch } from '@/types/leak';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

export async function searchGitHubCode(query: string): Promise<LeakMatch[]> {
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
  };

  const searchUrl = `https://api.github.com/search/code?q=${encodeURIComponent(query)}+in:file&per_page=10`;

  const res = await fetch(searchUrl, { headers });
  const data = await res.json();

  if (!data.items) return [];

  const matches: LeakMatch[] = [];

  for (const item of data.items) {
    const rawUrl = item.html_url
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob/', '/');

    try {
      const rawRes = await fetch(rawUrl);
      const fileContent = await rawRes.text();

      leakPatterns.forEach(pattern => {
        const found = [...fileContent.matchAll(pattern.regex)];
        found.forEach(match => {
          matches.push({
            source: 'github',
            fileUrl: item.html_url,
            repo: item.repository.full_name,
            filePath: item.path,
            matchedString: match[0],
            patternName: pattern.name,
            severity: pattern.severity as LeakMatch['severity'],
          });
        });
      });
    } catch (err) {
      console.error(`Failed to fetch: ${rawUrl}`);
    }
  }

  return matches;
}
