// Derives the plugin source name from a tool name.
// Plugin tools follow the convention "pluginName__methodName" (e.g. "delegation__delegate").
// Core Claude tools (Read, Bash, Write, etc.) return "builtin".

type ParsePluginSource = (toolName: string | undefined) => string;

const parsePluginSource: ParsePluginSource = (toolName) => {
  if (!toolName) {
    return 'builtin';
  }
  // Tool server generates names as `${p.name}__${t.name}` (e.g. "delegation__delegate")
  // The original orchestrator regex /^(\w+?)Plugin__/ was silently broken — never matched.
  const match = /^(\w+?)__/.exec(toolName);
  if (match?.[1]) {
    return match[1].toLowerCase();
  }
  return 'builtin';
};

export { parsePluginSource };
