// Argument builder for Claude CLI invocations

export type BuildArgsOptions = {
  model: string;
  allowedTools?: string[];
  maxTokens?: number;
  sessionId?: string;
};

type BuildArgs = (prompt: string, options: BuildArgsOptions) => string[];

export const buildArgs: BuildArgs = (prompt, options) => {
  const args: string[] = ['--output-format', 'json', '--model', options.model];

  if (options.sessionId) {
    args.push('--resume', options.sessionId);
  }

  args.push('-p', prompt);

  if (options.allowedTools && options.allowedTools.length > 0) {
    for (const tool of options.allowedTools) {
      args.push('--allowedTools', tool);
    }
  }

  if (options.maxTokens) {
    args.push('--max-tokens', String(options.maxTokens));
  }

  return args;
};
