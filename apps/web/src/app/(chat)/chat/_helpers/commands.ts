type CommandCategory = 'input' | 'agent' | 'system';

type CommandDefinition = {
  name: string;
  description: string;
  args: string;
  category: CommandCategory;
};

const COMMANDS: CommandDefinition[] = [
  {
    name: 'current-time',
    description: 'Insert the current timestamp into the message',
    args: '',
    category: 'input',
  },
  {
    name: 'delegate',
    description: 'Delegate a task to a sub-agent (used by Claude in its responses)',
    args: '<prompt>',
    category: 'agent',
  },
  {
    name: 're-delegate',
    description: 'Re-delegate with an amended prompt after validation failure',
    args: '<prompt>',
    category: 'agent',
  },
  {
    name: 'checkin',
    description: 'Send a progress update from a sub-agent to the parent thread',
    args: '<message>',
    category: 'agent',
  },
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

export type { CommandDefinition, CommandCategory };
export { COMMANDS };
