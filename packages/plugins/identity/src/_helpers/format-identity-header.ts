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

  if (agent.role) {
    parts.push(`## Role\n\n${agent.role}`);
  }

  if (agent.goal) {
    parts.push(`## Goal\n\n${agent.goal}`);
  }

  if (agent.backstory) {
    parts.push(`## Backstory\n\n${agent.backstory}`);
  }

  // Separate SEMANTIC (user insight) memories into their own section
  const semanticMemories = memories.filter((m) => m.type === 'SEMANTIC');
  const nonSemanticMemories = memories.filter((m) => m.type !== 'SEMANTIC');

  if (semanticMemories.length > 0) {
    const lines = semanticMemories.map((m) => `- ${m.content}`);
    parts.push(`## What I Know About You\n\n${lines.join('\n')}`);
  }

  if (nonSemanticMemories.length > 0) {
    const coreMemories = nonSemanticMemories.filter((m) => m.scope === 'AGENT' || !m.scope);
    const projectMemories = nonSemanticMemories.filter((m) => m.scope === 'PROJECT');
    const threadMemories = nonSemanticMemories.filter((m) => m.scope === 'THREAD');

    const formatLine = (m: AgentMemory) => {
      const date = m.createdAt.toISOString().split('T')[0];
      return `- [${date}] [${m.type}] ${m.content}`;
    };

    const sections: string[] = [];

    if (coreMemories.length > 0) {
      sections.push(`### Core\n\n${coreMemories.map(formatLine).join('\n')}`);
    }

    if (projectMemories.length > 0) {
      sections.push(`### Project Context\n\n${projectMemories.map(formatLine).join('\n')}`);
    }

    if (threadMemories.length > 0) {
      sections.push(`### This Conversation\n\n${threadMemories.map(formatLine).join('\n')}`);
    }

    parts.push(`## Relevant Memory\n\n${sections.join('\n\n')}`);
  }

  // Chain of Persona instruction (PCL 2025 — drives character consistency)
  parts.push(`> Before responding, briefly consider: given who you are as ${agent.name} and what you stand for, what is the right response here?`);

  return parts.join('\n\n');
};
