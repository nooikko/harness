import type { MemoryScope } from '@harness/database';

type ClassifyMemoryScope = (context: { projectId?: string | null; threadId?: string | null; haikuScope?: string | null }) => MemoryScope;

export const classifyMemoryScope: ClassifyMemoryScope = (context) => {
  const rawScope = context.haikuScope?.toUpperCase();

  // Trust Haiku classification if valid
  if (rawScope === 'THREAD' && context.threadId) {
    return 'THREAD';
  }
  if (rawScope === 'PROJECT' && context.projectId) {
    return 'PROJECT';
  }
  if (rawScope === 'AGENT') {
    return 'AGENT';
  }

  // Fallback heuristic: THREAD without threadId → PROJECT, PROJECT without projectId → AGENT
  if (rawScope === 'THREAD' && !context.threadId && context.projectId) {
    return 'PROJECT';
  }

  // Simple heuristic when Haiku scope missing or invalid
  if (context.projectId) {
    return 'PROJECT';
  }

  return 'AGENT';
};
