type ValidationResult = { valid: true } | { valid: false; reason: string };

type IsValidCharacterName = (name: string) => ValidationResult;

export const isValidCharacterName: IsValidCharacterName = (name) => {
  const trimmed = name.trim();

  if (!trimmed) {
    return { valid: false, reason: 'empty name' };
  }

  if (trimmed.length > 60) {
    return { valid: false, reason: 'exceeds 60 characters' };
  }

  if (trimmed.split(/\s+/).length > 5) {
    return { valid: false, reason: 'more than 5 words' };
  }

  if (/[;:]/.test(trimmed)) {
    return { valid: false, reason: 'contains description punctuation' };
  }

  const descriptionMarkers =
    /\b(not present|does not|mentioned|unknown name|as of this|referred to by|who is|which is|n\/a|none|unnamed|unidentified)\b/i;
  if (descriptionMarkers.test(trimmed)) {
    return { valid: false, reason: 'contains description markers' };
  }

  return { valid: true };
};
