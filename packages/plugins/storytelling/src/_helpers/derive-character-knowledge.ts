type CharacterInMomentRecord = {
  characterId: string | null;
  characterName: string;
  momentId: string;
  knowledgeGained: string | null;
};

type StoryMomentRecord = {
  id: string;
  summary: string;
  importance: number;
};

type KnowledgeResult = {
  knows: string[];
  doesNotKnow: string[];
};

type DeriveCharacterKnowledge = (
  characterId: string,
  characterMoments: CharacterInMomentRecord[],
  allMoments: StoryMomentRecord[],
) => KnowledgeResult;

const SIGNIFICANCE_THRESHOLD = 7;

export const deriveCharacterKnowledge: DeriveCharacterKnowledge = (characterId, characterMoments, allMoments) => {
  const knowsSet = new Set<string>();
  const participatedMomentIds = new Set<string>();

  for (const cm of characterMoments) {
    participatedMomentIds.add(cm.momentId);
    if (cm.knowledgeGained) {
      knowsSet.add(cm.knowledgeGained);
    }
  }

  const doesNotKnowSet = new Set<string>();

  for (const moment of allMoments) {
    if (moment.importance >= SIGNIFICANCE_THRESHOLD && !participatedMomentIds.has(moment.id)) {
      doesNotKnowSet.add(moment.summary);
    }
  }

  return {
    knows: [...knowsSet],
    doesNotKnow: [...doesNotKnowSet],
  };
};
