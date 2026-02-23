// Formats an array of context files into a single markdown section

import type { ContextFile } from './file-reader';

type FormatContextSection = (files: ContextFile[]) => string;

export const formatContextSection: FormatContextSection = (files) => {
  if (files.length === 0) {
    return '';
  }

  const sections = files.map((f) => `## ${f.name}\n\n${f.content}`);

  return `# Context\n\n${sections.join('\n\n---\n\n')}`;
};
