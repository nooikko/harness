import type { Agent, AgentMemory } from '@harness/database';

type FormatOptions = {
  soulMaxChars: number;
  identityMaxChars: number;
};

type FormatIdentityHeader = (agent: Agent, memories: AgentMemory[], options: FormatOptions) => string;

export const formatIdentityHeader: FormatIdentityHeader = (agent, memories, options) => {
  const soul = agent.soul.slice(0, options.soulMaxChars);
  const identity = agent.identity.slice(0, options.identityMaxChars);

  const parts = [`# ${agent.name} — Session Identity`];

  parts.push(`## Soul\n\n${soul}`);
  parts.push(`## Identity\n\n${identity}`);

  if (agent.userContext) {
    parts.push(`## User Context\n\n${agent.userContext}`);
  }

  if (memories.length > 0) {
    const memoryLines = memories.map((m) => {
      const date = m.createdAt.toISOString().split('T')[0];
      return `- [${date}] [${m.type}] ${m.content}`;
    });
    parts.push(`## Relevant Memory\n\n${memoryLines.join('\n')}`);
  }

  // Chain of Persona instruction (PCL 2025 — drives character consistency)
  parts.push(`> Before responding, briefly consider: given who you are as ${agent.name} and what you stand for, what is the right response here?`);

  return parts.join('\n\n');
};
