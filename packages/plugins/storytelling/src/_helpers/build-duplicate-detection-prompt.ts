type MomentRef = {
  id: string;
  summary: string;
  storyTime: string | null;
  kind: string;
  importance: number;
  characterNames: string[];
};

type BuildDuplicateDetectionPromptInput = {
  moments: MomentRef[];
  windowLabel?: string;
};

type BuildDuplicateDetectionPrompt = (input: BuildDuplicateDetectionPromptInput) => string;

export const buildDuplicateDetectionPrompt: BuildDuplicateDetectionPrompt = (input) => {
  const { moments, windowLabel } = input;

  const momentList = moments
    .map(
      (m, i) =>
        `${i + 1}. [${m.id}] (${m.storyTime ?? '?'}) ${m.summary} — ${m.kind}, importance ${m.importance}, characters: ${m.characterNames.join(', ') || 'none'}`,
    )
    .join('\n');

  const label = windowLabel ? ` for ${windowLabel}` : '';

  return `You are analyzing a story's canonical timeline${label} to detect duplicate or drifted moments — events that appear to describe the same thing but were extracted from different sources or represent AI drift (where the AI re-invented a scene that already happened).

## Moments to Analyze
${momentList}

---

## Instructions

Compare all moments above and identify pairs (or groups) that appear to describe the same event. Drift can be subtle:
- Same characters + same emotional beat but different story day
- Same scene described with slightly different details
- A character having the "same realization" twice at different points in the timeline
- Events with the same participants and location but minor detail changes

For each potential duplicate pair, provide:
1. The IDs of both moments
2. Which version appears to be the canonical one (usually the earlier one, unless the later one has better detail)
3. What specifically differs between them
4. Your confidence level (high/medium/low)
5. Whether this looks like AI drift (the AI forgot and re-created the scene) or a genuine story echo (intentional callback)

Output ONLY valid JSON:

\`\`\`json
{
  "duplicates": [
    {
      "momentA": "id of first moment",
      "momentB": "id of second moment",
      "canonicalId": "id of the version to keep",
      "differences": "what differs between them",
      "confidence": "high" | "medium" | "low",
      "isDrift": true | false,
      "explanation": "why this is a duplicate / drift"
    }
  ]
}
\`\`\`

If no duplicates are found, return \`{ "duplicates": [] }\`.`;
};
