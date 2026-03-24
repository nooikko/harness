import { describe, expect, it, vi } from 'vitest';
import type { IntentDefinition } from '../intent-registry';
import { classifyIntent, cosineSimilarity, createIntentRegistry } from '../intent-registry';

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical normalized vectors', () => {
    const v = [0.6, 0.8];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it('returns 0.0 for orthogonal vectors', () => {
    const a = [1, 0];
    const b = [0, 1];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
  });

  it('returns expected similarity for known vectors', () => {
    const a = [0.6, 0.8];
    const b = [0.8, 0.6];
    // dot product = 0.48 + 0.48 = 0.96
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.96, 5);
  });

  it('handles high-dimensional vectors', () => {
    const dim = 384;
    const a = new Array(dim).fill(1 / Math.sqrt(dim));
    const b = new Array(dim).fill(1 / Math.sqrt(dim));
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 3);
  });
});

describe('createIntentRegistry', () => {
  const mockEmbed = vi.fn<(texts: string[]) => Promise<number[][]>>();

  const definitions: IntentDefinition[] = [
    {
      intent: 'lights.control',
      examples: ['turn on the lights', 'turn off the bedroom lights'],
      plugin: 'govee',
      tool: 'set_light',
    },
    {
      intent: 'music.play',
      examples: ['play some jazz', 'put on lofi'],
      plugin: 'music',
      tool: 'play',
    },
  ];

  it('calls embed with all example utterances during build', async () => {
    mockEmbed.mockResolvedValueOnce([
      [0.1, 0.2, 0.3],
      [0.15, 0.25, 0.35],
      [0.5, 0.6, 0.7],
      [0.55, 0.65, 0.75],
    ]);

    await createIntentRegistry(definitions, mockEmbed);

    expect(mockEmbed).toHaveBeenCalledOnce();
    expect(mockEmbed).toHaveBeenCalledWith(['turn on the lights', 'turn off the bedroom lights', 'play some jazz', 'put on lofi']);
  });

  it('returns a registry with an entries array', async () => {
    mockEmbed.mockResolvedValueOnce([
      [0.1, 0.2, 0.3],
      [0.15, 0.25, 0.35],
      [0.5, 0.6, 0.7],
      [0.55, 0.65, 0.75],
    ]);

    const registry = await createIntentRegistry(definitions, mockEmbed);

    expect(registry.entries).toHaveLength(2);
    expect(registry.entries[0]?.intent).toBe('lights.control');
    expect(registry.entries[1]?.intent).toBe('music.play');
  });

  it('computes centroid as average of example embeddings', async () => {
    mockEmbed.mockResolvedValueOnce([
      [0.1, 0.2, 0.3],
      [0.3, 0.4, 0.5],
      [0.9, 0.8, 0.7],
      [0.7, 0.6, 0.5],
    ]);

    const registry = await createIntentRegistry(definitions, mockEmbed);

    // Centroid of [0.1, 0.2, 0.3] and [0.3, 0.4, 0.5] = [0.2, 0.3, 0.4]
    expect(registry.entries[0]?.centroid[0]).toBeCloseTo(0.2, 5);
    expect(registry.entries[0]?.centroid[1]).toBeCloseTo(0.3, 5);
    expect(registry.entries[0]?.centroid[2]).toBeCloseTo(0.4, 5);
  });
});

describe('classifyIntent', () => {
  it('returns the best matching intent with confidence', () => {
    const registry = {
      entries: [
        {
          intent: 'lights.control',
          plugin: 'govee',
          tool: 'set_light',
          centroid: [0.9, 0.1, 0.0],
          examples: [[0.9, 0.1, 0.0]],
        },
        {
          intent: 'music.play',
          plugin: 'music',
          tool: 'play',
          centroid: [0.1, 0.9, 0.0],
          examples: [[0.1, 0.9, 0.0]],
        },
      ],
    };

    // Query vector close to lights.control centroid
    const result = classifyIntent([0.85, 0.15, 0.0], registry);

    expect(result.intent).toBe('lights.control');
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.plugin).toBe('govee');
    expect(result.tool).toBe('set_light');
  });

  it('returns the music intent when query is closer to music', () => {
    const registry = {
      entries: [
        {
          intent: 'lights.control',
          plugin: 'govee',
          tool: 'set_light',
          centroid: [0.9, 0.1, 0.0],
          examples: [[0.9, 0.1, 0.0]],
        },
        {
          intent: 'music.play',
          plugin: 'music',
          tool: 'play',
          centroid: [0.1, 0.9, 0.0],
          examples: [[0.1, 0.9, 0.0]],
        },
      ],
    };

    const result = classifyIntent([0.15, 0.85, 0.0], registry);

    expect(result.intent).toBe('music.play');
    expect(result.plugin).toBe('music');
  });

  it('uses max example similarity as tiebreaker over centroid', () => {
    const registry = {
      entries: [
        {
          intent: 'lights.control',
          plugin: 'govee',
          tool: 'set_light',
          centroid: [0.5, 0.5, 0.0],
          examples: [
            [0.95, 0.05, 0.0], // This example is very close to the query
            [0.05, 0.95, 0.0],
          ],
        },
        {
          intent: 'music.play',
          plugin: 'music',
          tool: 'play',
          centroid: [0.5, 0.5, 0.0],
          examples: [
            [0.5, 0.5, 0.0],
            [0.5, 0.5, 0.0],
          ],
        },
      ],
    };

    // Query closest to lights example despite equal centroids
    const result = classifyIntent([0.9, 0.1, 0.0], registry);
    expect(result.intent).toBe('lights.control');
  });

  it('returns low confidence for vectors far from all intents', () => {
    const registry = {
      entries: [
        {
          intent: 'lights.control',
          plugin: 'govee',
          tool: 'set_light',
          centroid: [0.9, 0.1, 0.0],
          examples: [[0.9, 0.1, 0.0]],
        },
      ],
    };

    // Orthogonal vector
    const result = classifyIntent([0.0, 0.0, 1.0], registry);
    expect(result.confidence).toBeLessThan(0.3);
  });

  it('returns null intent when registry is empty', () => {
    const result = classifyIntent([0.5, 0.5, 0.0], { entries: [] });
    expect(result.intent).toBeNull();
    expect(result.confidence).toBe(0);
  });
});
