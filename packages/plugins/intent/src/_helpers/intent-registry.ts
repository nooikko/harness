export type IntentDefinition = {
  intent: string;
  examples: string[];
  plugin: string;
  tool: string;
};

export type IntentRegistryEntry = {
  intent: string;
  plugin: string;
  tool: string;
  centroid: number[];
  examples: number[][];
};

export type IntentRegistry = {
  entries: IntentRegistryEntry[];
};

export type ClassifyResult = {
  intent: string | null;
  confidence: number;
  plugin: string;
  tool: string;
};

export type EmbedFn = (texts: string[]) => Promise<number[][]>;

/**
 * Dot product of two vectors. Since vectors from the embedder are already
 * L2-normalized, the dot product equals cosine similarity.
 */
export const cosineSimilarity = (a: number[], b: number[]): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] as number) * (b[i] as number);
  }
  return sum;
};

/**
 * Pre-encode all intent examples and compute centroids.
 * Called once at plugin start().
 */
export const createIntentRegistry = async (definitions: IntentDefinition[], embed: EmbedFn): Promise<IntentRegistry> => {
  // Flatten all examples into a single batch for one embed() call
  const allExamples = definitions.flatMap((d) => d.examples);
  const allVectors = await embed(allExamples);

  let offset = 0;
  const entries: IntentRegistryEntry[] = definitions.map((def) => {
    const vectors = allVectors.slice(offset, offset + def.examples.length);
    offset += def.examples.length;

    // Centroid = element-wise average of example vectors
    const first = vectors[0];
    const dim = first ? first.length : 0;
    const centroid = new Array(dim).fill(0) as number[];
    for (const vec of vectors) {
      for (let i = 0; i < dim; i++) {
        centroid[i] = (centroid[i] as number) + (vec[i] as number) / vectors.length;
      }
    }

    return {
      intent: def.intent,
      plugin: def.plugin,
      tool: def.tool,
      centroid,
      examples: vectors,
    };
  });

  return { entries };
};

/**
 * Classify a query embedding against the registry.
 * Uses a blend of centroid similarity and max-example similarity
 * to find the best matching intent.
 */
export const classifyIntent = (queryVector: number[], registry: IntentRegistry): ClassifyResult => {
  if (registry.entries.length === 0) {
    return { intent: null, confidence: 0, plugin: '', tool: '' };
  }

  let bestIntent: IntentRegistryEntry | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const entry of registry.entries) {
    const centroidSim = cosineSimilarity(queryVector, entry.centroid);

    // Also check max similarity against individual examples
    let maxExampleSim = Number.NEGATIVE_INFINITY;
    for (const example of entry.examples) {
      const sim = cosineSimilarity(queryVector, example);
      if (sim > maxExampleSim) {
        maxExampleSim = sim;
      }
    }

    // Blend: 20% centroid + 80% best example — max-example similarity is the
    // strongest signal. Diverse intents (lights: on/off/dim/color) dilute the
    // centroid, but the closest example stays highly predictive.
    const score = 0.2 * centroidSim + 0.8 * maxExampleSim;

    if (score > bestScore) {
      bestScore = score;
      bestIntent = entry;
    }
  }

  // Confidence is the blended score clamped to [0, 1]
  const confidence = Math.max(0, Math.min(1, bestScore));

  // bestIntent is guaranteed non-null here because we early-return for empty entries
  // and NEGATIVE_INFINITY ensures at least one entry wins.
  const best = bestIntent as IntentRegistryEntry;
  return {
    intent: best.intent,
    confidence,
    plugin: best.plugin,
    tool: best.tool,
  };
};
