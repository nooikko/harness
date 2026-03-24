import type { ClassifyResult } from './intent-registry';

export type RouteDecision = {
  route: 'fast-path' | 'llm';
  intents: Array<ClassifyResult & { slots?: Record<string, unknown> }>;
};

export type RouteDecisionOptions = {
  threshold?: number;
  slots?: Array<Record<string, unknown>>;
};

export type RouteDecisionFn = (results: ClassifyResult[], options?: RouteDecisionOptions) => RouteDecision;

const DEFAULT_CONFIDENCE_THRESHOLD = 0.78;

export const routeDecision: RouteDecisionFn = (results, options) => {
  const threshold = options?.threshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  if (results.length === 0) {
    return { route: 'llm', intents: [] };
  }

  // All sub-intents must be high-confidence and non-null for fast-path
  const allHighConfidence = results.every((r) => r.intent !== null && r.confidence >= threshold);

  const intents = results.map((r, i) => ({
    ...r,
    slots: options?.slots?.[i],
  }));

  return {
    route: allHighConfidence ? 'fast-path' : 'llm',
    intents,
  };
};
