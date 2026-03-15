import { afterEach, describe, expect, it, vi } from 'vitest';

const mockPipeline = vi.fn();
const mockCreatePipeline = vi.fn();

vi.mock('@huggingface/transformers', () => ({
  pipeline: mockCreatePipeline,
}));

describe('embedder', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('lazy-loads the pipeline on first call', async () => {
    mockCreatePipeline.mockResolvedValue(mockPipeline);
    mockPipeline.mockResolvedValue({ tolist: () => [[0.1, 0.2, 0.3]] });

    const { embed } = await import('../embedder.js');
    await embed(['hello']);

    expect(mockCreatePipeline).toHaveBeenCalledWith('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  });

  it('reuses the cached pipeline on subsequent calls', async () => {
    mockCreatePipeline.mockResolvedValue(mockPipeline);
    mockPipeline.mockResolvedValue({ tolist: () => [[0.1, 0.2]] });

    const { embed } = await import('../embedder.js');
    await embed(['first']);
    await embed(['second']);

    expect(mockCreatePipeline).toHaveBeenCalledTimes(1);
  });

  it('returns embedding arrays from embed()', async () => {
    const expected = [
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ];
    mockCreatePipeline.mockResolvedValue(mockPipeline);
    mockPipeline.mockResolvedValue({ tolist: () => expected });

    const { embed } = await import('../embedder.js');
    const result = await embed(['hello', 'world']);

    expect(result).toEqual(expected);
    expect(mockPipeline).toHaveBeenCalledWith(['hello', 'world'], {
      pooling: 'mean',
      normalize: true,
    });
  });

  it('throws when embedSingle receives no results', async () => {
    mockCreatePipeline.mockResolvedValue(mockPipeline);
    mockPipeline.mockResolvedValue({ tolist: () => [] });

    const { embedSingle } = await import('../embedder.js');

    await expect(embedSingle('test')).rejects.toThrow('Embedding returned no results');
  });
});
