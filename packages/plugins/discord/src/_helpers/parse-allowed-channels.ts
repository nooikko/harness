// Parse allowed channels — converts a comma-separated string of channel IDs into a Set

type ParseAllowedChannels = (raw: string | undefined) => Set<string>;

export const parseAllowedChannels: ParseAllowedChannels = (raw) => {
  if (!raw?.trim()) {
    return new Set();
  }
  return new Set(
    raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
};
