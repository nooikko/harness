// Formats a full Claude model ID into a short display name

type FormatModelName = (model: string) => string;

const MODEL_LABELS: Record<string, string> = {
  'claude-haiku-4-5-20251001': 'Haiku',
  'claude-sonnet-4-6': 'Sonnet',
  'claude-opus-4-6': 'Opus',
};

export const formatModelName: FormatModelName = (model) => {
  return MODEL_LABELS[model] ?? model;
};
