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
// Filter out agent-only tools (audience: "agent") — those are for Claude's MCP tools, not the / command menu
const TOOL_COMMANDS: CommandDefinition[] = (() => {
  const humanTools = pluginToolRegistry.filter((t) => t.audience !== 'agent');

  const nameCount = new Map<string, number>();
  for (const tool of humanTools) {
    nameCount.set(tool.toolName, (nameCount.get(tool.toolName) ?? 0) + 1);
  }

  return humanTools.map((tool) => ({
    name: (nameCount.get(tool.toolName) ?? 0) > 1 ? `${tool.pluginName}-${tool.toolName}` : tool.toolName,
    description: tool.description,
    args: tool.args,
    category: 'tool' as const,
    pluginName: tool.pluginName,
  }));
})();

const COMMANDS: CommandDefinition[] = [...SYSTEM_COMMANDS, ...AGENT_COMMANDS, ...TOOL_COMMANDS];

export type { CommandCategory, CommandDefinition };
export { COMMANDS };
