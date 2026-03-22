type TranscriptMessage = {
  role: 'human' | 'assistant';
  content: string;
  index: number;
};

type ChunkTranscriptResult = {
  messages: TranscriptMessage[];
  chunks: TranscriptMessage[][];
};

type ChunkTranscriptOpts = {
  pairsPerChunk?: number;
  overlapPairs?: number;
};

const DEFAULT_PAIRS_PER_CHUNK = 12;
const DEFAULT_OVERLAP_PAIRS = 2;

type ParseClaudeTranscript = (raw: string) => TranscriptMessage[];

export const parseClaudeTranscript: ParseClaudeTranscript = (raw) => {
  const messages: TranscriptMessage[] = [];
  const lines = raw.split('\n');
  let currentRole: 'human' | 'assistant' | null = null;
  let currentContent: string[] = [];
  let messageIndex = 0;

  const flush = () => {
    if (currentRole && currentContent.length > 0) {
      messages.push({
        role: currentRole,
        content: currentContent.join('\n').trim(),
        index: messageIndex++,
      });
      currentContent = [];
    }
  };

  for (const line of lines) {
    const humanMatch = /^(?:Human|H|User):\s*(.*)/i.exec(line);
    const assistantMatch = /^(?:Assistant|A):\s*(.*)/i.exec(line);

    if (humanMatch) {
      flush();
      currentRole = 'human';
      if (humanMatch[1]?.trim()) {
        currentContent.push(humanMatch[1]);
      }
    } else if (assistantMatch) {
      flush();
      currentRole = 'assistant';
      if (assistantMatch[1]?.trim()) {
        currentContent.push(assistantMatch[1]);
      }
    } else if (currentRole) {
      currentContent.push(line);
    }
  }

  flush();
  return messages;
};

type ChunkTranscript = (raw: string, opts?: ChunkTranscriptOpts) => ChunkTranscriptResult;

export const chunkTranscript: ChunkTranscript = (raw, opts = {}) => {
  const pairsPerChunk = opts.pairsPerChunk ?? DEFAULT_PAIRS_PER_CHUNK;
  const overlapPairs = opts.overlapPairs ?? DEFAULT_OVERLAP_PAIRS;

  const messages = parseClaudeTranscript(raw);

  // Group into pairs (human + assistant)
  const pairs: TranscriptMessage[][] = [];
  let i = 0;
  while (i < messages.length) {
    const pair: TranscriptMessage[] = [messages[i]!];
    if (i + 1 < messages.length && messages[i]!.role === 'human' && messages[i + 1]!.role === 'assistant') {
      pair.push(messages[i + 1]!);
      i += 2;
    } else {
      i += 1;
    }
    pairs.push(pair);
  }

  // Chunk pairs with overlap
  const chunks: TranscriptMessage[][] = [];
  let start = 0;
  while (start < pairs.length) {
    const end = Math.min(start + pairsPerChunk, pairs.length);
    const chunkMessages = pairs.slice(start, end).flat();
    chunks.push(chunkMessages);

    // Advance past the chunk, minus overlap for context continuity
    const nextStart = end - overlapPairs;
    // Ensure forward progress: always advance at least 1 pair
    start = Math.max(nextStart, start + 1);
    // If we reached the end, stop
    if (end >= pairs.length) {
      break;
    }
  }

  return { messages, chunks };
};
