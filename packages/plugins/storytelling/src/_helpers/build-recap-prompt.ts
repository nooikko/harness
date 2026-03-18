type RecapCharacter = {
  name: string;
  personality?: string | null;
  appearance?: string | null;
  status: string;
};

type RecapMoment = {
  summary: string;
  storyTime?: string | null;
  characterNames: string[];
};

type RecapMessage = {
  role: string;
  content: string;
};

type BuildRecapPromptInput = {
  characters: RecapCharacter[];
  moments: RecapMoment[];
  recentMessages: RecapMessage[];
  premise: string | null;
};

type BuildRecapPrompt = (input: BuildRecapPromptInput) => string;

export const buildRecapPrompt: BuildRecapPrompt = (input) => {
  const sections: string[] = [];

  // Story premise
  if (input.premise) {
    sections.push(`## Story Premise\n\n${input.premise}`);
  }

  // Cast state
  if (input.characters.length > 0) {
    const characterLines = input.characters.map((c) => {
      const parts = [`- **${c.name}** (${c.status})`];
      if (c.personality) {
        parts.push(`  Personality: ${c.personality}`);
      }
      if (c.appearance) {
        parts.push(`  Appearance: ${c.appearance}`);
      }
      return parts.join('\n');
    });
    sections.push(`## Current Cast\n\n${characterLines.join('\n')}`);
  }

  // Key moments
  if (input.moments.length > 0) {
    const momentLines = input.moments.map((m) => {
      const timePart = m.storyTime ? ` [${m.storyTime}]` : '';
      const charPart = m.characterNames.length > 0 ? ` (${m.characterNames.join(', ')})` : '';
      return `- ${m.summary}${timePart}${charPart}`;
    });
    sections.push(`## Key Events So Far\n\n${momentLines.join('\n')}`);
  }

  // Recent messages (where we left off)
  if (input.recentMessages.length > 0) {
    const messageLines = input.recentMessages.map((m) => `**${m.role}:** ${m.content}`);
    sections.push(`## Where We Left Off\n\n${messageLines.join('\n\n')}`);
  }

  const body = sections.length > 0 ? sections.join('\n\n---\n\n') : 'No story context available yet.';

  return `# Story Recap\n\nThis is a continuation of an ongoing collaborative story. Here is everything you need to know to continue seamlessly.\n\n${body}\n\n---\n\n*Continue the story from where we left off. Maintain character voices, respect established facts, and build on recent events.*`;
};
