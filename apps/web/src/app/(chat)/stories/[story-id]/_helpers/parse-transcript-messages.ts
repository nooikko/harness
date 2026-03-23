type ParsedMessage = {
  index: number;
  role: 'human' | 'assistant';
  content: string;
};

type ParseTranscriptMessages = (rawContent: string) => ParsedMessage[];

export const parseTranscriptMessages: ParseTranscriptMessages = (rawContent) => {
  if (!rawContent.trim()) {
    return [];
  }

  const parts = rawContent.split(/\n\n(?=(?:Human|Assistant): )/);
  const messages: ParsedMessage[] = [];

  for (const part of parts) {
    if (!part.trim()) {
      continue;
    }

    if (part.startsWith('Human: ')) {
      messages.push({
        index: messages.length,
        role: 'human',
        content: part.slice(7),
      });
    } else if (part.startsWith('Assistant: ')) {
      messages.push({
        index: messages.length,
        role: 'assistant',
        content: part.slice(11),
      });
    }
  }

  return messages;
};

type SerializeTranscriptMessages = (messages: ParsedMessage[]) => string;

export const serializeTranscriptMessages: SerializeTranscriptMessages = (messages) => {
  return messages.map((m) => `${m.role === 'human' ? 'Human' : 'Assistant'}: ${m.content}`).join('\n\n');
};
