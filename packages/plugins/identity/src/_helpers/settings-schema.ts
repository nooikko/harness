import { createSettingsSchema, type SettingsFieldDefs } from '@harness/plugin-contract';

export const settingsFields = {
  importanceThreshold: {
    type: 'number' as const,
    label: 'Importance Threshold',
    description: 'Minimum importance score (1-10) for a memory to be saved. Lower values store more memories.',
    default: 6,
  },
  memoryLimit: {
    type: 'number' as const,
    label: 'Memory Limit',
    description: 'Maximum number of memories injected into each prompt. Higher values use more context window.',
    default: 10,
  },
  candidatePool: {
    type: 'number' as const,
    label: 'Candidate Pool',
    description: 'Number of recent memories scored before selecting the top N. Larger pools find better matches but cost more.',
    default: 100,
  },
  decayRate: {
    type: 'number' as const,
    label: 'Decay Rate',
    description: 'Hourly recency decay factor (0-1). Values closer to 1 keep old memories relevant longer. Default 0.995 = ~50% decay over 6 days.',
    default: 0.995,
  },
  reflectionThreshold: {
    type: 'number' as const,
    label: 'Reflection Threshold',
    description: 'Number of unreflected episodic memories before a reflection cycle triggers.',
    default: 10,
  },
  reflectionBoost: {
    type: 'number' as const,
    label: 'Reflection Boost',
    description: 'Extra score added to REFLECTION-type memories during retrieval. Higher values prioritize reflections over episodic memories.',
    default: 0.3,
  },
  semanticBoost: {
    type: 'number' as const,
    label: 'User Insight Boost',
    description:
      'Extra score added to SEMANTIC (user insight) memories during retrieval. Higher values prioritize user facts over episodic memories.',
    default: 0.3,
  },
} satisfies SettingsFieldDefs;

export const settingsSchema = createSettingsSchema(settingsFields);
