import type React from 'react';

type HighlightMatches = (text: string, query: string) => React.ReactNode[];

const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const highlightMatches: HighlightMatches = (text, query) => {
  if (!query.trim()) {
    return [text];
  }

  const words = query
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map(escapeRegExp);

  if (words.length === 0) {
    return [text];
  }

  const pattern = new RegExp(`(${words.join('|')})`, 'gi');
  // Use a non-global copy for classification — avoids lastIndex state issues
  const classifier = new RegExp(`(${words.join('|')})`, 'i');
  const parts = text.split(pattern);

  return parts.map((part, i) => {
    if (classifier.test(part)) {
      return (
        <mark key={i} className='rounded-sm bg-yellow-200/30 text-foreground dark:bg-yellow-500/20'>
          {part}
        </mark>
      );
    }
    return part;
  });
};
