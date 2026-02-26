// Derives the plugin source name from a tool name.
// Plugin tools follow the convention "pluginName__methodName" (e.g. "delegationPlugin__delegate").
// Core Claude tools (Read, Bash, Write, etc.) return "builtin".

type ParsePluginSource = (toolName: string | undefined) => string;

export const parsePluginSource: ParsePluginSource = (toolName) => {
  if (!toolName) {
    return 'builtin';
  }
  const match = /^(\w+?)Plugin__/.exec(toolName);
  if (match?.[1]) {
    return match[1].toLowerCase();
  }
  return 'builtin';
};
