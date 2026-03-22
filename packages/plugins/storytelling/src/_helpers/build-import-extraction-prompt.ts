type CharacterRef = {
  id: string;
  name: string;
  aliases?: string[];
  personality?: string | null;
};

type LocationRef = {
  id: string;
  name: string;
  parentName?: string;
};

type RecentMomentRef = {
  summary: string;
  storyTime: string | null;
  characterNames: string[];
};

type BuildImportExtractionPromptInput = {
  characters: CharacterRef[];
  locations: LocationRef[];
  storyTime: string | null;
  content: string;
  contentLabel?: string;
  recentMoments?: RecentMomentRef[];
};

type BuildImportExtractionPrompt = (input: BuildImportExtractionPromptInput) => string;

export const buildImportExtractionPrompt: BuildImportExtractionPrompt = (input) => {
  const { characters, locations, storyTime, content, contentLabel, recentMoments } = input;

  const characterList =
    characters.length > 0
      ? characters
          .map((c) => {
            const aliasStr = c.aliases && c.aliases.length > 0 ? ` (aliases: ${c.aliases.map((a) => `"${a}"`).join(', ')})` : '';
            const personalityStr = c.personality ? ` — ${c.personality.slice(0, 100)}` : '';
            return `- ${c.name}${aliasStr} (id: ${c.id})${personalityStr}`;
          })
          .join('\n')
      : '(none yet)';

  const locationList =
    locations.length > 0
      ? locations
          .map((l) => {
            const parent = l.parentName ? ` (inside: ${l.parentName})` : '';
            return `- ${l.name}${parent} (id: ${l.id})`;
          })
          .join('\n')
      : '(none yet)';

  const timeContext = storyTime ? `Current story time: ${storyTime}` : 'Story time: not established yet';

  const recentMomentsSection =
    recentMoments && recentMoments.length > 0
      ? `## Recently Extracted Moments (watch for re-tellings)\n${recentMoments.map((m) => `- [${m.storyTime ?? '?'}] ${m.summary} (${m.characterNames.join(', ')})`).join('\n')}`
      : '';

  const label = contentLabel ? ` (${contentLabel})` : '';

  return `You are extracting story state from a collaborative storytelling document for import into a canonical timeline. This is a therapeutic storytelling project — the characters are emotionally significant. Preserving texture, specificity, and relationship dynamics is critical.

## Existing Characters
${characterList}

## Existing Locations
${locationList}

## ${timeContext}

${recentMomentsSection}

## Content to Process${label}
${content}

---

## Extraction Instructions

Extract the following as a JSON object. This is an IMPORT operation — be thorough. Extract EVERY significant moment, not just the most important ones.

### Character Name Rules (STRICT)

- Character names MUST be 1-4 words — a proper name, nickname, or short descriptor (e.g., "Quinn", "The Expander", "CIS 405 Guy")
- NEVER use a sentence, status description, or role description as a name (e.g., "mentioned; not present" is NOT a name)
- If you cannot determine a proper name or nickname for someone, OMIT them entirely — do NOT create a character record
- Do NOT create a character record for someone who is only vaguely referenced without any identifying name or nickname

### Extraction Priority Rules

1. **Emotional-beat granularity**: Extract moments at the level of emotional shifts, not plot summaries. "During practice, Kai noticed Violet struggling and quietly showed her the grip without making a big deal of it" is ONE moment — not "the team practiced."

2. **Multi-character dynamics**: For each moment, list EVERY character present — not just the speaker. Each character gets:
   - Their specific role (not just "witness" — "the one who noticed first", "the one who looked away because she doesn't know how to help")
   - Their perspective (what this meant to THEM)
   - Emotional impact (how it changed them)
   - Relationship context (how this shifted their relationship with others present)

3. **Preserve specifics**: "under the streetlight" not "outside". "she whispered" not "she said". "magnesium" not "a supplement". Concrete details make moments real.

4. **Detect drift/re-tellings**: If a moment in this content looks like it describes the same event as one in "Recently Extracted Moments" above (same characters, same emotional beat, different day or slightly different details), include it BUT add a \`driftFlag\` field set to true with a \`driftNote\` explaining which existing moment it resembles. Do NOT skip it — flag it for human review.

5. **Count characters precisely**: If the text says "the girls" without naming them, flag it in the moment's description rather than guessing who was present. Only list characters you can specifically identify.

6. **Character development**: When a character shows growth, vulnerability, or a shift in behavior, capture it in a character update with the specific trait that changed. "More open" is too vague — "allowed herself to cry in front of someone for the first time" preserves the moment.

### JSON Schema

\`\`\`json
{
  "characters": [
    {
      "action": "create" | "update",
      "name": "string (1-4 words max — proper name, nickname, or short descriptor. NEVER a sentence or description)",
      "fields": { "appearance?": "", "personality?": "", "mannerisms?": "", "motives?": "", "backstory?": "", "relationships?": "", "color?": "", "status?": "" }
    }
  ],
  "moments": [
    {
      "summary": "1-2 sentence summary preserving emotional specificity",
      "description": "optional longer description with concrete details",
      "storyTime": "optional — when in the story this happened",
      "locationId": "ID of existing location (if known)",
      "newLocationName": "name if this is a NEW location",
      "newLocationDescription": "description of new location",
      "kind": "dialogue | action | revelation | bonding | confrontation | intimate | breakthrough | comedic | routine | decision",
      "importance": 1-10,
      "driftFlag": false,
      "driftNote": "optional — why this might be a re-telling of an existing moment",
      "characters": [
        {
          "name": "character name",
          "role": "protagonist | witness | antagonist | supporting | mentioned | observer | comforter | catalyst",
          "perspective": "what this moment means from this character's POV",
          "emotionalImpact": "how this affects them emotionally",
          "knowledgeGained": "what they learned",
          "relationshipContext": "how this changes their relationship with others in the scene"
        }
      ]
    }
  ],
  "locations": [
    {
      "action": "create" | "update",
      "name": "string",
      "description": "optional",
      "parentName": "optional parent location name"
    }
  ],
  "scene": {
    "characters": ["names currently in scene"],
    "location": "current location name or null",
    "storyTime": "current story time or null"
  } | null,
  "aliases": [
    { "alias": "alternate name used", "resolvedName": "canonical character name" }
  ]
}
\`\`\`

Output ONLY valid JSON. If nothing to extract for a category, use an empty array (or null for scene).`;
};
