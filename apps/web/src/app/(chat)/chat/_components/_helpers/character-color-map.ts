const PALETTE = [
  '#F59E0B', // amber
  '#3B82F6', // blue
  '#10B981', // emerald
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
] as const;

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

type GetCharacterColor = (name: string, override?: string | null) => string;

export const getCharacterColor: GetCharacterColor = (name, override) => {
  if (override && HEX_PATTERN.test(override)) {
    return override;
  }

  const normalized = name.toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash += normalized.charCodeAt(i);
  }

  const index = hash % PALETTE.length;
  return PALETTE[index] as string;
};
