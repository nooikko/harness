// Prompt assembler — builds the base prompt template before hooks modify it

export type ThreadMeta = {
  threadId: string;
  kind: string;
  name: string | undefined;
};

export type AssembledPrompt = {
  prompt: string;
  threadMeta: ThreadMeta;
};

type FormatThreadHeader = (meta: ThreadMeta) => string;

const formatThreadHeader: FormatThreadHeader = (meta) => {
  const label = meta.name ? `${meta.name} (${meta.kind})` : meta.kind;
  return `[Thread: ${meta.threadId} | ${label}]`;
};

type KindInstructionMap = Record<string, string>;

const KIND_INSTRUCTIONS: KindInstructionMap = {
  primary:
    "You are the user's primary assistant. Be proactive — surface relevant context, suggest follow-ups, and reference prior conversations when useful.",
  task: "You are working on a delegated task. Stay focused on the assigned objective. Report completion clearly when finished.",
  cron: "This is an automated cron invocation. Execute the scheduled task and report results concisely.",
  general: "You are in a general conversation thread. Respond helpfully and stay on topic.",
};

type GetKindInstruction = (kind: string) => string;

const getKindInstruction: GetKindInstruction = (kind) => {
  return KIND_INSTRUCTIONS[kind] ?? KIND_INSTRUCTIONS.general ?? "";
};

type AssemblePrompt = (message: string, meta: ThreadMeta) => AssembledPrompt;

export const assemblePrompt: AssemblePrompt = (message, meta) => {
  const header = formatThreadHeader(meta);
  const instruction = getKindInstruction(meta.kind);

  const sections = [header, instruction, `## User Message\n\n${message}`];

  const prompt = sections.join("\n\n");

  return { prompt, threadMeta: meta };
};
