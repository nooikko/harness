// Computes which MCP tools to suppress based on thread kind.
// Storytelling threads only see storytelling + time + identity tools.
// Non-storytelling threads never see storytelling tools.

const STORYTELLING_ALLOWED_PREFIXES = ['storytelling__', 'time__', 'identity__'];
const STORYTELLING_PREFIX = 'storytelling__';

type ComputeDisallowedTools = (threadKind: string, allToolNames: string[]) => string[] | undefined;

export const computeDisallowedTools: ComputeDisallowedTools = (threadKind, allToolNames) => {
  let disallowed: string[];

  if (threadKind === 'storytelling') {
    // Storytelling threads: only allow storytelling + time + identity tools
    disallowed = allToolNames.filter((name) => !STORYTELLING_ALLOWED_PREFIXES.some((prefix) => name.startsWith(prefix)));
  } else {
    // All other threads: hide storytelling tools
    disallowed = allToolNames.filter((name) => name.startsWith(STORYTELLING_PREFIX));
  }

  return disallowed.length > 0 ? disallowed : undefined;
};
