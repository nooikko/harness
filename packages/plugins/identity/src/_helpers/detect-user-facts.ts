type DetectUserFacts = (parsed: { userFact?: string }) => string | null;

export const detectUserFacts: DetectUserFacts = (parsed) => {
  const fact = parsed.userFact?.trim();
  if (!fact || fact.length === 0) {
    return null;
  }
  return fact;
};
