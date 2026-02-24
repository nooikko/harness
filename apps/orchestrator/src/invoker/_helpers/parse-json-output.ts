// Parses Claude CLI JSON output into structured fields

export type ParsedJsonOutput = {
  result: string;
  sessionId?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
};

type ParseJsonOutput = (raw: string) => ParsedJsonOutput;

export const parseJsonOutput: ParseJsonOutput = (raw) => {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return { result: '' };
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;

    const result = typeof parsed.result === 'string' ? parsed.result : trimmed;
    const sessionId = typeof parsed.session_id === 'string' ? parsed.session_id : undefined;
    const model = typeof parsed.model === 'string' ? parsed.model : undefined;

    const usage = parsed.usage as Record<string, unknown> | undefined;
    const inputTokens = typeof usage?.input_tokens === 'number' ? usage.input_tokens : undefined;
    const outputTokens = typeof usage?.output_tokens === 'number' ? usage.output_tokens : undefined;

    return { result, sessionId, model, inputTokens, outputTokens };
  } catch {
    return { result: trimmed };
  }
};
