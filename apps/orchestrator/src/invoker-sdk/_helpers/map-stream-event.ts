// Maps raw SDK messages to InvokeStreamEvent for consumption by plugins

import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { InvokeStreamEvent } from '@harness/plugin-contract';

type MapStreamEvent = (message: SDKMessage) => InvokeStreamEvent;

export const mapStreamEvent: MapStreamEvent = (message) => {
  const base: InvokeStreamEvent = {
    type: message.type,
    timestamp: Date.now(),
    raw: message,
  };

  if (message.type === 'assistant') {
    const assistantMsg = message as SDKMessage & {
      message?: { content?: Array<{ type: string; text?: string; name?: string }> };
    };
    type ContentBlock = { type: string; text?: string; name?: string };
    const blocks: ContentBlock[] = assistantMsg.message?.content ?? [];
    const textBlocks = blocks.filter((b: ContentBlock) => b.type === 'text' && b.text);
    const toolBlocks = blocks.filter((b: ContentBlock) => b.type === 'tool_use' && b.name);

    return {
      ...base,
      content: textBlocks.map((b: ContentBlock) => b.text).join('\n') || undefined,
      toolName: toolBlocks[0]?.name,
    };
  }

  if (message.type === 'tool_progress') {
    const progressMsg = message as SDKMessage & {
      tool_name?: string;
    };
    return {
      ...base,
      toolName: progressMsg.tool_name,
    };
  }

  if (message.type === 'tool_use_summary') {
    const summaryMsg = message as SDKMessage & {
      summary?: string;
    };
    return {
      ...base,
      content: summaryMsg.summary,
    };
  }

  return base;
};
