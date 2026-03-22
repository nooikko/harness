import { describe, expect, it } from 'vitest';
import { chunkDocument } from '../chunk-document';

describe('chunkDocument', () => {
  it('returns a single chunk for a short document without headers', () => {
    const text = 'Just some text\nwith a few lines\nnothing special.';
    const chunks = chunkDocument(text);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.sectionLabel).toBeNull();
    expect(chunks[0]?.content).toBe(text);
    expect(chunks[0]?.index).toBe(0);
  });

  it('splits document by markdown headers', () => {
    const text = `# Day 1
First day events.

# Day 2
Second day events.

# Day 3
Third day events.`;

    const chunks = chunkDocument(text);

    // Small sections get merged
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]?.content).toContain('Day 1');
  });

  it('assigns section labels from headers', () => {
    const text = `# Morning Events
Stuff happened.

# Afternoon Events
More stuff happened.`;

    const chunks = chunkDocument(text);

    expect(chunks[0]?.sectionLabel).toBe('Morning Events');
  });

  it('handles ## and ### headers', () => {
    const text = `## Section A
Content A

### Subsection B
Content B`;

    const chunks = chunkDocument(text);

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]?.content).toContain('Section A');
  });

  it('returns empty array for empty input', () => {
    const chunks = chunkDocument('');

    expect(chunks).toHaveLength(0);
  });

  it('handles whitespace-only input', () => {
    const chunks = chunkDocument('   \n\n  ');

    expect(chunks).toHaveLength(0);
  });

  it('merges small sections into one chunk', () => {
    const text = `# A
Line A

# B
Line B

# C
Line C`;

    const chunks = chunkDocument(text);

    // All three small sections should merge into one chunk
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toContain('Line A');
    expect(chunks[0]?.content).toContain('Line B');
    expect(chunks[0]?.content).toContain('Line C');
  });

  it('splits sections that exceed max chunk size', () => {
    const bigParagraph = 'x'.repeat(7000);
    const text = `# Big Section\n${bigParagraph}\n\n${bigParagraph}`;

    const chunks = chunkDocument(text);

    // Should split into multiple chunks
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('flushes pending when a new section would exceed max size', () => {
    const mediumContent = 'y'.repeat(8000);
    const text = `# First\n${mediumContent}\n\n# Second\n${mediumContent}`;

    const chunks = chunkDocument(text);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]?.sectionLabel).toBe('First');
  });

  it('preserves bullet points within sections', () => {
    const text = `# Characters
- Violet: tall, guarded
- Kai: short, energetic
- Suki: quiet, observant`;

    const chunks = chunkDocument(text);

    expect(chunks[0]?.content).toContain('- Violet: tall, guarded');
    expect(chunks[0]?.content).toContain('- Kai: short, energetic');
    expect(chunks[0]?.content).toContain('- Suki: quiet, observant');
  });
});
