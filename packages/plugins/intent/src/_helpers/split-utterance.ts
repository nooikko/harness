export type SplitUtterance = (utterance: string) => string[];

// Word-boundary conjunctions — \b ensures we don't split "brand", "command", "android" etc.
const CONJUNCTION_PATTERN = /\b(?:and|then|also)\b/i;

export const splitUtterance: SplitUtterance = (utterance) => {
  return utterance
    .split(CONJUNCTION_PATTERN)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
};
