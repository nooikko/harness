// Response parser — extracts [COMMAND] blocks and regular content from agent responses

export type CommandBlock = {
  type: string;
  params: Record<string, string>;
  content: string;
};

export type ParsedResponse = {
  commands: CommandBlock[];
  message: string;
};

/**
 * Matches [COMMAND ...params] ... [/COMMAND] blocks.
 * Uses a non-greedy match for content between opening and closing tags.
 * The opening tag can contain key="value" attribute pairs.
 */
const COMMAND_BLOCK_PATTERN = /\[COMMAND([^\]]*)\]([\s\S]*?)\[\/COMMAND\]/g;

/**
 * Matches key="value" or key='value' pairs inside the opening [COMMAND ...] tag.
 * Uses backreference (\2) to match the same quote character that opened the value.
 */
const PARAM_PATTERN = /(\w+)=(["'])([\s\S]*?)\2/g;

type StringAt = (arr: RegExpExecArray, idx: number) => string;

/**
 * Safely reads a string from a regex match array at the given index.
 * Returns empty string for undefined entries.
 */
const stringAt: StringAt = (arr, idx) => {
  return String(arr[idx] || "");
};

type ExtractParams = (attrString: string) => Record<string, string>;

const extractParams: ExtractParams = (attrString) => {
  const params: Record<string, string> = {};
  const entries = Array.from(attrString.matchAll(PARAM_PATTERN));

  for (const entry of entries) {
    const key = stringAt(entry, 1);
    const value = stringAt(entry, 3);
    if (key) {
      params[key] = value;
    }
  }

  return params;
};

type ParseResponse = (raw: string) => ParsedResponse;

export const parseResponse: ParseResponse = (raw) => {
  const commands: CommandBlock[] = [];
  let message = raw;
  const matches = Array.from(raw.matchAll(COMMAND_BLOCK_PATTERN));

  for (const match of matches) {
    const fullMatch = match[0];
    const attrString = stringAt(match, 1);
    const content = stringAt(match, 2).trim();

    const params = extractParams(attrString);
    const type = String(params.type || "");

    // Only include commands that have a type — malformed blocks without type are ignored
    if (type) {
      // Remove "type" from params since it is promoted to the top-level field
      const { type: _type, ...remainingParams } = params;
      commands.push({ type, params: remainingParams, content });
    }

    // Remove the command block from the message content
    message = message.replace(fullMatch, "");
  }

  // Clean up excessive whitespace left by removed blocks, but preserve structure
  message = message.replace(/\n{3,}/g, "\n\n").trim();

  return { commands, message };
};
