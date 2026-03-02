import type { Agent } from '@harness/database';

type FormatIdentityAnchor = (agent: Agent) => string;

export const formatIdentityAnchor: FormatIdentityAnchor = (agent) => {
  // Extract first non-empty line of soul as the core principle
  const firstSoulLine = agent.soul.split('\n').find((line) => line.trim().length > 0) ?? '';
  const corePrinciple = firstSoulLine.replace(/^#+\s*/, '').trim();

  return [
    `## ${agent.name} — Behavioral Anchor`,
    `You are ${agent.name}. Stay true to your soul and identity above.`,
    corePrinciple ? `Core principle: ${corePrinciple}` : '',
  ]
    .filter(Boolean)
    .join('\n');
};
