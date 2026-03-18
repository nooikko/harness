type CharacterRef = {
  id: string;
  name: string;
};

type LocationRef = {
  id: string;
  name: string;
  parentName?: string;
};

type BuildExtractionPromptInput = {
  characters: CharacterRef[];
  locations: LocationRef[];
  storyTime: string | null;
  latestExchange: string;
};

type BuildExtractionPrompt = (input: BuildExtractionPromptInput) => string;

export const buildExtractionPrompt: BuildExtractionPrompt = (input) => {
  const { characters, locations, storyTime, latestExchange } = input;

  const characterList = characters.length > 0 ? characters.map((c) => `- ${c.name} (id: ${c.id})`).join('\n') : '(none yet)';

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

  return `You are a story state extractor. Read the latest exchange from a collaborative storytelling session and extract structured data.

## Existing Characters
${characterList}

## Existing Locations
${locationList}

## ${timeContext}

## Latest Exchange
${latestExchange}

---

Analyze the exchange above and extract the following as a JSON object:

1. **characters**: New or updated characters. For each:
   - action: "create" (new character) or "update" (existing character changed)
   - name: character name (use existing name if updating)
   - fields: object with any of: appearance, personality, mannerisms, motives, backstory, relationships, color, status

2. **moments**: Significant story events that happened in this exchange. For each:
   - summary: 1-sentence summary
   - description: optional longer description
   - storyTime: optional story-time when it happened
   - locationId: ID of an existing location where it happened (if known)
   - newLocationName: if the moment happens at a NEW location not in the existing list, provide its name here
   - newLocationDescription: description of the new location
   - kind: one of "dialogue", "action", "revelation", "emotional", "worldbuilding", "combat", "transition"
   - importance: 1-10 scale
   - characters: array of characters involved:
     - name: character name
     - role: "protagonist", "antagonist", "supporting", "mentioned", "observer"
     - perspective: optional — what this moment means from this character's point of view
     - emotionalImpact: optional — how this affects the character emotionally
     - knowledgeGained: optional — what the character learned

3. **locations**: New or updated locations. For each:
   - action: "create" or "update"
   - name: location name
   - description: optional description
   - parentName: optional — name of parent location (containment)

4. **scene**: Current scene state after this exchange (or null if unclear):
   - characters: array of character names currently present in the scene
   - location: name of current location (or null)
   - storyTime: current story time (or null)

5. **aliases**: Character name aliases discovered (e.g., "the knight" refers to "Sir Aldric"). For each:
   - alias: the alternate name used
   - resolvedName: the canonical character name it refers to

Output ONLY valid JSON matching this structure. If nothing to extract for a category, use an empty array (or null for scene).

\`\`\`json
{
  "characters": [],
  "moments": [],
  "locations": [],
  "scene": null,
  "aliases": []
}
\`\`\``;
};
