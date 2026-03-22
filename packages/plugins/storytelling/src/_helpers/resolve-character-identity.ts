type SimilarCharacter = {
  characterId: string;
  name: string;
  score: number;
};

type ResolutionResult =
  | { action: 'create' }
  | { action: 'merge'; targetId: string; targetName: string }
  | { action: 'judge'; candidates: SimilarCharacter[] };

type ResolveCharacterIdentity = (candidates: SimilarCharacter[]) => ResolutionResult;

const AUTO_MERGE_THRESHOLD = 0.85;
const JUDGE_THRESHOLD = 0.65;

export const resolveCharacterIdentity: ResolveCharacterIdentity = (candidates) => {
  if (candidates.length === 0) {
    return { action: 'create' };
  }

  const best = candidates[0]!;

  if (best.score >= AUTO_MERGE_THRESHOLD) {
    return {
      action: 'merge',
      targetId: best.characterId,
      targetName: best.name,
    };
  }

  const uncertainCandidates = candidates.filter((c) => c.score >= JUDGE_THRESHOLD);
  if (uncertainCandidates.length > 0) {
    return { action: 'judge', candidates: uncertainCandidates };
  }

  return { action: 'create' };
};
