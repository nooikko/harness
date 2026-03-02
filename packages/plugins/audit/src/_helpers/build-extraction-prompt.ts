// Builds the extraction prompt sent to Claude Haiku to summarize a thread for audit

type Message = {
  role: string;
  content: string;
};

type BuildExtractionPrompt = (messages: Message[]) => string;

export const buildExtractionPrompt: BuildExtractionPrompt = (messages) => {
  const transcript = messages.map((m) => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n\n');

  return `You are extracting information from a conversation that is about to be permanently deleted. This extraction is the ONLY record that will remain.

Extract ALL important information VERY generously. Include:
- Decisions made and their rationale
- Facts stated or established
- User preferences expressed
- Code snippets, commands, or technical configurations
- Tasks mentioned, completed, or in progress
- References to external resources, links, or documents
- Context that might be useful in a future conversation
- Anything that a person might want to remember or refer back to later

Better to over-save than under-save — the user is deleting this thread and this extraction is the only record.

Format the output as structured markdown with clear sections.

--- CONVERSATION TRANSCRIPT ---

${transcript}

--- END TRANSCRIPT ---

Now provide the complete extraction of all important information from this conversation:`;
};
