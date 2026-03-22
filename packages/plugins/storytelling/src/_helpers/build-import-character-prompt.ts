type ExistingCharacter = {
  name: string;
  aliases: string[];
};

type BuildImportCharacterPromptInput = {
  text: string;
  existingCharacters: ExistingCharacter[];
};

type BuildImportCharacterPrompt = (input: BuildImportCharacterPromptInput) => string;

export const buildImportCharacterPrompt: BuildImportCharacterPrompt = (input) => {
  const { text, existingCharacters } = input;

  const existingList =
    existingCharacters.length > 0
      ? existingCharacters.map((c) => `- ${c.name}${c.aliases.length > 0 ? ` (aliases: ${c.aliases.join(', ')})` : ''}`).join('\n')
      : '(none yet)';

  return `You are importing character profiles into a story canon. These characters are emotionally significant — they represent real aspects of the author's inner self. Preserve every nuance of personality, do not flatten or summarize.

## Already Existing Characters
${existingList}

## Character Profiles to Import
${text}

---

Extract each character as a JSON object. For characters that already exist (name match or alias match), use action "update" to enrich their profile. For new characters, use action "create".

### Rules
1. **Character names MUST be 1-4 words** — a proper name, nickname, or short descriptor (e.g., "Quinn", "The Expander", "CIS 405 Guy"). NEVER use a sentence, status description, or role description as a name.
2. **Omit unidentifiable characters**: If you cannot determine a proper name or nickname, do NOT create a character record. Do not invent names for vaguely referenced people.
3. **Preserve texture**: If a profile says "she hides vulnerability behind sarcasm but melts when someone sees through it" — keep that EXACT phrasing in the personality field. Do not rephrase as "sarcastic but vulnerable."
4. **All fields are optional**: Only include fields that have content in the source material.
5. **Relationships are specific**: "Close to Kai" is less useful than "Kai is the first person she let see her cry — they share a quiet understanding that doesn't need words."
6. **Aliases**: If the profile mentions nicknames or alternate names, include them.

### JSON Schema

\`\`\`json
{
  "characters": [
    {
      "action": "create" | "update",
      "name": "canonical name (1-4 words max — proper name, nickname, or short descriptor. NEVER a sentence)",
      "aliases": ["nickname", "short name"],
      "fields": {
        "appearance": "physical description",
        "personality": "personality with full nuance preserved",
        "mannerisms": "speech patterns, habits, physical tells",
        "motives": "what drives them, what they want",
        "backstory": "history and background",
        "relationships": "specific relationships with other characters"
      }
    }
  ]
}
\`\`\`

Output ONLY valid JSON.`;
};
