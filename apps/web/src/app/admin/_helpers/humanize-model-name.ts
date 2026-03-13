// Maps Claude model IDs to human-readable short names with version numbers.
// Used in admin tables where full model IDs like "claude-haiku-4-5-20251001" are unreadable.

type HumanizeModelName = (modelId: string) => string;

const MODEL_NAMES: Record<string, string> = {
  // Haiku family
  'claude-haiku-4-5-20251001': 'Haiku 4.5',
  'claude-haiku-4-5': 'Haiku 4.5',
  'claude-haiku-3.5-20241022': 'Haiku 3.5',
  // Sonnet family
  'claude-sonnet-4-6': 'Sonnet 4.6',
  'claude-sonnet-4-5-20250514': 'Sonnet 4.5',
  'claude-sonnet-4-20250514': 'Sonnet 4',
  // Opus family
  'claude-opus-4-6': 'Opus 4.6',
  'claude-opus-4-5-20250514': 'Opus 4.5',
  'claude-opus-4-20250514': 'Opus 4',
};

const MODEL_FAMILY_PATTERN = /claude-(haiku|sonnet|opus)-(\d+(?:[.-]\d+)*)/i;

/**
 * Converts a full Claude model ID to a human-readable short name.
 *
 * Known model IDs are mapped to versioned names (e.g. "Haiku 4.5").
 * Unknown model IDs fall through to a best-effort extraction:
 *   - If the string contains "haiku", "sonnet", or "opus", extract family + version.
 *   - Otherwise, return the original string unchanged.
 */
export const humanizeModelName: HumanizeModelName = (modelId) => {
  if (modelId === '') {
    return modelId;
  }

  const exact = MODEL_NAMES[modelId];
  if (exact !== undefined) {
    return exact;
  }

  // Best-effort: extract family and leading version segment from unknown IDs
  const match = MODEL_FAMILY_PATTERN.exec(modelId);
  if (match) {
    const family = match[1]!;
    // Take only the first two version segments (e.g. "4-5" → "4.5", "4" → "4")
    const rawVersion = match[2]!;
    const version = rawVersion.replace(/-/g, '.').split('.').slice(0, 2).join('.');
    const capitalized = family.charAt(0).toUpperCase() + family.slice(1).toLowerCase();
    return `${capitalized} ${version}`;
  }

  return modelId;
};
