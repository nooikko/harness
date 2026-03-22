type DocumentChunk = {
  sectionLabel: string | null;
  content: string;
  index: number;
};

const HEADER_PATTERN = /^#{1,3}\s+.+/;
const MAX_CHUNK_CHARS = 12_000;

type ChunkDocument = (text: string) => DocumentChunk[];

export const chunkDocument: ChunkDocument = (text) => {
  if (!text.trim()) {
    return [];
  }

  const lines = text.split('\n');
  const sections: { label: string | null; lines: string[] }[] = [];
  let currentLabel: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    if (HEADER_PATTERN.test(line)) {
      if (currentLines.length > 0) {
        sections.push({ label: currentLabel, lines: currentLines });
      }
      currentLabel = line.replace(/^#{1,3}\s+/, '').trim();
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    sections.push({ label: currentLabel, lines: currentLines });
  }

  // Merge small sections, split large ones
  const chunks: DocumentChunk[] = [];
  let pending: string[] = [];
  let pendingLabel: string | null = null;
  let chunkIndex = 0;

  const flushPending = () => {
    if (pending.length > 0) {
      chunks.push({
        sectionLabel: pendingLabel,
        content: pending.join('\n').trim(),
        index: chunkIndex++,
      });
      pending = [];
      pendingLabel = null;
    }
  };

  for (const section of sections) {
    const sectionText = section.lines.join('\n');

    if (sectionText.length > MAX_CHUNK_CHARS) {
      flushPending();
      // Split large section by paragraph breaks
      const paragraphs = sectionText.split(/\n\n+/);
      let buffer: string[] = [];
      for (const para of paragraphs) {
        if (buffer.join('\n\n').length + para.length > MAX_CHUNK_CHARS && buffer.length > 0) {
          chunks.push({
            sectionLabel: section.label,
            content: buffer.join('\n\n').trim(),
            index: chunkIndex++,
          });
          buffer = [];
        }
        buffer.push(para);
      }
      if (buffer.length > 0) {
        chunks.push({
          sectionLabel: section.label,
          content: buffer.join('\n\n').trim(),
          index: chunkIndex++,
        });
      }
    } else if (pending.join('\n').length + sectionText.length > MAX_CHUNK_CHARS) {
      flushPending();
      pending = [sectionText];
      pendingLabel = section.label;
    } else {
      if (pending.length === 0) {
        pendingLabel = section.label;
      }
      pending.push(sectionText);
    }
  }

  flushPending();

  // If the document had no headers, return the whole thing as one chunk (if non-empty)
  if (chunks.length === 0) {
    const trimmed = text.trim();
    if (trimmed.length > 0) {
      chunks.push({ sectionLabel: null, content: trimmed, index: 0 });
    }
  }

  return chunks;
};
