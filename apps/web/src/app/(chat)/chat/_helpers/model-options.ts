type ModelOption = { value: string; label: string; description?: string };

export const MODEL_OPTIONS: ModelOption[] = [
  { value: 'haiku', label: 'Haiku', description: 'Default' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet' },
  { value: 'claude-opus-4-6', label: 'Opus' },
  { value: 'claude-opus-4-5-20251101', label: 'Opus 4.5' },
];
