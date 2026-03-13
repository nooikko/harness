import type { FileReference } from './load-file-references';

type FormatSize = (bytes: number) => string;

const formatSize: FormatSize = (bytes) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)}KB`;
  }
  return `${bytes}B`;
};

type FormatFileReferences = (files: FileReference[]) => string;

export const formatFileReferences: FormatFileReferences = (files) => {
  if (files.length === 0) {
    return '';
  }

  const projectFiles = files.filter((f) => f.scope === 'PROJECT');
  const threadFiles = files.filter((f) => f.scope === 'THREAD');

  const sections: string[] = ['# Available Files'];

  if (projectFiles.length > 0) {
    sections.push('\n## Project Files');
    for (const f of projectFiles) {
      sections.push(`- ${f.name} (${f.mimeType}, ${formatSize(f.size)}) → ${f.fullPath}`);
    }
  }

  if (threadFiles.length > 0) {
    sections.push('\n## Thread Files');
    for (const f of threadFiles) {
      sections.push(`- ${f.name} (${f.mimeType}, ${formatSize(f.size)}) → ${f.fullPath}`);
    }
  }

  return sections.join('\n');
};
