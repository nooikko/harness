// Internal helpers for the invoker module

type BuildArgsOptions = {
  model: string;
  allowedTools?: string[];
  maxTokens?: number;
};

const buildArgs = (prompt: string, options: BuildArgsOptions): string[] => {
  const args: string[] = [
    "-p",
    prompt,
    "--model",
    options.model,
    "--output-format",
    "text",
  ];

  if (options.allowedTools && options.allowedTools.length > 0) {
    for (const tool of options.allowedTools) {
      args.push("--allowedTools", tool);
    }
  }

  if (options.maxTokens) {
    args.push("--max-tokens", String(options.maxTokens));
  }

  return args;
};

export { buildArgs };
export type { BuildArgsOptions };
