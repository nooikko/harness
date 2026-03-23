type HexToRgbInt = (hex: string) => number;
type RgbIntToHex = (rgb: number) => string;
type NamedColorToRgbInt = (name: string) => number | null;

const NAMED_COLORS: Record<string, number> = {
  red: 0xff0000,
  green: 0x00ff00,
  blue: 0x0000ff,
  white: 0xffffff,
  yellow: 0xffff00,
  orange: 0xff8c00,
  purple: 0x800080,
  pink: 0xff69b4,
  cyan: 0x00ffff,
  'warm white': 0xffb347,
  'cool white': 0xf0f8ff,
  daylight: 0xf5f5dc,
  candle: 0xff9329,
  sunset: 0xff6347,
  relax: 0xff9329,
  energize: 0xd4e5ff,
};

export const hexToRgbInt: HexToRgbInt = (hex) => {
  const cleaned = hex.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return Number.parseInt(cleaned, 16);
};

export const rgbIntToHex: RgbIntToHex = (rgb) => {
  return `#${rgb.toString(16).padStart(6, '0')}`;
};

export const namedColorToRgbInt: NamedColorToRgbInt = (name) => {
  return NAMED_COLORS[name.toLowerCase()] ?? null;
};
