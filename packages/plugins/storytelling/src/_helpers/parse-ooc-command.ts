type OocCommandType = 'rename' | 'knowledge' | 'personality' | 'remove' | 'color' | 'time' | 'location' | 'unknown';

type OocCommand = {
  type: OocCommandType;
  params: Record<string, string | undefined>;
};

type ParseOocCommand = (content: string) => OocCommand;

const extractQuotedStrings = (text: string): string[] => {
  const matches = text.match(/["']([^"']+)["']/g);
  if (!matches) {
    return [];
  }
  return matches.map((m) => m.slice(1, -1));
};

export const parseOocCommand: ParseOocCommand = (content) => {
  const lower = content.toLowerCase();

  // "rename" + quoted strings → { from, to }
  if (lower.includes('rename')) {
    const quoted = extractQuotedStrings(content);
    return {
      type: 'rename',
      params: {
        from: quoted[0] ?? '',
        to: quoted[1] ?? '',
      },
    };
  }

  // "doesn't know" or "does not know" → knowledge correction
  if (lower.includes("doesn't know") || lower.includes('does not know')) {
    const parts = content.split(/doesn'?t know|does not know/i);
    const characterPart = (parts[0] ?? '').trim();
    const topicPart = (parts[1] ?? '').trim();
    return {
      type: 'knowledge',
      params: {
        character: characterPart,
        topic: topicPart,
      },
    };
  }

  // "make" + "more" or "less" → personality adjustment
  if (lower.includes('make') && (lower.includes('more') || lower.includes('less'))) {
    const makeMatch = content.match(/make\s+(.+?)\s+(more|less)\s+(.+)/i);
    return {
      type: 'personality',
      params: {
        character: makeMatch?.[1] ?? '',
        trait: makeMatch ? `${makeMatch[2]} ${makeMatch[3]}` : '',
      },
    };
  }

  // "remove" + "from the story"
  if (lower.includes('remove') && lower.includes('from the story')) {
    const removeMatch = content.match(/remove\s+(.+?)\s+from the story/i);
    return {
      type: 'remove',
      params: {
        character: removeMatch?.[1] ?? '',
      },
    };
  }

  // "color"
  if (lower.includes('color')) {
    const quoted = extractQuotedStrings(content);
    return {
      type: 'color',
      params: {
        characters: quoted.join(', '),
      },
    };
  }

  // "it's now" or "its now" or "time is"
  if (lower.includes("it's now") || lower.includes('its now') || lower.includes('time is')) {
    const timeMatch = content.match(/(?:it'?s now|its now|time is)\s+(.+)/i);
    return {
      type: 'time',
      params: {
        time: (timeMatch?.[1] ?? '').trim(),
      },
    };
  }

  // "we're at" or "we are at"
  if (lower.includes("we're at") || lower.includes('we are at')) {
    const locMatch = content.match(/(?:we're at|we are at)\s+(.+)/i);
    return {
      type: 'location',
      params: {
        location: (locMatch?.[1] ?? '').trim(),
      },
    };
  }

  return { type: 'unknown', params: {} };
};
