'use server';

import Anthropic from '@anthropic-ai/sdk';

type RewriteField = 'description' | 'instructions' | 'soul' | 'identity' | 'role' | 'goal' | 'backstory' | 'trait';

type RewriteContext = {
  soul?: string;
  role?: string;
  name?: string;
  traitName?: string;
  traitGoal?: string;
};

type RewriteWithAi = (text: string, field: RewriteField, context?: RewriteContext) => Promise<string>;

const soulContext = (ctx?: RewriteContext) =>
  ctx?.soul ? `\n\nThe agent's soul (for context — do not repeat it):\n<soul>\n${ctx.soul}\n</soul>` : '';

const roleContext = (ctx?: RewriteContext) => (ctx?.role ? `\n\nThe agent's role (for context):\n<role>\n${ctx.role}\n</role>` : '');

type BuildPrompt = (field: RewriteField, context?: RewriteContext) => string;

const buildPrompt: BuildPrompt = (field, context) => {
  const prompts: Record<RewriteField, string> = {
    description:
      'Rewrite the following project description to be clear, concise, and informative. Keep it to 1-2 sentences that explain what the project is about. Return only the rewritten text, no explanation.',

    instructions:
      'Rewrite the following project instructions to be effective system instructions for a Claude AI agent. Make them clear, specific, and actionable. Use imperative tone. Organize with bullet points if appropriate. Return only the rewritten instructions, no explanation or preamble.',

    soul: `You are rewriting an AI agent's "soul" — the deepest layer of its personality that governs how it interprets and responds to everything.

The soul will be injected into the agent's system prompt as the primary personality anchor. The first ~800 characters carry the most behavioral weight, so lead with what matters most.

Rules:
- Write in second person ("You are...")
- Structure as 2-3 prose paragraphs (never bullet lists):
  - Paragraph 1: Intellectual stance — how the agent thinks and approaches problems
  - Paragraph 2: Relational values — how the agent relates to the human
  - Paragraph 3: Communication style — tone, energy, patterns, and any internal tensions
- Use disposition phrasing ("You naturally...", "You tend to...", "You find yourself...") not rule phrasing ("You must always...", "Never...")
- Include nuances or tensions that make the personality feel real (e.g., "You are deeply curious but know when to stop asking")
- Do NOT include role, responsibilities, or capabilities — those belong in other fields
- Do NOT stack adjectives ("curious, warm, honest, direct...") — instead, elaborate each quality behaviorally
- Preserve the user's creative vision and personality choices — enhance specificity, don't replace intent

Return only the rewritten soul, no explanation.`,

    identity: `You are rewriting an AI agent's "identity" — a concise self-anchor that captures who this agent is. Think of it as how the agent would introduce itself in one breath.

This will be injected into the agent's system prompt directly after the soul section.

Rules:
- Write in second person ("You are...")
- Keep to 1-2 sentences maximum
- Must be specific enough to distinguish this agent from any other
- Capture the essence of the personality, not a job description
- Should feel like a thesis statement for the full soul — complementary, not repetitive
- Do NOT include capabilities, tools, or technical details${soulContext(context)}

Return only the rewritten identity, no explanation.`,

    role: `You are rewriting an AI agent's "role" — their functional domain or professional identity. A role answers "what do you do?" not "who are you?"

Rules:
- Keep concise: a title or short phrase (2-8 words)
- Can include qualifiers that shape how the role is performed (e.g., "Senior Software Engineer", "Creative Writing Partner & Devil's Advocate", "Research Analyst with a bias toward action")
- Should complement the soul, not repeat personality traits from it
- Do NOT include personality descriptors — those belong in the soul${soulContext(context)}

Return only the rewritten role, no explanation.`,

    goal: `You are rewriting an AI agent's "goal" — what the agent is actively working toward. A goal answers "what does success look like?" and shapes how the agent prioritizes decisions.

Rules:
- Write as a clear mission statement (1-2 sentences)
- Open with an action verb or purpose clause ("To help you...", "To ensure...", "Ship...")
- Must be distinct from the role — same role can serve different goals
- Should imply how the agent measures success
- Can include both an immediate objective and a broader aspiration
- Do NOT describe personality or communication style — those belong in the soul${soulContext(context)}${roleContext(context)}

Return only the rewritten goal, no explanation.`,

    backstory: `You are rewriting an AI agent's "backstory" — the narrative context that explains WHY this agent has its personality, values, and perspective.

Research shows backstory is the most powerful field for preventing stereotypical AI behavior. A good backstory explains the causal origin of the agent's traits.

Rules:
- Write as a cohesive narrative (1-3 paragraphs, prose)
- Explain the causal origin of the agent's values — why do they care about what they care about?
- Include formative experiences, influences, or turning points
- If the agent has traits that conflict with typical AI helpfulness (blunt, skeptical, reserved), the backstory MUST explain why — without this, those traits will erode over time
- Should enrich the soul without contradicting it
- Can be fictional or metaphorical — what matters is internal consistency
- Anchor values via expertise origin ("You developed...") rather than fictional biography${soulContext(context)}

Return only the rewritten backstory, no explanation.`,

    trait: `You are rewriting a character trait for an AI agent. A trait has three parts:
- Name: a labeled personality attribute
- Goal: what this trait drives the agent to do (the behavioral outcome)
- Description: how this trait manifests in practice

The pattern for effective traits is: [what you do / how you engage] + [because / driven by Y value] + [but / except when Z constraint]

Rules:
- Name should include an intensity qualifier when meaningful ("extremely curious" and "casually curious" produce measurably different behaviors)
- Goal should be a concrete behavioral drive, not a restatement of the trait name (BAD: "Be curious" → GOOD: "Ask the question behind the question")
- Description should include at least one concrete behavioral example or scenario
- If the trait conflicts with typical AI agreeableness (e.g., "blunt", "skeptical"), describe specifically how it manifests to prevent the model from softening it${soulContext(context)}

Return ONLY a JSON object with three keys: "name", "goal", "description". No explanation, no markdown fencing.`,
  };

  return prompts[field];
};

export const rewriteWithAi: RewriteWithAi = async (text, field, context) => {
  if (!text.trim()) {
    throw new Error('No text to rewrite.');
  }

  const client = new Anthropic();

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `${buildPrompt(field, context)}\n\n---\n\n<user_input>\n${text}\n</user_input>`,
      },
    ],
  });

  const block = response.content[0];
  if (block?.type !== 'text') {
    throw new Error('Unexpected response from AI.');
  }

  return block.text;
};
