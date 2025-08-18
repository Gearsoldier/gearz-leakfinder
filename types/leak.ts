// types/leak.ts

export type LeakMatch = {
  source: 'github' | 'pastebin' | 'gitlab';
  fileUrl: string;
  repo?: string;
  filePath?: string;
  matchedString: string;
  patternName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
};
