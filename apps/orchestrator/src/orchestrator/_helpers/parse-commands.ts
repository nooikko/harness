// Command parser — detects slash commands in Claude's response output

export type ParsedCommand = {
  command: string;
  args: string;
};

/**
 * Matches lines that start with a slash command (e.g. `/delegate some-agent "do this"`).
 * Commands must appear at the start of a line (after optional whitespace) and consist
 * of lowercase letters, digits, or hyphens. Everything after the command name on that
 * line is treated as the argument string.
 */
const COMMAND_PATTERN = /^\s*\/([a-z][a-z0-9-]*)\s*(.*)/gm;

type ParseCommands = (output: string) => ParsedCommand[];

export const parseCommands: ParseCommands = (output) => {
  const commands: ParsedCommand[] = [];
  let match: RegExpExecArray | null = COMMAND_PATTERN.exec(output);

  while (match !== null) {
    const command = match[1] as string;
    const args = (match[2] as string).trim();
    commands.push({ command, args });
    match = COMMAND_PATTERN.exec(output);
  }

  // Reset the regex lastIndex for reuse
  COMMAND_PATTERN.lastIndex = 0;

  return commands;
};
