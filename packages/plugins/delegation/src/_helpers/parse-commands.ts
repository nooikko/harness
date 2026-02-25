// Parses slash commands from sub-agent output text
// Extracts lines matching /command args patterns for routing through onCommand hooks

export type ParsedCommand = {
  command: string;
  args: string;
};

type ParseCommands = (output: string) => ParsedCommand[];

export const parseCommands: ParseCommands = (output) => {
  const commands: ParsedCommand[] = [];

  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    const match = trimmed.match(/^\/([\w-]+)\s*(.*)/);
    if (match?.[1] !== undefined) {
      // match[2] is guaranteed to exist because (.*) always captures
      const args = match[2] as string;
      commands.push({ command: match[1], args: args.trim() });
    }
  }

  return commands;
};
