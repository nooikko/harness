// Computes which MCP tools to suppress based on thread kind.
// Storytelling threads only need storytelling + time + identity tools.

const STORYTELLING_ALLOWED_PREFIXES = ['storytelling__', 'time__', 'identity__'];

type ComputeDisallowedTools = (threadKind: string, allToolNames: string[]) => string[] | undefined;

export const computeDisallowedTools: ComputeDisallowedTools = (threadKind, allToolNames) => {
  if (threadKind !== 'storytelling') {
    return undefined;
  }

  const disallowed = allToolNames.filter((name) => !STORYTELLING_ALLOWED_PREFIXES.some((prefix) => name.startsWith(prefix)));

  return disallowed.length > 0 ? disallowed : undefined;
};
