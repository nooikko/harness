import { pluginToolRegistry } from '@/generated/plugin-tool-registry';

type CommandCategory = 'input' | 'agent' | 'system' | 'tool';

type CommandDefinition = {
  name: string;
  description: string;
  args: string;
  category: CommandCategory;
  pluginName?: string;
};

// System commands handled client-side (not sent to orchestrator)
const SYSTEM_COMMANDS: CommandDefinition[] = [
  {
    name: 'model',
    description: 'Change the AI model for this thread (resets the session)',
    args: '<model-name>',
    category: 'system',
  },
  {
    name: 'new',
    description: 'Start a fresh conversation in a new thread',
    args: '',
    category: 'system',
  },
  {
    name: 'clear',
    description: 'Start a fresh conversation in a new thread',
    args: '',
    category: 'system',
  },
];

// Agent-internal command not exposed as an MCP tool
const AGENT_COMMANDS: CommandDefinition[] = [
  {
    name: 're-delegate',
    description: 'Re-delegate with an amended prompt after validation failure',
    args: '<prompt>',
    category: 'agent',
  },
];

// Auto-discovered plugin tools (from build-time generation)
// Disambiguate tools that share the same toolName across plugins by prefixing with pluginName
const TOOL_COMMANDS: CommandDefinition[] = (() => {
  const nameCount = new Map<string, number>();
  for (const tool of pluginToolRegistry) {
    nameCount.set(tool.toolName, (nameCount.get(tool.toolName) ?? 0) + 1);
  }

  return pluginToolRegistry.map((tool) => ({
    name: (nameCount.get(tool.toolName) ?? 0) > 1 ? `${tool.pluginName}-${tool.toolName}` : tool.toolName,
    description: tool.description,
    args: tool.args,
    category: 'tool' as const,
    pluginName: tool.pluginName,
  }));
})();

const COMMANDS: CommandDefinition[] = [...SYSTEM_COMMANDS, ...AGENT_COMMANDS, ...TOOL_COMMANDS];

export type { CommandDefinition, CommandCategory };
export { COMMANDS };
