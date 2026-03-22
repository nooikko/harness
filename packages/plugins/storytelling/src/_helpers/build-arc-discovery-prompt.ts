type SeedMoment = {
  summary: string;
  storyTime: string | null;
  characterNames: string[];
};

type MomentCandidate = {
  id: string;
  summary: string;
  storyTime: string | null;
  characterNames: string[];
};

type BuildArcDiscoveryPromptInput = {
  arcName: string;
  arcDescription: string | null;
  arcAnnotation: string | null;
  seedMoments: SeedMoment[];
  candidates: MomentCandidate[];
  guidance?: string;
};

type BuildArcDiscoveryPrompt = (input: BuildArcDiscoveryPromptInput) => string;

export const buildArcDiscoveryPrompt: BuildArcDiscoveryPrompt = (input) => {
  const { arcName, arcDescription, arcAnnotation, seedMoments, candidates, guidance } = input;

  const seedList = seedMoments.map((m, i) => `${i + 1}. [${m.storyTime ?? '?'}] ${m.summary} (${m.characterNames.join(', ') || 'none'})`).join('\n');

  const candidateList = candidates
    .map((m, i) => `${i + 1}. [${m.id}] (${m.storyTime ?? '?'}) ${m.summary} — characters: ${m.characterNames.join(', ') || 'none'}`)
    .join('\n');

  const descSection = arcDescription ? `\nDescription: ${arcDescription}` : '';
  const annotSection = arcAnnotation ? `\nWhy this arc matters: ${arcAnnotation}` : '';
  const guidanceSection = guidance ? `\n\n## Additional Guidance\n${guidance}` : '';

  return `You are searching for moments that belong to a story arc. An arc is a narrative thread connecting related events across time and characters.

## Arc: "${arcName}"${descSection}${annotSection}

## Seed Moments (already in this arc)
${seedList}
${guidanceSection}

## Candidate Moments (not yet in this arc)
${candidateList}

---

## Instructions

Examine each candidate moment and determine if it is related to the arc "${arcName}". A moment is related if it:
- Directly references the arc's theme (e.g., mentions the same topic, event, or relationship)
- Shows thematic parallels (similar emotional beats or character dynamics)
- Represents foreshadowing or a callback to the arc's events
- Shows a character's behavior that connects to the arc (e.g., walls going up/down in a trust arc)
- Is part of the cause-and-effect chain leading to or from the seed moments

For each related candidate, explain WHY it belongs — not just "it mentions X" but "this is when she first hinted at Y, which is the seed of the arc."

Rate confidence: high (clearly part of this arc), medium (likely related), low (possible connection).

Output ONLY valid JSON:

\`\`\`json
{
  "related": [
    {
      "momentId": "id from the candidate list",
      "confidence": "high" | "medium" | "low",
      "explanation": "why this moment belongs in this arc"
    }
  ]
}
\`\`\`

If no candidates are related, return \`{ "related": [] }\`.`;
};
