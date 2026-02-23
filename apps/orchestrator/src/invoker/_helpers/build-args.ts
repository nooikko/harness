// Argument builder for Claude CLI invocations

export type BuildArgsOptions = {
  model: string;
  allowedTools?: string[];
  maxTokens?: number;
};

type BuildArgs = (prompt: string, options: BuildArgsOptions) => string[];

export const buildArgs: BuildArgs = (prompt, options) => {
  const args: string[] = ['-p', prompt, '--model', options.model, '--output-format', 'text'];

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
