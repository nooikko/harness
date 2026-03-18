type CharacterMoment = {
  storyTime?: string | null;
  locationName?: string | null;
  summary: string;
  perspective?: string | null;
  emotionalImpact?: string | null;
  knowledgeGained?: string | null;
};

type CharacterInput = {
  name: string;
  appearance?: string | null;
  personality?: string | null;
  mannerisms?: string | null;
  motives?: string | null;
  backstory?: string | null;
  relationships?: string | null;
  moments: CharacterMoment[];
};

type KnowledgeInput = {
  knows: string[];
  doesNotKnow: string[];
};

type FormatCharacterFull = (character: CharacterInput, knowledge: KnowledgeInput) => string;

const MAX_MOMENTS = 5;

export const formatCharacterFull: FormatCharacterFull = (character, knowledge) => {
  const lines: string[] = [`### ${character.name}`];

  if (character.appearance) {
    lines.push(`Appearance: ${character.appearance}`);
  }
  if (character.personality) {
    lines.push(`Personality: ${character.personality}`);
  }
  if (character.mannerisms) {
    lines.push(`Mannerisms: ${character.mannerisms}`);
  }
  if (character.motives) {
    lines.push(`Motives: ${character.motives}`);
  }
  if (character.backstory) {
    lines.push(`Backstory: ${character.backstory}`);
  }
  if (character.relationships) {
    lines.push(`Relationships: ${character.relationships}`);
  }

  const moments = character.moments.slice(0, MAX_MOMENTS);
  if (moments.length > 0) {
    lines.push(`Key moments (${character.name}'s perspective):`);
    for (const moment of moments) {
      const locationPart = moment.locationName ? ` @ ${moment.locationName}` : '';
      const timePart = moment.storyTime ? `${moment.storyTime}` : '';
      const prefix = timePart || locationPart ? `${timePart}${locationPart}: ` : '';
      lines.push(`  - ${prefix}${moment.summary}`);
      if (moment.perspective) {
        lines.push(`    "${moment.perspective}"`);
      }
      if (moment.emotionalImpact) {
        lines.push(`    Impact: ${moment.emotionalImpact}`);
      }
    }
  }

  if (knowledge.knows.length > 0) {
    lines.push(`Knows: ${knowledge.knows.join(', ')}`);
  }
  if (knowledge.doesNotKnow.length > 0) {
    lines.push(`Does NOT know: ${knowledge.doesNotKnow.join(', ')}`);
  }

  return lines.join('\n');
};
