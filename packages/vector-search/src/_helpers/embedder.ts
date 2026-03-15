type Pipeline = (
  texts: string[],
  options: { pooling: string; normalize: boolean },
) => Promise<{
  tolist: () => number[][];
}>;

let pipeline: Pipeline | null = null;

export type Embed = (texts: string[]) => Promise<number[][]>;

/**
 * Generates embeddings using the all-MiniLM-L6-v2 model (384 dimensions).
 * The model is lazy-loaded on first call and cached for subsequent calls.
 */
export const embed: Embed = async (texts) => {
  if (!pipeline) {
    const { pipeline: createPipeline } = await import('@huggingface/transformers');
    pipeline = (await createPipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')) as Pipeline;
  }
  const output = await pipeline(texts, { pooling: 'mean', normalize: true });
  return output.tolist();
};

export type EmbedSingle = (text: string) => Promise<number[]>;

/**
 * Generates a single embedding vector for a text string.
 */
export const embedSingle: EmbedSingle = async (text) => {
  const results = await embed([text]);
  const first = results[0];
  if (!first) {
    throw new Error('Embedding returned no results');
  }
  return first;
};
